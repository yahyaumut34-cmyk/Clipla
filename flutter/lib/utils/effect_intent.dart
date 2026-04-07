// useEffectIntent.js'den çevrildi — saf Dart, Flutter bağımlılığı yok

class EffectCategory {
  final String category;
  final String label;
  final String emoji;
  final int color; // ARGB int
  final List<String> keywords;
  final String description;
  final double intensity;

  const EffectCategory({
    required this.category,
    required this.label,
    required this.emoji,
    required this.color,
    required this.keywords,
    required this.description,
    this.intensity = 0.7,
  });

  EffectCategory copyWithIntensity(double newIntensity) {
    return EffectCategory(
      category: category,
      label: label,
      emoji: emoji,
      color: color,
      keywords: keywords,
      description: description,
      intensity: newIntensity,
    );
  }
}

const kEffectCategories = <String, EffectCategory>{
  'impact_shock': EffectCategory(
    category: 'impact_shock',
    label: 'Şok Etkisi',
    emoji: '💥',
    color: 0xFFF87171,
    keywords: ['şok', 'sürpriz', 'beklenmedik', 'vay', 'şaşırt', 'wow', 'shock', 'surprised', 'unexpected'],
    description: 'Dramatik vurgu, güçlü ses efekti',
  ),
  'comedy_reaction': EffectCategory(
    category: 'comedy_reaction',
    label: 'Komedi Tepkisi',
    emoji: '😂',
    color: 0xFFFFD166,
    keywords: ['komik', 'güldür', 'eğlenceli', 'şaka', 'funny', 'laugh', 'hilarious', 'gülünç', 'mizah'],
    description: 'Kahkaha efekti, komedi zamanlaması',
  ),
  'tension_build': EffectCategory(
    category: 'tension_build',
    label: 'Gerilim',
    emoji: '😰',
    color: 0xFF8B5CF6,
    keywords: ['gerilim', 'heyecan', 'korku', 'beklenti', 'suspense', 'tension', 'thriller', 'dramatic'],
    description: 'Gerilim artışı, müzik yükselmesi',
  ),
  'crowd_laugh': EffectCategory(
    category: 'crowd_laugh',
    label: 'Kahkaha',
    emoji: '🎭',
    color: 0xFF1DB974,
    keywords: ['kahkaha', 'gülüş', 'alkış', 'crowd', 'applause', 'audience', 'izleyici', 'salon'],
    description: 'Kalabalık sesi, alkış efekti',
  ),
  'impact_emphasis': EffectCategory(
    category: 'impact_emphasis',
    label: 'Vurgu',
    emoji: '⚡',
    color: 0xFFE05C2A,
    keywords: ['vurgu', 'önemli', 'dikkat', 'emphasis', 'highlight', 'important', 'kritik', 'anahtar'],
    description: 'Ses vurgusu, görsel flash',
  ),
  'fail_tone': EffectCategory(
    category: 'fail_tone',
    label: 'Başarısızlık',
    emoji: '🎺',
    color: 0xFF94A3B8,
    keywords: ['başarısız', 'olmadı', 'kötü', 'fail', 'wrong', 'sad trombone', 'rezalet', 'felaket'],
    description: 'Hüzünlü trompet, aksaklık efekti',
  ),
  'epic_moment': EffectCategory(
    category: 'epic_moment',
    label: 'Epik An',
    emoji: '🎸',
    color: 0xFFF59E0B,
    keywords: ['epik', 'harika', 'muhteşem', 'epic', 'awesome', 'incredible', 'cinema'],
    description: 'Epik müzik, sinematik efekt',
  ),
};

EffectCategory? detectEffectIntent(String text) {
  if (text.isEmpty) return null;
  final t = text.toLowerCase();

  EffectCategory? bestMatch;
  int bestScore = 0;

  for (final entry in kEffectCategories.entries) {
    final matches = entry.value.keywords.where((kw) => t.contains(kw)).length;
    if (matches > bestScore) {
      bestScore = matches;
      final rawIntensity = (0.5 + matches * 0.2).clamp(0.1, 1.0);
      bestMatch = entry.value.copyWithIntensity(rawIntensity);
    }
  }

  if (bestMatch == null) return null;

  // Yoğunluk modifiye edicileri
  double modifier = 1.0;
  if (t.contains('daha fazla') || t.contains('arttır') || t.contains('yükselt') || t.contains('güçlendir')) {
    modifier = 1.2;
  } else if (t.contains('azalt') || t.contains('düşür') || t.contains('hafiflet') || t.contains('yumuşat')) {
    modifier = 0.8;
  } else if (t.contains('maksimum') || t.contains('en fazla') || t.contains('maximum')) {
    modifier = 2.0;
  } else if (t.contains('minimum') || t.contains('en az') || t.contains('hafif')) {
    modifier = 0.5;
  }

  final finalIntensity = (bestMatch.intensity * modifier).clamp(0.1, 1.0);
  return bestMatch.copyWithIntensity(finalIntensity);
}
