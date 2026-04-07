/**
 * useTTS — platform-agnostik Text-to-Speech hook
 *
 * Web:    window.speechSynthesis
 * Native: expo-speech
 *
 * Arayüz:
 *   const { speaking, speak, cancel } = useTTS({ language = 'tr-TR' });
 *   speak('merhaba', () => console.log('bitti'));
 *   speak('hello',   () => {}, 'en-US');   // override per-call
 */

import { useState, useRef, useEffect } from 'react';
import { Platform } from 'react-native';

// ── Emoji aralıkları (Unicode 15.1 kapsamlı) ──────────────────────────────
const EMOJI_RE = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{2300}-\u{23FF}]|[\u{2B00}-\u{2BFF}]|[\u{FE00}-\u{FE0F}]|\u{200D}/gu;

// ── Markdown / biçimlendirme kalıpları ────────────────────────────────────
const MARKDOWN_RE = /(\*{1,2}|_{1,2}|`{1,3}|#{1,6}\s|---+|\|)/g;

/**
 * TTS'e gönderilmeden önce metni temizler:
 *  - Tüm emoji karakterlerini kaldırır
 *  - Markdown biçimlendirmesini (**, *, #, ---, `, |) kaldırır
 *  - Çoklu boşlukları tek boşluğa indirger
 */
function stripForTTS(text) {
  return String(text || '')
    .replace(EMOJI_RE, '')
    .replace(MARKDOWN_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const IS_WEB = Platform.OS === 'web';
const STABLE_FEMALE_VOICE_PREFS = [
  'Google Türkçe',
  'Microsoft Zira Desktop - Turkish',
  'Microsoft Zira Online - Turkish',
  'Microsoft Server Speech Text to Speech Voice (tr-TR, ZiraRUS)',
  'tr-TR-Standard-A',
  'tr-TR-Standard-B',
  'tr-TR-Wavenet-A',
  'tr-TR-Wavenet-B',
  'Turkish Female',
  'Turkish'
];
const FEMALE_VOICE_HINTS = [
  'female', 'woman', 'lady', 'kadın', 'zeynep', 'aylin', 'meltem', 'seray', 'burcu', 'deniz', 'seda', 'yasemin', 'emine', 'yıldız', 'selin', 'beren', 'eda', 'nisa', 'öykü', 'dilara', 'feza'
];

function voiceText(text = '') {
  return String(text).toLowerCase();
}

function matchStableVoice(voice) {
  const name = voice.name || voice.voiceURI || voice.identifier || voice.id || '';
  const text = voiceText(name);
  return STABLE_FEMALE_VOICE_PREFS.some(h => text.includes(h.toLowerCase()));
}

function matchFemaleVoice(voice) {
  const name = voice.name || voice.voiceURI || voice.identifier || voice.id || '';
  const text = voiceText(name);
  return FEMALE_VOICE_HINTS.some(h => text.includes(h));
}

function languageOfVoice(voice) {
  return voice.lang || voice.language || voice.locale || '';
}

function chooseBestVoice(voices, langCode) {
  const shortLang = String(langCode || 'tr').split('-')[0].toLowerCase();
  const sameLang = voices.filter(v => languageOfVoice(v).toLowerCase().startsWith(shortLang));
  const stableSameLang = sameLang.find(matchStableVoice);
  if (stableSameLang) return stableSameLang;
  const femaleSameLang = sameLang.find(matchFemaleVoice);
  if (femaleSameLang) return femaleSameLang;
  if (sameLang.length > 0) return sameLang[0];
  const stableAny = voices.find(matchStableVoice);
  if (stableAny) return stableAny;
  const femaleAny = voices.find(matchFemaleVoice);
  if (femaleAny) return femaleAny;
  return voices[0] || null;
}

export function useTTS({ language: defaultLang = 'tr-TR' } = {}) {
  const [speaking, setSpeaking] = useState(false);
  const [preferredVoice, setPreferredVoice] = useState(null);
  const [preferredVoiceId, setPreferredVoiceId] = useState(null);
  const watchdogRef = useRef(null);

  // Cleanup watchdog on unmount
  useEffect(() => {
    return () => {
      if (watchdogRef.current) clearInterval(watchdogRef.current);
      if (IS_WEB && typeof window !== 'undefined') window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (!IS_WEB || typeof window === 'undefined') return;
    const SS = window.speechSynthesis;
    const updateVoice = () => {
      const voices = SS.getVoices() || [];
      const selected = chooseBestVoice(voices, defaultLang);
      if (selected) setPreferredVoice(selected);
    };
    updateVoice();
    SS.addEventListener?.('voiceschanged', updateVoice);
    return () => SS.removeEventListener?.('voiceschanged', updateVoice);
  }, [defaultLang]);

  useEffect(() => {
    if (IS_WEB) return;
    let active = true;
    (async () => {
      try {
        const Speech = await import('expo-speech');
        if (!Speech.getAvailableVoicesAsync) return;
        const voices = await Speech.getAvailableVoicesAsync();
        if (!active) return;
        const best = chooseBestVoice(voices, defaultLang);
        if (best) setPreferredVoiceId(best.identifier || best.name || best.id || null);
      } catch {}
    })();
    return () => { active = false; };
  }, [defaultLang]);

  function speakWeb(text, onEnd, lang) {
    const useLang = lang || defaultLang;
    if (typeof window === 'undefined') { onEnd?.(); return; }
    const SS = window.speechSynthesis;
    if (!SS) { onEnd?.(); return; }
    SS.cancel();
    if (watchdogRef.current) clearInterval(watchdogRef.current);

    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = useLang;
    utt.rate = 0.95;
    utt.pitch = 1.05;

    const voices = SS.getVoices();
    const selected = preferredVoice || chooseBestVoice(voices, useLang);
    if (selected) utt.voice = selected;

    utt.onstart = () => setSpeaking(true);
    utt.onend   = () => {
      setSpeaking(false);
      if (watchdogRef.current) clearInterval(watchdogRef.current);
      onEnd?.();
    };
    utt.onerror = () => {
      setSpeaking(false);
      if (watchdogRef.current) clearInterval(watchdogRef.current);
      onEnd?.();
    };

    SS.speak(utt);
    watchdogRef.current = setInterval(() => {
      if (!SS.speaking) { clearInterval(watchdogRef.current); }
      else if (SS.paused) SS.resume();
    }, 500);
  }

  async function speakNative(text, onEnd, lang) {
    const useLang = lang || defaultLang;
    try {
      const Speech = await import('expo-speech');
      setSpeaking(true);
      const options = {
        language: useLang,
        rate: 0.95,
        pitch: 1.0,
        onDone:    () => { setSpeaking(false); onEnd?.(); },
        onError:   () => { setSpeaking(false); onEnd?.(); },
        onStopped: () => { setSpeaking(false); },
      };
      if (preferredVoiceId) {
        options.voice = preferredVoiceId;
      }
      Speech.speak(text, options);
    } catch(e) {
      console.error('[useTTS] speakNative:', e);
      setSpeaking(false);
      onEnd?.();
    }
  }

  function cancelWeb() {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    if (watchdogRef.current) clearInterval(watchdogRef.current);
    setSpeaking(false);
  }

  async function cancelNative() {
    try {
      const Speech = await import('expo-speech');
      Speech.stop();
    } catch {}
    setSpeaking(false);
  }

  const speak  = IS_WEB ? speakWeb  : speakNative;
  const cancel = IS_WEB ? cancelWeb : cancelNative;

  return { speaking, speak: (text, onEnd, lang) => {
    speak(stripForTTS(text), onEnd, lang);
  }, cancel };
}
