import { useState, useRef, useCallback, useMemo, useEffect, memo } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, Pressable,
  TextInput, FlatList, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import {
  sendChatMessage, sendChatMessageStream, generateShorts,
  toAbsoluteUrl, bustCache, applyEffect, mergeVideos, trimMerge,
  undoEdit, getEditPreview,
} from '../api';
import { useMicrophone } from '../hooks/useMicrophone';
import { useTTS } from '../hooks/useTTS';
import { useEditPolling } from '../hooks/useEditPolling';
import { useEffectIntent } from '../hooks/useEffectIntent';
import { NativeVideoPlayer } from './NativeVideoPlayer';
import { EffectPicker } from './EffectPicker';
import { C, IS_WEB } from '../shared/theme';

import { Badge } from './Badge';
import { SUB_LANGS, PLAT_LABELS, isStartCommand, mergeCommand, detectSubtitleLang } from '../shared/constants';

const VOICE_LANGS = [
  { code: 'tr-TR', label: 'TR' },
  { code: 'en-US', label: 'EN' },
];

// Voice keyword helpers for auto-confirmation
function isConfirmWord(text) {
  return /^(evet|yes|başla|başlat|tamam|onayla|yap|ok|olur)\b/i.test(text.trim());
}
function isRejectWord(text) {
  return /^(hayır|hayir|no|dur|değiştir|degistir|iptal|vazgeç|vazgec)\b/i.test(text.trim());
}
function isShortsCmd(text) {
  return /(shorts|kısa klip|kısa video|short klip)\b/i.test(text);
}
function isApplyEffectCmd(text) {
  return /\b(uygula|efekt uygula|apply|evet uygula|ekle|koy|yerleştir|uygula)\b/i.test(text);
}
function isEffectAutoApplyCmd(text) {
  return /\b(uygula|ekle|koy|yerleştir|apply)\b/i.test(text)
    && /\b(kahkaha|gülüş|alkış|komik|komedi|şok|gerilim|epik|fail|başarısız|vurgu)\b/i.test(text);
}
function isIntensityIncreaseCmd(text) {
  return /(yoğunluk artır|daha fazla yoğunluk|arttır yoğunluk|yükselt yoğunluk|güçlendir)\b/i.test(text);
}
function isIntensityDecreaseCmd(text) {
  return /(yoğunluk azalt|azalt yoğunluk|düşür yoğunluk|hafiflet yoğunluk|yumuşat)\b/i.test(text);
}
function isSubtitleLangCmd(text) {
  return /\b(altyazı|alt yazı|subtitle|subtitles)\b/i.test(text);
}
function isUndoCmd(text) {
  return /\b(geri al|undo|önceki|onceki|geri dön|geri don|iptal et|vazgeç|vazgec)\b/i.test(text);
}
function isPreviewCmd(text) {
  return /\b(nasıl oldu|nasil oldu|önizle|onizle|preview|nasıl görünüyor|nasil gorunuyor|durumu söyle|durumu soyle|ne oldu|describe|anlat)\b/i.test(text);
}

// Confirm box + edit progress — ayrı memo component: parent re-render'larından izole
const ChatFooter = memo(function ChatFooter({
  loading, confirmData, editLoading, detectedEffect, effectApplying,
  removeFillers, preserveRhythm, setRemoveFillers, setPreserveRhythm,
  setDetectedEffect, handleEffectSelect, startEdit, addMsg, speak,
  handleStartMic, setConfirmData, editProgress,
}) {
  if (!loading && !confirmData && !editLoading) return null;
  return (
    <View style={{ paddingHorizontal: 0 }}>
      {loading && (
        <View style={[sf.msgRow, { marginBottom: 10 }]}>
          <View style={[sf.avatar, sf.avatarAi]}><Text style={{ fontSize: 11, color: C.accent }}>C</Text></View>
          <View style={[sf.bubble, sf.bubbleAi, { paddingVertical: 14 }]}><ActivityIndicator size="small" color={C.accent}/></View>
        </View>
      )}
      {confirmData && !editLoading && (
        <View style={[sf.confirmBox, { marginBottom: 10 }]}>
          <Text style={sf.confirmTitle}>EDİT PLANI HAZIR</Text>
          <Text style={sf.confirmRow}>Platform: <Text style={{ color: C.txt }}>{PLAT_LABELS[confirmData.platform] || confirmData.platform}</Text></Text>
          <Text style={sf.confirmRow}>Süre: <Text style={{ color: C.txt }}>{confirmData.target_duration_sec ? confirmData.target_duration_sec + 's' : 'Otomatik'}</Text></Text>
          <Text style={sf.confirmRow}>Komut: <Text style={{ color: C.txt }}>{confirmData.command_text}</Text></Text>
          {confirmData.subtitle_language && confirmData.subtitle_language !== 'tr' && (
            <Text style={sf.confirmRow}>Altyazı: <Text style={{ color: C.green }}>{SUB_LANGS[confirmData.subtitle_language] || confirmData.subtitle_language}</Text></Text>
          )}
          {detectedEffect && (
            <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: detectedEffect.color + '14', borderRadius: 8, padding: 8,
              borderWidth: 1, borderColor: detectedEffect.color + '40' }}>
              <Text style={{ fontSize: 18 }}>{detectedEffect.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: detectedEffect.color, fontWeight: '600' }}>Efekt Algılandı: {detectedEffect.label}</Text>
                <Text style={{ fontSize: 10, color: C.muted }}>{detectedEffect.description}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleEffectSelect(detectedEffect.category, detectedEffect.intensity)}
                style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: detectedEffect.color, opacity: effectApplying ? 0.5 : 1 }}
                disabled={effectApplying}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>Uygula</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setDetectedEffect(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ color: C.muted, fontSize: 14 }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: 'rgba(29,185,116,0.15)' }}>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }} onPress={() => setRemoveFillers(v => !v)}>
              <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1,
                borderColor: removeFillers ? C.green : C.border,
                backgroundColor: removeFillers ? C.green : 'transparent',
                alignItems: 'center', justifyContent: 'center' }}>
                {removeFillers && <Text style={{ color: '#000', fontSize: 11, fontWeight: '700' }}>✓</Text>}
              </View>
              <Text style={{ fontSize: 11, color: C.dim }}>Filler kelimeleri temizle (ıı, şey, yani...)</Text>
            </TouchableOpacity>
            {removeFillers && (
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 26 }} onPress={() => setPreserveRhythm(v => !v)}>
                <View style={{ width: 16, height: 16, borderRadius: 3, borderWidth: 1,
                  borderColor: preserveRhythm ? C.accent : C.border,
                  backgroundColor: preserveRhythm ? C.accent : 'transparent',
                  alignItems: 'center', justifyContent: 'center' }}>
                  {preserveRhythm && <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>✓</Text>}
                </View>
                <Text style={{ fontSize: 11, color: C.muted }}>Doğal konuşma ritmini koru</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={{ fontSize: 10, color: C.green, marginTop: 10, marginBottom: 2 }}>
            🎤 "evet" de veya butona bas
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <TouchableOpacity style={sf.confirmYes} onPress={startEdit}>
              <Text style={sf.confirmYesTxt}>Evet, Başla</Text>
            </TouchableOpacity>
            <TouchableOpacity style={sf.confirmNo} onPress={() => {
              setConfirmData(null);
              const msg = 'Tamam, ne değiştirmek istiyorsun?';
              addMsg('ai', msg);
              speak(msg, () => handleStartMic());
            }}>
              <Text style={sf.confirmNoTxt}>Değiştir</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {editLoading && (
        <View style={[sf.editProgress, { marginBottom: 10 }]}>
          <ActivityIndicator color={C.accent}/>
          <Text style={sf.editProgressTxt}>{editProgress || 'Video işleniyor...'}</Text>
        </View>
      )}
    </View>
  );
});

const sf = StyleSheet.create({
  msgRow:         { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  avatar:         { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0 },
  avatarAi:       { borderColor: 'rgba(224,92,42,0.35)', backgroundColor: 'rgba(224,92,42,0.1)' },
  bubble:         { maxWidth: '78%', padding: 11, borderRadius: 12, borderWidth: 1 },
  bubbleAi:       { backgroundColor: C.card, borderColor: C.border },
  confirmBox:     { backgroundColor: 'rgba(29,185,116,0.06)', borderWidth: 1, borderColor: 'rgba(29,185,116,0.25)', borderRadius: 12, padding: 16 },
  confirmTitle:   { fontSize: 10, color: C.green, letterSpacing: 2, marginBottom: 10 },
  confirmRow:     { fontSize: 12, color: C.muted, lineHeight: 22 },
  confirmYes:     { backgroundColor: C.green, borderRadius: 8, padding: 10, flex: 1, alignItems: 'center' },
  confirmYesTxt:  { color: '#041a0d', fontSize: 13, fontWeight: '600' },
  confirmNo:      { borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, flex: 1, alignItems: 'center' },
  confirmNoTxt:   { color: C.dim, fontSize: 13 },
  editProgress:   { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  editProgressTxt:{ color: C.dim, fontSize: 13 },
});

// ── Çoklu video voice helpers ────────────────────────────
function isMergeCmd(text) {
  return /\b(videoları birleştir|hepsini birleştir|birleştir|merge yap|videoları tek yap|videoları birleş)\b/i.test(text);
}
function isTransitionCmd(text) {
  return /\b(fade|crossfade|geçiş|dissolve|wipe|zoom|siyah|beyaz)\b/i.test(text) &&
         /\b(geçiş|transition|efekt)\b/i.test(text);
}
function parseTransition(text) {
  if (/crossfade|dissolve/i.test(text)) return 'crossfade';
  if (/wipe/i.test(text)) return 'wipe';
  if (/zoom/i.test(text)) return 'zoom';
  if (/siyah|black/i.test(text)) return 'black';
  if (/beyaz|white/i.test(text)) return 'white';
  return 'fade';
}
function parseOrderCmd(text) {
  // "ikinci videoyu başa al", "birinci ile üçüncüyü değiştir"
  const numMap = { bir: 1, birinci: 1, 'bir\'inci': 1, iki: 2, ikinci: 2, üç: 3, üçüncü: 3, dört: 4, dördüncü: 4, beş: 5, beşinci: 5, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5 };
  const found = [];
  for (const [word, num] of Object.entries(numMap)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) found.push(num);
  }
  return found;
}

export function StepChat({ jobData, onDone, planCtx, onPaywall, onEffectApplied }) {
  const [tab, setTab]           = useState('chat');
  const msgIdRef = useRef(1);
  const _initMsg = jobData.isMulti
    ? `${(jobData.allJobs||[]).length} video yüklendi. Videoları birleştirmek, kesmek veya edit için konuş.`
    : `Video yüklendi (${jobData.duration}s). Mic'e bas, konuş, tekrar bas.`;
  const [messages, setMessages] = useState([{ id: '0', role: 'ai', text: _initMsg }]);
  const [input, setInput]       = useState('');
  const [platform, setPlatform] = useState('youtube_shorts');
  const [voiceLang, setVoiceLang]     = useState('tr-TR');
  const [confirmData, setConfirmData] = useState(null);
  const [removeFillers, setRemoveFillers]   = useState(true);
  const [preserveRhythm, setPreserveRhythm] = useState(true);
  const [loading, setLoading]   = useState(false);
  const [allowVoiceDuringProcessing, setAllowVoiceDuringProcessing] = useState(false);
  const [shortsLoading, setShortsLoading] = useState(false);
  const [shorts, setShorts]     = useState([]);
  const [shortsError, setShortsError] = useState('');
  const [effectPickerVisible, setEffectPickerVisible] = useState(false);
  const [detectedEffect, setDetectedEffect] = useState(null); // auto-detected from message
  const [editHistory, setEditHistory] = useState([]); // [{version, command, duration}]
  const [suggestions, setSuggestions] = useState([]); // AI'dan gelen öneri listesi
  const [effectApplying, setEffectApplying] = useState(false);

  // ── Çoklu video state ────────────────────────────────────
  const [videoList, setVideoList]           = useState(jobData.allJobs || []);
  const [mergeTransition, setMergeTransition] = useState('cut');
  const [merging, setMerging]               = useState(false);
  const [activeJobId, setActiveJobId]       = useState(jobData.jobId);
  const isMulti = videoList.length > 1;

  // ── Trim state: { [jobId]: { start: '', end: '' } } ──────
  const [trimTimes, setTrimTimes] = useState(() => {
    const init = {};
    (jobData.allJobs || []).forEach(v => { init[v.jobId] = { start: '', end: '' }; });
    return init;
  });
  const [trimMerging, setTrimMerging] = useState(false);

  const scrollRef         = useRef(null);
  const pendingCommandRef = useRef('');
  const pendingSubLangRef = useRef(null);

  // Refs for voice confirmation — keep latest state accessible in async callbacks
  const confirmDataRef    = useRef(null);
  const detectedEffectRef = useRef(null);
  const onTranscriptRef   = useRef(null);

  // Sabit listeler — her render'da yeniden hesaplanmasın
  const platEntries  = useMemo(() => Object.entries(PLAT_LABELS), []);
  const subLangPairs = useMemo(() => Object.entries(SUB_LANGS), []);

  const processingTranscriptRef = useRef(false);

  // Keep refs in sync with state (for voice callback closures)
  useEffect(() => { confirmDataRef.current   = confirmData;    }, [confirmData]);
  useEffect(() => { detectedEffectRef.current = detectedEffect; }, [detectedEffect]);

  // Job değişince eski shorts'u temizle
  useEffect(() => { setShorts([]); setShortsError(''); }, [jobData.jobId]);

  const { speaking, speak, cancel: cancelTTS } = useTTS({ language: voiceLang });
  const { detectIntent } = useEffectIntent();

  // Stable callback — always calls the latest handleTranscript via ref
  const stableOnTranscript = useCallback((text) => onTranscriptRef.current?.(text), []);

  const { micAvail, listening, interim, startMic, stopMicAndSend } = useMicrophone({
    onTranscript: stableOnTranscript,
    language: voiceLang,
  });

  // handleEffectSelect ve sendMsg'de activeJobId kullan
  const currentJobId = activeJobId || jobData.jobId;

  const { editLoading, editProgress, startEdit: runEdit } = useEditPolling({
    jobId: activeJobId,
    onDone: (finalResult) => {
      speak('Video hazır!');
      pendingCommandRef.current = '';
      pendingSubLangRef.current = null;
      // Versiyon geçmişini güncelle
      setEditHistory(prev => [...prev, {
        version: prev.length + 1,
        command: finalResult?.command_text || '',
        duration: finalResult?.duration?.output || 0,
      }]);
      onDone(finalResult);
    },
    onError: (e) => {
      const errMsg = `Hata: ${e.message}`;
      addMsg('ai', errMsg);
      speak(errMsg, allowVoiceDuringProcessing ? () => handleStartMic() : undefined);
    },
  });

  const addMsg = useCallback((role, text) => {
    const id = String(msgIdRef.current++);
    setMessages(prev => [...prev, { id, role, text }]);
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 100);
  }, []);

  function handleStartMic() {
    if (speaking) return;
    if (editLoading && !allowVoiceDuringProcessing) return;
    startMic();
  }

  async function doMerge() {
    if (videoList.length < 2 || merging) return;
    setMerging(true);
    const jobIds = videoList.map(v => v.jobId);
    const transitions = Array(jobIds.length - 1).fill(mergeTransition);
    const transLabel = mergeTransition === 'cut' ? 'Kesik geçiş' : `${mergeTransition} geçiş`;
    addMsg('ai', `${videoList.length} video birleştiriliyor (${transLabel})...`);
    speak('Videolar birleştiriliyor, lütfen bekle.');
    try {
      const data = await mergeVideos(jobIds, { transitions });
      setActiveJobId(data.job_id);
      setVideoList([{ jobId: data.job_id, duration: data.duration, name: 'Birleşik Video' }]);
      const msg = `✓ ${data.video_count} video birleştirildi (${data.duration}s). Şimdi düzenleme komutunu söyleyebilirsin.`;
      addMsg('ai', msg);
      speak(msg, () => handleStartMic());
    } catch(e) {
      const errMsg = 'Birleştirme hatası: ' + e.message;
      addMsg('ai', errMsg);
      speak(errMsg, () => handleStartMic());
    } finally {
      setMerging(false);
    }
  }

  async function doTrimMerge() {
    if (!videoList.length || trimMerging) return;
    setTrimMerging(true);
    const clips = videoList.map(v => {
      const t = trimTimes[v.jobId] || {};
      const start = parseFloat(t.start) || 0;
      const end   = t.end !== '' && t.end !== undefined ? parseFloat(t.end) || undefined : undefined;
      return { job_id: v.jobId, start, end };
    });
    addMsg('ai', 'Videolar kesiliyor ve birleştiriliyor...');
    speak('Videolar kesiliyor, lütfen bekle.');
    try {
      const data = await trimMerge(clips, { transition: mergeTransition });
      setActiveJobId(data.job_id);
      setVideoList([{ jobId: data.job_id, duration: data.duration, name: 'Kesilmiş + Birleşik' }]);
      const msg = `✓ ${data.clip_count} kesit birleştirildi (${data.duration}s). Şimdi düzenleme komutunu söyleyebilirsin.`;
      addMsg('ai', msg);
      speak(msg, () => handleStartMic());
    } catch(e) {
      const errMsg = 'Kesme hatası: ' + e.message;
      addMsg('ai', errMsg);
      speak(errMsg, () => handleStartMic());
    } finally {
      setTrimMerging(false);
    }
  }

  // Voice interceptor — runs before sendMsg to handle confirmation/effect/shorts commands
  function handleTranscript(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    // Race condition koruması: eşzamanlı iki transcript çakışmasın
    if (processingTranscriptRef.current) return;
    processingTranscriptRef.current = true;
    setTimeout(() => { processingTranscriptRef.current = false; }, 500);

    // Waiting for edit plan confirmation → intercept "evet/tamam" or "hayır/değiştir"
    if (confirmDataRef.current) {
      if (isConfirmWord(trimmed)) {
        addMsg('user', trimmed);
        startEdit();
        return;
      }
      if (isRejectWord(trimmed)) {
        addMsg('user', trimmed);
        setConfirmData(null);
        const msg = 'Tamam, ne değiştirmek istiyorsun?';
        addMsg('ai', msg);
        speak(msg, () => handleStartMic());
        return;
      }
    }

    // Effect detected + user says "uygula"
    if (detectedEffectRef.current && isApplyEffectCmd(trimmed)) {
      addMsg('user', trimmed);
      handleEffectSelect(detectedEffectRef.current.category, detectedEffectRef.current.intensity);
      return;
    }

    // If the user says an effect keyword with a direct apply verb, apply it immediately
    if (detectedEffectRef.current && isEffectAutoApplyCmd(trimmed)) {
      addMsg('user', trimmed);
      handleEffectSelect(detectedEffectRef.current.category, detectedEffectRef.current.intensity);
      return;
    }

    // ── Çoklu video komutları ─────────────────────────────
    if (isMulti && isMergeCmd(trimmed)) {
      addMsg('user', trimmed);
      doMerge();
      return;
    }
    if (isMulti && isTransitionCmd(trimmed)) {
      addMsg('user', trimmed);
      const t = parseTransition(trimmed);
      setMergeTransition(t);
      speak(`Geçiş efekti "${t}" olarak ayarlandı. "Videoları birleştir" de.`, () => handleStartMic());
      return;
    }
    if (isMulti && /\b(sırayı değiştir|başa al|sona at|yer değiştir)\b/i.test(trimmed)) {
      addMsg('user', trimmed);
      const nums = parseOrderCmd(trimmed);
      if (nums.length >= 2) {
        const [a, b] = [nums[0] - 1, nums[1] - 1];
        setVideoList(prev => {
          if (a < 0 || b < 0 || a >= prev.length || b >= prev.length) return prev;
          const next = [...prev];
          [next[a], next[b]] = [next[b], next[a]];
          return next;
        });
        speak(`${nums[0]}. ve ${nums[1]}. videolar yer değiştirdi.`, () => handleStartMic());
      } else if (/başa al/i.test(trimmed) && nums[0]) {
        const idx = nums[0] - 1;
        setVideoList(prev => {
          if (idx <= 0 || idx >= prev.length) return prev;
          const next = [...prev];
          const [item] = next.splice(idx, 1);
          next.unshift(item);
          return next;
        });
        speak(`${nums[0]}. video başa alındı.`, () => handleStartMic());
      } else {
        speak('Hangi videoları değiştirmek istiyorsun? Örnek: "ikinci ile üçüncüyü değiştir"', () => handleStartMic());
      }
      return;
    }

    // Shorts voice command → switch tab + trigger generation
    if (isShortsCmd(trimmed)) {
      addMsg('user', trimmed);
      setTab('shorts');
      setTimeout(() => doGenerateShorts(), 100);
      return;
    }

    // Intensity adjustment commands
    if (detectedEffectRef.current && isIntensityIncreaseCmd(trimmed)) {
      addMsg('user', trimmed);
      setDetectedEffect(prev => prev ? {...prev, intensity: Math.min(prev.intensity * 1.2, 1.0)} : null);
      speak('Yoğunluk artırıldı', () => handleStartMic());
      return;
    }
    if (detectedEffectRef.current && isIntensityDecreaseCmd(trimmed)) {
      addMsg('user', trimmed);
      setDetectedEffect(prev => prev ? {...prev, intensity: Math.max(prev.intensity * 0.8, 0.1)} : null);
      speak('Yoğunluk azaltıldı', () => handleStartMic());
      return;
    }

    // Beat sync, bg remove, audio enhance → preview aşamasına yönlendir
    if (/\b(beat.sync|arka.plan.kaldır|sesi.iyileştir|gürültüyü.temizle)\b/i.test(trimmed)) {
      addMsg('user', trimmed);
      const msg = 'Bu özellik Önizleme adımında kullanılabilir. Video hazırlandıktan sonra Önizleme ekranında sesle veya butonla uygulayabilirsin.';
      addMsg('ai', msg);
      speak(msg, () => handleStartMic());
      return;
    }

    // Subtitle language selection
    if (isSubtitleLangCmd(trimmed)) {
      const code = detectSubtitleLang(trimmed);
      if (code) {
        pendingSubLangRef.current = code;
        addMsg('user', trimmed);
        speak(`Altyazı dili ${SUB_LANGS[code]} olarak ayarlandı`, () => handleStartMic());
        return;
      }
    }

    // Undo — geri al son edit
    if (isUndoCmd(trimmed)) {
      addMsg('user', trimmed);
      handleUndo();
      return;
    }

    // Voice preview — "nasıl oldu?" → açıklama oku
    if (isPreviewCmd(trimmed)) {
      addMsg('user', trimmed);
      handleVoicePreview();
      return;
    }

    sendMsg(trimmed);
  }

  // Update ref every render so the stable stableOnTranscript always calls fresh handleTranscript
  onTranscriptRef.current = handleTranscript;

  async function sendMsg(text) {
    const msg = (text || input).trim();
    if (!msg || loading || editLoading) return;
    setInput(''); addMsg('user', msg); setLoading(true); setConfirmData(null); setSuggestions([]);
    const intent = detectIntent(msg);
    if (intent) setDetectedEffect(intent);
    try {
      const history = messages.slice(-8).map(m => ({
        role: m.role === 'ai' ? 'assistant' : 'user', content: m.text,
      }));

      let data;
      if (IS_WEB) {
        // Streaming: render tokens as they arrive
        const streamId = String(msgIdRef.current++);
        setMessages(prev => [...prev, { id: streamId, role: 'ai', text: '' }]);
        setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 100);

        let accumulated = '';
        await sendChatMessageStream({
          message: msg, history, jobId: currentJobId, language: voiceLang,
          onChunk: (chunk) => {
            accumulated += chunk;
            setMessages(prev => prev.map(m => m.id === streamId ? { ...m, text: accumulated } : m));
          },
          onDone: (d) => { data = d; },
        });
        // onDone gelmezse accumulated'dan fallback data oluştur
        if (!data && accumulated) {
          data = { reply: accumulated };
        }
      } else {
        data = await sendChatMessage({ message: msg, history, jobId: currentJobId, language: voiceLang });
        addMsg('ai', data.reply || 'Anladım.');
      }

      const reply = data?.reply || 'Anladım.';

      const detectedLang = detectSubtitleLang(msg) || detectSubtitleLang(reply);
      if (detectedLang) {
        pendingSubLangRef.current = detectedLang;
      }

      if (!isStartCommand(msg)) {
        const merged = mergeCommand(pendingCommandRef.current, msg);
        pendingCommandRef.current = merged;
      }

      if (data?.ready_to_edit && data.edit_params) {
        const finalCommand = pendingCommandRef.current
          ? mergeCommand(pendingCommandRef.current, isStartCommand(msg) ? '' : msg)
          : msg;
        setConfirmData({
          ...data.edit_params,
          command_text:      finalCommand,
          subtitle_language: detectedLang || pendingSubLangRef.current || null,
        });
      }

      if (data?.suggestions?.length) {
        setSuggestions(data.suggestions);
      }

      if (data?.ready_to_edit && data.edit_params) {
        speak(reply + ' Onaylamak için "evet" de.', () => handleStartMic());
      } else {
        speak(reply, () => handleStartMic());
      }
    } catch(err) {
      console.error('[sendMsg]', err);
      const errTxt = 'Bir hata oluştu, tekrar dener misin?';
      const retryMsg = msg; // closure için yakala
      const id = String(msgIdRef.current++);
      setMessages(prev => [...prev, {
        id, role: 'ai', text: errTxt,
        retry: () => sendMsg(retryMsg),
      }]);
      speak(errTxt, () => handleStartMic());
    } finally {
      setLoading(false);
    }
  }

  async function handleUndo() {
    try {
      const data = await undoEdit(currentJobId);
      setEditHistory(prev => prev.slice(0, -1));
      const msg = `Versiyon ${data.version}'e geri döndük. Süre: ${data.duration}s.`;
      addMsg('ai', msg);
      speak(msg, () => handleStartMic());
      onDone({ download_url: data.download_url, output_url: data.output_url });
    } catch(e) {
      const errMsg = e.message.includes('önceki versiyon') ? 'Geri alınacak önceki versiyon yok.' : `Geri alma hatası: ${e.message}`;
      addMsg('ai', errMsg);
      speak(errMsg, () => handleStartMic());
    }
  }

  async function handleVoicePreview() {
    try {
      const data = await getEditPreview(currentJobId);
      const desc = data.description;
      addMsg('ai', desc);
      speak(desc, () => handleStartMic());
    } catch(e) {
      const msg = 'Önizleme bilgisi alınamadı.';
      addMsg('ai', msg);
      speak(msg, () => handleStartMic());
    }
  }

  function startEdit() {
    if (!confirmData) return;
    const params = confirmData;
    setConfirmData(null);
    if (!allowVoiceDuringProcessing) cancelTTS();
    addMsg('ai', 'Video işleniyor...');
    speak('Video işleniyor, lütfen bekle.');
    runEdit({
      commandText:       params.command_text || pendingCommandRef.current || '',
      platform:          params.platform || platform,
      targetDurationSec: params.target_duration_sec || null,
      subtitleLang:      params.subtitle_language || pendingSubLangRef.current || null,
      removeFillers,
      preserveRhythm,
    });
  }

  async function handleEffectSelect(category, intensity) {
    if (planCtx && !planCtx.canUseEffects) {
      onPaywall?.('effects');
      return;
    }
    setEffectApplying(true);
    try {
      const plan = planCtx?.isPro ? 'pro' : 'free';
      const data = await applyEffect(currentJobId, { category, intensity }, plan);
      addMsg('ai', `✓ Efekt uygulandı: ${category} (yoğunluk: ${Math.round(intensity * 100)}%)`);
      setDetectedEffect(null);
      if (data?.download_url) onEffectApplied?.(data);
    } catch(e) {
      addMsg('ai', `Efekt hatası: ${e.message}`);
    } finally {
      setEffectApplying(false);
    }
  }

  async function doGenerateShorts() {
    if (planCtx && !planCtx.canGenerateShorts) {
      onPaywall?.('shorts');
      return;
    }
    setShortsLoading(true); setShortsError(''); setShorts([]);
    try {
      const plan = planCtx?.isPro ? 'pro' : 'free';
      const data = await generateShorts(currentJobId, { topN: 5 }, plan);
      setShorts(data.shorts || []);
    } catch(e) {
      setShortsError(e.message);
    } finally {
      setShortsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tabBtn, tab === 'chat' && s.tabBtnOn]} onPress={() => setTab('chat')}>
          <Text style={[s.tabTxt, tab === 'chat' && s.tabTxtOn]}>Auto-Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabBtn, tab === 'shorts' && s.tabBtnOn]} onPress={() => setTab('shorts')}>
          <Text style={[s.tabTxt, tab === 'shorts' && s.tabTxtOn]}>Shorts</Text>
        </TouchableOpacity>
        {editHistory.length > 0 && (
          <TouchableOpacity
            style={{ marginLeft: 8, flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
              backgroundColor: 'rgba(29,185,116,0.1)', borderWidth: 1, borderColor: 'rgba(29,185,116,0.25)' }}
            onPress={handleUndo}>
            <Text style={{ fontSize: 10, color: C.green }}>↺ Geri Al ({editHistory.length})</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Çoklu Video Paneli ── */}
      {isMulti && tab === 'chat' && (
        <View style={s.multiPanel}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 9, color: C.accent, letterSpacing: 1.5 }}>VİDEO LİSTESİ ({videoList.length})</Text>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {['cut','fade','crossfade','wipe'].map(t => (
                <TouchableOpacity key={t}
                  style={[s.transBtn, mergeTransition === t && s.transBtnOn]}
                  onPress={() => setMergeTransition(t)}>
                  <Text style={{ fontSize: 9, color: mergeTransition === t ? C.accent : C.muted }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {videoList.map((v, i) => {
            const trim = trimTimes[v.jobId] || { start: '', end: '' };
            return (
              <View key={v.jobId} style={s.trimRow}>
                <Text style={s.trimIdx}>{i + 1}</Text>
                <Text style={s.trimName} numberOfLines={1}>{v.name || v.jobId}</Text>
                <Text style={s.trimDur}>{v.duration ? v.duration + 's' : ''}</Text>
                <TextInput
                  style={s.trimInput}
                  placeholder="başlangıç"
                  placeholderTextColor={C.muted}
                  keyboardType="numeric"
                  value={trim.start}
                  onChangeText={val => setTrimTimes(prev => ({ ...prev, [v.jobId]: { ...prev[v.jobId], start: val } }))}
                />
                <Text style={{ fontSize: 10, color: C.muted }}>-</Text>
                <TextInput
                  style={s.trimInput}
                  placeholder="bitiş"
                  placeholderTextColor={C.muted}
                  keyboardType="numeric"
                  value={trim.end}
                  onChangeText={val => setTrimTimes(prev => ({ ...prev, [v.jobId]: { ...prev[v.jobId], end: val } }))}
                />
                <Text style={{ fontSize: 9, color: C.muted }}>sn</Text>
              </View>
            );
          })}
          {/* Kesim varsa Trim+Merge, yoksa sadece Merge */}
          {videoList.some(v => trimTimes[v.jobId]?.start || trimTimes[v.jobId]?.end) ? (
            <TouchableOpacity
              style={[s.mergeBtn, { backgroundColor: '#7c3aed' }, (trimMerging || merging) && { opacity: 0.5 }]}
              onPress={doTrimMerge}
              disabled={trimMerging || merging}>
              {trimMerging
                ? <><ActivityIndicator size="small" color="#fff"/><Text style={s.mergeBtnTxt}> Kesiliyor...</Text></>
                : <Text style={s.mergeBtnTxt}>✂️ Kes ve Birleştir</Text>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.mergeBtn, merging && { opacity: 0.5 }]}
              onPress={doMerge}
              disabled={merging}>
              {merging
                ? <><ActivityIndicator size="small" color={C.accent}/><Text style={s.mergeBtnTxt}> Birleştiriliyor...</Text></>
                : <Text style={s.mergeBtnTxt}>🔗 Videoları Birleştir</Text>}
            </TouchableOpacity>
          )}
          <Text style={{ fontSize: 9, color: C.muted, marginTop: 4, textAlign: 'center' }}>
            Başlangıç/bitiş boşsa videonun tamamı kullanılır
          </Text>
        </View>
      )}

      {tab === 'chat' && (
        <>
          <View style={s.platRow}>
            {Object.entries(PLAT_LABELS).map(([id, label]) => (
              <TouchableOpacity key={id} style={[s.platBtn, platform === id && s.platBtnOn]} onPress={() => setPlatform(id)}>
                <Text style={[s.platTxt, platform === id && s.platTxtOn]}>{label}</Text>
              </TouchableOpacity>
            ))}
            <View style={{ flex: 1 }}/>
            {VOICE_LANGS.map(({ code, label }) => (
              <TouchableOpacity key={code}
                style={[s.platBtn, voiceLang === code && s.platBtnOn, { minWidth: 38, alignItems: 'center' }]}
                onPress={() => setVoiceLang(code)}>
                <Text style={[s.platTxt, voiceLang === code && s.platTxtOn]}>🎤 {label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {editLoading && (
            <View style={s.voiceBar}>
              <Text style={s.voiceDot}>🎤</Text>
              <Text style={[s.voiceTxt, { color: allowVoiceDuringProcessing ? C.green : C.muted }]}>
                {editProgress || (allowVoiceDuringProcessing ? 'Mic AÇIK (manuel)' : 'Mic KAPALI (işleniyor)')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  const next = !allowVoiceDuringProcessing;
                  setAllowVoiceDuringProcessing(next);
                  if (next) handleStartMic();
                  else cancelTTS();
                }}
                style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1,
                  borderColor: allowVoiceDuringProcessing ? C.green : C.muted,
                  backgroundColor: allowVoiceDuringProcessing ? 'rgba(29,185,116,0.1)' : 'transparent' }}>
                <Text style={{ fontSize: 10, color: allowVoiceDuringProcessing ? C.green : C.muted }}>
                  {allowVoiceDuringProcessing ? 'Kapat' : 'Sesi Aç'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!editLoading && (listening || speaking || loading) && (
            <View style={s.voiceBar}>
              {speaking
                ? (<><Text style={s.voiceDot}>🔊</Text><Text style={s.voiceTxt}>Clipla-Y konuşuyor...</Text></>)
                : loading
                ? (<><ActivityIndicator size="small" color={C.accent}/><Text style={s.voiceTxt}>Düşünüyor...</Text></>)
                : (<><Text style={[s.voiceDot, { color: C.accent }]}>🎤</Text>
                    <Text style={s.voiceTxt}>{interim || 'Dinliyorum...'}</Text>
                    <Text style={{ color: C.muted, fontSize: 11 }}>Bırak → gönder</Text></>)}
            </View>
          )}

          <FlatList
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            data={messages}
            keyExtractor={m => m.id}
            removeClippedSubviews
            maxToRenderPerBatch={10}
            initialNumToRender={15}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd?.({ animated: true })}
            ListFooterComponent={<ChatFooter
              loading={loading}
              confirmData={confirmData}
              editLoading={editLoading}
              detectedEffect={detectedEffect}
              effectApplying={effectApplying}
              removeFillers={removeFillers}
              preserveRhythm={preserveRhythm}
              setRemoveFillers={setRemoveFillers}
              setPreserveRhythm={setPreserveRhythm}
              setDetectedEffect={setDetectedEffect}
              handleEffectSelect={handleEffectSelect}
              startEdit={startEdit}
              addMsg={addMsg}
              speak={speak}
              handleStartMic={handleStartMic}
              setConfirmData={setConfirmData}
              editProgress={editProgress}
            />}
            renderItem={({ item: m }) => (
              <View style={[s.msgRow, m.role === 'user' && s.msgRowUser, { marginBottom: 10 }]}>
                <View style={[s.avatar, m.role === 'ai' ? s.avatarAi : s.avatarUser]}>
                  <Text style={{ fontSize: 11, color: m.role === 'ai' ? C.accent : C.green }}>{m.role === 'ai' ? 'C' : 'S'}</Text>
                </View>
                <View style={{ maxWidth: '78%' }}>
                  <View style={[s.bubble, m.role === 'ai' ? s.bubbleAi : s.bubbleUser]}>
                    <Text style={s.bubbleTxt}>{m.text}</Text>
                  </View>
                  {m.retry && (
                    <TouchableOpacity onPress={m.retry} style={{ marginTop: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: C.accent }}>
                      <Text style={{ color: C.accent, fontSize: 11 }}>↺ Tekrar Dene</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}/>

          {suggestions.length > 0 && !loading && !editLoading && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingBottom: 6 }}>
              {suggestions.map((s_text, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => { setSuggestions([]); sendMsg(s_text); }}
                  style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
                    backgroundColor: 'rgba(224,92,42,0.08)', borderWidth: 1, borderColor: 'rgba(224,92,42,0.25)' }}>
                  <Text style={{ fontSize: 11, color: C.accent }}>{s_text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={s.inputRow}>
            {micAvail && !editLoading && (
              <Pressable
                style={[s.micBtn, listening && s.micBtnOn]}
                onPressIn={() => { if (!speaking && !loading) handleStartMic(); }}
                onPressOut={() => { if (listening) stopMicAndSend(); }}
                onLongPress={() => {}}
                delayLongPress={300}>
                <Text style={{ fontSize: 20 }}>{listening ? '⏹' : '🎤'}</Text>
              </Pressable>
            )}
            <TextInput
              style={s.chatInput}
              placeholder={listening ? (interim || 'Dinliyorum... (bırak → gönder)') : 'Yaz veya mic\'e bas konuş bırak'}
              placeholderTextColor={listening ? C.accent : C.muted}
              value={listening ? '' : input}
              onChangeText={t => { if (!listening) setInput(t); }}
              onSubmitEditing={() => sendMsg()}
              returnKeyType="send"
              editable={!editLoading && !listening && !speaking}
            />
            <TouchableOpacity
              style={[s.micBtn, { borderColor: planCtx && !planCtx.canUseEffects ? C.border : 'rgba(224,92,42,0.3)' }]}
              onPress={() => planCtx && !planCtx.canUseEffects ? onPaywall?.('effects') : setEffectPickerVisible(true)}
              disabled={effectApplying}>
              <Text style={{ fontSize: 18, opacity: planCtx && !planCtx.canUseEffects ? 0.4 : 1 }}>✨</Text>
            </TouchableOpacity>
            {!listening && (
              <TouchableOpacity
                style={[s.sendBtn, (!input.trim() || loading || editLoading) && s.btnDisabled]}
                onPress={() => sendMsg()}
                disabled={!input.trim() || loading || editLoading}>
                <Text style={{ color: '#fff', fontSize: 18 }}>→</Text>
              </TouchableOpacity>
            )}
          </View>
          <EffectPicker
            visible={effectPickerVisible}
            onSelect={handleEffectSelect}
            onClose={() => setEffectPickerVisible(false)}
          />
        </>
      )}

      {tab === 'shorts' && (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Badge label="SHORTS" color={C.green}/>
          <Text style={[s.stepTitle, { fontSize: 24, marginTop: 12 }]}>Kısa Klip Üret</Text>
          <Text style={s.stepSub}>Anlam analizi ile{'\n'}giriş-gelişme-sonuç yapısında{'\n'}kısa klipler otomatik seçilir.</Text>
          <TouchableOpacity style={[s.btn, s.btnAccent, shortsLoading && s.btnDisabled]}
            onPress={doGenerateShorts} disabled={shortsLoading}>
            {shortsLoading ? <ActivityIndicator color="#fff"/> : <Text style={s.btnTxt}>Shorts Üret</Text>}
          </TouchableOpacity>
          {!!shortsError && (
            <View style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={s.errTxt}>{shortsError}</Text>
              <TouchableOpacity style={[s.btn, { marginTop: 10 }]} onPress={doGenerateShorts}>
                <Text style={[s.btnTxt, { color: C.accent }]}>Tekrar Dene</Text>
              </TouchableOpacity>
            </View>
          )}
          {!shortsLoading && !shortsError && shorts.length === 0 && (
            <View style={{ alignItems: 'center', marginTop: 32, opacity: 0.5 }}>
              <Text style={{ fontSize: 36, marginBottom: 10 }}>✂</Text>
              <Text style={{ color: C.dim, fontSize: 13, textAlign: 'center' }}>
                Henüz klip yok.{'\n'}"Shorts Üret" butonuna bas.
              </Text>
            </View>
          )}
          {shorts.map(clip => (
            <View key={clip.index} style={s.shortCard}>
              {/* Başlık satırı */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: C.txt, fontWeight: '700' }}>Klip {clip.index}</Text>
                  {clip.emotional_peak && (
                    <View style={{ backgroundColor: 'rgba(224,92,42,0.15)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: C.accent, fontSize: 9, letterSpacing: 1 }}>ZİRVE</Text>
                    </View>
                  )}
                  {clip.narrative_structure && (
                    <View style={{ backgroundColor: 'rgba(29,185,116,0.12)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: C.green, fontSize: 9, letterSpacing: 0.5 }}>{clip.narrative_structure}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: C.muted, fontSize: 10 }}>{clip.start?.toFixed(1)}s – {clip.end?.toFixed(1)}s</Text>
              </View>

              {/* Skor barı */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <View style={{ flex: 1, height: 3, backgroundColor: C.border, borderRadius: 2 }}>
                  <View style={{ height: 3, width: `${Math.min((clip.semantic_score ?? clip.score ?? 0) * 100, 100)}%`,
                    backgroundColor: C.green, borderRadius: 2 }}/>
                </View>
                <Text style={{ color: C.muted, fontSize: 10 }}>
                  {clip.completeness != null ? `%${Math.round(clip.completeness * 100)} tam` : `Skor: ${clip.score}`}
                </Text>
              </View>

              {/* Neden iyi */}
              {clip.why_good ? (
                <Text style={{ color: C.dim, fontSize: 11, fontStyle: 'italic', marginBottom: 8 }}>💡 {clip.why_good}</Text>
              ) : clip.text_preview ? (
                <Text style={{ color: C.muted, fontSize: 11, fontStyle: 'italic', marginBottom: 8 }}>"{clip.text_preview}"</Text>
              ) : null}

              {/* Video */}
              {IS_WEB && clip.url ? (
                <video src={`${toAbsoluteUrl(clip.url)}?t=${Date.now()}`} controls
                  style={{ width: '100%', borderRadius: 8, backgroundColor: '#000', display: 'block' }}/>
              ) : clip.url ? (
                <NativeVideoPlayer uri={toAbsoluteUrl(clip.url)} height={180}/>
              ) : null}
              {clip.status === 'error' && <Text style={s.errTxt}>{clip.error}</Text>}
            </View>
          ))}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  tabRow:          { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.border },
  tabBtn:          { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  tabBtnOn:        { borderColor: C.accent, backgroundColor: 'rgba(224,92,42,0.12)' },
  tabTxt:          { fontSize: 12, color: C.muted },
  tabTxtOn:        { color: C.accent, fontWeight: '600' },
  platRow:         { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: C.border },
  platBtn:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  platBtnOn:       { borderColor: C.accent, backgroundColor: 'rgba(224,92,42,0.12)' },
  platTxt:         { fontSize: 11, color: C.muted, letterSpacing: 0.5 },
  platTxtOn:       { color: C.accent },
  voiceBar:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(224,92,42,0.07)', borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(224,92,42,0.15)' },
  voiceDot:        { fontSize: 14, color: C.green },
  voiceTxt:        { flex: 1, fontSize: 13, color: C.dim, fontStyle: 'italic' },
  msgRow:          { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  msgRowUser:      { flexDirection: 'row-reverse' },
  avatar:          { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0 },
  avatarAi:        { borderColor: 'rgba(224,92,42,0.35)', backgroundColor: 'rgba(224,92,42,0.1)' },
  avatarUser:      { borderColor: 'rgba(29,185,116,0.35)', backgroundColor: 'rgba(29,185,116,0.08)' },
  bubble:          { maxWidth: '78%', padding: 11, borderRadius: 12, borderWidth: 1 },
  bubbleAi:        { backgroundColor: C.card, borderColor: C.border },
  bubbleUser:      { backgroundColor: 'rgba(224,92,42,0.1)', borderColor: 'rgba(224,92,42,0.2)' },
  bubbleTxt:       { fontSize: 13, color: C.txt, lineHeight: 20 },
  confirmBox:      { backgroundColor: 'rgba(29,185,116,0.06)', borderWidth: 1, borderColor: 'rgba(29,185,116,0.25)', borderRadius: 12, padding: 16 },
  confirmTitle:    { fontSize: 10, color: C.green, letterSpacing: 2, marginBottom: 10 },
  confirmRow:      { fontSize: 12, color: C.muted, lineHeight: 22 },
  confirmYes:      { backgroundColor: C.green, borderRadius: 8, padding: 10, flex: 1, alignItems: 'center' },
  confirmYesTxt:   { color: '#041a0d', fontSize: 13, fontWeight: '600' },
  confirmNo:       { borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, flex: 1, alignItems: 'center' },
  confirmNoTxt:    { color: C.dim, fontSize: 13 },
  editProgress:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  editProgressTxt: { color: C.dim, fontSize: 13 },
  inputRow:        { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderColor: C.border },
  chatInput:       { flex: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, color: C.txt, fontSize: 13 },
  sendBtn:         { width: 44, backgroundColor: C.accent, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  micBtn:          { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  micBtnOn:        { borderColor: C.accent, backgroundColor: 'rgba(224,92,42,0.15)' },
  multiPanel:      { backgroundColor: 'rgba(224,92,42,0.05)', borderWidth: 1, borderColor: 'rgba(224,92,42,0.2)', borderRadius: 10, padding: 12, marginHorizontal: 16, marginBottom: 8 },
  transBtn:        { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  transBtnOn:      { borderColor: C.accent, backgroundColor: 'rgba(224,92,42,0.12)' },
  mergeBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, backgroundColor: C.accent, borderRadius: 8, padding: 8 },
  mergeBtnTxt:     { color: '#fff', fontSize: 12, fontWeight: '600' },
  trimRow:         { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  trimIdx:         { fontSize: 10, color: C.accent, width: 14, fontWeight: '700' },
  trimName:        { flex: 1, fontSize: 10, color: C.txt },
  trimDur:         { fontSize: 9, color: C.muted, width: 28, textAlign: 'right' },
  trimInput:       { width: 46, height: 26, borderWidth: 1, borderColor: C.border, borderRadius: 5, backgroundColor: C.card, color: C.txt, fontSize: 11, paddingHorizontal: 5, textAlign: 'center' },
  shortCard:       { marginTop: 16, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  stepTitle:       { fontSize: 34, color: C.txt, fontStyle: 'italic', marginTop: 12, marginBottom: 8, lineHeight: 40 },
  stepSub:         { fontSize: 14, color: C.dim, lineHeight: 22, marginBottom: 28 },
  btn:             { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: C.card },
  btnAccent:       { backgroundColor: C.accent, borderColor: C.accent },
  btnDisabled:     { opacity: 0.3 },
  btnTxt:          { color: '#fff', fontSize: 14, letterSpacing: 0.5, fontWeight: '500' },
  errTxt:          { color: '#f87171', fontSize: 12, textAlign: 'center', marginBottom: 8 },
});
