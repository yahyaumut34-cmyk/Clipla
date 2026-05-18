/**
 * useTTS — platform-agnostik Text-to-Speech hook
 *
 * Web:    Backend edge-tts (Microsoft Neural tr-TR-EmelNeural) → fallback: speechSynthesis
 * Native: expo-speech
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { BASE_URL } from '../api';

// ── Emoji aralıkları (Unicode 15.1 kapsamlı) ──────────────────────────────
const EMOJI_RE = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{2300}-\u{23FF}]|[\u{2B00}-\u{2BFF}]|[\u{FE00}-\u{FE0F}]|\u{200D}/gu;
const MARKDOWN_RE = /(\*{1,2}|_{1,2}|`{1,3}|#{1,6}\s|---+|\|)/g;

function stripForTTS(text) {
  return String(text || '')
    .replace(EMOJI_RE, '')
    .replace(MARKDOWN_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const IS_WEB = Platform.OS === 'web';

// ── Neural ses tercihi (dile göre) ────────────────────────────────────────
const NEURAL_VOICE_MAP = {
  'tr':    'tr-TR-EmelNeural',    // Türkçe kadın sesi — doğal, rahatlatıcı
  'tr-TR': 'tr-TR-EmelNeural',
  'en':    'en-US-JennyNeural',   // İngilizce kadın sesi
  'en-US': 'en-US-JennyNeural',
  'en-GB': 'en-GB-SoniaNeural',
};

function getNeuralVoice(lang) {
  const short = (lang || 'tr').split('-')[0].toLowerCase();
  return NEURAL_VOICE_MAP[lang] || NEURAL_VOICE_MAP[short] || 'tr-TR-EmelNeural';
}

// ── API key (auth için) ────────────────────────────────────────────────────
const _API_KEY = (() => {
  try {
    return process.env.EXPO_PUBLIC_API_KEY || '1p8LO_BwlNTZW_o1ZVvXRWBu_gv_HON0O6yVDekJIK4';
  } catch { return ''; }
})();

// ── Backend Neural TTS ─────────────────────────────────────────────────────
let _neuralAvailable = null; // null=bilinmiyor, true=var, false=yok

async function speakViaBackend(text, lang, onEnd, setSpeaking, audioRef) {
  const voice = getNeuralVoice(lang);
  try {
    const res = await fetch(`${BASE_URL}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${_API_KEY}` },
      body: JSON.stringify({ text, voice, rate: '-5%' }),
    });
    if (!res.ok) {
      _neuralAvailable = false;
      return false;
    }
    _neuralAvailable = true;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);

    // Önceki oynatmayı durdur
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    setSpeaking(true);

    audio.onended = () => {
      setSpeaking(false);
      URL.revokeObjectURL(url);
      audioRef.current = null;
      onEnd?.();
    };
    audio.onerror = () => {
      setSpeaking(false);
      URL.revokeObjectURL(url);
      audioRef.current = null;
      onEnd?.();
    };

    await audio.play();
    return true;
  } catch {
    _neuralAvailable = false;
    return false;
  }
}

// ── Browser speechSynthesis (fallback) ────────────────────────────────────
const STABLE_FEMALE_VOICE_PREFS = [
  'microsoft zeynep online (natural)',
  'microsoft emel online (natural)',
  'microsoft zeynep',
  'microsoft emel',
  'google türkçe',
  'microsoft zira online - turkish',
  'microsoft zira desktop - turkish',
  'tr-tr-wavenet-a',
  'tr-tr-standard-a',
  'turkish female',
  'turkish',
];
const FEMALE_VOICE_HINTS = [
  'zeynep', 'emel', 'female', 'woman', 'lady',
  'aylin', 'meltem', 'seda', 'yasemin', 'selin',
];

function chooseBestVoice(voices, langCode) {
  const shortLang = String(langCode || 'tr').split('-')[0].toLowerCase();
  const sameLang  = voices.filter(v => (v.lang || '').toLowerCase().startsWith(shortLang));
  const stable    = sameLang.find(v => STABLE_FEMALE_VOICE_PREFS.some(p => v.name.toLowerCase().includes(p)));
  if (stable) return stable;
  const female    = sameLang.find(v => FEMALE_VOICE_HINTS.some(h => v.name.toLowerCase().includes(h)));
  if (female) return female;
  return sameLang[0] || voices[0] || null;
}

function speakViaBrowser(text, lang, onEnd, setSpeaking, preferredVoice, watchdogRef) {
  if (typeof window === 'undefined') { onEnd?.(); return; }
  const SS = window.speechSynthesis;
  if (!SS) { onEnd?.(); return; }
  SS.cancel();
  if (watchdogRef.current) clearInterval(watchdogRef.current);

  const utt  = new SpeechSynthesisUtterance(text);
  utt.lang   = lang;
  utt.rate   = 0.88;
  utt.pitch  = 1.0;
  const voice = preferredVoice || chooseBestVoice(SS.getVoices(), lang);
  if (voice) utt.voice = voice;

  utt.onstart = () => setSpeaking(true);
  utt.onend   = () => { setSpeaking(false); clearInterval(watchdogRef.current); onEnd?.(); };
  utt.onerror = () => { setSpeaking(false); clearInterval(watchdogRef.current); onEnd?.(); };

  SS.speak(utt);
  watchdogRef.current = setInterval(() => {
    if (!SS.speaking) clearInterval(watchdogRef.current);
    else if (SS.paused) SS.resume();
  }, 500);
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function useTTS({ language: defaultLang = 'tr-TR' } = {}) {
  const [speaking, setSpeaking]         = useState(false);
  const [preferredVoice, setPreferredVoice] = useState(null);
  const [preferredVoiceId, setPreferredVoiceId] = useState(null);
  const watchdogRef   = useRef(null);
  const ttsTimeoutRef = useRef(null);
  const audioRef      = useRef(null);   // Web Audio element (neural TTS)
  const cancelRef     = useRef(null);   // mevcut iptal fonksiyonu

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchdogRef.current) clearInterval(watchdogRef.current);
      if (ttsTimeoutRef.current) clearTimeout(ttsTimeoutRef.current);
      if (IS_WEB && typeof window !== 'undefined') window.speechSynthesis?.cancel();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []);

  // Browser voice preload (fallback için)
  useEffect(() => {
    if (!IS_WEB || typeof window === 'undefined') return;
    const SS = window.speechSynthesis;
    const updateVoice = () => {
      const v = chooseBestVoice(SS.getVoices() || [], defaultLang);
      if (v) setPreferredVoice(v);
    };
    updateVoice();
    SS.addEventListener?.('voiceschanged', updateVoice);
    return () => SS.removeEventListener?.('voiceschanged', updateVoice);
  }, [defaultLang]);

  // Native: expo-speech voice preload
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

  // ── Web speak: neural backend önce, fallback browser ──────────────────
  async function speakWeb(text, onEnd, lang) {
    const useLang = lang || defaultLang;

    // Backend neural TTS (kesin kapalıysa atla)
    if (_neuralAvailable !== false) {
      const ok = await speakViaBackend(text, useLang, onEnd, setSpeaking, audioRef);
      if (ok) {
        cancelRef.current = () => {
          if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
          setSpeaking(false);
        };
        return;
      }
    }

    // Fallback: browser speechSynthesis
    cancelRef.current = () => {
      window.speechSynthesis?.cancel();
      clearInterval(watchdogRef.current);
      setSpeaking(false);
    };
    speakViaBrowser(text, useLang, onEnd, setSpeaking, preferredVoice, watchdogRef);
  }

  // ── Native speak ──────────────────────────────────────────────────────
  async function speakNative(text, onEnd, lang) {
    const useLang = lang || defaultLang;
    try {
      const Speech = await import('expo-speech');
      if (ttsTimeoutRef.current) clearTimeout(ttsTimeoutRef.current);
      setSpeaking(true);
      const finish = (cb) => { clearTimeout(ttsTimeoutRef.current); setSpeaking(false); cb?.(); };
      const options = {
        language: useLang, rate: 0.88, pitch: 1.0,
        onDone:    () => finish(onEnd),
        onError:   () => finish(onEnd),
        onStopped: () => finish(undefined),
      };
      if (preferredVoiceId) options.voice = preferredVoiceId;
      Speech.speak(text, options);
      ttsTimeoutRef.current = setTimeout(async () => {
        try { (await import('expo-speech')).stop(); } catch {}
        finish(onEnd);
      }, 30000);
    } catch(e) {
      console.error('[useTTS] speakNative:', e);
      setSpeaking(false);
      onEnd?.();
    }
  }

  function cancelWeb() {
    cancelRef.current?.();
    cancelRef.current = null;
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    if (watchdogRef.current) clearInterval(watchdogRef.current);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setSpeaking(false);
  }

  async function cancelNative() {
    try { (await import('expo-speech')).stop(); } catch {}
    setSpeaking(false);
  }

  const _speak  = IS_WEB ? speakWeb  : speakNative;
  const cancel  = IS_WEB ? cancelWeb : cancelNative;

  return {
    speaking,
    speak: (text, onEnd, lang) => _speak(stripForTTS(text), onEnd, lang),
    cancel,
  };
}
