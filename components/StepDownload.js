import { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, Linking } from 'react-native';
import * as Sharing from 'expo-sharing';
import { toAbsoluteUrl } from '../api';
import { C, IS_WEB } from '../shared/theme';
import { Badge } from './Badge';

export function StepDownload({ result, onRestart }) {
  const dur      = result.duration || {};
  const videoUrl = toAbsoluteUrl(result.download_url || result.output_url || '');
  const [sharing, setSharing] = useState(false);

  function download() {
    if (IS_WEB && typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = videoUrl; a.download = 'cliplav_output.mp4'; a.click();
    } else {
      Linking.openURL(videoUrl);
    }
  }

  async function share() {
    if (IS_WEB) { download(); return; }
    setSharing(true);
    try {
      const { FileSystem } = await import('expo-file-system');
      const localUri = FileSystem.cacheDirectory + 'cliplav_output.mp4';
      await FileSystem.downloadAsync(videoUrl, localUri);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(localUri, { mimeType: 'video/mp4', dialogTitle: 'Videoyu Paylaş' });
      } else {
        Linking.openURL(videoUrl);
      }
    } catch(e) {
      console.error('[share]', e);
      Linking.openURL(videoUrl);
    } finally {
      setSharing(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[s.stepWrap, { alignItems: 'center' }]}>
      <Text style={{ fontSize: 72, marginBottom: 16 }}>✓</Text>
      <Badge label="HAZIR" color={C.green}/>
      <Text style={[s.stepTitle, { textAlign: 'center', marginTop: 12 }]}>Videon Hazır!</Text>
      <Text style={[s.stepSub, { textAlign: 'center' }]}>
        {dur.input}s ham video{'\n'}→ {dur.output}s kurgulanan video
      </Text>
      <TouchableOpacity style={[s.btn, s.btnGreen, { width: '100%', marginTop: 24 }]} onPress={download}>
        <Text style={s.btnTxt}>MP4 İndir</Text>
      </TouchableOpacity>
      {!IS_WEB && (
        <TouchableOpacity
          style={[s.btn, { width: '100%', marginTop: 10, borderColor: C.accent }, sharing && s.btnDisabled]}
          onPress={share} disabled={sharing}>
          {sharing
            ? <ActivityIndicator color={C.accent}/>
            : <Text style={[s.btnTxt, { color: C.accent }]}>Paylaş</Text>}
        </TouchableOpacity>
      )}
      <TouchableOpacity style={[s.btn, { width: '100%', marginTop: 10 }]} onPress={onRestart}>
        <Text style={[s.btnTxt, { color: C.dim }]}>Yeni Video Yükle</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  stepWrap:  { padding: 24, paddingTop: 16 },
  stepTitle: { fontSize: 34, color: C.txt, fontStyle: 'italic', marginTop: 12, marginBottom: 8, lineHeight: 40 },
  stepSub:   { fontSize: 14, color: C.dim, lineHeight: 22, marginBottom: 28 },
  btn:       { borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: C.card },
  btnGreen:  { backgroundColor: C.green, borderColor: C.green },
  btnDisabled: { opacity: 0.3 },
  btnTxt:    { color: '#fff', fontSize: 14, letterSpacing: 0.5, fontWeight: '500' },
});
