// useTTS.js'den çevrildi
import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';

const List<String> _kStableFemaleVoicePrefs = [
  'Google Türkçe',
  'Microsoft Zira Desktop - Turkish',
  'Microsoft Zira Online - Turkish',
  'tr-TR-Standard-A',
  'tr-TR-Standard-B',
  'tr-TR-Wavenet-A',
  'tr-TR-Wavenet-B',
  'Turkish Female',
  'Turkish',
];

const List<String> _kFemaleVoiceHints = [
  'female', 'woman', 'lady', 'kadın', 'zeynep', 'aylin', 'meltem',
  'seray', 'burcu', 'deniz', 'seda', 'yasemin', 'emine', 'yıldız',
  'selin', 'beren', 'eda', 'nisa', 'öykü', 'dilara', 'feza',
];

class TtsService extends ChangeNotifier {
  final FlutterTts _tts = FlutterTts();
  bool _speaking = false;
  Map<String, String>? _preferredVoice;

  bool get speaking => _speaking;

  Future<void> init({String language = 'tr-TR'}) async {
    await _tts.setLanguage(language);
    await _tts.setSpeechRate(0.95);
    await _tts.setPitch(1.0);
    await _tts.setVolume(1.0);

    _tts.setStartHandler(() {
      _speaking = true;
      notifyListeners();
    });
    _tts.setCompletionHandler(() {
      _speaking = false;
      notifyListeners();
    });
    _tts.setErrorHandler((msg) {
      _speaking = false;
      notifyListeners();
    });

    await _selectBestVoice(language);
  }

  Future<void> _selectBestVoice(String language) async {
    try {
      final voices = await _tts.getVoices as List?;
      if (voices == null || voices.isEmpty) return;

      final voiceMaps = voices.cast<Map>();
      final shortLang = language.split('-').first.toLowerCase();

      // Aynı dildeki sesler
      final sameLang = voiceMaps.where((v) {
        final locale = (v['locale'] ?? v['lang'] ?? '').toString().toLowerCase();
        return locale.startsWith(shortLang);
      }).toList();

      // 1. Öncelik: stabil tercih listesinden biri
      Map? best = _findStable(sameLang);
      // 2. Kadın sesi
      best ??= _findFemale(sameLang);
      // 3. Herhangi aynı dil sesi
      if (best == null && sameLang.isNotEmpty) best = sameLang.first;
      // 4. Herhangi ses
      if (best == null && voiceMaps.isNotEmpty) best = voiceMaps.first;

      if (best != null) {
        _preferredVoice = Map<String, String>.from(
          best.map((k, v) => MapEntry(k.toString(), v.toString())),
        );
        await _tts.setVoice(_preferredVoice!);
      }
    } catch (_) {
      // Ses listesi alınamazsa varsayılan kalır
    }
  }

  Map? _findStable(List<Map> voices) {
    for (final pref in _kStableFemaleVoicePrefs) {
      final found = voices.where((v) {
        final name = (v['name'] ?? '').toString().toLowerCase();
        return name.contains(pref.toLowerCase());
      }).firstOrNull;
      if (found != null) return found;
    }
    return null;
  }

  Map? _findFemale(List<Map> voices) {
    return voices.where((v) {
      final name = (v['name'] ?? '').toString().toLowerCase();
      return _kFemaleVoiceHints.any((h) => name.contains(h));
    }).firstOrNull;
  }

  /// Metni seslendir. Emoji ve markdown'ı filtreler.
  Future<void> speak(String text, {VoidCallback? onDone, String? language}) async {
    final filtered = _stripForTTS(text);
    if (filtered.trim().isEmpty) { onDone?.call(); return; }

    if (_speaking) {
      await _tts.stop();
    }

    if (language != null && language.isNotEmpty) {
      await _tts.setLanguage(language);
      await _selectBestVoice(language);
    }

    await _tts.speak(filtered);

    if (onDone != null) {
      _tts.setCompletionHandler(() {
        _speaking = false;
        notifyListeners();
        onDone();
      });
    }
  }

  Future<void> cancel() async {
    await _tts.stop();
    _speaking = false;
    notifyListeners();
  }

  /// Emoji (Unicode 15.1 kapsamlı) + markdown biçimlendirmesini kaldırır.
  String _stripForTTS(String text) {
    // Emoji aralıkları
    var result = text.replaceAll(
      RegExp(
        r'[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]'
        r'|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]'
        r'|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]'
        r'|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]'
        r'|[\u{2300}-\u{23FF}]|[\u{2B00}-\u{2BFF}]|[\u{FE00}-\u{FE0F}]|\u{200D}',
        unicode: true,
      ),
      '',
    );
    // Markdown biçimlendirme
    result = result.replaceAll(RegExp(r'\*{1,2}|_{1,2}|`{1,3}|#{1,6}\s|---+|\|'), '');
    // Çoklu boşluk
    result = result.replaceAll(RegExp(r'\s{2,}'), ' ');
    return result.trim();
  }

  @override
  void dispose() {
    _tts.stop();
    super.dispose();
  }
}
