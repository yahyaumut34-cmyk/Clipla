import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { C } from '../shared/theme';

export function NativeVideoPlayer({ uri, height = 220 }) {
  const [error, setError] = useState(false);
  const player = useVideoPlayer(uri, p => { p.loop = false; });

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener?.('statusChange', ({ status, error: e }) => {
      if (status === 'error' || e) setError(true);
    });
    return () => {
      sub?.remove?.();
      try { player?.release?.(); } catch {}
    };
  }, [player]);

  if (error) {
    return (
      <View style={[s.errorBox, { height }]}>
        <Text style={s.errorIcon}>⚠</Text>
        <Text style={s.errorTxt}>Video yüklenemedi</Text>
        <Text style={s.errorSub}>Dosya bozuk veya format desteklenmiyor</Text>
      </View>
    );
  }

  return (
    <VideoView
      player={player}
      allowsFullscreen
      allowsPictureInPicture
      style={{ width: '100%', height, borderRadius: 10, backgroundColor: '#000' }}
    />
  );
}

const s = StyleSheet.create({
  errorBox: { width: '100%', borderRadius: 10, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  errorIcon: { fontSize: 28, marginBottom: 8 },
  errorTxt:  { fontSize: 14, color: C.txt, fontWeight: '500' },
  errorSub:  { fontSize: 11, color: C.muted, marginTop: 4 },
});
