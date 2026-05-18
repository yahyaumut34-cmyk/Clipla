/**
 * VideoTimeline — Film şeridi bileşeni
 * Web: HTML5 canvas ile gerçek video kareleri
 * Native: Renkli blok şerit
 * Destekler: scrubber (konum seçimi), trim handles (kırpma)
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  PanResponder, Image,
} from 'react-native';
import { C, IS_WEB } from '../shared/theme';

const PX_PER_SEC = 48;   // saniye başına piksel
const STRIP_H    = 54;   // şerit yüksekliği
const THUMB_W    = 54;   // kare genişliği
const THUMB_H    = 54;   // kare yüksekliği
const HANDLE_W   = 18;   // trim handle genişliği

// ── Web: video karelerini canvas ile çıkar ────────────────────────────────────
function useVideoFrames(uri, duration) {
  const [frames, setFrames] = useState([]);

  useEffect(() => {
    if (!IS_WEB || !uri || !duration || duration <= 0) return;
    let cancelled = false;

    async function extract() {
      try {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = THUMB_W;
        canvas.height = THUMB_H;
        video.crossOrigin = 'anonymous';
        video.muted = true;
        video.preload = 'metadata';

        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = reject;
          video.src = uri;
          setTimeout(reject, 5000);
        });

        const count = Math.min(Math.ceil(duration), 14);
        const result = [];

        for (let i = 0; i < count && !cancelled; i++) {
          video.currentTime = (i / count) * video.duration;
          await new Promise(r => { video.onseeked = r; setTimeout(r, 800); });
          try {
            ctx.drawImage(video, 0, 0, THUMB_W, THUMB_H);
            result.push(canvas.toDataURL('image/jpeg', 0.55));
          } catch {
            result.push(null);
          }
        }

        if (!cancelled) setFrames(result);
        video.src = '';
      } catch {
        // CORS veya başka hata → gradient fallback
      }
    }

    extract();
    return () => { cancelled = true; };
  }, [uri, duration]);

  return frames;
}

// ── Trim handle ───────────────────────────────────────────────────────────────
function TrimHandle({ side, onDrag, disabled }) {
  const panRef = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder:  () => !disabled,
      onPanResponderMove: (_, gs) => onDrag(gs.dx),
      onPanResponderRelease: () => {},
    })
  ).current;

  return (
    <View
      {...panRef.panHandlers}
      style={[
        tl.handle,
        side === 'start' ? tl.handleStart : tl.handleEnd,
      ]}
    >
      <Text style={tl.handleIcon}>{side === 'start' ? '◀' : '▶'}</Text>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// VideoTimeline
// Props:
//   uri          — video url (kare çıkarmak için)
//   duration     — saniye (number)
//   currentTime  — scrubber konumu (number)
//   onTimeChange — (time: number) => void
//   trimStart    — kırpma başlangıcı (number, default 0)
//   trimEnd      — kırpma sonu (number | null = sona kadar)
//   onTrimChange — ({ start, end }) => void | undefined (undefined → handles gizli)
//   readOnly     — sadece görsel, etkileşim yok
// ════════════════════════════════════════════════════════════════════════════════
export function VideoTimeline({
  uri,
  duration = 30,
  currentTime = 0,
  onTimeChange,
  trimStart = 0,
  trimEnd,
  onTrimChange,
  readOnly = false,
  markers = [],   // [{ id, icon, color, time, label }]
}) {
  const [containerW, setContainerW] = useState(360);
  const trimStartRef = useRef(trimStart);
  const trimEndRef   = useRef(trimEnd ?? duration);
  const frames       = useVideoFrames(uri, duration);

  useEffect(() => { trimStartRef.current = trimStart; },       [trimStart]);
  useEffect(() => { trimEndRef.current = trimEnd ?? duration; }, [trimEnd, duration]);

  const tEnd   = trimEnd ?? duration;
  const totalW = Math.max(duration * PX_PER_SEC, containerW);

  const timeToX = (t) => (Math.max(0, Math.min(duration, t)) / duration) * totalW;
  const xToTime = (x) => parseFloat(Math.max(0, Math.min(duration, (x / totalW) * duration)).toFixed(2));

  // Zaman çizgileri
  const interval = duration <= 10 ? 1 : duration <= 30 ? 5 : duration <= 120 ? 10 : 30;
  const marks = [];
  for (let t = 0; t <= duration; t += interval) marks.push(t);

  // Scrubber'ı pozisyonla
  function handleStripPress(e) {
    if (readOnly || !onTimeChange) return;
    const x = IS_WEB ? e.nativeEvent.offsetX : e.nativeEvent.locationX;
    onTimeChange(xToTime(x));
  }

  // Trim handle sürükleme
  const startDragHandler = useCallback((gs_dx) => {
    if (!onTrimChange) return;
    const newStart = xToTime(timeToX(trimStartRef.current) + gs_dx);
    const newStartClamped = Math.min(newStart, trimEndRef.current - 0.5);
    trimStartRef.current = newStartClamped;
    onTrimChange({ start: newStartClamped, end: trimEndRef.current });
  }, [onTrimChange, totalW, duration]);

  const endDragHandler = useCallback((gs_dx) => {
    if (!onTrimChange) return;
    const newEnd = xToTime(timeToX(trimEndRef.current) + gs_dx);
    const newEndClamped = Math.max(newEnd, trimStartRef.current + 0.5);
    trimEndRef.current = newEndClamped;
    onTrimChange({ start: trimStartRef.current, end: newEndClamped });
  }, [onTrimChange, totalW, duration]);

  const scrubX    = timeToX(currentTime);
  const trimSX    = timeToX(trimStart);
  const trimEX    = timeToX(tEnd);
  const segCount  = Math.ceil(totalW / THUMB_W);

  return (
    <View
      style={tl.root}
      onLayout={e => setContainerW(e.nativeEvent.layout.width)}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ width: totalW + HANDLE_W * 2 }}
        style={tl.scroll}
      >
        {/* Trim start handle */}
        {onTrimChange && (
          <View style={[tl.handleWrap, { left: trimSX }]}>
            <TrimHandle side="start" onDrag={startDragHandler} />
          </View>
        )}

        {/* Film şeridi */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleStripPress}
          style={{ width: totalW }}
        >
          {/* Şerit */}
          <View style={[tl.strip, { width: totalW }]}>

            {/* Kareler veya renkli bloklar */}
            {frames.length > 0
              ? frames.map((src, i) => (
                <View key={i} style={tl.frame}>
                  {src
                    ? <Image source={{ uri: src }} style={tl.frameImg} />
                    : <View style={tl.frameBlank} />
                  }
                  <View style={tl.filmHole} />
                </View>
              ))
              : Array.from({ length: segCount }, (_, i) => {
                  const t = (i / segCount) * duration;
                  const inRange = t >= trimStart && t <= tEnd;
                  return (
                    <View key={i} style={[tl.segment, { backgroundColor: inRange ? '#1e2444' : '#0d0f18' }]}>
                      <View style={tl.filmHole} />
                    </View>
                  );
                })
            }

            {/* Trim dışı karartma */}
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {trimStart > 0 && (
                <View style={[tl.dimmed, { left: 0, width: trimSX }]} />
              )}
              {tEnd < duration && (
                <View style={[tl.dimmed, { left: trimEX, width: totalW - trimEX }]} />
              )}
              {/* Trim kenarlığı */}
              <View style={[tl.trimBorder, { left: trimSX, width: trimEX - trimSX }]} />
              {/* İşlem markerları */}
              {markers.map(m => {
                const mx = timeToX(m.time);
                return (
                  <View key={m.id}>
                    {/* Dikey çizgi */}
                    <View style={[tl.markerLine, { left: mx, backgroundColor: m.color }]} />
                    {/* İkon badge */}
                    <View style={[tl.markerBadge, { left: mx - 11, backgroundColor: m.color }]}>
                      <Text style={tl.markerIcon}>{m.icon}</Text>
                    </View>
                  </View>
                );
              })}
              {/* Scrubber çizgisi */}
              {!readOnly && onTimeChange && (
                <View style={[tl.scrubber, { left: scrubX }]}>
                  <View style={tl.scrubberHead} />
                </View>
              )}
            </View>
          </View>

          {/* Zaman işaretçileri */}
          <View style={[tl.markRow, { width: totalW }]}>
            {marks.map(t => (
              <View key={t} style={[tl.markPos, { left: timeToX(t) }]}>
                <Text style={tl.markTxt}>{t}s</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>

        {/* Trim end handle */}
        {onTrimChange && (
          <View style={[tl.handleWrap, { left: trimEX }]}>
            <TrimHandle side="end" onDrag={endDragHandler} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────
const tl = StyleSheet.create({
  root:   { width: '100%', overflow: 'hidden' },
  scroll: { width: '100%' },

  // Şerit
  strip:  { height: STRIP_H, flexDirection: 'row', overflow: 'hidden', borderRadius: 6, borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)' },
  frame:  { width: THUMB_W, height: STRIP_H, overflow: 'hidden', borderRightWidth: 1, borderColor: '#0a0b12', position: 'relative' },
  frameImg:   { width: THUMB_W, height: THUMB_H },
  frameBlank: { width: THUMB_W, height: THUMB_H, backgroundColor: '#1a1d2e' },
  segment:{ width: THUMB_W, height: STRIP_H, borderRightWidth: 1, borderColor: '#0a0b12', justifyContent: 'flex-start' },
  filmHole: { position: 'absolute', top: 4, left: '50%', marginLeft: -5, width: 10, height: 7, borderRadius: 2, backgroundColor: '#0a0b12' },

  // Overlay
  dimmed:     { ...StyleSheet.absoluteFillObject, position: 'absolute', top: 0, height: STRIP_H, backgroundColor: 'rgba(0,0,0,0.58)' },
  trimBorder: { position: 'absolute', top: 0, height: STRIP_H, borderWidth: 2, borderColor: C.accent, borderRadius: 4 },
  scrubber:   { position: 'absolute', top: -3, bottom: 0, width: 2, backgroundColor: '#fff', shadowColor: '#fff', shadowOpacity: 0.8, shadowRadius: 4 },
  scrubberHead: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginLeft: -3, marginTop: 0 },

  // Zaman çizgileri
  markRow: { height: 16, position: 'relative' },
  markPos: { position: 'absolute', top: 2 },
  markTxt: { fontSize: 9, color: C.dim, fontWeight: '500' },

  // Markerlar
  markerLine:  { position: 'absolute', top: 20, bottom: 0, width: 2, opacity: 0.75 },
  markerBadge: { position: 'absolute', top: 3, width: 22, height: 22, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  markerIcon:  { fontSize: 12 },

  // Handle
  handleWrap:  { position: 'absolute', top: 0, zIndex: 10, width: HANDLE_W, height: STRIP_H },
  handle:      { width: HANDLE_W, height: STRIP_H, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, borderRadius: 4 },
  handleStart: { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  handleEnd:   { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
  handleIcon:  { fontSize: 10, color: '#fff', fontWeight: '700' },
});
