import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  ScrollView, ActivityIndicator, Animated,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { uploadVideoWithProgress, WARN_BYTES } from '../api';
import { C, IS_WEB } from '../shared/theme';
import { Badge } from './Badge';

const TOTAL_BLOCKS = 100; // 10 × 10 grid

function inferMimeType(fileName) {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  const map = { mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska', webm: 'video/webm', m4v: 'video/x-m4v' };
  return map[ext] || 'video/mp4';
}

// 100 blok grid — her blok 1% temsil eder
function ProgressGrid({ pct }) {
  const blocks = useMemo(() => Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1), []);
  return (
    <View style={g.grid}>
      {blocks.map(n => (
        <View
          key={n}
          style={[g.block, n <= pct ? g.blockFilled : g.blockEmpty]}
        />
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
  const [file, setFile]         = useState(null);
  const [asset, setAsset]       = useState(null);
  const [sizeMB, setSizeMB]     = useState(0);
  const [loading, setLoading]   = useState(false);
  const [picking, setPicking]   = useState(false);
  const [error, setError]       = useState('');
  const [uploadPct, setUploadPct] = useState(0);
  const [phase, setPhase]       = useState('idle'); // idle | uploading | success

  const pulse          = useRef(new Animated.Value(1)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const lastPctRef     = useRef(0);
  const pulseAnim      = useRef(null);
  const successDataRef = useRef(null); // tanım kullanımdan ÖNCE

  // Pulse animasyonu
  useEffect(() => {
    pulseAnim.current = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.03, duration: 1100, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 1100, useNativeDriver: true }),
    ]));
    pulseAnim.current.start();
    return () => pulseAnim.current?.stop();
  }, []);

  // Başarı ekranı fade-in + otomatik geçiş
  useEffect(() => {
    if (phase !== 'success') return;
    pulseAnim.current?.stop();
    successOpacity.setValue(0);
    Animated.timing(successOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    // successDataRef.current null güvencesi
    if (!successDataRef.current?.job_id) return;
    const src = IS_WEB ? file : asset;
    const timer = setTimeout(() => {
      onDone({
        jobId:    successDataRef.current.job_id,
        duration: successDataRef.current.duration || 0,
        file:     src,
      });
    }, 1400);
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

  async function pickNativeFiles() {
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
    if (picking || loading) return;
    setError(''); setPicking(true); setPhase('idle');
    try {
      if (IS_WEB) {
        const f = await pickFileWeb();
        if (f) { setFile(f); setAsset(null); setSizeMB(parseFloat((f.size / 1024 / 1024).toFixed(1))); }
      } else {
        const a = await pickNativeFiles();
        if (a) { setAsset(a); setFile(null); setSizeMB(parseFloat(((a.fileSize || 0) / 1024 / 1024).toFixed(1))); }
      }
    } catch(e) {
      setError(e.message);
    } finally {
      setPicking(false);
    }
  }

  const handleProgress = useCallback((pct) => {
    const clamped = Math.min(Math.max(Math.round(pct), 0), 100);
    // Her 1%'de güncelle; ilk çağrıda da (pct=0) grid göster
    if (clamped !== lastPctRef.current) {
      lastPctRef.current = clamped;
      setUploadPct(clamped);
    }
  }, []);

  async function upload() {
    const src = IS_WEB ? file : asset;
    if (!src) return;
    if (planCtx && !planCtx.loaded) return; // AsyncStorage henüz yüklenmedi
    if (planCtx && !planCtx.canUpload) { onPaywall?.(); return; }

    setLoading(true); setError(''); setUploadPct(0); setPhase('uploading');
    lastPctRef.current = 0;

    try {
      const data = await uploadVideoWithProgress(src, handleProgress);
      if (!data.job_id) throw new Error('job_id alınamadı');
      await planCtx?.recordUpload?.();
      // %100 göster, sonra success ekranına geç
      setUploadPct(100);
      successDataRef.current = data;
      setPhase('success');
    } catch(e) {
      setError(e.message);
      setPhase('idle');
    } finally {
      setLoading(false);
    }
  }

  const displayName = IS_WEB ? file?.name : (asset?.fileName || asset?.uri?.split('/').pop() || '');
  const hasFile = IS_WEB ? !!file : !!asset;
  const isLarge = sizeMB > (WARN_BYTES / 1024 / 1024);
  const isBusy  = picking || loading;

  // ── Başarı ekranı ──
  if (phase === 'success') {
    return (
      <Animated.View style={[s.successWrap, { opacity: successOpacity }]}>
        <View style={s.successCard}>
          <View style={s.successIconWrap}>
            <Text style={s.successIcon}>✓</Text>
          </View>
          <Text style={s.successTitle}>Video Yüklendi!</Text>
          <Text style={s.successSub} numberOfLines={1}>{displayName}</Text>
          {sizeMB > 0 && <Text style={s.successMeta}>{sizeMB} MB</Text>}
          {/* Tüm bloklar yeşil */}
          <ProgressGrid pct={100} />
          <ActivityIndicator color={C.green} size="small" style={{ marginTop: 4 }}/>
          <Text style={s.successHint}>Devam ediliyor...</Text>
        </View>
      </Animated.View>
    );
  }

  // ── Upload sırasında ──
  if (phase === 'uploading') {
    return (
      <ScrollView contentContainerStyle={s.stepWrap}>
        <Badge label="ADIM 1"/>
        <Text style={s.stepTitle}>Yükleniyor</Text>
        <View style={s.uploadingCard}>
          {/* Blok grid */}
          <ProgressGrid pct={uploadPct} />
          {/* Yüzde + etiket */}
          <View style={s.pctRow}>
            <Text style={s.pctNum}>{uploadPct}</Text>
            <Text style={s.pctSign}>%</Text>
          </View>
          <Text style={s.uploadingLabel}>
            {uploadPct < 10
              ? 'Sunucuya bağlanıyor...'
              : uploadPct < 95
              ? 'Yükleniyor...'
              : 'Sunucu işliyor...'}
          </Text>
          <Text style={s.uploadingFile} numberOfLines={1}>{displayName}</Text>
        </View>
      </ScrollView>
    );
  }

  // ── Normal ekran (idle) ──
  return (
    <ScrollView contentContainerStyle={s.stepWrap}>
      <Badge label="ADIM 1" />
      <Text style={s.stepTitle}>Videoyu Yükle</Text>
      <Text style={s.stepSub}>Ham çekimi olduğu gibi at.{'\n'}Edit etmene gerek yok.</Text>

      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <TouchableOpacity style={[s.uploadBox, isBusy && { opacity: 0.65 }]}
          onPress={handlePick} activeOpacity={0.8} disabled={isBusy}>
          {picking ? (
            <>
              <ActivityIndicator color={C.accent} size="large" style={{ marginBottom: 12 }}/>
              <Text style={s.uploadBoxTitle}>Seçiliyor...</Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 44, marginBottom: 12 }}>{IS_WEB ? '🎬' : '📁'}</Text>
              <Text style={s.uploadBoxTitle}>{hasFile ? 'Farklı Video Seç' : 'Video Seç'}</Text>
              <Text style={s.uploadBoxSub}>{IS_WEB ? 'MP4 · MOV · WebM' : 'Dosyalar · iCloud · MP4 · MOV'}</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>

      {hasFile && (
        <View style={s.fileChosen}>
          <View style={s.fileIconWrap}>
            <Text style={{ fontSize: 20 }}>✓</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.fileName} numberOfLines={1}>{displayName}</Text>
            <Text style={s.fileMeta}>{sizeMB > 0 ? sizeMB + ' MB' : 'Hazır'}</Text>
          </View>
        </View>
      )}

      {planCtx && !planCtx.isPro && (
        <View style={[s.warnBox, { borderColor: planCtx.uploadsRemaining === 0 ? 'rgba(248,113,113,0.4)' : 'rgba(255,209,102,0.3)' }]}>
          <Text style={[s.warnTxt, { color: planCtx.uploadsRemaining === 0 ? '#f87171' : C.warn }]}>
            {planCtx.uploadsRemaining === 0
              ? "Günlük ücretsiz yükleme limitin doldu. Pro'ya geç!"
              : `Ücretsiz: bugün ${planCtx.uploadsRemaining} yükleme hakkın kaldı.`}
          </Text>
        </View>
      )}

      {isLarge && (
        <View style={s.warnBox}>
          <Text style={s.warnTxt}>Büyük dosya: {sizeMB} MB. Yükleme süresi uzun olabilir.</Text>
        </View>
      )}

      {!!error && (
        <View style={s.errorCard}>
          <Text style={s.errorTxt}>⚠ {error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={upload}>
            <Text style={s.retryBtnTxt}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[s.btn, s.btnAccent, (!hasFile || isBusy) && s.btnDisabled]}
        onPress={upload}
        disabled={!hasFile || isBusy}>
        <Text style={s.btnTxt}>Yükle ve Devam Et</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  stepWrap:       { padding: 24, paddingTop: 16 },
  stepTitle:      { fontSize: 34, color: C.txt, fontStyle: 'italic', marginTop: 12, marginBottom: 8, lineHeight: 40 },
  stepSub:        { fontSize: 14, color: C.dim, lineHeight: 22, marginBottom: 28 },

  uploadBox:      { borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 48, alignItems: 'center', backgroundColor: C.card, marginBottom: 16 },
  uploadBoxTitle: { fontSize: 16, color: C.txt, marginBottom: 4 },
  uploadBoxSub:   { fontSize: 12, color: C.muted },

  fileChosen:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(29,185,116,0.08)', borderWidth: 1, borderColor: 'rgba(29,185,116,0.2)', borderRadius: 10, padding: 14, marginBottom: 16 },
  fileIconWrap:   { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(29,185,116,0.15)', alignItems: 'center', justifyContent: 'center' },
  fileName:       { fontSize: 13, color: C.txt, marginBottom: 2 },
  fileMeta:       { fontSize: 11, color: C.muted },

  warnBox:        { backgroundColor: 'rgba(255,209,102,0.08)', borderWidth: 1, borderColor: 'rgba(255,209,102,0.3)', borderRadius: 8, padding: 12, marginBottom: 12 },
  warnTxt:        { color: C.warn, fontSize: 12, lineHeight: 18 },

  errorCard:      { backgroundColor: 'rgba(248,113,113,0.08)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', borderRadius: 10, padding: 14, marginBottom: 12, gap: 10 },
  errorTxt:       { color: '#f87171', fontSize: 13, lineHeight: 18 },
  retryBtn:       { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#f87171', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  retryBtnTxt:    { color: '#f87171', fontSize: 12, fontWeight: '600' },

  btn:            { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: C.card },
  btnAccent:      { backgroundColor: C.accent, borderColor: C.accent },
  btnDisabled:    { opacity: 0.3 },
  btnTxt:         { color: '#fff', fontSize: 14, letterSpacing: 0.5, fontWeight: '500' },

  // Upload aşaması
  uploadingCard:  { backgroundColor: C.card, borderWidth: 1, borderColor: 'rgba(29,185,116,0.3)', borderRadius: 16, padding: 24, alignItems: 'center', marginTop: 12 },
  pctRow:         { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6 },
  pctNum:         { fontSize: 64, color: C.green, fontWeight: '700', lineHeight: 72 },
  pctSign:        { fontSize: 24, color: C.green, fontWeight: '600', marginBottom: 10, marginLeft: 4 },
  uploadingLabel: { fontSize: 14, color: C.dim, marginBottom: 6 },
  uploadingFile:  { fontSize: 11, color: C.muted, maxWidth: 260 },

  // Başarı ekranı
  successWrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  successCard:    { backgroundColor: C.card, borderWidth: 1, borderColor: 'rgba(29,185,116,0.4)', borderRadius: 20, padding: 32, alignItems: 'center', width: '100%', maxWidth: 360 },
  successIconWrap:{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(29,185,116,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successIcon:    { fontSize: 36, color: C.green },
  successTitle:   { fontSize: 24, color: C.green, fontWeight: '700', marginBottom: 6 },
  successSub:     { fontSize: 13, color: C.txt, marginBottom: 4, maxWidth: 260 },
  successMeta:    { fontSize: 11, color: C.muted, marginBottom: 16 },
  successHint:    { fontSize: 12, color: C.muted, marginTop: 8 },
});
