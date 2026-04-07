/**
 * useEffectIntent — sesli/yazılı komuttan efekt niyeti çıkarır
 *
 * Lokal kural tabanlı — backend çağrısı yok, anında çalışır.
 *
 * Arayüz:
 *   const { detectIntent } = useEffectIntent();
 *   const intent = detectIntent("şu kısmı daha komik yap");
 *   // → { category: 'comedy_reaction', label: 'Komedi Tepkisi', intensity: 0.8, emoji: '😂' }
 *   // → null (efekt niyeti yoksa)
 */

export const EFFECT_CATEGORIES = {
  impact_shock: {
    label:     'Şok Etkisi',
    emoji:     '💥',
    color:     '#f87171',
    keywords:  ['şok', 'sürpriz', 'beklenmedik', 'vay', 'şaşırt', 'wow', 'shock', 'surprised', 'unexpected'],
    description: 'Dramatik vurgu, güçlü ses efekti',
  },
  comedy_reaction: {
    label:     'Komedi Tepkisi',
    emoji:     '😂',
    color:     '#ffd166',
    keywords:  ['komik', 'güldür', 'eğlenceli', 'şaka', 'funny', 'laugh', 'hilarious', 'gülünç', 'mizah'],
    description: 'Kahkaha efekti, komedi zamanlaması',
  },
  tension_build: {
    label:     'Gerilim',
    emoji:     '😰',
    color:     '#8b5cf6',
    keywords:  ['gerilim', 'heyecan', 'korku', 'beklenti', 'suspense', 'tension', 'thriller', 'dramatic'],
    description: 'Gerilim artışı, müzik yükselmesi',
  },
  crowd_laugh: {
    label:     'Kahkaha',
    emoji:     '🎭',
    color:     '#1db974',
    keywords:  ['kahkaha', 'gülüş', 'alkış', 'crowd', 'applause', 'audience', 'izleyici', 'salon'],
    description: 'Kalabalık sesi, alkış efekti',
  },
  impact_emphasis: {
    label:     'Vurgu',
    emoji:     '⚡',
    color:     '#e05c2a',
    keywords:  ['vurgu', 'önemli', 'dikkat', 'emphasis', 'highlight', 'important', 'kritik', 'anahtar'],
    description: 'Ses vurgusu, görsel flash',
  },
  fail_tone: {
    label:     'Başarısızlık',
    emoji:     '🎺',
    color:     '#94a3b8',
    keywords:  ['başarısız', 'olmadı', 'kötü', 'fail', 'wrong', 'sad trombone', 'rezalet', 'felaket'],
    description: 'Hüzünlü trompet, aksaklık efekti',
  },
  epic_moment: {
    label:     'Epik An',
    emoji:     '🎸',
    color:     '#f59e0b',
    keywords:  ['epik', 'harika', 'muhteşem', 'epic', 'awesome', 'incredible', 'incredible', 'cinema'],
    description: 'Epik müzik, sinematik efekt',
  },
};

export function useEffectIntent() {
  function detectIntent(text) {
    if (!text) return null;
    const t = text.toLowerCase();

    let bestMatch = null;
    let bestScore = 0;

    for (const [category, data] of Object.entries(EFFECT_CATEGORIES)) {
      const matches = data.keywords.filter(kw => t.includes(kw)).length;
      if (matches > bestScore) {
        bestScore = matches;
        bestMatch = { category, ...data, intensity: Math.min(0.5 + matches * 0.2, 1.0) };
      }
    }

    if (!bestMatch) return null;

    // Yoğunluk modifiye edicileri
    let intensityModifier = 1.0;
    if (t.includes('daha fazla') || t.includes('arttır') || t.includes('yükselt') || t.includes('güçlendir')) {
      intensityModifier = 1.2;
    } else if (t.includes('azalt') || t.includes('düşür') || t.includes('hafiflet') || t.includes('yumuşat')) {
      intensityModifier = 0.8;
    } else if (t.includes('maksimum') || t.includes('en fazla') || t.includes('maximum')) {
      intensityModifier = 2.0; // will cap at 1.0
    } else if (t.includes('minimum') || t.includes('en az') || t.includes('hafif')) {
      intensityModifier = 0.5;
    }

    bestMatch.intensity = Math.max(0.1, Math.min(bestMatch.intensity * intensityModifier, 1.0));

    return bestMatch;
  }

  return { detectIntent, categories: EFFECT_CATEGORIES };
}
