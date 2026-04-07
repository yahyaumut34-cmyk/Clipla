// useMicrophone.js'den çevrildi
// STT zinciri: speech_to_text (on-device) → backend /api/stt/transcribe (fallback)
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import '../api/api_service.dart';

enum SttMode { onDevice, backend, unavailable }

class SttService extends ChangeNotifier {
  final stt.SpeechToText _stt = stt.SpeechToText();
  final AudioRecorder _recorder = AudioRecorder();

  bool _available = false;
  bool _listening = false;
  String _interim = '';
  SttMode _mode = SttMode.unavailable;
  bool _onDeviceAvail = false;

  bool get available  => _available;
  bool get listening  => _listening;
  String get interim  => _interim;
  SttMode get mode    => _mode;

  /// Uygulama başlangıcında çağrılır
  Future<void> init() async {
    try {
      _onDeviceAvail = await _stt.initialize(
        onError: (e) => debugPrint('[SttService] on-device error: $e'),
        debugLogging: false,
      );
    } catch (_) {
      _onDeviceAvail = false;
    }

    if (_onDeviceAvail) {
      _mode = SttMode.onDevice;
      _available = true;
    } else {
      // Mic permission kontrolü — backend fallback için kayıt gerekli
      final hasPermission = await _recorder.hasPermission();
      if (hasPermission) {
        _mode = SttMode.backend;
        _available = true;
      }
    }
    notifyListeners();
  }

  /// Mikrofonu başlatır, transcript gelince onResult çağrılır
  Future<void> startListening({
    required void Function(String text) onResult,
    String locale = 'tr-TR',
  }) async {
    if (_listening) return;

    if (_onDeviceAvail) {
      await _startOnDevice(onResult: onResult, locale: locale);
    } else {
      await _startBackend();
    }
  }

  /// Dinlemeyi durdurur; on-device'ta sonuç otomatik gelir, backend'de STT çağrılır
  Future<void> stopListening({void Function(String text)? onResult}) async {
    if (!_listening) return;

    if (_onDeviceAvail) {
      await _stt.stop();
      // Sonuç onResult callback via _startOnDevice tarafından zaten iletildi
    } else {
      await _stopBackend(onResult: onResult);
    }
  }

  // ── On-device (speech_to_text) ───────────────────────────────────────────

  Future<void> _startOnDevice({
    required void Function(String text) onResult,
    required String locale,
  }) async {
    _listening = true;
    _interim = '';
    notifyListeners();

    await _stt.listen(
      localeId: locale,
      listenMode: stt.ListenMode.confirmation,
      onResult: (result) {
        if (result.finalResult) {
          final text = result.recognizedWords.trim();
          _listening = false;
          _interim = '';
          notifyListeners();
          if (text.isNotEmpty) {
            onResult(text);
          }
          // Boş sonuç → backend fallback tetikle
        } else {
          _interim = result.recognizedWords;
          notifyListeners();
        }
      },
      listenFor: const Duration(seconds: 30),
      pauseFor: const Duration(seconds: 3),
      cancelOnError: true,
    );
  }

  // ── Backend fallback (record + /api/stt/transcribe) ──────────────────────

  String? _recordPath;

  Future<void> _startBackend() async {
    _listening = true;
    _interim = 'Dinliyorum...';
    notifyListeners();

    final tmpDir = await getTemporaryDirectory();
    _recordPath = '${tmpDir.path}/stt_record_${DateTime.now().millisecondsSinceEpoch}.m4a';

    await _recorder.start(
      const RecordConfig(encoder: AudioEncoder.aacLc, bitRate: 128000, sampleRate: 44100),
      path: _recordPath!,
    );
  }

  Future<void> _stopBackend({void Function(String text)? onResult}) async {
    _listening = false;
    _interim = 'Ses gönderiliyor...';
    notifyListeners();

    try {
      final path = await _recorder.stop();
      _interim = '';
      notifyListeners();

      if (path == null || path.isEmpty) return;

      final data = await transcribeAudio(path, 'tr-TR');
      final text = ((data['text'] ?? data['transcript'] ?? '') as String).trim();
      if (text.isNotEmpty) {
        onResult?.call(text);
      }
    } catch (e) {
      debugPrint('[SttService] backend STT error: $e');
      _interim = '';
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _stt.stop();
    _recorder.dispose();
    super.dispose();
  }
}
