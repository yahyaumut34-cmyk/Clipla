import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import { generateSubtitles, toAbsoluteUrl, bustCache, applyEffect, addSoundEffect, addMusic } from '../api';
import { useMicrophone } from '../hooks/useMicrophone';
import { useTTS } from '../hooks/useTTS';
import { useEffectIntent } from '../hooks/useEffectIntent';
import { NativeVideoPlayer } from './NativeVideoPlayer';
import { C, IS_WEB } from '../shared/theme';
import { SUB_LANGS, detectSubtitleLang } from '../shared/constants';
import { Badge } from './Badge';

function getViralityData(scores, editPlan) {
  const info    = scores.info_density  ?? null;
  const pacing  = scores.pacing_score  ?? null;
  const hook    = scores.hook_score    ?? info;
  const retention = scores.retention_score ?? pacing;

  if (info === null && pacing === null) return null;

  const overall = Math.round(((info ?? 50) + (pacing ?? 50)) / 2);
  const cuts    = editPlan?.cuts_applied ?? null;

  const hookLabel    = hook    >= 70 ? 'Güçlü' : hook    >= 40 ? 'Orta' : 'Zayıf';
  const tempoLabel   = pacing  >= 70 ? 'Hızlı ve ilgi çekici' : pacing >= 40 ? 'Dengeli' : 'Yavaş, izleyici kaybedebilirsin';
  const verdict      = overall >= 70 ? 'Viral potansiyeli yüksek' : overall >= 45 ? 'Ortalama içerik' : 'Geliştirme önerilir';
  const verdictColor = overall >= 70 ? '#1db974' : overall >= 45 ? '#ffd166' : '#f87171';

  const tips = [];
  if ((info ?? 50) < 50)  tips.push('İlk 3 saniyeye güçlü bir kanca ekle');
  if ((pacing ?? 50) < 50) tips.push('Daha sık kesimle tempo artır');
  if (cuts !== null && cuts < 3) tips.push('Daha fazla kesim dinamizm sağlayabilir');
  if ((retention ?? 50) < 50) tips.push('İzlenme süresini artırmak için sonucu güçlendir');

  return { overall, hookLabel, tempoLabel, verdict, verdictColor, tips };
}

const ViralityCard = memo(function ViralityCard({ scores, analysis, editPlan }) {
  const data = useMemo(() => getViralityData(scores, editPlan), [scores, editPlan]);
  if (!data) return null;

  const { overall, hookLabel, tempoLabel, verdict, verdictColor, tips } = data;
  const barColor = overall >= 70 ? C.green : overall >= 45 ? C.warn : '#f87171';

  return (
    <View style={[s.metricsCard, { borderColor: verdictColor + '40' }]}>
      <Text style={s.sectionLabel}>VİRALİTE ANALİZİ</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <View style={{ height: 6, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ height: 6, width: `${overall}%`, backgroundColor: barColor, borderRadius: 3 }}/>
          </View>
        </View>
        <Text style={{ color: barColor, fontSize: 20, fontWeight: '700', marginLeft: 12 }}>{overall}</Text>
        <Text style={{ color: C.muted, fontSize: 11, marginLeft: 2 }}>/100</Text>
      </View>
      <Text style={{ color: verdictColor, fontSize: 12, fontWeight: '600', marginBottom: 12 }}>{verdict}</Text>
      {[
        ['Kanca Gücü', hookLabel],
        ['Tempo',      tempoLabel],
      ].map(([k, v]) => (
        <View key={k} style={[s.metricRow, { borderBottomWidth: 0, paddingVertical: 4 }]}>
          <Text style={s.metricKey}>{k}</Text>
          <Text style={[s.metricVal, { color: C.dim }]}>{v}</Text>
        </View>
      ))}
      {tips.length > 0 && (
        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: C.border }}>
          <Text style={[s.sectionLabel, { marginBottom: 6 }]}>ÖNERİLER</Text>
          {tips.map((tip, i) => (
            <Text key={i} style={{ color: C.dim, fontSize: 11, lineHeight: 18, marginBottom: 3 }}>• {tip}</Text>
          ))}
        </View>
      )}
    </View>
  );
});

export function StepPreview({ result, jobId: jobIdProp, originalFile, onDone, onUpdateResult }) {
  const dur      = result.duration || {};
  const scores   = result.scores || {};
  const analysis = result.claude_analysis || {};
  const videoUrl = toAbsoluteUrl(result.download_url || result.output_url || '');
  // jobId: prop'tan gelir (güvenilir), yoksa result'tan fallback
  const jobId    = jobIdProp || result.job_id || null;

  // SUB_LANGS object.entries bir kez hesapla
  const subLangsList = useMemo(() => Object.entries(SUB_LANGS), []);

  const [voiceLang] = useState('tr-TR');
  const [subLoading, setSubLoading] = useState(false);
  const [subStatus, setSubStatus]   = useState('');
  const [subVideoUrl, setSubVideoUrl] = useState(
    result.autoSubtitleApplied ? toAbsoluteUrl(result.download_url || '') : ''
  );
  const [subLang, setSubLang] = useState(result.suggestedSubtitleLang || 'tr');

  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const onTranscriptRef = useRef(null);
  const stableOnTranscript = useCallback((text) => onTranscriptRef.current?.(text), []);
  const { speaking, speak, cancel: cancelTTS } = useTTS({ language: voiceLang });
  const { detectIntent } = useEffectIntent();
  const { micAvail, listening, interim, startMic, stopMicAndSend } = useMicrophone({
    onTranscript: stableOnTranscript,
    language: voiceLang,
  });

  const localFileUrl = useMemo(() => {
    if (IS_WEB && originalFile && typeof originalFile.name === 'string') {
      return URL.createObjectURL(originalFile);
    }
    return null;
  }, [originalFile]);

  useEffect(() => {
    return () => { if (localFileUrl) URL.revokeObjectURL(localFileUrl); };
  }, [localFileUrl]);

  useEffect(() => {
    if (result.autoSubtitleApplied && result.autoSubtitleLanguage) {
      setSubStatus(`✓ ${SUB_LANGS[result.autoSubtitleLanguage] || result.autoSubtitleLanguage} altyazı eklendi (otomatik)`);
    }
  }, []);

  useEffect(() => {
    if (voiceEnabled) {
      speak('Sesli komut etkinleştirildi. Etki veya altyazı komutu söyleyebilirsiniz.');
    } else if (listening) {
      stopMicAndSend();
    }
  }, [voiceEnabled]);

  // ── SFX & Müzik ──────────────────────────────────────────
  const [appliedSounds, setAppliedSounds] = useState([]);
  const [soundLoading, setSoundLoading]   = useState(false);

  function isApplyEffectCmd(text) {
    return /\b(uygula|ekle|koy|yerleştir|apply)\b/i.test(text);
  }
  function isSubtitleLangCmd(text) {
    return /\b(altyazı|alt yazı|subtitle|subtitles)\b/i.test(text);
  }

  // SFX anahtar kelimeleri → sfx_type
  const SFX_KEYWORD_MAP = {
    kahkaha: 'laugh', 'güldür': 'laugh', 'gülüş sesi': 'laugh', 'gülüşme': 'laugh',
    alkış: 'applause', 'alkışlama': 'applause', 'el çırp': 'applause',
    düdük: 'airhorn', borazan: 'airhorn', siren: 'airhorn',
    woş: 'whoosh', 'geçiş sesi': 'whoosh', swoosh: 'whoosh',
    'üzgün trompet': 'sad_trombone', fiyasko: 'sad_trombone', 'wah wah': 'sad_trombone',
    davul: 'drum_hit', 'davul sesi': 'drum_hit', boom: 'drum_hit',
    zil: 'bell', 'zil sesi': 'bell', ding: 'bell', çan: 'bell',
    pop: 'pop', 'tık sesi': 'pop',
    bip: 'beep', 'uyarı sesi': 'beep',
    coşku: 'crowd_cheer', bravo: 'crowd_cheer', 'yaşa': 'crowd_cheer', 'tezahürat': 'crowd_cheer',
  };

  // Müzik ruh hali anahtar kelimeleri → mood
  const MUSIC_MOOD_MAP = {
    sakin: 'calm', huzurlu: 'calm', rahat: 'calm', sessiz: 'calm',
    enerjik: 'energetic', 'hızlı müzik': 'energetic', dinamik: 'energetic',
    minimal: 'minimal', sade: 'minimal', 'arka plan': 'minimal',
    ritmik: 'rhythmic', tempolu: 'rhythmic', ritimli: 'rhythmic',
    yavaş: 'slow', ağır: 'slow', melankoli: 'slow',
  };

  function parseSfxCommand(text) {
    const lower = text.toLowerCase();
    // Kelime eşleşmesi: en uzun anahtar kelimeden başla (greedy)
    const keys = Object.keys(SFX_KEYWORD_MAP).sort((a, b) => b.length - a.length);
    for (const kw of keys) {
      if (lower.includes(kw)) {
        const sfx_type = SFX_KEYWORD_MAP[kw];
        const timestamp = parseTimeToken(text);
        return { sfx_type, timestamp };
      }
    }
    return null;
  }

  function parseMusicCommand(text) {
    const lower = text.toLowerCase();
    if (!/\b(müzik|şarkı|arka plan müzik|background music)\b/i.test(lower)) return null;
    const keys = Object.keys(MUSIC_MOOD_MAP).sort((a, b) => b.length - a.length);
    let mood = null;
    for (const kw of keys) {
      if (lower.includes(kw)) { mood = MUSIC_MOOD_MAP[kw]; break; }
    }
    if (!mood) mood = 'calm'; // varsayılan
    const range = parseTimeRange(text);
    const start_time = range?.start ?? 0;
    const end_time   = range?.end   ?? null;
    return { mood, start_time, end_time };
  }

  async function applySfx(sfxType, timestamp) {
    if (!jobId) { setSubStatus('Hata: Job ID bulunamadı'); return; }
    setSoundLoading(true);
    const sfxLabels = { laugh: 'Kahkaha', applause: 'Alkış', airhorn: 'Düdük', whoosh: 'Geçiş Sesi',
      sad_trombone: 'Üzgün Trompet', drum_hit: 'Davul', bell: 'Zil', pop: 'Pop',
      beep: 'Bip', crowd_cheer: 'Coşku' };
    const label = sfxLabels[sfxType] || sfxType;
    const tsText = timestamp != null ? ` (${timestamp}s)` : '';
    setSubStatus(`${label} ekleniyor...${tsText}`);
    try {
      const data = await addSoundEffect(jobId, { sfx_type: sfxType, timestamp, volume: 0.85 });
      if (data?.download_url) {
        const url = toAbsoluteUrl(data.download_url);
        setSubVideoUrl(url);
        setSubStatus(`✓ ${label} efekti eklendi${tsText}`);
        onUpdateResult?.({ ...result, download_url: url, output_url: url });
        setAppliedSounds(prev => [...prev, { type: 'sfx', label, timestamp, id: Date.now() }]);
        speak(`${label} sesi eklendi${tsText}`, () => voiceEnabled && startMic());
      }
    } catch(e) {
      setSubStatus('SFX hatası: ' + e.message);
      speak('Ses efekti eklenemedi', () => voiceEnabled && startMic());
    } finally {
      setSoundLoading(false);
    }
  }

  async function applyBgMusic(mood, startTime, endTime) {
    if (!jobId) { setSubStatus('Hata: Job ID bulunamadı'); return; }
    setSoundLoading(true);
    const moodLabels = { calm: 'Sakin', energetic: 'Enerjik', minimal: 'Minimal', rhythmic: 'Ritmik', slow: 'Yavaş' };
    const label = moodLabels[mood] || mood;
    setSubStatus(`${label} müzik ekleniyor...`);
    try {
      const data = await addMusic(jobId, { mood, start_time: startTime, end_time: endTime, volume: 0.22 });
      if (data?.download_url) {
        const url = toAbsoluteUrl(data.download_url);
        setSubVideoUrl(url);
        const rangeText = endTime != null ? ` (${startTime}-${endTime}s)` : '';
        setSubStatus(`✓ ${label} müzik eklendi${rangeText}`);
        onUpdateResult?.({ ...result, download_url: url, output_url: url });
        setAppliedSounds(prev => [...prev, { type: 'music', label, startTime, endTime, id: Date.now() }]);
        speak(`${label} müzik eklendi`, () => voiceEnabled && startMic());
      }
    } catch(e) {
      setSubStatus('Müzik hatası: ' + e.message);
      speak('Müzik eklenemedi', () => voiceEnabled && startMic());
    } finally {
      setSoundLoading(false);
    }
  }

  function parseTimeToken(token) {
    if (!token) return null;
    const t = token.trim().toLowerCase();

    const minuteSecond = /(?:(\d+)\s*dakika\s*(\d+)\s*saniye)|(?:(\d+):([0-5]?\d))/i.exec(t);
    if (minuteSecond) {
      if (minuteSecond[1] && minuteSecond[2]) return Number(minuteSecond[1]) * 60 + Number(minuteSecond[2]);
      return Number(minuteSecond[3]) * 60 + Number(minuteSecond[4]);
    }

    const secondsOnly = /(\d+)\s*\.?\s*saniye|([0-9]+)\s*sn/i.exec(t);
    if (secondsOnly) return Number(secondsOnly[1] || secondsOnly[2]);

    const colonMatch = /^(\d+):(\d{1,2})$/.exec(t);
    if (colonMatch) return Number(colonMatch[1]) * 60 + Number(colonMatch[2]);

    const numberMatch = /(\d+)\s*$/.exec(t);
    if (numberMatch) return Number(numberMatch[1]);
    return null;
  }

  function parseTimeRange(text) {
    const range = /(?:(\d+(?::\d+)?)(?:\s*(?:dakika|dk|saniye|sn))?)\s*(?:ile|ve|-)\s*(\d+(?::\d+)?)(?:\s*(?:dakika|dk|saniye|sn))?/i.exec(text);
    if (!range) return null;
    const start = parseTimeToken(range[1]);
    const end = parseTimeToken(range[2]);
    return start != null ? { start, end } : null;
  }

  function parsePreviewIntent(text) {
    const intent = detectIntent(text);
    const range = parseTimeRange(text);
    const time = range?.start ?? parseTimeToken(text);
    return { intent, timestamp: time || null, range };
  }

  async function applyPreviewEffect(intent, timestamp = null) {
    if (!jobId) {
      setSubStatus('Hata: Job ID bulunamadı');
      return;
    }
    setSubLoading(true);
    const timingText = timestamp != null ? ` ${timestamp}s.` : '';
    setSubStatus(`${intent.label} uygulanıyor...${timingText}`);
    try {
      const data = await applyEffect(jobId, { category: intent.category, intensity: intent.intensity, timestamp });
      if (data?.download_url) {
        const url = toAbsoluteUrl(data.download_url);
        setSubVideoUrl(url);
        setSubStatus(`✓ ${intent.label} efekti uygulandı${timestamp != null ? ` (${timestamp}s)` : ''}`);
        onUpdateResult?.({ ...result, download_url: url, output_url: url });
      } else {
        setSubStatus('Efekt uygulandı ama video güncellenemedi');
      }
    } catch (e) {
      setSubStatus('Efekt hatası: ' + e.message);
    } finally {
      setSubLoading(false);
    }
  }

  function handleTranscript(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    // ── Ses efekti komutu ────────────────────────────────
    const sfxMatch = parseSfxCommand(trimmed);
    if (sfxMatch) {
      addTranscriptMessage('user', trimmed);
      applySfx(sfxMatch.sfx_type, sfxMatch.timestamp);
      return;
    }

    // ── Müzik komutu ─────────────────────────────────────
    const musicMatch = parseMusicCommand(trimmed);
    if (musicMatch) {
      addTranscriptMessage('user', trimmed);
      applyBgMusic(musicMatch.mood, musicMatch.start_time, musicMatch.end_time);
      return;
    }

    if (isSubtitleLangCmd(trimmed)) {
      const code = detectSubtitleLang(trimmed);
      if (code) {
        addTranscriptMessage('user', trimmed);
        setSubLang(code);
        speak(`Altyazı dili ${SUB_LANGS[code]} olarak ayarlandı`);
        handleGenerateSubtitles(code);
        return;
      }
    }

    const { intent, timestamp } = parsePreviewIntent(trimmed);
    if (intent) {
      const effectKeywords = /\b(kahkaha|gülüş|alkış|komik|komedi|şok|gerilim|epik|başarısız|vurgu|müzik|ses)\b/i;
      if (isApplyEffectCmd(trimmed) || effectKeywords.test(trimmed)) {
        addTranscriptMessage('user', trimmed);
        applyPreviewEffect(intent, timestamp);
        return;
      }
    }

    if (/\b(yeniden|tekrar|düzelt|geliştir|değiştir|daha kısa|daha uzun|daha komik|daha eğlenceli)\b/i.test(trimmed)) {
      speak('Bu isteği uygulamak için lütfen önce Chat ekranına geri dönün.');
      return;
    }

    speak('Anlayamadım. Altyazı veya efekt komutu deneyin.');
  }

  function addTranscriptMessage(role, text) {
    setSubStatus(`Komut alındı: ${text}`);
  }

  onTranscriptRef.current = handleTranscript;

  // handleGenerateSubtitles stable referans
  const handleGenerateSubtitles = useCallback(async (lang) => {
    if (!jobId) {
      setSubStatus('Hata: Job ID bulunamadı, sayfayı yenile.');
      return;
    }
    setSubLoading(true); setSubStatus(''); setSubVideoUrl('');
    try {
      const data = await generateSubtitles(jobId, { language: lang });
      if (data.video_url) {
        const url = toAbsoluteUrl(data.video_url);
        setSubVideoUrl(url);
        setSubStatus(`✓ ${SUB_LANGS[lang] || lang} altyazı eklendi`);
        onUpdateResult?.({
          ...result,
          download_url: url,
          output_url: url,
          autoSubtitleApplied: true,
          autoSubtitleLanguage: lang,
        });
      } else {
        setSubStatus(data.burn_in_error || 'Altyazı oluşturuldu (video yakma başarısız)');
      }
    } catch(e) {
      setSubStatus('Hata: ' + e.message);
    } finally {
      setSubLoading(false);
    }
  }, [jobId]);

  const displayVideoUrl = subVideoUrl || videoUrl;

  return (
    <ScrollView contentContainerStyle={s.stepWrap}>
      <Badge label="ADIM 3" color={C.green}/>
      <Text style={s.stepTitle}>Önizleme</Text>

      <View style={s.compareRow}>
        <View style={s.compareCard}>
          <Text style={s.compareLabel}>ORİJİNAL</Text>
          <Text style={s.compareDur}>{dur.input || '?'}s</Text>
        </View>
        <Text style={{ color: C.muted, fontSize: 24 }}>→</Text>
        <View style={[s.compareCard, { borderColor: 'rgba(29,185,116,0.35)' }]}>
          <Text style={[s.compareLabel, { color: C.green }]}>KURGULANAN</Text>
          <Text style={[s.compareDur, { color: C.green }]}>{dur.output || '?'}s</Text>
        </View>
      </View>

      {!!displayVideoUrl && (
        <View style={s.videoPlayerWrap}>
          <Text style={s.sectionLabel}>KURGULANAN VIDEO</Text>
          {IS_WEB ? (
            <video src={bustCache(displayVideoUrl)} controls
              style={{ width: '100%', maxHeight: 320, borderRadius: 10, backgroundColor: '#000', display: 'block' }}/>
          ) : (
            <NativeVideoPlayer uri={displayVideoUrl}/>
          )}
        </View>
      )}

      {!!originalFile && !IS_WEB && (
        <View style={s.videoPlayerWrap}>
          <Text style={s.sectionLabel}>ORİJİNAL VIDEO</Text>
          <NativeVideoPlayer uri={originalFile.uri} height={160}/>
        </View>
      )}
      {!!localFileUrl && (
        <View style={s.videoPlayerWrap}>
          <Text style={s.sectionLabel}>ORİJİNAL VIDEO</Text>
          <video src={localFileUrl} controls
            style={{ width: '100%', maxHeight: 220, borderRadius: 10, backgroundColor: '#000', display: 'block' }}/>
        </View>
      )}

      <View style={[s.metricsCard, { marginBottom: 12 }]}> 
        <Text style={s.sectionLabel}>SESLE KOMUT</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <TouchableOpacity
            style={[s.btn, { flex: 1, backgroundColor: voiceEnabled ? 'rgba(29,185,116,0.15)' : C.card }]}
            onPress={() => {
              const next = !voiceEnabled;
              setVoiceEnabled(next);
              if (next) startMic();
              else {
                cancelTTS();
                if (listening) stopMicAndSend();
              }
            }}>
            <Text style={[s.btnTxt, { color: voiceEnabled ? C.green : C.accent }]}>🔊 Sesli Komut {voiceEnabled ? 'Açık' : 'Kapalı'}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, minHeight: 32, justifyContent: 'center' }}>
            <Text style={{ fontSize: 12, color: C.muted }}>{listening ? interim || 'Dinliyorum...' : 'Komut için açın'}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 11, color: C.muted, lineHeight: 18 }}>
          {'Ses: "5. saniyeye kahkaha sesi koy", "10. saniyeye alkış ekle"\nMüzik: "arka plana sakin müzik ekle", "enerjik müzik koy"'}
        </Text>
      </View>

      {/* SES & MÜZİK KARTI */}
      <View style={[s.metricsCard, { marginBottom: 12 }]}>
        <Text style={s.sectionLabel}>SES & MÜZİK</Text>

        {/* Hızlı SFX butonları */}
        <Text style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>Ses Efektleri</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {[
            { sfx: 'laugh', emoji: '😂', label: 'Kahkaha' },
            { sfx: 'applause', emoji: '👏', label: 'Alkış' },
            { sfx: 'airhorn', emoji: '📣', label: 'Düdük' },
            { sfx: 'sad_trombone', emoji: '🎺', label: 'Fiyasko' },
            { sfx: 'crowd_cheer', emoji: '🎉', label: 'Coşku' },
            { sfx: 'drum_hit', emoji: '🥁', label: 'Davul' },
            { sfx: 'bell', emoji: '🔔', label: 'Zil' },
            { sfx: 'whoosh', emoji: '💨', label: 'Woş' },
          ].map(({ sfx, emoji, label }) => (
            <TouchableOpacity
              key={sfx}
              disabled={soundLoading}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
                opacity: soundLoading ? 0.4 : 1 }}
              onPress={() => applySfx(sfx, null)}>
              <Text style={{ fontSize: 11, color: C.txt }}>{emoji} {label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Hızlı Müzik butonları */}
        <Text style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>Arka Plan Müziği</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {[
            { mood: 'calm',      emoji: '🌿', label: 'Sakin' },
            { mood: 'energetic', emoji: '⚡', label: 'Enerjik' },
            { mood: 'rhythmic',  emoji: '🎵', label: 'Ritmik' },
            { mood: 'minimal',   emoji: '🎹', label: 'Minimal' },
            { mood: 'slow',      emoji: '🌙', label: 'Yavaş' },
          ].map(({ mood, emoji, label }) => (
            <TouchableOpacity
              key={mood}
              disabled={soundLoading}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
                opacity: soundLoading ? 0.4 : 1 }}
              onPress={() => applyBgMusic(mood, 0, null)}>
              <Text style={{ fontSize: 11, color: C.txt }}>{emoji} {label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Uygulanan sesler listesi */}
        {appliedSounds.length > 0 && (
          <View style={{ borderTopWidth: 1, borderColor: C.border, paddingTop: 10 }}>
            <Text style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>Eklenenler</Text>
            {appliedSounds.map((item) => (
              <Text key={item.id} style={{ fontSize: 11, color: C.green, marginBottom: 3 }}>
                {item.type === 'sfx'
                  ? `🔊 ${item.timestamp != null ? `${item.timestamp}s - ` : ''}${item.label}`
                  : `🎵 ${item.startTime > 0 ? `${item.startTime}s` : 'Baştan'} - ${item.label} müzik`}
              </Text>
            ))}
          </View>
        )}

        {soundLoading && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <ActivityIndicator color={C.accent} size="small"/>
            <Text style={{ fontSize: 12, color: C.muted }}>{subStatus}</Text>
          </View>
        )}
      </View>

      <View style={s.metricsCard}>
        <Text style={s.sectionLabel}>ALTYAZI EKLE</Text>
        <FlatList
          data={subLangsList}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={([code]) => code}
          style={{ marginBottom: 12 }}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          initialNumToRender={5}
          renderItem={({ item: [code, label] }) => (
            <TouchableOpacity
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1,
                marginRight: 6,
                borderColor: subLang === code ? C.accent : C.border,
                backgroundColor: subLang === code ? 'rgba(224,92,42,0.12)' : C.card }}
              onPress={() => setSubLang(code)}>
              <Text style={{ fontSize: 11, color: subLang === code ? C.accent : C.muted }}>{label}</Text>
            </TouchableOpacity>
          )}
        />
        {/* Türkçe/İngilizce dışı diller AI çevirisi gerektirir — uyarı göster */}
        {subLang && !['tr', 'en'].includes(subLang) && (
          <View style={{ backgroundColor: 'rgba(255,209,102,0.12)', borderRadius: 8, padding: 10,
            borderWidth: 1, borderColor: 'rgba(255,209,102,0.3)', marginBottom: 10 }}>
            <Text style={{ fontSize: 11, color: C.warn, lineHeight: 17 }}>
              Türkçe/İngilizce dışı diller AI çevirisi kullanır (Anthropic API).
              Uzun videolarda ek API maliyeti oluşabilir.
            </Text>
          </View>
        )}
        <TouchableOpacity style={[s.btn, subLoading && s.btnDisabled]}
          onPress={() => handleGenerateSubtitles(subLang)} disabled={subLoading}>
          {subLoading
            ? <ActivityIndicator color={C.accent}/>
            : <Text style={[s.btnTxt, { color: C.accent }]}>Altyazı Ekle ({SUB_LANGS[subLang]})</Text>}
        </TouchableOpacity>
        {!!subStatus && (
          <Text style={{ color: subVideoUrl ? C.green : C.warn, fontSize: 12, marginTop: 8 }}>{subStatus}</Text>
        )}
      </View>

      <View style={s.metricsCard}>
        <Text style={s.sectionLabel}>ÖZET</Text>
        {[
          ['Platform', result.platform],
          ['Kesim sayısı', result.edit_plan?.cuts_applied != null ? result.edit_plan.cuts_applied + ' adet' : null],
          ['Bilgi yoğunluğu', scores.info_density != null ? scores.info_density + '/100' : null],
          ['Tempo skoru', scores.pacing_score != null ? scores.pacing_score + '/100' : null],
        ].filter(r => r[1] != null).map(([k, v]) => (
          <View key={k} style={s.metricRow}>
            <Text style={s.metricKey}>{k}</Text>
            <Text style={s.metricVal}>{v}</Text>
          </View>
        ))}
      </View>

      <ViralityCard scores={scores} analysis={analysis} editPlan={result.edit_plan}/>

      {analysis.one_line_summary ? (
        <View style={s.analysisBox}>
          <Text style={s.sectionLabel}>CLAUDE YORUMU</Text>
          <Text style={s.analysisTxt}>{analysis.one_line_summary}</Text>
          {(analysis.suggestions || []).slice(0, 3).map((sg, i) => (
            <Text key={i} style={s.suggestion}>- {sg}</Text>
          ))}
        </View>
      ) : null}

      <TouchableOpacity style={[s.btn, s.btnGreen]} onPress={onDone}>
        <Text style={s.btnTxt}>İndir</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  stepWrap:       { padding: 24, paddingTop: 16 },
  stepTitle:      { fontSize: 34, color: C.txt, fontStyle: 'italic', marginTop: 12, marginBottom: 8, lineHeight: 40 },
  compareRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20 },
  compareCard:    { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 20, alignItems: 'center', minWidth: 110, backgroundColor: C.card },
  compareLabel:   { fontSize: 9, color: C.muted, marginBottom: 8, letterSpacing: 1.5 },
  compareDur:     { fontSize: 32, color: C.txt, fontStyle: 'italic' },
  videoPlayerWrap:{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 16, overflow: 'hidden' },
  sectionLabel:   { fontSize: 9, color: C.muted, letterSpacing: 2, marginBottom: 12 },
  metricsCard:    { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 16, marginBottom: 16 },
  metricRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: C.border },
  metricKey:      { fontSize: 12, color: C.muted },
  metricVal:      { fontSize: 12, color: C.txt },
  analysisBox:    { backgroundColor: 'rgba(224,92,42,0.06)', borderWidth: 1, borderColor: 'rgba(224,92,42,0.2)', borderRadius: 12, padding: 16, marginBottom: 20 },
  analysisTxt:    { fontSize: 13, color: C.txt, lineHeight: 20, marginBottom: 10 },
  suggestion:     { fontSize: 12, color: C.dim, lineHeight: 20, marginBottom: 4 },
  btn:            { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: C.card },
  btnGreen:       { backgroundColor: C.green, borderColor: C.green },
  btnDisabled:    { opacity: 0.3 },
  btnTxt:         { color: '#fff', fontSize: 14, letterSpacing: 0.5, fontWeight: '500' },
});
