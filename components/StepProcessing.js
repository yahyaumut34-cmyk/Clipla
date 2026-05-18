/**
 * StepProcessing — Hızlı edit işlenirken gösterilen ekran
 * useEditPolling hook'unu kullanır, tamamlandığında onDone çağrılır.
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useEditPolling } from '../hooks/useEditPolling';
import { C } from '../shared/theme';

const STEP_MESSAGES = [
  'Ses analiz ediliyor...',
  'Sessizlikler kaldırılıyor...',
  'Platform formatı uygulanıyor...',
  'Video render ediliyor...',
  'Tamamlanıyor...',
];

export function StepProcessing({ jobData, template, onDone, onError }) {
  const { editLoading, editProgress, startEdit } = useEditPolling({
    jobId: jobData?.jobId,
    onDone: (result) => onDone(result),
    onError: (e)    => onError?.(e),
  });

  // Bileşen mount olunca edit'i başlat
  useEffect(() => {
    if (!jobData?.jobId || !template) return;
    startEdit({
      commandText:       `${template.label} formatında düzenle`,
      platform:          template.platform,
      targetDurationSec: template.targetSec,
      subtitleLang:      null,
      removeFillers:     template.removeFillers,
      preserveRhythm:    true,
    });
  }, []); // sadece bir kere

  const progressText = editProgress || 'Hazırlanıyor...';
  const progressPct  = (() => {
    const m = progressText.match(/(\d+)/);
    return m ? Math.min(parseInt(m[1]), 100) : null;
  })();

  return (
    <View style={s.wrap}>
      <View style={s.card}>
        <Text style={s.emoji}>{template?.emoji || '⚙'}</Text>
        <Text style={s.title}>{template?.label || 'İşleniyor'}</Text>
        <Text style={s.subtitle}>{template?.desc || ''}</Text>

        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${progressPct ?? 30}%`, backgroundColor: template?.color || C.accent }]}/>
        </View>

        <ActivityIndicator color={template?.color || C.accent} size="large" style={{ marginVertical: 16 }}/>
        <Text style={s.progressTxt}>{progressText}</Text>
        <Text style={s.hint}>Ekranı kapatmayın, işlem devam ediyor.</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:         { width: '100%', maxWidth: 340, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, padding: 28, alignItems: 'center', gap: 8 },
  emoji:        { fontSize: 52, marginBottom: 4 },
  title:        { fontSize: 20, color: C.txt, fontWeight: '700' },
  subtitle:     { fontSize: 12, color: C.muted, marginBottom: 4 },
  progressTrack:{ width: '100%', height: 4, borderRadius: 2, backgroundColor: C.border, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2, transition: 'width 0.5s ease' },
  progressTxt:  { fontSize: 13, color: C.dim, textAlign: 'center' },
  hint:         { fontSize: 10, color: C.muted, marginTop: 8, textAlign: 'center' },
});
