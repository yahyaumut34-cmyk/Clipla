import { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { uploadVideoWithProgress, WARN_BYTES } from '../api';
import { C, IS_WEB } from '../shared/theme';
import { Badge } from './Badge';

const MAX_VIDEOS   = 5;
const TOTAL_BLOCKS = 100;

function inferMimeType(fileName) {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  const map = { mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska', webm: 'video/webm', m4v: 'video/x-m4v' };
  return map[ext] || 'video/mp4';
}

function ProgressGrid({ pct }) {
  const blocks = useMemo(() => Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1), []);
  return (
    <View style={g.grid}>
      {blocks.map(n => (
        <View key={n} style={[g.block, n <= pct ? g.blockFilled : g.blockEmpty]}/>
      ))}
    </View>
  );
}

const g = StyleSheet.create({
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'center', marginBottom: 12 },
  block:       { width: 20, height: 20, borderRadius: 3 },
  blockFilled: { backgroundColor: C.green },
  blockEmpty:  { backgroundColor: 'rgba(29,185,116,0.1)', borderWidth: 1, borderColor: 'rgba(29,185,116,0.2)' },
});

export function StepUpload({ onDone, planCtx, onPaywall }) {
  // Her video: { id, file(web)|asset(native), name, sizeMB, jobId, pct, status: 'pending'|'uploading'|'done'|'error', error }
  const [videos, setVideos]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [phase, setPhase]     = useState('idle'); // idle | uploading | success

  useEffect(() => {
    if (phase !== 'success') return;
    const doneVideos = videos.filter(v => v.status === 'done');
    if (!doneVideos.length) return;
    const timer = setTimeout(() => {
      const allJobs = doneVideos.map(v => ({
        jobId:    v.jobId,
        duration: v.duration || 0,
        file:     IS_WEB ? v.file : v.asset,
        name:     v.name,
      }));
      onDone({
        jobId:    allJobs[0].jobId,
        duration: allJobs[0].duration,
        file:     allJobs[0].file,
        allJobs,
        isMulti:  allJobs.length > 1,
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [phase]);

  async function pickFileWeb() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/*';
      input.onchange = (e) => resolve(e.target.files[0] || null);
      input.click();
    });
  }

  async function pickNative() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'video/*', copyToCacheDirectory: true, multiple: false,
    });
    if (result.canceled) return null;
    const doc = result.assets?.[0];
    if (!doc?.uri) throw new Error('Dosya seçilemedi');
    const fileName = doc.name || doc.uri.split('/').pop() || 'video.mp4';
    return { uri: doc.uri, fileName, mimeType: doc.mimeType || inferMimeType(fileName), fileSize: doc.size || 0, duration: 0, source: 'files' };
  }

  async function handlePick() {
    if (picking || loading || videos.length >= MAX_VIDEOS) return;
    setPicking(true);
    try {
      let name, sizeMB, file = null, asset = null;
      if (IS_WEB) {
        const f = await pickFileWeb();
        if (!f) return;
        file = f; name = f.name; sizeMB = parseFloat((f.size / 1024 / 1024).toFixed(1));
      } else {
        const a = await pickNative();
        if (!a) return;
        asset = a; name = a.fileName; sizeMB = parseFloat(((a.fileSize || 0) / 1024 / 1024).toFixed(1));
      }
      setVideos(prev => [...prev, { id: Date.now(), file, asset, name, sizeMB, jobId: null, pct: 0, status: 'pending', error: '' }]);
    } catch(e) {
      // ignore cancel
    } finally {
      setPicking(false);
    }
  }

  function removeVideo(id) {
    setVideos(prev => prev.filter(v => v.id !== id));
  }

  function moveUp(idx) {
    if (idx === 0) return;
    setVideos(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveDown(idx) {
    setVideos(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  async function uploadAll() {
    if (!videos.length || loading) return;
    if (planCtx && !planCtx.loaded) return;
    if (planCtx && !planCtx.canUpload) { onPaywall?.(); return; }

    setLoading(true); setPhase('uploading');

    const updated = [...videos];

    for (let i = 0; i < updated.length; i++) {
      const v = updated[i];
      if (v.status === 'done') continue;

      updated[i] = { ...v, status: 'uploading', pct: 0 };
      setVideos([...updated]);

      try {
        const src = IS_WEB ? v.file : v.asset;
        const data = await uploadVideoWithProgress(src, (pct) => {
          updated[i] = { ...updated[i], pct };
          setVideos([...updated]);
        });
        await planCtx?.recordUpload?.();
        updated[i] = { ...updated[i], status: 'done', jobId: data.job_id, duration: data.duration || 0, pct: 100 };
        setVideos([...updated]);
      } catch(e) {
        updated[i] = { ...updated[i], status: 'error', error: e.message, pct: 0 };
        setVideos([...updated]);
      }
    }

    const anyDone = updated.some(v => v.status === 'done');
    if (anyDone) {
      setPhase('success');
    } else {
      setLoading(false); setPhase('idle');
    }
  }

  const hasVideos  = videos.length > 0;
  const canUpload  = hasVideos && !loading;
  const doneCount  = videos.filter(v => v.status === 'done').length;
  const totalPct   = videos.length ? Math.round(videos.reduce((s, v) => s + v.pct, 0) / videos.length) : 0;

  // ── Başarı ekranı ──
  if (phase === 'success') {
    const doneVideos = videos.filter(v => v.status === 'done');
    return (
      <View style={s.successWrap}>
        <View style={s.successCard}>
          <View style={s.successIconWrap}>
            <Text style={s.successIcon}>✓</Text>
          </View>
          <Text style={s.successTitle}>{doneVideos.length > 1 ? `${doneVideos.length} Video Yüklendi!` : 'Video Yüklendi!'}</Text>
          {doneVideos.map((v, i) => (
            <Text key={v.id} style={s.successSub} numberOfLines={1}>{i + 1}. {v.name}</Text>
          ))}
          <ProgressGrid pct={100}/>
          <ActivityIndicator color={C.green} size="small" style={{ marginTop: 4 }}/>
          <Text style={s.successHint}>Devam ediliyor...</Text>
        </View>
      </View>
    );
  }

  // ── Upload aşaması ──
  if (phase === 'uploading') {
    return (
      <ScrollView contentContainerStyle={s.stepWrap}>
        <Badge label="ADIM 1"/>
        <Text style={s.stepTitle}>Yükleniyor</Text>
        <View style={s.uploadingCard}>
          <ProgressGrid pct={totalPct}/>
          <View style={s.pctRow}>
            <Text style={s.pctNum}>{totalPct}</Text>
            <Text style={s.pctSign}>%</Text>
          </View>
          {videos.map((v, i) => (
            <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, width: '100%' }}>
              <Text style={{ fontSize: 11, color: C.muted, width: 14 }}>{i + 1}.</Text>
              <Text style={{ flex: 1, fontSize: 11, color: v.status === 'error' ? '#f87171' : v.status === 'done' ? C.green : C.dim }} numberOfLines={1}>
                {v.status === 'done' ? '✓ ' : v.status === 'uploading' ? '⏳ ' : v.status === 'error' ? '✗ ' : '• '}{v.name}
              </Text>
              {v.status === 'uploading' && <Text style={{ fontSize: 10, color: C.accent }}>{v.pct}%</Text>}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  // ── Normal ekran (idle) ──
  return (
    <ScrollView contentContainerStyle={s.stepWrap}>
      <Badge label="ADIM 1"/>
      <Text style={s.stepTitle}>Video{videos.length > 1 ? 'ları' : 'yu'} Yükle</Text>
      <Text style={s.stepSub}>
        {videos.length > 1
          ? `${videos.length} video seçildi — sırayı ayarla, birleştir.`
          : 'Ham çekimi olduğu gibi at. Edit etmene gerek yok.'}
      </Text>

      {/* Video listesi */}
      {videos.map((v, idx) => (
        <View key={v.id} style={s.videoRow}>
          <View style={s.videoIndex}><Text style={{ fontSize: 12, color: C.accent, fontWeight: '700' }}>{idx + 1}</Text></View>
          <Text style={s.videoName} numberOfLines={1}>{v.name}</Text>
          <Text style={s.videoSize}>{v.sizeMB > 0 ? v.sizeMB + ' MB' : ''}</Text>
          {/* Sıra butonları */}
          <TouchableOpacity onPress={() => moveUp(idx)} disabled={idx === 0} style={[s.orderBtn, idx === 0 && { opacity: 0.2 }]}>
            <Text style={{ fontSize: 12, color: C.muted }}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => moveDown(idx)} disabled={idx === videos.length - 1} style={[s.orderBtn, idx === videos.length - 1 && { opacity: 0.2 }]}>
            <Text style={{ fontSize: 12, color: C.muted }}>↓</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => removeVideo(v.id)} style={s.removeBtn}>
            <Text style={{ fontSize: 13, color: '#f87171' }}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Seç / Ekle butonu */}
      <View>
        <TouchableOpacity
          style={[s.uploadBox, (picking || videos.length >= MAX_VIDEOS) && { opacity: 0.5 }]}
          onPress={handlePick}
          activeOpacity={0.8}
          disabled={picking || videos.length >= MAX_VIDEOS}>
          {picking ? (
            <><ActivityIndicator color={C.accent} size="large" style={{ marginBottom: 12 }}/><Text style={s.uploadBoxTitle}>Seçiliyor...</Text></>
          ) : videos.length === 0 ? (
            <><Text style={{ fontSize: 44, marginBottom: 12 }}>{IS_WEB ? '🎬' : '📁'}</Text>
              <Text style={s.uploadBoxTitle}>Video Seç</Text>
              <Text style={s.uploadBoxSub}>{IS_WEB ? 'MP4 · MOV · WebM' : 'Dosyalar · iCloud · MP4 · MOV'}</Text></>
          ) : videos.length < MAX_VIDEOS ? (
            <><Text style={{ fontSize: 32, marginBottom: 8 }}>＋</Text>
              <Text style={s.uploadBoxTitle}>Video Ekle</Text>
              <Text style={s.uploadBoxSub}>{MAX_VIDEOS - videos.length} video daha ekleyebilirsin</Text></>
          ) : (
            <Text style={[s.uploadBoxSub, { textAlign: 'center' }]}>Maksimum {MAX_VIDEOS} video</Text>
          )}
        </TouchableOpacity>
      </View>

      {planCtx && !planCtx.isPro && (
        <View style={[s.warnBox, { borderColor: planCtx.uploadsRemaining === 0 ? 'rgba(248,113,113,0.4)' : 'rgba(255,209,102,0.3)' }]}>
          <Text style={[s.warnTxt, { color: planCtx.uploadsRemaining === 0 ? '#f87171' : C.warn }]}>
            {planCtx.uploadsRemaining === 0
              ? "Günlük ücretsiz yükleme limitin doldu. Pro'ya geç!"
              : `Ücretsiz: bugün ${planCtx.uploadsRemaining} yükleme hakkın kaldı.`}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[s.btn, s.btnAccent, !canUpload && s.btnDisabled]}
        onPress={uploadAll}
        disabled={!canUpload}>
        <Text style={s.btnTxt}>
          {videos.length > 1 ? `${videos.length} Videoyu Yükle ve Devam Et` : 'Yükle ve Devam Et'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  stepWrap:       { padding: 24, paddingTop: 16 },
  stepTitle:      { fontSize: 34, color: C.txt, fontStyle: 'italic', marginTop: 12, marginBottom: 8, lineHeight: 40 },
  stepSub:        { fontSize: 14, color: C.dim, lineHeight: 22, marginBottom: 20 },

  videoRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(29,185,116,0.06)', borderWidth: 1, borderColor: 'rgba(29,185,116,0.2)', borderRadius: 10, padding: 10, marginBottom: 8 },
  videoIndex:     { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(224,92,42,0.15)', alignItems: 'center', justifyContent: 'center' },
  videoName:      { flex: 1, fontSize: 12, color: C.txt },
  videoSize:      { fontSize: 10, color: C.muted, minWidth: 40, textAlign: 'right' },
  orderBtn:       { width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  removeBtn:      { width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', backgroundColor: 'rgba(248,113,113,0.08)', alignItems: 'center', justifyContent: 'center' },

  uploadBox:      { borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 36, alignItems: 'center', backgroundColor: C.card, marginBottom: 16 },
  uploadBoxTitle: { fontSize: 16, color: C.txt, marginBottom: 4 },
  uploadBoxSub:   { fontSize: 12, color: C.muted },

  warnBox:        { backgroundColor: 'rgba(255,209,102,0.08)', borderWidth: 1, borderColor: 'rgba(255,209,102,0.3)', borderRadius: 8, padding: 12, marginBottom: 12 },
  warnTxt:        { color: C.warn, fontSize: 12, lineHeight: 18 },

  btn:            { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: C.card },
  btnAccent:      { backgroundColor: C.accent, borderColor: C.accent },
  btnDisabled:    { opacity: 0.3 },
  btnTxt:         { color: '#fff', fontSize: 14, letterSpacing: 0.5, fontWeight: '500' },

  uploadingCard:  { backgroundColor: C.card, borderWidth: 1, borderColor: 'rgba(29,185,116,0.3)', borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 12 },
  pctRow:         { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6 },
  pctNum:         { fontSize: 64, color: C.green, fontWeight: '700', lineHeight: 72 },
  pctSign:        { fontSize: 24, color: C.green, fontWeight: '600', marginBottom: 10, marginLeft: 4 },

  successWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  successCard:    { backgroundColor: C.card, borderWidth: 1, borderColor: 'rgba(29,185,116,0.4)', borderRadius: 20, padding: 32, alignItems: 'center', width: '100%', maxWidth: 360 },
  successIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(29,185,116,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successIcon:    { fontSize: 36, color: C.green },
  successTitle:   { fontSize: 24, color: C.green, fontWeight: '700', marginBottom: 6 },
  successSub:     { fontSize: 12, color: C.txt, marginBottom: 2, maxWidth: 260 },
  successHint:    { fontSize: 12, color: C.muted, marginTop: 8 },
});
