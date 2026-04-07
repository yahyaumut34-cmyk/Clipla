// shared/constants.js'den çevrildi

const Map<String, String> kSubLangs = {
  'tr': 'Türkçe',
  'en': 'İngilizce',
  'de': 'Almanca',
  'fr': 'Fransızca',
  'es': 'İspanyolca',
  'pt': 'Portekizce',
  'ru': 'Rusça',
  'zh': 'Çince',
  'ja': 'Japonca',
  'ar': 'Arapça',
};

const Map<String, String> kPlatLabels = {
  'youtube_shorts': 'Shorts',
  'tiktok':         'TikTok',
  'youtube':        'YouTube',
};

const List<String> kBasicSubtitleLangs = ['tr', 'en'];

const List<String> kProAdvancedSubtitleLangs = ['de', 'fr', 'es', 'pt', 'ru', 'zh', 'ja', 'ar'];

/// Sadece "başlat" tetikleyici sözcükler — gerçek komut değil
bool isStartCommand(String text) {
  final t = text.toLowerCase().trim().replaceAll(RegExp(r'[.,!?]$'), '');
  const tr = ['başla', 'yap', 'tamam', 'evet', 'ok', 'devam', 'git', 'başlayabilirsin'];
  const en = ['start', 'go', 'yes', 'ok', 'proceed', 'do it', 'confirm', "let's go"];
  return tr.contains(t) || en.contains(t);
}

String mergeCommand(String prev, String next) {
  final a = prev.trim();
  final b = next.trim();
  if (a.isEmpty) return b;
  if (b.isEmpty) return a;
  if (a.contains(b)) return a;
  return '$a, $b';
}

String? detectSubtitleLang(String text) {
  final t = text.toLowerCase();
  if (t.contains('alman') || t.contains('deutsch') || t.contains('german')) return 'de';
  if (t.contains('ingiliz') || t.contains('english')) return 'en';
  if (t.contains('fransız') || t.contains('french') || t.contains('français')) return 'fr';
  if (t.contains('ispanyol') || t.contains('spanish') || t.contains('español')) return 'es';
  if (t.contains('portekiz') || t.contains('portuguese') || t.contains('português')) return 'pt';
  if (t.contains('rusça') || t.contains('russian') || t.contains('rus ')) return 'ru';
  if (t.contains('çince') || t.contains('chinese') || t.contains('mandarin')) return 'zh';
  if (t.contains('japonca') || t.contains('japanese')) return 'ja';
  if (t.contains('arapça') || t.contains('arabic')) return 'ar';
  if (t.contains('türkçe') || t.contains('turkish')) return 'tr';
  return null;
}

// Voice keyword helpers — StepChat.js'den çevrildi
bool isConfirmWord(String text) {
  return RegExp(r'^(evet|yes|başla|başlat|tamam|onayla|yap|ok|olur)\b', caseSensitive: false)
      .hasMatch(text.trim());
}

bool isRejectWord(String text) {
  return RegExp(r'^(hayır|hayir|no|dur|değiştir|degistir|iptal|vazgeç|vazgec)\b', caseSensitive: false)
      .hasMatch(text.trim());
}

bool isShortsCmd(String text) {
  return RegExp(r'(shorts|kısa klip|kısa video|short klip)\b', caseSensitive: false)
      .hasMatch(text);
}

bool isApplyEffectCmd(String text) {
  return RegExp(r'\b(uygula|efekt uygula|apply|evet uygula|ekle|koy|yerleştir)\b', caseSensitive: false)
      .hasMatch(text);
}

bool isEffectAutoApplyCmd(String text) {
  return RegExp(r'\b(uygula|ekle|koy|yerleştir|apply)\b', caseSensitive: false).hasMatch(text) &&
      RegExp(r'\b(kahkaha|gülüş|alkış|komik|komedi|şok|gerilim|epik|fail|başarısız|vurgu)\b', caseSensitive: false)
          .hasMatch(text);
}

bool isIntensityIncreaseCmd(String text) {
  return RegExp(r'(yoğunluk artır|daha fazla yoğunluk|arttır yoğunluk|yükselt yoğunluk|güçlendir)\b',
          caseSensitive: false)
      .hasMatch(text);
}

bool isIntensityDecreaseCmd(String text) {
  return RegExp(r'(yoğunluk azalt|azalt yoğunluk|düşür yoğunluk|hafiflet yoğunluk|yumuşat)\b',
          caseSensitive: false)
      .hasMatch(text);
}

bool isSubtitleLangCmd(String text) {
  return RegExp(r'\b(altyazı|alt yazı|subtitle|subtitles)\b', caseSensitive: false)
      .hasMatch(text);
}

// ── SFX & Müzik ─────────────────────────────────────────────────────────────

const Map<String, String> kSfxKeywordMap = {
  'gülüş sesi':   'laugh',
  'kahkaha':      'laugh',
  'güldür':       'laugh',
  'alkışlama':    'applause',
  'el çırp':      'applause',
  'alkış':        'applause',
  'borazan':      'airhorn',
  'düdük':        'airhorn',
  'geçiş sesi':   'whoosh',
  'woş':          'whoosh',
  'üzgün trompet':'sad_trombone',
  'fiyasko':      'sad_trombone',
  'davul sesi':   'drum_hit',
  'davul':        'drum_hit',
  'boom':         'drum_hit',
  'zil sesi':     'bell',
  'zil':          'bell',
  'çan':          'bell',
  'ding':         'bell',
  'pop':          'pop',
  'uyarı sesi':   'beep',
  'bip':          'beep',
  'tezahürat':    'crowd_cheer',
  'bravo':        'crowd_cheer',
  'coşku':        'crowd_cheer',
  'yaşa':         'crowd_cheer',
};

const Map<String, String> kMusicMoodMap = {
  'hızlı müzik':  'energetic',
  'enerjik':      'energetic',
  'dinamik':      'energetic',
  'huzurlu':      'calm',
  'sakin':        'calm',
  'rahat':        'calm',
  'minimal':      'minimal',
  'sade':         'minimal',
  'tempolu':      'rhythmic',
  'ritmik':       'rhythmic',
  'ritimli':      'rhythmic',
  'ağır':         'slow',
  'yavaş':        'slow',
};

const Map<String, String> kSfxLabels = {
  'laugh':        'Kahkaha',
  'applause':     'Alkış',
  'airhorn':      'Düdük',
  'whoosh':       'Geçiş Sesi',
  'sad_trombone': 'Üzgün Trompet',
  'drum_hit':     'Davul',
  'bell':         'Zil',
  'pop':          'Pop',
  'beep':         'Bip',
  'crowd_cheer':  'Coşku',
};

const Map<String, String> kMusicLabels = {
  'calm':      'Sakin',
  'energetic': 'Enerjik',
  'minimal':   'Minimal',
  'rhythmic':  'Ritmik',
  'slow':      'Yavaş',
};

/// Metinden SFX komutu çıkar. Döndürür: {sfx_type, timestamp} veya null.
Map<String, dynamic>? parseSfxCommand(String text) {
  final lower = text.toLowerCase();
  final keys = kSfxKeywordMap.keys.toList()
    ..sort((a, b) => b.length.compareTo(a.length)); // uzun önce
  for (final kw in keys) {
    if (lower.contains(kw)) {
      return {
        'sfx_type':  kSfxKeywordMap[kw]!,
        'timestamp': parseTimeToken(text),
      };
    }
  }
  return null;
}

/// Metinden müzik komutu çıkar. Döndürür: {mood, start_time} veya null.
Map<String, dynamic>? parseMusicCommand(String text) {
  final lower = text.toLowerCase();
  if (!RegExp(r'\b(müzik|şarkı|background music)\b').hasMatch(lower)) return null;
  final keys = kMusicMoodMap.keys.toList()
    ..sort((a, b) => b.length.compareTo(a.length));
  String mood = 'calm';
  for (final kw in keys) {
    if (lower.contains(kw)) { mood = kMusicMoodMap[kw]!; break; }
  }
  return {'mood': mood, 'start_time': 0.0};
}

/// Metinden saniye cinsinden zaman çıkar.
double? parseTimeToken(String text) {
  final t = text.toLowerCase();
  // "X dakika Y saniye"
  final ms = RegExp(r'(\d+)\s*dakika\s*(\d+)\s*saniye').firstMatch(t);
  if (ms != null) {
    return double.parse(ms.group(1)!) * 60 + double.parse(ms.group(2)!);
  }
  // "X:Y"
  final col = RegExp(r'(\d+):(\d{1,2})').firstMatch(t);
  if (col != null) {
    return double.parse(col.group(1)!) * 60 + double.parse(col.group(2)!);
  }
  // "X saniye" veya "X sn"
  final sec = RegExp(r'(\d+)\s*\.?\s*saniye|(\d+)\s*sn\b').firstMatch(t);
  if (sec != null) {
    return double.parse((sec.group(1) ?? sec.group(2))!);
  }
  return null;
}
