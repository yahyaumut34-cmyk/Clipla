// ─────────────────────────────────────────────
// Paylaşılan sabitler
// ─────────────────────────────────────────────

export const SUB_LANGS = {
  tr: 'Türkçe',
  en: 'İngilizce',
  de: 'Almanca',
  fr: 'Fransızca',
  es: 'İspanyolca',
  pt: 'Portekizce',
  ru: 'Rusça',
  zh: 'Çince',
  ja: 'Japonca',
  ar: 'Arapça',
};

export const EDIT_TEMPLATES = [
  {
    id: 'tiktok_viral', label: 'TikTok Viral', emoji: '🔥',
    platform: 'tiktok', targetSec: 30, removeFillers: true,
    desc: '~30 saniye · dikey · enerjik kurgu',
    color: '#ff2d55',
  },
  {
    id: 'youtube_short', label: 'YouTube Short', emoji: '▶',
    platform: 'youtube_shorts', targetSec: 60, removeFillers: true,
    desc: '~60 saniye · dikey · temiz kurgu',
    color: '#e05c2a',
  },
  {
    id: 'reels', label: 'Reels', emoji: '📸',
    platform: 'instagram', targetSec: 30, removeFillers: true,
    desc: '~30 saniye · kare format · reels',
    color: '#c13584',
  },
  {
    id: 'clean_cut', label: 'Clean Cut', emoji: '✂',
    platform: 'youtube', targetSec: null, removeFillers: false,
    desc: 'Orijinal süre · sadece sessizlik temizlenir',
    color: '#1db974',
  },
];

export const PLAT_LABELS = {
  youtube_shorts: 'Shorts',
  tiktok:         'TikTok',
  youtube:        'YouTube',
};

/** Sadece "başlat" niyetli tetikleyici sözcükler — gerçek komut değil */
export function isStartCommand(text) {
  const t = (text || '').toLowerCase().trim().replace(/[.,!?]$/, '');
  const TR = ['başla', 'yap', 'tamam', 'evet', 'ok', 'devam', 'git', 'başlayabilirsin'];
  const EN = ['start', 'go', 'yes', 'ok', 'proceed', 'do it', 'confirm', 'let\'s go'];
  return TR.includes(t) || EN.includes(t);
}

export function mergeCommand(prev, next) {
  const a = (prev || '').trim();
  const b = (next || '').trim();
  if (!a) return b;
  if (!b) return a;
  if (a.includes(b)) return a;
  return `${a}, ${b}`;
}

export const TRANSITION_TYPES = {
  fade:        { label: 'Fade',        emoji: '🌫️' },
  fadeblack:   { label: 'Siyaha Fade', emoji: '⬛' },
  fadewhite:   { label: 'Beyaza Fade', emoji: '⬜' },
  dissolve:    { label: 'Çözülme',     emoji: '✨' },
  slideleft:   { label: 'Sola Kayma',  emoji: '◀️' },
  slideright:  { label: 'Sağa Kayma',  emoji: '▶️' },
  slideup:     { label: 'Yukarı',      emoji: '🔼' },
  slidedown:   { label: 'Aşağı',       emoji: '🔽' },
  wipeleft:    { label: 'Sol Silme',   emoji: '◁' },
  wiperight:   { label: 'Sağ Silme',  emoji: '▷' },
  circleopen:  { label: 'Daire Aç',   emoji: '⭕' },
  pixelize:    { label: 'Piksel',      emoji: '🟦' },
};

export function detectTransitionCmd(text) {
  const t = (text || '').toLowerCase();
  if (/siyah.*fade|fade.*siyah|karara.*geçiş/i.test(t))    return 'fadeblack';
  if (/beyaz.*fade|fade.*beyaz|beyaza.*geçiş/i.test(t))    return 'fadewhite';
  if (/çözül|dissolve/i.test(t))                            return 'dissolve';
  if (/sola.*kay|kaya.*sol|slide.*left/i.test(t))           return 'slideleft';
  if (/sağa.*kay|kaya.*sağ|slide.*right/i.test(t))          return 'slideright';
  if (/yukarı.*kay|slide.*up/i.test(t))                     return 'slideup';
  if (/aşağı.*kay|slide.*down/i.test(t))                    return 'slidedown';
  if (/sol.*sil|wipe.*left/i.test(t))                       return 'wipeleft';
  if (/sağ.*sil|wipe.*right/i.test(t))                      return 'wiperight';
  if (/daire|circle/i.test(t))                              return 'circleopen';
  if (/piksel|pixel/i.test(t))                              return 'pixelize';
  if (/fade|geçiş ekle|geçiş koy/i.test(t))                return 'fade';
  return null;
}

export function detectSubtitleLang(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('alman')    || t.includes('deutsch')    || t.includes('german'))    return 'de';
  if (t.includes('ingiliz')  || t.includes('english'))                               return 'en';
  if (t.includes('fransız')  || t.includes('french')     || t.includes('français'))  return 'fr';
  if (t.includes('ispanyol') || t.includes('spanish')    || t.includes('español'))   return 'es';
  if (t.includes('portekiz') || t.includes('portuguese') || t.includes('português')) return 'pt';
  if (t.includes('rusça')    || t.includes('russian')    || t.includes('rus '))      return 'ru';
  if (t.includes('çince')    || t.includes('chinese')    || t.includes('mandarin'))  return 'zh';
  if (t.includes('japonca')  || t.includes('japanese'))                              return 'ja';
  if (t.includes('arapça')   || t.includes('arabic'))                               return 'ar';
  if (t.includes('türkçe')   || t.includes('turkish'))                              return 'tr';
  return null;
}
