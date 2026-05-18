/**
 * StepQuickEdit — Şablon Seç + Video Yükle (tek ekran)
 * Şablon seçilir → video yüklenir → onDone({ jobData, template }) çağrılır
 */
import { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { uploadVideoWithProgress, WARN_BYTES } from '../api';
import { TemplateSelector } from './TemplateSelector';
import { C, IS_WEB } from '../shared/theme';
import { EDIT_TEMPLATES } from '../shared/constants';

const TOTAL_BLOCKS = 100;

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
  block:       { width: 18, height: 18, borderRadius: 3 },
  blockFilled: { backgroundColor: C.green },
  blockEmpty:  { backgroundColor: 'rgba(29,185,116,0.1)', borderWidth: 1, borderColor: 'rgba(29,185,116,0.2)' },
});

function inferMimeType(fileName) {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  const map = { mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska', webm: 'video/webm', m4v: 'video/x-m4v' };
  return map[ext] || 'video/mp4';
}

export function StepQuickEdit({ onDone, onSwitchAdvanced, planCtx, onPaywall }) {
  const [template, setTemplate] = useState(EDIT_TEMPLATES[0]); // TikTok Viral varsayılan
  const [video, setVideo]       = useState(null); // { name, file|asset, sizeMB }
  const [phase, setPhase]       = useState('idle'); // idle | uploading | done
  const [pct, setPct]           = useState(0);
  const [error, setError]       = useState('');

  // Upload bittikten sonra onDone çağır
  useEffect(() => {
    if (phase === 'done' && video?.jobId) {
      setTimeout(() => {
        onDone({
          jobData: {
            jobId:    video.jobId,
            duration: video.duration || 0,
            file:     IS_WEB ? video.file : video.asset,
            allJobs:  [{ jobId: video.jobId, duration: video.duration || 0, name: video.name }],
            isMulti:  false,
          },
          template,
        });
      }, 600);
    }
  }, [phase, video]);

  async function pickFile() {
    if (IS_WEB) {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        input.onchange = (e) => resolve(e.target.files[0] || null);
        input.click();
      });
    } else {
      const { getDocumentAsync } = await import('expo-document-picker');
      const result = await getDocumentAsync({ type: 'video/*', copyToCacheDirectory: true });
      if (result.canceled) return null;
      const doc = result.assets?.[0];
      if (!doc?.uri) return null;
      const fileName = doc.name || doc.uri.split('/').pop() || 'video.mp4';
      return { uri: doc.uri, fileName, mimeType: doc.mimeType || inferMimeType(fileName), fileSize: doc.size || 0 };
    }
  }

  async function handlePick() {
    if (phase === 'uploading') return;
    setError('');
    try {
      const f = await pickFile();
      if (!f) return;
      const name   = IS_WEB ? f.name   : f.fileName;
      const sizeMB = IS_WEB ? parseFloat((f.size / 1024 / 1024).toFixed(1)) : parseFloat(((f.fileSize || 0) / 1024 / 1024).toFixed(1));
      setVideo({ file: IS_WEB ? f : null, asset: IS_WEB ? null : f, name, sizeMB });
    } catch { /* ignore cancel */ }
  }

  async function handleProcess() {
    if (!video || !template || phase === 'uploading') return;
    if (planCtx && !planCtx.canUpload) { onPaywall?.(); return; }

    setPhase('uploading'); setPct(0); setError('');
    try {
      const src  = IS_WEB ? video.file : video.asset;
      const data = await uploadVideoWithProgress(src, (p) => setPct(p));
      await planCtx?.recordUpload?.();
      setVideo(prev => ({ ...prev, jobId: data.job_id, duration: data.duration || 0 }));
      setPhase('done');
    } catch(e) {
      setError(e.message);
      setPhase('idle');
    }
  }

  // Yükleniyor ekranı
  if (phase === 'uploading' || phase === 'done') {
    return (
      <View style={s.centered}>
        <View style={s.uploadCard}>
          <Text style={s.uploadEmoji}>{template.emoji}</Text>
          <Text style={s.uploadTitle}>{phase === 'done' ? 'Yüklendi!' : 'Yükleniyor...'}</Text>
          <ProgressGrid pct={pct}/>
          <Text style={s.pctTxt}>{pct}%</Text>
          {phase === 'done' && <ActivityIndicator color={C.green} style={{ marginTop: 8 }}/>}
        </View>
      </View>
    );
  }

  const canProcess = !!video && !!template;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.wrap}>
      {/* Şablon Seçimi */}
      <Text style={s.sectionLabel}>FORMAT SEÇ</Text>
      <TemplateSelector selected={template} onSelect={setTemplate}/>

      {/* Seçili şablon özeti */}
      {template && (
        <View style={[s.templateSummary, { borderColor: template.color + '40' }]}>
          <Text style={[s.templateSummaryTitle, { color: template.color }]}>{template.emoji} {template.label} seçildi</Text>
          <Text style={s.templateSummaryDesc}>{template.desc}</Text>
        </View>
      )}

      {/* Video Yükleme */}
      <Text style={[s.sectionLabel, { marginTop: 20 }]}>VİDEO EKLE</Text>
      <TouchableOpacity style={s.dropZone} onPress={handlePick}>
        {video ? (
          <>
            <Text style={s.fileIcon}>🎬</Text>
            <Text style={s.fileName} numberOfLines={1}>{video.name}</Text>
            <Text style={s.fileSz}>{video.sizeMB} MB · değiştirmek için dokun</Text>
          </>
        ) : (
          <>
            <Text style={s.fileIcon}>+</Text>
            <Text style={s.dropHint}>Video seç</Text>
            <Text style={s.dropSub}>MP4, MOV, MKV, WebM</Text>
          </>
        )}
      </TouchableOpacity>

      {!!error && <Text style={s.errTxt}>{error}</Text>}

      {/* İşle Butonu */}
      <TouchableOpacity
        style={[s.processBtn, !canProcess && s.processBtnOff, { backgroundColor: canProcess ? (template?.color || C.accent) : C.border }]}
        onPress={handleProcess}
        disabled={!canProcess}>
        <Text style={s.processBtnTxt}>
          {canProcess ? `▶  ${template.label} olarak işle` : 'Şablon seç ve video ekle'}
        </Text>
      </TouchableOpacity>

      {/* Gelişmiş mod bağlantısı */}
      <TouchableOpacity style={s.advancedLink} onPress={onSwitchAdvanced}>
        <Text style={s.advancedLinkTxt}>Gelişmiş (AI Sohbet ile düzenle) →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap:          { padding: 16, paddingBottom: 40 },
  centered:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  sectionLabel:  { fontSize: 9, color: C.accent, letterSpacing: 2, marginBottom: 10, marginLeft: 4 },

  templateSummary:      { marginHorizontal: 4, marginTop: 10, padding: 12, borderRadius: 10, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.02)' },
  templateSummaryTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  templateSummaryDesc:  { fontSize: 11, color: C.muted },

  dropZone:   { borderWidth: 1, borderStyle: 'dashed', borderColor: C.border, borderRadius: 12, padding: 28, alignItems: 'center', backgroundColor: C.card, gap: 6 },
  fileIcon:   { fontSize: 36, color: C.accent },
  fileName:   { fontSize: 13, color: C.txt, maxWidth: '90%', textAlign: 'center' },
  fileSz:     { fontSize: 10, color: C.muted },
  dropHint:   { fontSize: 16, color: C.dim, fontWeight: '600' },
  dropSub:    { fontSize: 11, color: C.muted },

  processBtn:    { marginTop: 20, borderRadius: 12, padding: 16, alignItems: 'center' },
  processBtnOff: { opacity: 0.5 },
  processBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },

  uploadCard:  { width: '100%', maxWidth: 320, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, padding: 24, alignItems: 'center', gap: 8 },
  uploadEmoji: { fontSize: 48 },
  uploadTitle: { fontSize: 18, color: C.txt, fontWeight: '700' },
  pctTxt:      { fontSize: 22, color: C.green, fontWeight: '700' },

  errTxt:      { color: '#f87171', fontSize: 11, marginTop: 8, textAlign: 'center' },
  advancedLink:    { marginTop: 24, alignItems: 'center' },
  advancedLinkTxt: { fontSize: 12, color: C.muted, textDecorationLine: 'underline' },
});
