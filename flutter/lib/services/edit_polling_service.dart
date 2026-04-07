// useEditPolling.js'den çevrildi
import 'dart:async';
import 'package:flutter/foundation.dart';
import '../api/api_service.dart';
import '../models/edit_result.dart';
import 'tts_service.dart';

const Duration _kPollInterval = Duration(seconds: 4);
const Duration _kTimeout      = Duration(minutes: 5);

const Map<String, String> _kStatusLabels = {
  'pending':    'Sıraya alındı...',
  'queued':     'Sıraya alındı...',
  'processing': 'İşleniyor...',
  'analyzing':  'Ses analiz ediliyor...',
  'cutting':    'Kesimler uygulanıyor...',
  'rendering':  'Video render ediliyor...',
  'done':       'Tamamlandı!',
  'completed':  'Tamamlandı!',
  'error':      'Hata oluştu',
  'failed':     'Hata oluştu',
};

class EditPollingService extends ChangeNotifier {
  final TtsService _tts;

  EditPollingService(this._tts);

  bool _loading = false;
  String _progress = '';
  Timer? _timer;
  bool _pollActive = false;
  DateTime? _startedAt;
  String _lastSpokenStatus = '';
  int _lastSpokenProgress = 0;

  bool get loading => _loading;
  String get progress => _progress;

  void _stopPolling() {
    _timer?.cancel();
    _timer = null;
    _pollActive = false;
  }

  String _formatProgress(Map<String, dynamic> data) {
    final status = data['status'] as String? ?? '';
    final label  = _kStatusLabels[status] ?? 'İşleniyor...';
    final pct    = data['progress'] != null ? ' %${(data['progress'] as num).round()}' : '';
    final step   = data['step'] != null ? ' — ${data['step']}' : '';
    return '$label$pct$step';
  }

  Future<void> startEdit({
    required String jobId,
    required void Function(EditResult result) onDone,
    required void Function(Exception error) onError,
    String commandText = '',
    String platform = 'youtube',
    double? targetDurationSec,
    String? subtitleLang,
    bool removeFillers = false,
    bool preserveRhythm = true,
  }) async {
    _stopPolling();
    _loading = true;
    _progress = 'Başlatılıyor...';
    _lastSpokenStatus = '';
    _lastSpokenProgress = 0;
    notifyListeners();

    _tts.speak('Düzenleme başladı');
    _startedAt = DateTime.now();

    try {
      final initialData = await autoEdit(
        jobId,
        commandText: commandText,
        platform: platform,
        targetDurationSec: targetDurationSec,
        removeFillers: removeFillers,
        preserveRhythm: preserveRhythm,
      );

      final status = initialData['status'] as String? ?? '';
      if (status == 'done' || status == 'completed' ||
          initialData['download_url'] != null || initialData['output_url'] != null) {
        await _applySubtitleAndFinish(
          jobId: jobId,
          data: initialData,
          subtitleLang: subtitleLang,
          onDone: onDone,
        );
        return;
      }

      _progress = _formatProgress(initialData);
      notifyListeners();

      _timer = Timer.periodic(_kPollInterval, (timer) async {
        if (DateTime.now().difference(_startedAt!) > _kTimeout) {
          _stopPolling();
          _loading = false;
          _progress = '';
          notifyListeners();
          onError(Exception('İşlem zaman aşımına uğradı (5 dakika)'));
          return;
        }

        if (_pollActive) return;
        _pollActive = true;
        try {
          final statusData = await getAutoEditStatus(jobId);
          _progress = _formatProgress(statusData);
          notifyListeners();

          // Voice milestone feedback
          final currentStatus   = statusData['status'] as String? ?? '';
          final currentProgress = (statusData['progress'] as num?)?.toDouble() ?? 0;

          if (currentStatus != _lastSpokenStatus) {
            final label = _kStatusLabels[currentStatus] ?? 'İşleniyor...';
            _tts.speak(label.replaceAll('%', 'yüzde'));
            _lastSpokenStatus = currentStatus;
          }
          if (currentProgress >= 25 && _lastSpokenProgress < 25) {
            _tts.speak('Yüzde 25 tamamlandı');
            _lastSpokenProgress = 25;
          } else if (currentProgress >= 50 && _lastSpokenProgress < 50) {
            _tts.speak('Yüzde 50 tamamlandı');
            _lastSpokenProgress = 50;
          } else if (currentProgress >= 75 && _lastSpokenProgress < 75) {
            _tts.speak('Yüzde 75 tamamlandı');
            _lastSpokenProgress = 75;
          }

          if (currentStatus == 'done' || currentStatus == 'completed' ||
              statusData['download_url'] != null || statusData['output_url'] != null) {
            _stopPolling();
            await _applySubtitleAndFinish(
              jobId: jobId,
              data: statusData,
              subtitleLang: subtitleLang,
              onDone: onDone,
            );
          } else if (currentStatus == 'error' || currentStatus == 'failed') {
            _stopPolling();
            _loading = false;
            _progress = '';
            notifyListeners();
            onError(Exception(statusData['error'] ?? statusData['detail'] ?? 'İşlem başarısız'));
          }
        } catch (e) {
          debugPrint('[EditPollingService] poll error: $e');
        } finally {
          _pollActive = false;
        }
      });
    } catch (e) {
      _stopPolling();
      _loading = false;
      _progress = '';
      notifyListeners();
      onError(Exception(e.toString()));
    }
  }

  Future<void> _applySubtitleAndFinish({
    required String jobId,
    required Map<String, dynamic> data,
    required String? subtitleLang,
    required void Function(EditResult result) onDone,
  }) async {
    var result = EditResult.fromJson(data);
    result = result.copyWith(suggestedSubtitleLang: subtitleLang);

    if (subtitleLang != null) {
      try {
        final subData = await generateSubtitles(jobId, language: subtitleLang);
        final videoUrl = subData['video_url'] as String?;
        if (videoUrl != null) {
          final absUrl = toAbsoluteUrl(videoUrl);
          result = result.copyWith(
            downloadUrl: absUrl,
            outputUrl: absUrl,
            autoSubtitleApplied: true,
            autoSubtitleLanguage: subtitleLang,
          );
        }
      } catch (e) {
        debugPrint('[EditPollingService] subtitle error: $e');
      }
    }

    _loading = false;
    _progress = '';
    notifyListeners();
    _tts.speak('Düzenleme tamamlandı');
    onDone(result);
  }

  @override
  void dispose() {
    _stopPolling();
    super.dispose();
  }
}
