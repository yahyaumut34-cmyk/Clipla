/**
 * useMicrophone — platform-agnostik ses girişi hook
 *
 * STT zinciri:
 *   Web:    window.SpeechRecognition (on-device, anlık)
 *   Native: 1) expo-speech-recognition (on-device, ücretsiz)
 *           2) expo-av Recording → backend /api/stt/transcribe (fallback)
 *
 * Arayüz:
 *   const { micAvail, listening, interim, sttMode, startMic, stopMicAndSend } =
 *     useMicrophone({ onTranscript, language = 'tr-TR' });
 *
 *   sttMode: 'web' | 'on-device' | 'backend' | null
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { transcribeAudio } from '../api';
import { isStartCommand } from '../shared/constants';

const SILENCE_MS = 5000; // 5s sessizlik → otomatik gönder

const IS_WEB = Platform.OS === 'web';

// Modül cache — her çağrıda re-import yapılmasın
let _srModule = null;
let _avModule = null;

async function getSRModule() {
  if (!_srModule) _srModule = await import('expo-speech-recognition');
  return _srModule;
}
async function getAVModule() {
  if (!_avModule) _avModule = await import('expo-av');
  return _avModule;
}

async function probeOnDeviceSR() {
  try {
    const mod = await getSRModule();
    return !!mod?.ExpoSpeechRecognitionModule;
  } catch {
    return false;
  }
}

export function useMicrophone({ onTranscript, language = 'tr-TR' }) {
  const [micAvail, setMicAvail]   = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim]     = useState('');
  const [sttMode, setSttMode]     = useState(null); // 'web' | 'on-device' | 'backend'

  // Web refs
  const recRef        = useRef(null);
  const listeningRef  = useRef(false);
  const accRef        = useRef('');
  const interimRef    = useRef('');
  const silenceTimer  = useRef(null);

  // Native refs
  const recordingRef     = useRef(null);     // expo-av recording
  const onDeviceAvailRef = useRef(null);     // tri-state: null=unknown, true, false
  const srRef            = useRef(null);     // expo-speech-recognition subscription

  // ── Web: SpeechRecognition setup (rebuilds on language change) ──
  useEffect(() => {
    if (!IS_WEB || typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setMicAvail(true);
    setSttMode('web');

    if (recRef.current) {
      try { recRef.current.stop(); } catch {}
    }

    const rec = new SR();
    rec.lang = language;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let finals = '', inter = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finals += e.results[i][0].transcript + ' ';
        else inter += e.results[i][0].transcript;
      }
      if (finals) {
        accRef.current = (accRef.current + ' ' + finals).trim();

        // "başla" / "start" → hemen gönder, dinlemeyi bitir
        if (isStartCommand(finals.trim())) {
          clearTimeout(silenceTimer.current);
          listeningRef.current = false;
          setListening(false);
          // "başla" kelimesini mesajdan çıkar, gerçek komut kısmını gönder
          const text = accRef.current
            .replace(/\b(başla|başlayabilirsin|start|go|tamam|evet|ok|devam|git)\b/gi, '')
            .trim();
          accRef.current = '';
          interimRef.current = '';
          setInterim('');
          try { rec.stop(); } catch {}
          if (text) onTranscript(text);
          return;
        }

        // 5s sessizlik güvenlik tamponu → otomatik gönder
        clearTimeout(silenceTimer.current);
        silenceTimer.current = setTimeout(() => {
          if (listeningRef.current) {
            listeningRef.current = false;
            setListening(false);
            const text = (accRef.current + ' ' + interimRef.current).trim();
            accRef.current = '';
            interimRef.current = '';
            setInterim('');
            try { rec.stop(); } catch {}
            if (text) onTranscript(text);
          }
        }, SILENCE_MS);
      }
      interimRef.current = inter;
      setInterim(inter);
    };

    rec.onend = () => {
      if (listeningRef.current) {
        try { rec.start(); } catch {
          listeningRef.current = false;
          setListening(false);
          setInterim('');
        }
      }
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech') return;
      clearTimeout(silenceTimer.current);
      listeningRef.current = false;
      setListening(false);
      setInterim('');
    };

    recRef.current = rec;
  }, [language]);

  // ── Native: probe on-device availability + request permissions ──
  useEffect(() => {
    if (IS_WEB) return;
    let cancelled = false;
    (async () => {
      try {
        // Try expo-speech-recognition first
        const hasOnDevice = await probeOnDeviceSR();
        if (cancelled) return;

        if (hasOnDevice) {
          const mod = await getSRModule();
          const { status } = await mod.ExpoSpeechRecognitionModule.requestPermissionsAsync();
          if (!cancelled && status === 'granted') {
            setMicAvail(true);
            setSttMode('on-device');
            onDeviceAvailRef.current = true;
            return;
          }
        }

        // Fall back to expo-av
        onDeviceAvailRef.current = false;
        const { Audio } = await getAVModule();
        const { status } = await Audio.requestPermissionsAsync();
        if (!cancelled && status === 'granted') {
          setMicAvail(true);
          setSttMode('backend');
        }
      } catch {
        if (!cancelled) setSttMode('backend');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Web: start ──
  function startMicWeb() {
    if (!recRef.current) return;
    accRef.current = '';
    interimRef.current = '';
    setInterim('');
    listeningRef.current = true;
    setListening(true);
    try { recRef.current.start(); } catch {}
  }

  // ── Web: stop and send ──
  function stopMicAndSendWeb() {
    if (!recRef.current) return;
    clearTimeout(silenceTimer.current);
    listeningRef.current = false;
    setListening(false);
    const combined = (accRef.current + ' ' + interimRef.current).trim();
    accRef.current = '';
    interimRef.current = '';
    setInterim('');
    try { recRef.current.stop(); } catch {}
    if (combined) setTimeout(() => onTranscript(combined), 150);
  }

  // ── Native on-device: expo-speech-recognition ──
  async function startMicOnDevice() {
    try {
      const mod = await getSRModule();
      const { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } = mod;

      accRef.current = '';
      setInterim('');

      // Start recognition
      ExpoSpeechRecognitionModule.start({
        lang: language,
        interimResults: true,
        continuous: false,
      });

      setListening(true);

      // Listen for results via event subscription
      const sub1 = ExpoSpeechRecognitionModule.addListener('result', (event) => {
        const transcript = event.results?.[0]?.transcript || '';
        if (event.isFinal) {
          accRef.current = transcript;
          setInterim('');
        } else {
          setInterim(transcript);
        }
      });
      const sub2 = ExpoSpeechRecognitionModule.addListener('end', () => {
        sub1?.remove();
        sub2?.remove();
        srRef.current = null;
        setListening(false);
        setInterim('');
        const text = accRef.current.trim();
        accRef.current = '';
        if (text) {
          onTranscript(text);
        } else {
          // On-device boş sonuç — backend'e düş
          console.warn('[useMicrophone] on-device gave empty result, falling back to backend');
          onDeviceAvailRef.current = false;
          setSttMode('backend');
          startMicBackend();
        }
      });
      const sub3 = ExpoSpeechRecognitionModule.addListener('error', (event) => {
        console.warn('[useMicrophone] on-device SR error:', event);
        sub1?.remove();
        sub2?.remove();
        sub3?.remove();
        srRef.current = null;
        setListening(false);
        setInterim('');
        // Fall back to backend for this session
        onDeviceAvailRef.current = false;
        setSttMode('backend');
      });
      srRef.current = { sub1, sub2, sub3 };
    } catch(e) {
      console.error('[useMicrophone] startMicOnDevice error:', e);
      onDeviceAvailRef.current = false;
      setSttMode('backend');
      // Try backend recording as fallback
      await startMicBackend();
    }
  }

  async function stopMicAndSendOnDevice() {
    try {
      const mod = await getSRModule();
      mod.ExpoSpeechRecognitionModule.stop();
      // Result handled by the 'end' event listener
    } catch(e) {
      console.error('[useMicrophone] stopMicAndSendOnDevice:', e);
      setListening(false);
    }
  }

  // ── Native backend: expo-av Recording → backend STT ──
  async function startMicBackend() {
    try {
      const { Audio } = await getAVModule();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setListening(true);
    } catch(e) {
      console.error('[useMicrophone] startMicBackend:', e);
    }
  }

  async function stopMicAndSendBackend() {
    if (!recordingRef.current) return;
    setListening(false);
    try {
      const recording = recordingRef.current;
      recordingRef.current = null;
      await recording.stopAndUnloadAsync();

      const { Audio } = await getAVModule();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recording.getURI();
      if (!uri) return;

      setInterim(language.startsWith('tr') ? 'Ses gönderiliyor...' : 'Sending audio...');
      const resp = await fetch(uri);
      const blob = await resp.blob();
      const data = await transcribeAudio(blob, 'command.m4a', language);
      setInterim('');
      const text = (data.text || data.transcript || '').trim();
      if (text) onTranscript(text);
    } catch(e) {
      setInterim('');
      console.error('[useMicrophone] stopMicAndSendBackend:', e);
    }
  }

  // ── Unified native start/stop ──
  const startMicNative = useCallback(async () => {
    if (onDeviceAvailRef.current === null) {
      // Still probing, wait briefly and retry
      await new Promise(r => setTimeout(r, 600));
    }
    if (onDeviceAvailRef.current === true) {
      await startMicOnDevice();
    } else {
      await startMicBackend();
    }
  }, [language]);

  const stopMicAndSendNative = useCallback(async () => {
    if (onDeviceAvailRef.current === true) {
      await stopMicAndSendOnDevice();
    } else {
      await stopMicAndSendBackend();
    }
  }, [language]);

  const startMic       = IS_WEB ? startMicWeb       : startMicNative;
  const stopMicAndSend = IS_WEB ? stopMicAndSendWeb : stopMicAndSendNative;

  const displayInterim = IS_WEB
    ? interim
    : (listening
        ? (interim || (language.startsWith('tr') ? 'Dinliyorum...' : 'Listening...'))
        : '');

  return { micAvail, listening, interim: displayInterim, sttMode, startMic, stopMicAndSend };
}
