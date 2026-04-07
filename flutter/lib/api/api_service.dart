// api.js'den çevrildi
import 'dart:io';
import 'package:dio/dio.dart';

// ── Base URL seçimi ──────────────────────────────────────────────────────────
// Production build için --dart-define kullanın:
//   flutter build apk --dart-define=BACKEND_URL=https://api.clipla.com
//   flutter build appbundle --dart-define=BACKEND_URL=https://api.clipla.com
const String _kProductionUrl   = String.fromEnvironment('BACKEND_URL', defaultValue: '');
const String _kBaseWeb         = 'http://127.0.0.1:8000';
const String _kDefaultMobile   = 'http://192.168.1.6:8000';
const String _kAndroidEmulator = 'http://10.0.2.2:8000';
const String _kIosSimulator    = 'http://127.0.0.1:8000';
const int    kWarnBytes        = 300 * 1024 * 1024;
const int    kMaxBytes         = 800 * 1024 * 1024;

// API Authentication
// Production build için --dart-define=API_KEY=... kullanın
const String _kApiKey = String.fromEnvironment('API_KEY', defaultValue: 'clipla-dev-key-degistir');

String get kBaseUrl {
  // --dart-define ile production URL tanımlandıysa onu kullan
  if (_kProductionUrl.isNotEmpty) return _kProductionUrl;
  if (Platform.isAndroid) return _kDefaultMobile;
  if (Platform.isIOS)     return _kIosSimulator;
  return _kBaseWeb;
}

Map<String, String> get _authHeaders => {
  'Authorization': 'Bearer $_kApiKey',
  'Content-Type': 'application/json',
};

String toAbsoluteUrl(String path) {
  if (path.isEmpty) return '';
  if (path.startsWith('http')) return path;
  return '$kBaseUrl$path';
}

String bustCache(String url) {
  if (url.isEmpty) return '';
  return '$url?t=${DateTime.now().millisecondsSinceEpoch}';
}

// Dio instance — connection timeout 5 dakika (büyük dosyalar)
final _dio = Dio(BaseOptions(
  connectTimeout: const Duration(seconds: 30),
  receiveTimeout: const Duration(minutes: 10),
  sendTimeout: const Duration(minutes: 5),
  headers: {
    'Authorization': 'Bearer $_kApiKey',
  },
));

// ── Video Upload (progress callback ile) ────────────────────────────────────

Future<Map<String, dynamic>> uploadVideoWithProgress(
  String filePath,
  String fileName,
  String mimeType,
  int fileSize,
  void Function(int percent)? onProgress,
) async {
  if (fileSize > kMaxBytes) {
    throw Exception('Video çok büyük: ${(fileSize / 1024 / 1024).toStringAsFixed(0)} MB (max 800 MB).');
  }

  final formData = FormData.fromMap({
    'file': await MultipartFile.fromFile(
      filePath,
      filename: fileName,
      contentType: DioMediaType.parse(mimeType),
    ),
  });

  final response = await _dio.post(
    '$kBaseUrl/api/video/upload',
    data: formData,
    onSendProgress: (sent, total) {
      if (total > 0) {
        final pct = (sent / total * 100).round().clamp(0, 100);
        onProgress?.call(pct);
      }
    },
  );

  final data = response.data as Map<String, dynamic>;
  if (data['job_id'] == null) throw Exception('job_id alınamadı');
  return data;
}

// ── Chat ────────────────────────────────────────────────────────────────────

Future<Map<String, dynamic>> sendChatMessage({
  required String message,
  required List<Map<String, String>> history,
  required String jobId,
  String language = 'tr-TR',
}) async {
  final response = await _dio.post(
    '$kBaseUrl/api/chat',
    data: {
      'message': message,
      'history': history,
      'job_id': jobId,
      'language': language,
    },
  );
  return response.data as Map<String, dynamic>;
}

// ── Auto Edit ───────────────────────────────────────────────────────────────

Future<Map<String, dynamic>> autoEdit(
  String jobId, {
  String commandText = '',
  String platform = 'youtube',
  double? targetDurationSec,
  bool removeFillers = false,
  bool preserveRhythm = true,
}) async {
  final response = await _dio.post(
    '$kBaseUrl/api/auto-edit/$jobId',
    data: {
      'command_text':        commandText,
      'platform':            platform,
      'target_duration_sec': targetDurationSec,
      'remove_fillers':      removeFillers,
      'preserve_rhythm':     preserveRhythm,
    },
  );
  return response.data as Map<String, dynamic>;
}

// ── Status Polling ──────────────────────────────────────────────────────────

Future<Map<String, dynamic>> getAutoEditStatus(String jobId) async {
  final response = await _dio.get('$kBaseUrl/api/auto-edit/$jobId/status');
  return response.data as Map<String, dynamic>;
}

// ── Generate Shorts ─────────────────────────────────────────────────────────

Future<Map<String, dynamic>> generateShorts(
  String jobId, {
  int topN = 5,
  bool reencode = false,
  bool semanticAnalysis = true,
  bool requireCompleteness = true,
  bool detectEmotionalPeak = true,
}) async {
  final response = await _dio.post(
    '$kBaseUrl/api/shorts/$jobId',
    data: {
      'top_n':                topN,
      'reencode':             reencode,
      'semantic_analysis':    semanticAnalysis,
      'require_completeness': requireCompleteness,
      'detect_emotional_peak': detectEmotionalPeak,
    },
  );
  return response.data as Map<String, dynamic>;
}

// ── Generate Subtitles ──────────────────────────────────────────────────────

Future<Map<String, dynamic>> generateSubtitles(
  String jobId, {
  String language = 'tr',
  bool burnIn = true,
  int fontSize = 16,
  String position = 'bottom',
}) async {
  final response = await _dio.post(
    '$kBaseUrl/api/subtitles/$jobId',
    data: {
      'language':  language,
      'burn_in':   burnIn,
      'font_size': fontSize,
      'position':  position,
    },
  );
  return response.data as Map<String, dynamic>;
}

// ── Apply Effect ────────────────────────────────────────────────────────────

Future<Map<String, dynamic>> applyEffect(
  String jobId, {
  required String category,
  double intensity = 0.8,
  double? timestamp,
}) async {
  final response = await _dio.post(
    '$kBaseUrl/api/effects/$jobId',
    data: {
      'category':  category,
      'intensity': intensity,
      'timestamp': timestamp,
    },
  );
  return response.data as Map<String, dynamic>;
}

// ── Add Sound Effect ────────────────────────────────────────────────────────

Future<Map<String, dynamic>> addSoundEffect(
  String jobId, {
  required String sfxType,
  double? timestamp,
  double volume = 0.85,
}) async {
  final response = await _dio.post(
    '$kBaseUrl/api/sfx/$jobId',
    data: {
      'sfx_type':  sfxType,
      'timestamp': timestamp,
      'volume':    volume,
    },
  );
  return response.data as Map<String, dynamic>;
}

// ── Add Background Music ─────────────────────────────────────────────────────

Future<Map<String, dynamic>> addMusic(
  String jobId, {
  required String mood,
  double startTime = 0.0,
  double? endTime,
  double volume = 0.22,
}) async {
  final response = await _dio.post(
    '$kBaseUrl/api/music/$jobId',
    data: {
      'mood':       mood,
      'start_time': startTime,
      'end_time':   endTime,
      'volume':     volume,
    },
  );
  return response.data as Map<String, dynamic>;
}

// ── STT Transcribe ──────────────────────────────────────────────────────────

Future<Map<String, dynamic>> transcribeAudio(
  String filePath,
  String language,
) async {
  final filename = filePath.split('/').last;
  final formData = FormData.fromMap({
    'file':     await MultipartFile.fromFile(filePath, filename: filename),
    'language': language.split('-').first, // 'tr-TR' → 'tr'
  });

  final response = await _dio.post(
    '$kBaseUrl/api/stt/transcribe',
    data: formData,
  );
  return response.data as Map<String, dynamic>;
}
