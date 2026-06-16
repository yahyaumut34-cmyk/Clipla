/**
 * WorkspaceScreen — Film Şeritli Edit Arayüzü
 * Video yükle → film şeridi → aksiyonlar → uygula → indir
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  ScrollView, Platform, TextInput,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSpring, withRepeat, withSequence, withDelay,
  Easing,
} from 'react-native-reanimated';
import { C, IS_WEB }         from '../shared/theme';
import { useTTS }            from '../hooks/useTTS';
import { useMicrophone }     from '../hooks/useMicrophone';
import { useEditPolling }    from '../hooks/useEditPolling';
import { VideoTimeline }     from '../components/VideoTimeline';
import { NativeVideoPlayer } from '../components/NativeVideoPlayer';
import { VideoMergeModal }   from '../components/VideoMergeModal';
import {
  uploadVideoWithProgress, toAbsoluteUrl, trimMerge,
  generateSubtitles, addMusic, addSoundEffect,
  enhanceAudio, generateShorts, undoEdit,
  changeSpeed, applyEffect, applyFilter, removeBackground,
  addTextOverlay, sendChatMessage, analyzeVideo,
} from '../api';
import { detectTransitionCmd, TRANSITION_TYPES } from '../shared/constants';
import { ChatMessages } from '../components/FloatingChat';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

// ── Aksiyon tanımları ─────────────────────────────────────────────────────────
const ACTIONS = [
  { id: 'text',     icon: '✍️', label: 'Başlık / Metin', desc: 'Videoya yazı veya grafik ekle' },
  { id: 'subtitle', icon: '📝', label: 'Altyazı Ekle',   desc: 'Otomatik altyazı oluştur' },
  { id: 'effect',   icon: '⚡', label: 'Efekt',           desc: 'Görsel etki ekle' },
  { id: 'filter',   icon: '🎨', label: 'Filtre',          desc: 'Renk filtresi uygula' },
  { id: 'music',    icon: '🎵', label: 'Müzik',           desc: 'Arka plan müziği ekle' },
  { id: 'speed',    icon: '⏩', label: 'Hız',             desc: 'Hızlandır veya yavaşlat' },
  { id: 'shorts',   icon: '🎬', label: 'Shorts',          desc: 'YouTube / TikTok için hazırla' },
  { id: 'bgremove', icon: '🎭', label: 'Arka Plan Sil',   desc: 'Arka planı kaldır' },
  { id: 'enhance',  icon: '🔊', label: 'Ses Kalitesi',    desc: 'Gürültüyü azalt' },
  { id: 'undo',     icon: '↩️', label: 'Geri Al',         desc: 'Son işlemi geri al' },
];

const MARKER_COLORS = {
  text:     '#f59e0b',
  subtitle: '#3b82f6',
  effect:   '#8b5cf6',
  music:    '#10b981',
  speed:    '#f97316',
  filter:   '#ec4899',
  bgremove: '#eab308',
  enhance:  '#06b6d4',
  shorts:   '#ef4444',
  sfx:      '#84cc16',
  undo:     '#94a3b8',
};

const TEXT_POSITIONS = [
  { id: 'top',    label: '⬆ Üst' },
  { id: 'center', label: '⬛ Orta' },
  { id: 'bottom', label: '⬇ Alt' },
];
const TEXT_COLORS = [
  { id: 'white',  label: '⬜ Beyaz' },
  { id: 'yellow', label: '🟡 Sarı' },
  { id: 'red',    label: '🔴 Kırmızı' },
  { id: 'cyan',   label: '🔵 Siyan' },
];
const TEXT_SIZES = [
  { id: 32,  label: 'S' },
  { id: 48,  label: 'M' },
  { id: 64,  label: 'L' },
  { id: 84,  label: 'XL' },
];

const EFFECT_OPTS = [
  { id: 'impact_shock',    label: 'Şok' },
  { id: 'comedy_reaction', label: 'Komedi' },
  { id: 'tension_build',   label: 'Gerilim' },
  { id: 'epic_moment',     label: 'Epik' },
  { id: 'vintage_film',    label: 'Vintage' },
  { id: 'neon_glow',       label: 'Neon' },
];

const FILTER_OPTS = [
  { id: 'warm',      label: '🌅 Sıcak' },
  { id: 'cool',      label: '❄️ Soğuk' },
  { id: 'cinematic', label: '🎬 Sinematik' },
  { id: 'vivid',     label: '🌈 Canlı' },
  { id: 'noir',      label: '⬛ Noir' },
];

// ── Sesli komut — zaman algıla ("5. saniyeye", "3-8 saniyesi") ───────────────
function parseTimeFromText(text) {
  // "5. saniyeye", "5 saniyeye", "beşinci saniyeye"
  const single = text.match(/(\d+(?:[.,]\d+)?)\s*\.?\s*saniy/i);
  if (single) return { start: parseFloat(single[1].replace(',', '.')), end: null };
  // "3-8 saniyesi", "3 ile 8 saniyesi"
  const range = text.match(/(\d+)\s*[-ile]+\s*(\d+)\s*saniy/i);
  if (range) return { start: parseFloat(range[1]), end: parseFloat(range[2]) };
  return null;
}

function isConfirmWord(t) { return /^(evet|yes|başla|tamam|onayla|yap|ok|olur)\b/i.test(t.trim()); }
function isRejectWord(t)  { return /^(hayır|hayir|no|dur|değiştir|iptal|vazgeç)\b/i.test(t.trim()); }
function isUndoCmd(t)     { return /\b(geri al|undo|önceki)\b/i.test(t); }

// ── Öneri chip'leri ───────────────────────────────────────────────────────────
const SUGGESTION_CHIPS = [
  { id: 'baslik',    label: '✍️ Başlık Ekle',  cmd: 'videoya başlık ekle' },
  { id: 'altyazi',   label: '📝 Altyazı',      cmd: 'altyazı ekle' },
  { id: 'cinematic', label: '🎬 Sinematik',     cmd: 'sinematik filtre' },
  { id: 'shorts',    label: '✂️ Shorts',        cmd: 'shorts çıkar' },
  { id: 'muzik',     label: '🎵 Müzik Ekle',   cmd: 'müzik ekle' },
  { id: 'ses',       label: '🔊 Ses Temizle',   cmd: 'ses gürültüsünü temizle' },
  { id: 'birlestir', label: '🔗 Birleştir',     cmd: 'video birleştir' },
];

const REC_ICONS = {
  sfx: '🔊', music: '🎵', subtitle: '📝', effect: '⚡',
  filter: '🎨', enhance: '🎙', speed: '⏩', bgremove: '🎭',
};

function RecommendationCards({ recs, onApply, applyingRec }) {
  if (!recs?.length) return null;
  return (
    <View style={ws2.recWrap}>
      <Text style={ws2.recTitle}>✦ AI TAVSİYELERİ</Text>
      {recs.map((rec, i) => (
        <View key={i} style={ws2.recCard}>
          <View style={ws2.recLeft}>
            <Text style={ws2.recIcon}>{REC_ICONS[rec.type] || '⚡'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={ws2.recLabel}>{rec.label}</Text>
              <Text style={ws2.recReason} numberOfLines={2}>{rec.reason}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[ws2.recBtn, applyingRec === rec.type && ws2.recBtnBusy]}
            onPress={() => onApply(rec)}
            disabled={!!applyingRec}
            activeOpacity={0.8}
          >
            <Text style={ws2.recBtnTxt}>{applyingRec === rec.type ? '...' : 'Uygula'}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function SuggestionChips({ onSelect, disabled }) {
  const translateY = useSharedValue(36);
  const opacity    = useSharedValue(0);

  useEffect(() => {
    opacity.value    = withTiming(1, { duration: 280 });
    translateY.value = withSpring(0, { stiffness: 85, damping: 12 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={sg.row}
        style={sg.scroll}
      >
        {SUGGESTION_CHIPS.map(chip => (
          <TouchableOpacity
            key={chip.id}
            style={sg.chip}
            onPress={() => onSelect(chip.cmd)}
            disabled={disabled}
            activeOpacity={0.75}
          >
            <Text style={sg.chipTxt}>{chip.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

// ── Yardımcılar ───────────────────────────────────────────────────────────────
let _vidId = 0;
function mkVid(file) {
  const id   = String(++_vidId);
  const name = IS_WEB ? file.name : (file.name || 'video.mp4');
  return { id, file, name, sizeMB: ((IS_WEB ? file.size : file.size || 0) / 1024 / 1024).toFixed(1), jobId: null, pct: 0, status: 'pending' };
}
function pickFileWeb() {
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'video/*'; inp.multiple = true;
    inp.onchange = e => resolve(Array.from(e.target.files));
    inp.click();
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// ProcessingAnimation — ActivityIndicator yerine Reanimated spinner
// ════════════════════════════════════════════════════════════════════════════════
function ProcessingAnimation({ size = 28 }) {
  const rotate = useSharedValue(0);
  const scale  = useSharedValue(0.85);

  useEffect(() => {
    rotate.value = withRepeat(
      withTiming(360, { duration: 1100, easing: Easing.linear }), -1
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1,    { duration: 550, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.85, { duration: 550, easing: Easing.inOut(Easing.ease) }),
      ), -1
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: rotate.value + 'deg' }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[pa.ring, { width: size, height: size, borderRadius: size / 2 }, ringStyle]} />
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SkeletonBar — shimmer placeholder
// ════════════════════════════════════════════════════════════════════════════════
function SkeletonBar({ width = '100%', height = 12, radius = 6, style }) {
  const opacity = useSharedValue(0.25);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.65, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.25, { duration: 750, easing: Easing.inOut(Easing.ease) }),
      ), -1
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: C.muted }, style, animStyle]}
    />
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// ActionRow — genişleyen aksiyon satırı
// ════════════════════════════════════════════════════════════════════════════════
function ActionRow({ action, open, onToggle, onApply, busy, currentTime }) {
  const [speedVal,     setSpeedVal]     = useState('1.5');
  const [effectSel,    setEffectSel]    = useState(EFFECT_OPTS[0].id);
  const [filterSel,    setFilterSel]    = useState(FILTER_OPTS[0].id);
  const [subLang,      setSubLang]      = useState('tr');
  const [textInput,    setTextInput]    = useState('');
  const [textPosition, setTextPosition] = useState('bottom');
  const [textColor,    setTextColor]    = useState('white');
  const [textSize,     setTextSize]     = useState(48);

  function apply() {
    if (action.id === 'speed')    return onApply(action.id, { speed: parseFloat(speedVal) || 1.5 });
    if (action.id === 'effect')   return onApply(action.id, { category: effectSel, intensity: 0.75 });
    if (action.id === 'filter')   return onApply(action.id, { filter_name: filterSel });
    if (action.id === 'subtitle') return onApply(action.id, { language: subLang, style: 'bold' });
    if (action.id === 'text') {
      if (!textInput.trim()) return;
      return onApply(action.id, {
        text:      textInput.trim(),
        position:  textPosition,
        color:     textColor,
        font_size: textSize,
        start_sec: currentTime > 0 ? currentTime : null,
      });
    }
    onApply(action.id, {});
  }

  return (
    <View style={ar.wrap}>
      <TouchableOpacity style={ar.row} onPress={onToggle} activeOpacity={0.75}>
        <View style={ar.iconWrap}>
          <Text style={ar.icon}>{action.icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ar.label}>{action.label}</Text>
          <Text style={ar.desc}>{action.desc}</Text>
        </View>
        {busy
          ? <ProcessingAnimation size={22} />
          : <Text style={[ar.chevron, open && { transform: [{ rotate: '90deg' }] }]}>›</Text>
        }
      </TouchableOpacity>

      {open && !busy && (
        <View style={ar.panel}>
          {currentTime > 0 && (
            <Text style={ar.timeHint}>⏱ {currentTime.toFixed(1)}s konumuna uygulanacak</Text>
          )}

          {action.id === 'text' && (
            <>
              <TextInput
                style={ar.textInput}
                placeholder='Yazılacak metni gir… ("Harika Anlar", "INTRO" vs.)'
                placeholderTextColor={C.dim}
                value={textInput}
                onChangeText={setTextInput}
                maxLength={80}
              />
              <Text style={ar.optLabel}>Konum</Text>
              <View style={ar.opts}>
                {TEXT_POSITIONS.map(p => (
                  <TouchableOpacity key={p.id} style={[ar.chip, textPosition === p.id && ar.chipOn]} onPress={() => setTextPosition(p.id)}>
                    <Text style={[ar.chipTxt, textPosition === p.id && ar.chipTxtOn]}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={ar.optLabel}>Renk</Text>
              <View style={ar.opts}>
                {TEXT_COLORS.map(c => (
                  <TouchableOpacity key={c.id} style={[ar.chip, textColor === c.id && ar.chipOn]} onPress={() => setTextColor(c.id)}>
                    <Text style={[ar.chipTxt, textColor === c.id && ar.chipTxtOn]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={ar.optLabel}>Boyut</Text>
              <View style={ar.opts}>
                {TEXT_SIZES.map(s => (
                  <TouchableOpacity key={s.id} style={[ar.chip, textSize === s.id && ar.chipOn]} onPress={() => setTextSize(s.id)}>
                    <Text style={[ar.chipTxt, textSize === s.id && ar.chipTxtOn]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {action.id === 'speed' && (
            <View style={ar.opts}>
              {['0.5', '0.75', '1.5', '2'].map(v => (
                <TouchableOpacity key={v} style={[ar.chip, speedVal === v && ar.chipOn]} onPress={() => setSpeedVal(v)}>
                  <Text style={[ar.chipTxt, speedVal === v && ar.chipTxtOn]}>{v}x</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {action.id === 'effect' && (
            <View style={ar.opts}>
              {EFFECT_OPTS.map(e => (
                <TouchableOpacity key={e.id} style={[ar.chip, effectSel === e.id && ar.chipOn]} onPress={() => setEffectSel(e.id)}>
                  <Text style={[ar.chipTxt, effectSel === e.id && ar.chipTxtOn]}>{e.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {action.id === 'filter' && (
            <View style={ar.opts}>
              {FILTER_OPTS.map(f => (
                <TouchableOpacity key={f.id} style={[ar.chip, filterSel === f.id && ar.chipOn]} onPress={() => setFilterSel(f.id)}>
                  <Text style={[ar.chipTxt, filterSel === f.id && ar.chipTxtOn]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {action.id === 'subtitle' && (
            <View style={ar.opts}>
              {[['tr', '🇹🇷 Türkçe'], ['en', '🇺🇸 İngilizce'], ['de', '🇩🇪 Almanca']].map(([code, lbl]) => (
                <TouchableOpacity key={code} style={[ar.chip, subLang === code && ar.chipOn]} onPress={() => setSubLang(code)}>
                  <Text style={[ar.chipTxt, subLang === code && ar.chipTxtOn]}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={ar.applyBtn} onPress={apply} activeOpacity={0.85}>
            <Text style={ar.applyTxt}>
              {action.id === 'text' ? '✍️ Videoya Ekle' : 'Uygula'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Ses dalgası — Reanimated (native thread, 60fps) ───────────────────────────
function MicWaveform() {
  // Hooks kuralı: döngü içinde çağrılamaz, 4 ayrı tanımla
  const h0 = useSharedValue(4);
  const h1 = useSharedValue(6);
  const h2 = useSharedValue(4);
  const h3 = useSharedValue(5);

  const s0 = useAnimatedStyle(() => ({ height: h0.value }));
  const s1 = useAnimatedStyle(() => ({ height: h1.value }));
  const s2 = useAnimatedStyle(() => ({ height: h2.value }));
  const s3 = useAnimatedStyle(() => ({ height: h3.value }));

  useEffect(() => {
    const cfg = (dur) => ({ duration: dur, easing: Easing.inOut(Easing.sine) });
    h0.value = withRepeat(withSequence(withTiming(14, cfg(300)), withTiming(4,  cfg(300))), -1);
    h1.value = withDelay(120, withRepeat(withSequence(withTiming(20, cfg(340)), withTiming(6,  cfg(340))), -1));
    h2.value = withDelay(60,  withRepeat(withSequence(withTiming(18, cfg(320)), withTiming(4,  cfg(320))), -1));
    h3.value = withDelay(180, withRepeat(withSequence(withTiming(12, cfg(380)), withTiming(5,  cfg(380))), -1));
  }, []);

  const barBase = { width: 3, borderRadius: 2, backgroundColor: '#fff' };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2.5, height: 24 }}>
      <Animated.View style={[barBase, s0]} />
      <Animated.View style={[barBase, s1]} />
      <Animated.View style={[barBase, s2]} />
      <Animated.View style={[barBase, s3]} />
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// CommandBar — mikrofon + yazılabilir komut girişi
// ════════════════════════════════════════════════════════════════════════════════
function usePulse(active) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.14, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.00, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [active]);
  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

function CommandBar({ value, interim, listening, onChangeText, onSend, onToggleMic, micAvail, disabled }) {
  const pulseStyle = usePulse(listening);
  const canSend = (value.trim() || interim.trim()) && !disabled;
  const displayText = listening ? interim : value;
  const isInterim = listening && !!interim;

  return (
    <View style={cb.wrap}>
      {micAvail && (
        <Animated.View style={pulseStyle}>
          <TouchableOpacity
            style={[cb.mic, listening && cb.micActive]}
            onPress={onToggleMic}
            activeOpacity={0.8}
          >
            {listening
              ? <MicWaveform />
              : <Text style={cb.micIcon}>🎙</Text>
            }
          </TouchableOpacity>
        </Animated.View>
      )}
      <TextInput
        style={[cb.input, isInterim && cb.inputInterim]}
        placeholder={listening ? 'Dinliyorum kanka...' : 'Komut yaz veya mikrofona bas...'}
        placeholderTextColor={C.dim}
        value={displayText}
        onChangeText={onChangeText}
        onSubmitEditing={onSend}
        returnKeyType="send"
        blurOnSubmit={false}
        editable={!listening && !disabled}
        maxLength={400}
      />
      <TouchableOpacity
        style={[cb.send, !canSend && cb.sendOff]}
        onPress={onSend}
        disabled={!canSend}
        activeOpacity={0.8}
      >
        <Text style={cb.sendIcon}>↑</Text>
      </TouchableOpacity>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// WorkspaceScreen
// ════════════════════════════════════════════════════════════════════════════════
export function WorkspaceScreen({ session, planCtx, onPaywall }) {

  const [wsState, setWsState]               = useState('idle');
  const [jobData, setJobData]               = useState(null);
  const [uploadPct, setUploadPct]           = useState(0);
  const [result, setResult]                 = useState(null);
  const [currentTime, setCurrentTime]       = useState(0);
  const [videoUri, setVideoUri]             = useState(null);
  const [openAction, setOpenAction]         = useState(null);
  const [busyAction, setBusyAction]         = useState(null);
  const [toast, setToast]                   = useState('');
  const [cmdText, setCmdText]               = useState('');
  const [appliedOps, setAppliedOps]         = useState([]);
  const [videoList, setVideoList]           = useState([]);
  const [mergeUploading, setMergeUploading] = useState(false);
  const [mergeSettings, setMergeSettings]   = useState({ transition: 'cut', clips: {} });
  const [editTransition, setEditTransition] = useState(null); // geçiş tipi: fade, slideleft vb.
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [showActions, setShowActions]             = useState(false);
  const [messages, setMessages]                   = useState([]);
  const [chatLoading, setChatLoading]             = useState(false);
  const [chatHistory, setChatHistory]             = useState([]);
  const [confirmData, setConfirmData]             = useState(null);
  const [recommendations, setRecommendations]     = useState([]);
  const [applyingRec, setApplyingRec]             = useState(null);

  const videoListRef     = useRef([]);
  const mergeSettingsRef = useRef(mergeSettings);
  const processingRef    = useRef(false);
  const onTranscriptRef  = useRef(null);

  useEffect(() => { videoListRef.current = videoList; },         [videoList]);
  useEffect(() => { mergeSettingsRef.current = mergeSettings; }, [mergeSettings]);

  const { speak } = useTTS();

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  function addMsg(role, text) {
    setMessages(prev => [...prev, { id: `${Date.now()}_${Math.random()}`, role, text }]);
  }

  async function sendToAI(userText) {
    addMsg('user', userText);
    setChatLoading(true);
    try {
      const res = await sendChatMessage({ message: userText, history: chatHistory, jobId: jobData?.jobId });
      const reply = res.message || res.reply || res.text || 'Anladım kanka!';
      addMsg('assistant', reply);
      setChatHistory(prev => [
        ...prev,
        { role: 'user', content: userText },
        { role: 'assistant', content: reply },
      ]);
      if (res.ready_to_edit && res.edit_params) setConfirmData(res.edit_params);
    } catch (e) {
      addMsg('assistant', `Üzgünüm, bir sorun oluştu: ${e.message}`);
    } finally {
      setChatLoading(false);
    }
  }

  function handleConfirm() {
    if (!confirmData || !jobData?.jobId) return;
    const params = { ...confirmData };
    setConfirmData(null);
    const transMsg = editTransition ? ` (${TRANSITION_TYPES[editTransition]?.label || editTransition} geçişiyle)` : '';
    addMsg('assistant', `Harika! Edit başlıyor${transMsg}, az bekle kanka 🚀`);
    startEdit({
      commandText:       params.command_text || '',
      platform:          params.platform || 'youtube',
      targetDurationSec: params.target_duration_sec || null,
      transition:        editTransition,
    });
  }

  function handleReject() {
    setConfirmData(null);
    addMsg('assistant', 'Tamam kanka, değiştirelim. Ne yapmak istiyorsun? 🎙');
  }

  // ── Polling ───────────────────────────────────────────────────────────────
  const { editLoading, editProgress, startEdit } = useEditPolling({
    jobId: jobData?.jobId,
    onDone: r => {
      const url = toAbsoluteUrl(r?.output_url || r?.download_url || '');
      if (url) {
        setResult(prev => ({ ...prev, download_url: url, output_url: url }));
        setVideoUri(url);
        setWsState('done');
      }
      showToast('✅ Tamamlandı!');
      speak('Tamamlandı');
      addMsg('assistant', 'Bitti kanka! 🎉 Video hazır — yukarıdan önizleyebilir, indirmek için "⬇ İndir" butonuna basabilirsin. Başka bir şey yapalım mı?');
    },
    onError: e => {
      setWsState('ready');
      showToast(`Hata: ${e.message}`);
      addMsg('assistant', `Ups, bir hata oluştu: ${e.message} — tekrar deneyelim mi?`);
    },
  });

  function updateResult(res) {
    const url = toAbsoluteUrl(res?.output_url || res?.download_url || '');
    if (!url) return;
    setResult(prev => ({ ...prev, download_url: url, output_url: url }));
    setVideoUri(url);
    setWsState('done');
  }

  // ── Dosya seç ─────────────────────────────────────────────────────────────
  async function pickFiles() {
    if (IS_WEB) return pickFileWeb();
    const res = await DocumentPicker.getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true, allowsMultipleSelection: true });
    if (res.canceled) return [];
    return res.assets || [];
  }

  async function handleUpload() {
    try {
      const files = await pickFiles();
      if (!files.length) return;

      if (files.length === 1 && videoList.length === 0) {
        const file = files[0];
        setWsState('uploading'); setUploadPct(0);
        const data = await uploadVideoWithProgress(file, pct => setUploadPct(pct));
        const uri = IS_WEB ? URL.createObjectURL(file) : (file.uri || file.name);
        setJobData({ jobId: data.job_id, duration: data.duration || 60, name: file.name || 'video.mp4' });
        setVideoUri(uri);
        setCurrentTime(0);
        setWsState('ready');
        speak('Video hazır, analiz ediyorum.');
        setMessages([]);
        setChatHistory([]);
        setConfirmData(null);
        setRecommendations([]);
        setTimeout(() => addMsg('assistant', `"${file.name || 'Video'}" yüklendi! Analiz ediyorum... 🔍`), 300);
        // Arka planda video analizi
        analyzeVideo(data.job_id).then(analysis => {
          setRecommendations(analysis.recommendations || []);
          const recLabels = (analysis.recommendations || []).map(r => `• ${r.label}`).join('\n');
          addMsg('assistant',
            `${analysis.summary}\n\nSenin için ${analysis.recommendations?.length || 0} öneri hazırladım:\n${recLabels}\n\nBirini uygulayayım mı, yoksa başka bir şey mi yapalım? 🎙`
          );
        }).catch(() => {
          addMsg('assistant', 'Video hazır! Ne yapalım kanka? Altyazı, efekt, müzik — söyle! 🎙');
        });
      } else {
        setVideoList(prev => [...prev, ...files.map(f => mkVid(f))].slice(0, 5));
        setMergeModalVisible(true);
      }
    } catch (e) {
      setWsState('idle');
      showToast(`Yükleme hatası: ${e.message}`);
    }
  }

  async function handleAddMore() {
    if (videoList.length >= 5) return;
    const files = await pickFiles().catch(() => []);
    if (!files.length) return;
    setVideoList(prev => [...prev, ...files.map(f => mkVid(f))].slice(0, 5));
    setMergeModalVisible(true);
  }

  async function handleMergeUpload() {
    const vl = videoListRef.current;
    const ms = mergeSettingsRef.current;
    if (vl.length < 1 || mergeUploading) return;
    setMergeUploading(true);
    try {
      const uploaded = [];
      for (const v of vl) {
        const data = await uploadVideoWithProgress(v.file, pct =>
          setVideoList(prev => prev.map(x => x.id === v.id ? { ...x, pct } : x))
        );
        uploaded.push({ ...v, jobId: data.job_id });
        setVideoList(prev => prev.map(x => x.id === v.id ? { ...x, jobId: data.job_id, status: 'done', pct: 100 } : x));
      }

      let jd;
      if (uploaded.length === 1) {
        jd = { jobId: uploaded[0].jobId, duration: 0, name: uploaded[0].name };
      } else {
        const clips = uploaded.map(v => ({
          job_id: v.jobId,
          start:  parseFloat(ms.clips[v.id]?.trimStart) || 0,
          end:    ms.clips[v.id]?.trimEnd != null && ms.clips[v.id]?.trimEnd !== ''
                    ? parseFloat(ms.clips[v.id].trimEnd) || undefined : undefined,
        }));
        const res = await trimMerge(clips, { transition: ms.transition });
        jd = { jobId: res.job_id || uploaded[0].jobId, duration: res.duration || 0, name: `Birleştirilmiş (${uploaded.length} video)` };
      }

      setJobData(jd);
      setVideoList([]); setMergeSettings({ transition: 'cut', clips: {} }); setMergeModalVisible(false);
      setWsState('ready');
      speak('Video hazır, analiz ediyorum.');
      setMessages([]);
      setChatHistory([]);
      setConfirmData(null);
      setRecommendations([]);
      setTimeout(() => addMsg('assistant', `${uploaded.length} video birleştirildi! Analiz ediyorum... 🔍`), 300);
      analyzeVideo(jd.jobId).then(analysis => {
        setRecommendations(analysis.recommendations || []);
        const recLabels = (analysis.recommendations || []).map(r => `• ${r.label}`).join('\n');
        addMsg('assistant', `${analysis.summary}\n\nÖnerilerim:\n${recLabels}\n\nBirini uygulayayım mı? 🎙`);
      }).catch(() => {
        addMsg('assistant', `${uploaded.length} video birleştirildi! Şimdi ne yapalım kanka? 🎙`);
      });
    } catch (e) {
      showToast(`Birleştirme hatası: ${e.message}`);
    } finally {
      setMergeUploading(false);
    }
  }

  // ── Aksiyon uygula ────────────────────────────────────────────────────────
  async function handleApply(id, opts = {}) {
    if (!jobData?.jobId || busyAction) return;
    setBusyAction(id); setOpenAction(null);
    // Seçili zaman damgası varsa ekle
    const optsWithTime = currentTime > 0 ? { ...opts, start_time: currentTime } : opts;
    try {
      let res;
      if (id === 'text')          res = await addTextOverlay(jobData.jobId, optsWithTime);
      else if (id === 'subtitle') res = await generateSubtitles(jobData.jobId, optsWithTime);
      else if (id === 'effect')   res = await applyEffect(jobData.jobId, optsWithTime);
      else if (id === 'music')    res = await addMusic(jobData.jobId, optsWithTime);
      else if (id === 'speed')    res = await changeSpeed(jobData.jobId, optsWithTime);
      else if (id === 'shorts')   res = await generateShorts(jobData.jobId, optsWithTime);
      else if (id === 'filter')   res = await applyFilter(jobData.jobId, optsWithTime);
      else if (id === 'bgremove') res = await removeBackground(jobData.jobId, optsWithTime);
      else if (id === 'enhance')  res = await enhanceAudio(jobData.jobId, optsWithTime);
      else if (id === 'sfx')      res = await addSoundEffect(jobData.jobId, optsWithTime);
      else if (id === 'undo')     res = await undoEdit(jobData.jobId);
      if (res) updateResult(res);
      if (id !== 'undo') {
        const action = ACTIONS.find(a => a.id === id);
        setAppliedOps(prev => [...prev, {
          id:    `${id}_${Date.now()}`,
          type:  id,
          icon:  action?.icon ?? '⚡',
          color: MARKER_COLORS[id] ?? '#6366f1',
          time:  currentTime,
          label: action?.label ?? id,
        }]);
      } else {
        // Geri al → son marker'ı kaldır
        setAppliedOps(prev => prev.slice(0, -1));
      }
      showToast('✅ Uygulandı!');
      speak('Tamamlandı');
    } catch (e) {
      showToast(`Hata: ${e.message}`);
    } finally {
      setBusyAction(null);
    }
  }

  // ── Tavsiye uygula ────────────────────────────────────────────────────────
  async function handleApplyRec(rec) {
    if (!jobData?.jobId || applyingRec) return;
    setApplyingRec(rec.type);
    try {
      await handleApply(rec.type, rec.params || {});
      // Uygulanan tavsiyeyi listeden kaldır
      setRecommendations(prev => prev.filter(r => r !== rec));
    } catch {}
    finally { setApplyingRec(null); }
  }

  // ── Sesli / yazılı komut — yürüt ─────────────────────────────────────────
  function executeCmd(text) {
    if (!text?.trim() || processingRef.current) return;
    processingRef.current = true;
    try {
      const t = text.trim().toLowerCase();

      // Onay / ret (AI edit planı bekleniyorsa)
      if (isConfirmWord(t) && confirmData) { handleConfirm(); return; }
      if (isRejectWord(t) && confirmData)  { handleReject();  return; }

      if (isUndoCmd(t)) { handleApply('undo', {}); return; }

      // Geçiş komutu
      if (/geçiş|transition|fade|slide|wipe|dissolve|daire|piksel/i.test(t)) {
        const detected = detectTransitionCmd(t);
        if (detected) {
          setEditTransition(detected);
          const info = TRANSITION_TYPES[detected];
          addMsg('assistant', `${info?.emoji || '🎬'} ${info?.label || detected} geçişi seçildi! Onaylayınca uygulanacak.`);
          speak(`${info?.label || detected} geçişi seçildi`);
          return;
        }
      }

      // Video birleştirme modal
      if (/video.*birleştir|birleştir|merge/i.test(t)) {
        setMergeModalVisible(true); return;
      }

      // Zaman damgası komutları
      const timeInfo = parseTimeFromText(t);
      if (timeInfo) {
        setCurrentTime(timeInfo.start);
        showToast(`⏱ ${timeInfo.start}s konumuna ayarlandı`);
        speak(`${timeInfo.start} saniyeye ayarlandı`);
        if (/efekt|effect/i.test(t))          handleApply('effect',   { category: 'impact_shock', intensity: 0.75 });
        else if (/altyazı|subtitle/i.test(t)) handleApply('subtitle', { language: 'tr', style: 'bold' });
        else if (/müzik|music/i.test(t))      handleApply('music',    {});
        return;
      }

      // ── Stil presetleri ──────────────────────────────────────────────────
      if (/mrbeast|mr.?beast/i.test(t)) {
        addMsg('assistant', 'MrBeast stili yüklüyor! 🚀 Canlı filtre uyguluyorum...');
        handleApply('filter', { filter_name: 'vivid' }); return;
      }
      if (/sinematik|cinematic/i.test(t))       { handleApply('filter', { filter_name: 'cinematic' }); return; }
      if (/warm|sıcak|gün.?batımı/i.test(t))    { handleApply('filter', { filter_name: 'warm' }); return; }
      if (/noir|karanlık|siyah.?beyaz/i.test(t)) { handleApply('filter', { filter_name: 'noir' }); return; }
      if (/vivid|canlı.?renk/i.test(t))          { handleApply('filter', { filter_name: 'vivid' }); return; }

      // ── Metin / başlık overlay ────────────────────────────────────────────
      if (/başlık|metin|yazı|title|text\s+ekle|grafik/i.test(t)) {
        // Tırnak içindeki veya "yaz: ..." sonrasındaki metni çıkar
        const quoted = t.match(/["""''](.*?)["""'']/) || t.match(/(?:yaz[ıi]?|ekle|koy)[:\s]+([^,.\n]+)/i);
        const overlayText = (quoted?.[1] || quoted?.[2] || '').trim();
        if (overlayText) {
          const pos   = /üst|top|yukar/i.test(t) ? 'top' : /orta|center|merk/i.test(t) ? 'center' : 'bottom';
          const color = /sarı|yellow/i.test(t) ? 'yellow' : /kırmızı|red/i.test(t) ? 'red' : /siyan|cyan/i.test(t) ? 'cyan' : 'white';
          const size  = /büyük|large|xl/i.test(t) ? 64 : /küçük|small/i.test(t) ? 32 : 48;
          handleApply('text', { text: overlayText, position: pos, color, font_size: size });
        } else {
          // Metin belirtilmemiş → paneli aç
          setOpenAction('text');
          setShowActions(true);
          addMsg('assistant', 'Paneli açtım kanka! Yazını gir, konumunu ve rengini seç, sonra "Videoya Ekle" de. 🎬');
        }
        return;
      }

      // ── Doğrudan operasyonlar ─────────────────────────────────────────────
      if (/altyazı|subtitle/i.test(t))       { handleApply('subtitle', { language: 'tr', style: 'bold' }); return; }
      if (/efekt|effect/i.test(t))           { handleApply('effect',   { category: 'impact_shock', intensity: 0.75 }); return; }
      if (/müzik|music/i.test(t))            { handleApply('music',    {}); return; }
      if (/hızlan|speed.?up|fast/i.test(t))  { handleApply('speed',    { speed: 1.5 }); return; }
      if (/yavaşla|slow/i.test(t))           { handleApply('speed',    { speed: 0.5 }); return; }
      if (/filtre|filter/i.test(t))          { handleApply('filter',   { filter_name: 'cinematic' }); return; }
      if (/shorts|tiktok|reels/i.test(t))    { handleApply('shorts',   {}); return; }
      if (/ses.*(iyileştir|temizle|gürültü)|audio|gürültü/i.test(t)) { handleApply('enhance', {}); return; }
      if (/arka.?plan|background/i.test(t))  { handleApply('bgremove', {}); return; }

      // ── Bilinmeyen komut → AI'ya gönder ──────────────────────────────────
      sendToAI(text);
    } finally {
      processingRef.current = false;
    }
  }

  // Mikrofon: sesli komut → otomatik yürüt (ref pattern — identity stable)
  const stableOnTranscript = useCallback(t => onTranscriptRef.current?.(t), []);
  // Her render'da güncel closures'ı yakala
  onTranscriptRef.current = (t) => {
    setCmdText(t);
    if (t.trim() && jobData) executeCmd(t);
  };

  const { micAvail, listening, interim, startMic, stopMicAndSend } = useMicrophone({
    language:     'tr-TR',
    onTranscript: stableOnTranscript,
  });

  function handleMicToggle() {
    if (listening) {
      stopMicAndSend();
    } else {
      setCmdText('');
      startMic();
    }
  }

  function handleSendCmd() {
    const text = cmdText.trim();
    if (!text || !jobData || chatLoading) return;
    setCmdText('');
    executeCmd(text);
  }

  // ── İndir / Yeniden başla ─────────────────────────────────────────────────
  async function handleDownload() {
    const url = result?.download_url;
    if (!url) return;
    if (IS_WEB) {
      const a = document.createElement('a');
      a.href = url; a.download = 'clipla-output.mp4'; a.click();
    } else {
      const ok = await Sharing.isAvailableAsync();
      if (ok) await Sharing.shareAsync(url);
    }
  }

  function handleRestart() {
    setWsState('idle'); setJobData(null); setResult(null); setRecommendations([]);
    setVideoUri(null); setCurrentTime(0); setAppliedOps([]);
    setOpenAction(null); setBusyAction(null);
    setVideoList([]); setMergeSettings({ transition: 'cut', clips: {} });
    setMessages([]); setChatHistory([]); setConfirmData(null); setShowActions(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={ws.root}>

      {/* IDLE */}
      {wsState === 'idle' && (
        <View style={ws.idle}>
          <View style={ws.idleCard}>
            <Text style={ws.idleEmoji}>🎬</Text>
            <Text style={ws.idleTitle}>Videoyu yükle</Text>
            <Text style={ws.idleSub}>Düzenlemek istediğin videoyu seç</Text>
            <TouchableOpacity style={ws.idleBtn} onPress={handleUpload} activeOpacity={0.85}>
              <Text style={ws.idleBtnTxt}>📁  Video Seç</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* UPLOADING */}
      {wsState === 'uploading' && (
        <View style={ws.idle}>
          <View style={ws.uploadCard}>
            <ProcessingAnimation size={36} />
            <Text style={ws.uploadName} numberOfLines={1}>{jobData?.name || 'Video yükleniyor...'}</Text>
            <View style={ws.track}><View style={[ws.fill, { width: `${uploadPct}%` }]} /></View>
            <Text style={ws.pct}>{uploadPct}%</Text>
            <View style={{ width: '100%', gap: 8, marginTop: 4 }}>
              <SkeletonBar height={8} width="80%" />
              <SkeletonBar height={8} width="60%" />
              <SkeletonBar height={8} width="70%" />
            </View>
          </View>
        </View>
      )}

      {/* WORKSPACE: ready / done / processing */}
      {(wsState === 'ready' || wsState === 'done' || wsState === 'processing') && (
        <View style={{ flex: 1 }}>

          {/* ── Üst alan: video bilgisi + timeline + opsiyonel işlem listesi ── */}
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={ws.videoSection}
            contentContainerStyle={ws.videoSectionContent}
          >
            {/* Video başlık */}
            <View style={ws.topBar}>
              <View style={ws.videoThumb}>
                <Text style={{ fontSize: 20 }}>{wsState === 'done' ? '✅' : '🎬'}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={ws.videoName} numberOfLines={1}>{jobData?.name}</Text>
                <Text style={ws.videoMeta}>
                  {jobData?.duration ? `${Math.round(jobData.duration)}s` : 'Hazır'}
                  {currentTime > 0 ? ` · ⏱ ${currentTime.toFixed(1)}s` : ''}
                </Text>
              </View>
              <TouchableOpacity style={ws.changeBtn} onPress={handleUpload} activeOpacity={0.8}>
                <Text style={ws.changeBtnTxt}>Değiştir</Text>
              </TouchableOpacity>
            </View>

            {/* Film şeridi */}
            <View style={ws.timelineWrap}>
              <VideoTimeline
                uri={videoUri}
                duration={jobData?.duration || 60}
                currentTime={currentTime}
                onTimeChange={setCurrentTime}
                markers={appliedOps}
              />
              {currentTime > 0 && (
                <TouchableOpacity style={ws.clearTime} onPress={() => setCurrentTime(0)}>
                  <Text style={ws.clearTimeTxt}>× Konumu sıfırla</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Done: video önizleme */}
            {wsState === 'done' && result && (
              <View style={ws.playerWrap}>
                <NativeVideoPlayer
                  uri={toAbsoluteUrl(result.download_url || result.output_url || '')}
                  height={140}
                />
              </View>
            )}

            {/* İşlem durumu */}
            {(editLoading || busyAction) && (
              <View style={ws.statusCard}>
                <ProcessingAnimation size={26} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={ws.statusTxt}>{editProgress || 'İşleniyor...'}</Text>
                  <SkeletonBar height={3} style={{ marginTop: 6 }} />
                </View>
              </View>
            )}

            {/* Done: hızlı aksiyon satırı */}
            {wsState === 'done' && result && (
              <View style={ws.doneQuickRow}>
                <TouchableOpacity style={ws.dlBtn} onPress={handleDownload} activeOpacity={0.85}>
                  <Text style={ws.dlBtnTxt}>⬇  İndir</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ws.restartBtnSm} onPress={handleRestart} activeOpacity={0.85}>
                  <Text style={ws.restartTxt}>🔄</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Manuel işlemler toggle */}
            <TouchableOpacity
              style={ws.actionsToggle}
              onPress={() => setShowActions(p => !p)}
              activeOpacity={0.75}
            >
              <Text style={ws.actionsToggleTxt}>
                {showActions ? '▲ Gizle' : '⚙️ Manuel İşlemler'}
              </Text>
            </TouchableOpacity>

            {showActions && (
              <>
                {ACTIONS.map(action => (
                  <ActionRow
                    key={action.id}
                    action={action}
                    open={openAction === action.id}
                    busy={busyAction === action.id}
                    currentTime={currentTime}
                    onToggle={() => setOpenAction(prev => prev === action.id ? null : action.id)}
                    onApply={handleApply}
                  />
                ))}
                <View style={ws.bottomActions}>
                  <TouchableOpacity style={ws.mergeBtn} onPress={() => setMergeModalVisible(true)} activeOpacity={0.85}>
                    <Text style={ws.mergeBtnTxt}>🔗  Video Birleştir</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={ws.restartBtn} onPress={handleRestart} activeOpacity={0.85}>
                    <Text style={ws.restartTxt}>🔄  Yeniden Başla</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ height: 8 }} />
              </>
            )}
          </ScrollView>

          {/* ── AI Tavsiyeleri ── */}
          {recommendations.length > 0 && (wsState === 'ready' || wsState === 'done') && (
            <RecommendationCards
              recs={recommendations}
              onApply={handleApplyRec}
              applyingRec={applyingRec}
            />
          )}

          {/* ── Clipla AI Sohbet ── */}
          <View style={{ flex: 1 }}>
            <ChatMessages
              messages={messages}
              loading={chatLoading}
              confirmData={confirmData}
              onConfirm={handleConfirm}
              onReject={handleReject}
              editLoading={editLoading}
              editProgress={editProgress}
              isListening={listening}
              interim={interim}
              wsState={wsState}
            />
          </View>

          {/* ── Öneri chip'leri ── */}
          {(wsState === 'ready' || wsState === 'done') && (
            <SuggestionChips
              onSelect={cmd => { setCmdText(''); executeCmd(cmd); }}
              disabled={!!busyAction || chatLoading}
            />
          )}
        </View>
      )}

      {/* Komut çubuğu — workspace aktifken göster */}
      {(wsState === 'ready' || wsState === 'done' || wsState === 'processing') && (
        <CommandBar
          value={listening ? '' : cmdText}
          interim={listening ? (interim || '') : ''}
          listening={listening}
          onChangeText={t => { if (!listening) setCmdText(t); }}
          onSend={handleSendCmd}
          onToggleMic={handleMicToggle}
          micAvail={micAvail}
          disabled={!!busyAction}
        />
      )}

      {/* Toast */}
      {!!toast && (
        <View style={ws.toast} pointerEvents="none">
          <Text style={ws.toastTxt}>{toast}</Text>
        </View>
      )}

      {/* Birleştirme modal */}
      <VideoMergeModal
        visible={mergeModalVisible}
        onClose={() => {
          if (!mergeUploading) {
            setMergeModalVisible(false); setVideoList([]);
            setMergeSettings({ transition: 'cut', clips: {} });
          }
        }}
        videoList={videoList}
        setVideoList={setVideoList}
        mergeSettings={mergeSettings}
        setMergeSettings={setMergeSettings}
        onMergeUpload={handleMergeUpload}
        uploading={mergeUploading}
        onAddMore={handleAddMore}
      />
    </View>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────
const ws = StyleSheet.create({
  root:               { flex: 1, backgroundColor: C.bg },
  scroll:             { flex: 1 },
  scrollContent:      { paddingHorizontal: 16, paddingTop: 14 },
  videoSection:       { flexShrink: 0 },
  videoSectionContent:{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  actionsToggle:      { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 2, marginTop: 2 },
  actionsToggleTxt:   { fontSize: 11, color: C.accent, fontWeight: '600', letterSpacing: 0.3 },
  doneQuickRow:       { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 4 },
  restartBtnSm:       { backgroundColor: C.card, borderRadius: 13, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: C.border },

  idle:        { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  idleCard:    { width: '100%', maxWidth: 400, alignItems: 'center', backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 32 },
  idleEmoji:   { fontSize: 52, marginBottom: 14 },
  idleTitle:   { fontSize: 20, color: C.txt, fontWeight: '700', marginBottom: 6 },
  idleSub:     { fontSize: 13, color: C.dim, marginBottom: 24, textAlign: 'center' },
  idleBtn:     { width: '100%', backgroundColor: C.accent, borderRadius: 13, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  idleBtnTxt:  { color: '#fff', fontSize: 15, fontWeight: '700' },
  uploadCard: { width: '100%', maxWidth: 400, backgroundColor: C.card, borderRadius: 16, padding: 24, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: C.border },
  uploadName: { fontSize: 14, color: C.txt, fontWeight: '600' },
  track:      { width: '100%', height: 4, backgroundColor: C.muted, borderRadius: 2, overflow: 'hidden' },
  fill:       { height: 4, backgroundColor: C.accent, borderRadius: 2 },
  pct:        { fontSize: 12, color: C.dim },

  topBar:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  videoThumb:  { width: 40, height: 40, borderRadius: 10, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  videoName:   { fontSize: 13, color: C.txt, fontWeight: '600', marginBottom: 2 },
  videoMeta:   { fontSize: 11, color: C.dim },
  changeBtn:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7, borderWidth: 1, borderColor: C.border },
  changeBtnTxt:{ fontSize: 11, color: C.dim },

  timelineWrap: { marginBottom: 14, backgroundColor: C.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: C.border },
  clearTime:    { alignSelf: 'flex-end', marginTop: 6 },
  clearTimeTxt: { fontSize: 11, color: C.dim },

  playerWrap: { marginBottom: 12, borderRadius: 12, overflow: 'hidden' },

  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: C.card2, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  statusTxt:  { fontSize: 12, color: C.dim },

  sectionLabel: { fontSize: 10, color: C.dim, letterSpacing: 1.5, fontWeight: '700', marginBottom: 8 },

  bottomActions: { gap: 10, marginTop: 20 },
  dlBtn:         { backgroundColor: C.accent, borderRadius: 13, paddingVertical: 14, alignItems: 'center' },
  dlBtnTxt:      { color: '#fff', fontSize: 15, fontWeight: '700' },
  mergeBtn:      { borderRadius: 13, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  mergeBtnTxt:   { color: C.txt, fontSize: 13, fontWeight: '600' },
  restartBtn:    { backgroundColor: C.card, borderRadius: 13, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  restartTxt:    { color: C.dim, fontSize: 13 },

  toast:    { position: 'absolute', bottom: 80, alignSelf: 'center', backgroundColor: 'rgba(22,23,31,0.97)', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: C.border },
  toastTxt: { color: C.txt, fontSize: 13, fontWeight: '500' },
});

const ar = StyleSheet.create({
  wrap:     { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginBottom: 8, overflow: 'hidden' },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  icon:     { fontSize: 18 },
  label:    { fontSize: 14, color: C.txt, fontWeight: '600', marginBottom: 2 },
  desc:     { fontSize: 11, color: C.dim },
  chevron:  { fontSize: 22, color: C.dim },

  panel:    { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderColor: C.border },
  timeHint: { fontSize: 11, color: C.accent, marginTop: 10, marginBottom: 2 },
  opts:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginBottom: 4 },
  chip:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border },
  chipOn:   { backgroundColor: C.accent, borderColor: C.accent },
  chipTxt:  { fontSize: 12, color: C.dim, fontWeight: '500' },
  chipTxtOn:{ color: '#fff', fontWeight: '600' },
  applyBtn:  { marginTop: 12, backgroundColor: C.accent, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  applyTxt:  { color: '#fff', fontSize: 14, fontWeight: '700' },
  textInput: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: C.txt, fontSize: 13, marginTop: 10, marginBottom: 4 },
  optLabel:  { fontSize: 10, color: C.dim, letterSpacing: 1.2, fontWeight: '700', marginTop: 10, marginBottom: 2 },
});

const cb = StyleSheet.create({
  wrap:         { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 14, borderTopWidth: 1, borderColor: C.border, backgroundColor: C.card },
  mic:          { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  micActive:    { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  micIcon:      { fontSize: 18 },
  input:        { flex: 1, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, color: C.txt, fontSize: 13, maxHeight: 80 },
  inputInterim: { color: C.dim },
  send:         { width: 40, height: 40, borderRadius: 20, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendOff:      { opacity: 0.3 },
  sendIcon:     { color: '#fff', fontSize: 20, fontWeight: '700' },
});

const sg = StyleSheet.create({
  scroll: { flexGrow: 0, borderTopWidth: 1, borderColor: C.border, backgroundColor: C.card },
  row:    { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip:   { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 18, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border },
  chipTxt:{ fontSize: 12, color: C.txt, fontWeight: '500' },
});

const pa = StyleSheet.create({
  ring: {
    borderWidth: 2.5,
    borderColor: 'transparent',
    borderTopColor: C.accent,
    borderRightColor: 'rgba(99,102,241,0.35)',
  },
});

const ws2 = StyleSheet.create({
  recWrap:   { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  recTitle:  { fontSize: 9, color: C.accent, letterSpacing: 2, fontWeight: '700', marginBottom: 6 },
  recCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 10, marginBottom: 6 },
  recLeft:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 10 },
  recIcon:   { fontSize: 20 },
  recLabel:  { fontSize: 12, color: C.txt, fontWeight: '600', marginBottom: 2 },
  recReason: { fontSize: 11, color: C.dim, lineHeight: 15 },
  recBtn:    { backgroundColor: C.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  recBtnBusy: { opacity: 0.5 },
  recBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
