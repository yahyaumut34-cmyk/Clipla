import { useEffect } from 'react';
import { VideoView, useVideoPlayer } from 'expo-video';

export function NativeVideoPlayer({ uri, height = 220 }) {
  const player = useVideoPlayer(uri, p => { p.loop = false; });

  useEffect(() => {
    return () => {
      try { player?.release?.(); } catch {}
    };
  }, [player]);

  return (
    <VideoView
      player={player}
      allowsFullscreen
      allowsPictureInPicture
      style={{ width: '100%', height, borderRadius: 10, backgroundColor: '#000' }}
    />
  );
}
