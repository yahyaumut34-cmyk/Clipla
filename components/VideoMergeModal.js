import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput,
  ScrollView, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { C, IS_WEB } from '../shared/theme';
import { VideoTimeline } from './VideoTimeline';

// Web: dosyadan blob URL + süre algıla
function useFileInfo(file) {
  const [info, setInfo] = useState({ uri: null, duration: 60 });
  useEffect(() => {
    if (!file) return;
    if (IS_WEB) {
      const uri = URL.createObjectURL(file);
      const vid = document.createElement('video');
      vid.preload = 'metadata';
      vid.onloadedmetadata = () => setInfo({ uri, duration: Math.ceil(vid.duration) || 60 });
      vid.onerror = () => setInfo({ uri, duration: 60 });
      vid.src = uri;
      return () => URL.revokeObjectURL(uri);
    } else {
      setInfo({ uri: file.uri || null, duration: 60 });
    }
  }, [file]);
  return info;
}

const TRANSITIONS = [
  { id: 'cut',       label: 'Kesik' },
  { id: 'fade',      label: 'Fade' },
  { id: 'crossfade', label: 'Crossfade' },
  { id: 'wipe',      label: 'Wipe' },
  { id: 'zoom',      label: 'Zoom' },
];

// ── Video satırı (film şeritli) ───────────────────────────────────────────────
function VideoRow({ v, idx, total, clip, uploading, onMoveUp, onMoveDown, onRemove, onTrim, onTrimRange }) {
  const { uri, duration } = useFileInfo(v.file);
  const trimStart = parseFloat(clip.trimStart) || 0;
  const trimEnd   = clip.trimEnd ? parseFloat(clip.trimEnd) : null;

  return (
    <View style={s.vidCard}>
      {/* Üst satır: numara + isim + sırala + kaldır */}
      <View style={s.vidHeader}>
        <View style={s.numCircle}>
          <Text style={s.numTxt}>{idx + 1}</Text>
        </View>
        <Text style={s.vidName} numberOfLines={1}>{v.name}</Text>
        {!uploading && (
          <View style={s.orderBtns}>
            {idx > 0 && (
              <TouchableOpacity style={s.orderBtn} onPress={onMoveUp}>
                <Text style={s.orderBtnTxt}>↑</Text>
              </TouchableOpacity>
            )}
            {idx < total - 1 && (
              <TouchableOpacity style={s.orderBtn} onPress={onMoveDown}>
                <Text style={s.orderBtnTxt}>↓</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {!uploading && (
          <TouchableOpacity style={s.removeBtn} onPress={onRemove}>
            <Text style={s.removeBtnTxt}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Film şeridi + trim handles */}
      <View style={s.timelineWrap}>
        <VideoTimeline
          uri={uri}
          duration={duration}
          trimStart={trimStart}
          trimEnd={trimEnd}
          onTrimChange={onTrimRange}
          readOnly={uploading}
        />
      </View>

      {/* Sayısal trim göstergesi + manuel giriş */}
      <View style={s.trimRow}>
        <Text style={s.trimLbl}>Başlangıç</Text>
        <TextInput
          style={s.trimInput}
          placeholder="0"
          placeholderTextColor={C.dim}
          keyboardType="numeric"
          value={clip.trimStart || ''}
          onChangeText={val => onTrim('trimStart', val)}
          editable={!uploading}
        />
        <Text style={s.trimArrow}>→</Text>
        <Text style={s.trimLbl}>Bitiş</Text>
        <TextInput
          style={s.trimInput}
          placeholder={String(duration)}
          placeholderTextColor={C.dim}
          keyboardType="numeric"
          value={clip.trimEnd || ''}
          onChangeText={val => onTrim('trimEnd', val)}
          editable={!uploading}
        />
        <Text style={s.trimUnit}>sn</Text>
      </View>

      {/* Yükleme ilerlemesi */}
      {uploading && (
        <View style={s.progressRow}>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${v.pct || 0}%` }]} />
          </View>
          <Text style={s.progressPct}>{v.pct || 0}%</Text>
        </View>
      )}
    </View>
  );
}

export function VideoMergeModal({
  visible,
  onClose,
  videoList,
  setVideoList,
  mergeSettings,
  setMergeSettings,
  onMergeUpload,
  uploading,
  onAddMore,
}) {
  const isMerge = videoList.length >= 2;

  function moveUp(idx) {
    if (idx === 0) return;
    setVideoList(prev => {
      const n = [...prev];
      [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]];
      return n;
    });
  }

  function moveDown(idx) {
    setVideoList(prev => {
      if (idx === prev.length - 1) return prev;
      const n = [...prev];
      [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]];
      return n;
    });
  }

  function removeVid(id) {
    setVideoList(prev => prev.filter(v => v.id !== id));
  }

  function setTrim(id, key, val) {
    setMergeSettings(prev => ({
      ...prev,
      clips: { ...prev.clips, [id]: { ...(prev.clips[id] || {}), [key]: val } },
    }));
  }

  const canClose = !uploading;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={canClose ? onClose : undefined}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Backdrop */}
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={canClose ? onClose : undefined}
        />

        {/* Sheet */}
        <View style={s.sheet}>
          {/* Handle bar */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <Text style={s.title}>Video Birleştirme</Text>
              {videoList.length > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeTxt}>{videoList.length}/5</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[s.closeBtn, !canClose && { opacity: 0.3 }]}
              onPress={canClose ? onClose : undefined}
              disabled={!canClose}
            >
              <Text style={s.closeBtnTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Video listesi */}
            {videoList.length === 0 ? (
              <View style={s.emptyMerge}>
                <Text style={s.emptyMergeEmoji}>🎬</Text>
                <Text style={s.emptyMergeTitle}>Videoları seç ve birleştir</Text>
                <Text style={s.emptyMergeSub}>
                  Birleştirmek istediğin videoları ekle, sırala, trim noktaları belirle ve tek videoya dönüştür.
                </Text>
                <TouchableOpacity style={s.emptyMergeBtn} onPress={onAddMore}>
                  <Text style={s.emptyMergeBtnTxt}>+ Video Ekle</Text>
                </TouchableOpacity>
              </View>
            ) : (
              videoList.map((v, idx) => (
                <VideoRow
                  key={v.id}
                  v={v}
                  idx={idx}
                  total={videoList.length}
                  clip={mergeSettings.clips[v.id] || {}}
                  uploading={uploading}
                  onMoveUp={() => moveUp(idx)}
                  onMoveDown={() => moveDown(idx)}
                  onRemove={() => removeVid(v.id)}
                  onTrim={(key, val) => setTrim(v.id, key, val)}
                  onTrimRange={({ start, end }) => {
                    setTrim(v.id, 'trimStart', String(start));
                    setTrim(v.id, 'trimEnd', String(end));
                  }}
                />
              ))
            )}

            {/* + Video Ekle */}
            {!uploading && videoList.length < 5 && (
              <TouchableOpacity style={s.addMoreBtn} onPress={onAddMore}>
                <Text style={s.addMoreTxt}>+ Video Ekle</Text>
              </TouchableOpacity>
            )}

            {/* Geçiş efekti — sadece 2+ video varsa */}
            {isMerge && (
              <>
                <Text style={s.sectionLbl}>GEÇİŞ EFEKTİ</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={s.chipScroll}
                >
                  <View style={s.chipRow}>
                    {TRANSITIONS.map(tr => {
                      const active = mergeSettings.transition === tr.id;
                      return (
                        <TouchableOpacity
                          key={tr.id}
                          style={[s.chip, active && s.chipActive]}
                          onPress={() => !uploading && setMergeSettings(p => ({ ...p, transition: tr.id }))}
                        >
                          <Text style={[s.chipTxt, active && s.chipTxtActive]}>{tr.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </>
            )}

            {/* Tek video hint */}
            {!isMerge && videoList.length === 1 && !uploading && (
              <Text style={s.hintTxt}>
                Birleştirmek için en az 1 video daha ekle. Ya da tek video olarak yükle.
              </Text>
            )}
          </ScrollView>

          {/* Buton */}
          <View style={s.footer}>
            <TouchableOpacity
              style={[s.mergeBtn, (uploading || videoList.length === 0) && { opacity: 0.5 }]}
              onPress={onMergeUpload}
              disabled={uploading || videoList.length === 0}
            >
              {uploading ? (
                <View style={s.btnInner}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={s.mergeBtnTxt}>Yükleniyor...</Text>
                </View>
              ) : (
                <Text style={s.mergeBtnTxt}>
                  {isMerge ? '⬆ Yükle ve Birleştir' : '⬆ Yükle'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  flex:    { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },

  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: '88%',
    backgroundColor: C.card,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    flex: 1,
  },

  handle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: C.border, alignSelf: 'center', marginTop: 10, marginBottom: 6,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderColor: C.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title:      { fontSize: 16, color: C.txt, fontWeight: '700' },
  badge:      { backgroundColor: 'rgba(163,139,250,0.15)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeTxt:   { fontSize: 12, color: C.accent2, fontWeight: '600' },
  closeBtn:   { width: 30, height: 30, borderRadius: 15, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  closeBtnTxt:{ fontSize: 13, color: C.dim },

  scroll:        { flex: 1 },
  scrollContent: { padding: 20, gap: 0 },

  emptyTxt: { fontSize: 13, color: C.dim, textAlign: 'center', marginVertical: 20 },
  emptyMerge:      { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  emptyMergeEmoji: { fontSize: 48, marginBottom: 14 },
  emptyMergeTitle: { fontSize: 17, color: C.txt, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyMergeSub:   { fontSize: 13, color: C.dim, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyMergeBtn:   { backgroundColor: C.accent, paddingHorizontal: 32, paddingVertical: 13, borderRadius: 12 },
  emptyMergeBtnTxt:{ color: '#fff', fontSize: 15, fontWeight: '700' },

  // Video kart (film şeritli)
  vidCard:     { backgroundColor: C.card2, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 10 },
  vidHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  numCircle:   { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(99,102,241,0.18)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  numTxt:      { fontSize: 11, color: C.accent, fontWeight: '700' },
  vidName:     { flex: 1, fontSize: 13, color: C.txt, fontWeight: '500' },
  orderBtns:   { flexDirection: 'row', gap: 4 },
  orderBtn:    { width: 26, height: 26, borderRadius: 5, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  orderBtnTxt: { fontSize: 12, color: C.dim },
  removeBtn:   { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(248,113,113,0.1)', alignItems: 'center', justifyContent: 'center' },
  removeBtnTxt:{ fontSize: 11, color: C.red },

  timelineWrap: { marginBottom: 10 },

  trimRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  trimLbl:   { fontSize: 10, color: C.dim },
  trimInput: { width: 60, height: 28, backgroundColor: C.bg, borderRadius: 7, borderWidth: 1, borderColor: C.border, paddingHorizontal: 7, fontSize: 12, color: C.txt },
  trimArrow: { fontSize: 10, color: C.dim },
  trimUnit:  { fontSize: 10, color: C.dim },

  progressRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  progressTrack: { flex: 1, height: 4, backgroundColor: C.muted, borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: 4, backgroundColor: C.accent, borderRadius: 2 },
  progressPct:   { fontSize: 10, color: C.dim, width: 28, textAlign: 'right' },

  addMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, marginBottom: 4, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.accent, borderStyle: 'dashed' },
  addMoreTxt: { fontSize: 13, color: C.accent, fontWeight: '600' },

  sectionLbl: { fontSize: 10, color: C.dim, letterSpacing: 1, marginTop: 18, marginBottom: 10 },
  chipScroll: { marginBottom: 4 },
  chipRow:    { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  chip:       { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipTxt:    { fontSize: 13, color: C.dim },
  chipTxtActive: { color: '#fff', fontWeight: '600' },

  hintTxt: { fontSize: 12, color: C.dim, textAlign: 'center', marginTop: 16, lineHeight: 18 },

  footer:    { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderColor: C.border },
  mergeBtn:  { backgroundColor: C.accent, borderRadius: 12, padding: 15, alignItems: 'center' },
  btnInner:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mergeBtnTxt:{ color: '#fff', fontSize: 15, fontWeight: '700' },
});
