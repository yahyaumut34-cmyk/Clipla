/**
 * FloatingChat → yeniden tasarlandı
 * Artık "floating" değil — ChatMessages ve ChatInput inline bileşenler
 */

import { useState, useRef, useEffect, memo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSpring, withRepeat, withSequence,
  Easing,
} from 'react-native-reanimated';
import { C } from '../shared/theme';
import { PLAT_LABELS } from '../shared/constants';

// ── Pulse animasyonu (Reanimated) ─────────────────────────────────────────────
function usePulse(active) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.25, { duration: 500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.00, { duration: 500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [active]);

  return useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
}

// ── Mesaj balonu (Reanimated fade-in + spring slide) ─────────────────────────
const MessageBubble = memo(function MessageBubble({ item }) {
  const opacity    = useSharedValue(0);
  const translateY = useSharedValue(10);

  useEffect(() => {
    opacity.value    = withTiming(1, { duration: 220 });
    translateY.value = withSpring(0, { stiffness: 140, damping: 14 });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const isUser = item.role === 'user';
  return (
    <Animated.View style={[fc.msgRow, isUser && fc.msgRowUser, animStyle]}>
      {!isUser && (
        <View style={fc.avatar}>
          <Text style={fc.avatarTxt}>✦</Text>
        </View>
      )}
      <View style={[fc.bubble, isUser ? fc.bubbleUser : fc.bubbleAi]}>
        <Text style={[fc.bubbleTxt, isUser && fc.bubbleTxtUser]}>{item.text}</Text>
      </View>
    </Animated.View>
  );
});

// ── Yazıyor göstergesi ────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <View style={fc.msgRow}>
      <View style={fc.avatar}><Text style={fc.avatarTxt}>✦</Text></View>
      <View style={[fc.bubble, fc.bubbleAi]}>
        <Text style={{ color: C.dim, fontSize: 18, letterSpacing: 3 }}>···</Text>
      </View>
    </View>
  );
}

// ── Onay kartı ────────────────────────────────────────────────────────────────
function ConfirmCard({ data, onConfirm, onReject }) {
  return (
    <View style={fc.confirmCard}>
      <View style={fc.confirmDot} />
      <Text style={fc.confirmLabel}>EDİT PLANI HAZIR</Text>
      <Text style={fc.confirmRow}>
        Platform: <Text style={fc.confirmVal}>{PLAT_LABELS[data.platform] || data.platform || '—'}</Text>
      </Text>
      <Text style={fc.confirmRow}>
        Süre: <Text style={fc.confirmVal}>{data.target_duration_sec ? data.target_duration_sec + 's' : 'Otomatik'}</Text>
      </Text>
      <Text style={fc.confirmRow} numberOfLines={2}>
        Komut: <Text style={fc.confirmVal}>{data.command_text}</Text>
      </Text>
      <Text style={fc.confirmHint}>🎤 "evet" de veya butona bas</Text>
      <View style={fc.confirmBtns}>
        <TouchableOpacity style={fc.confirmYes} onPress={onConfirm} activeOpacity={0.85}>
          <Text style={fc.confirmYesTxt}>Evet, Başla</Text>
        </TouchableOpacity>
        <TouchableOpacity style={fc.confirmNo} onPress={onReject} activeOpacity={0.85}>
          <Text style={fc.confirmNoTxt}>Değiştir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── İşlem ilerleme çubuğu (Reanimated — native thread) ───────────────────────
function ProgressCard({ editProgress }) {
  const pct = (() => {
    const m = (editProgress || '').match(/(\d+)/);
    return m ? Math.min(parseInt(m[1], 10), 100) : 0;
  })();

  const animPct     = useSharedValue(15);
  const shimmerOpac = useSharedValue(0.6);

  useEffect(() => {
    animPct.value = withTiming(pct || 15, {
      duration: 700,
      easing: Easing.out(Easing.quad),
    });
  }, [pct]);

  useEffect(() => {
    shimmerOpac.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 700 }),
        withTiming(0.5, { duration: 700 }),
      ),
      -1
    );
  }, []);

  const barStyle = useAnimatedStyle(() => ({
    width: animPct.value + '%',
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmerOpac.value,
  }));

  return (
    <View style={fc.progressCard}>
      <ActivityIndicator color={C.accent} size="small" />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={fc.progressTxt}>{editProgress || 'Video işleniyor...'}</Text>
        <View style={fc.progressTrack}>
          <Animated.View style={[fc.progressFill, barStyle]}>
            <Animated.View style={[fc.progressShimmer, shimmerStyle]} />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

// ── Boş ekran ─────────────────────────────────────────────────────────────────
function EmptyState({ canChat }) {
  return (
    <View style={fc.empty}>
      <Text style={fc.emptyEmoji}>🎬</Text>
      <Text style={fc.emptyTitle}>Clipla burada!</Text>
      <Text style={fc.emptyDesc}>
        {canChat
          ? 'Söyle ne yapalım kanka!\n"Altyazı ekle", "sinematik yap", "shorts çıkar"\n— ya da ne istersen, yap abi! 🎙'
          : 'Bir video yükle patron, başlayalım! 🎥'}
      </Text>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// ChatMessages — sohbet listesi
// ════════════════════════════════════════════════════════════════════════════════
export function ChatMessages({
  messages = [],
  loading = false,
  confirmData,
  onConfirm,
  onReject,
  editLoading = false,
  editProgress = '',
  isListening = false,
  interim = '',
  wsState,
}) {
  const listRef = useRef(null);
  const canChat = wsState === 'ready' || wsState === 'done' || wsState === 'processing';

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 80);
  }, [messages.length, loading, confirmData, editLoading]);

  return (
    <FlatList
      ref={listRef}
      style={fc.list}
      contentContainerStyle={fc.listContent}
      data={messages}
      keyExtractor={m => m.id}
      removeClippedSubviews
      ListEmptyComponent={<EmptyState canChat={canChat} />}
      renderItem={({ item }) => <MessageBubble item={item} />}
      ListFooterComponent={
        <View>
          {loading && <TypingIndicator />}
          {confirmData && !editLoading && (
            <ConfirmCard data={confirmData} onConfirm={onConfirm} onReject={onReject} />
          )}
          {editLoading && <ProgressCard editProgress={editProgress} />}
          {isListening && interim ? (
            <View style={fc.listeningHint}>
              <Text style={fc.listeningTxt}>🎙 {interim}</Text>
            </View>
          ) : null}
        </View>
      }
      onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: false })}
    />
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// ChatInput — mesaj giriş alanı
// ════════════════════════════════════════════════════════════════════════════════
export function ChatInput({
  onSend,
  loading = false,
  wsState,
  isListening = false,
  onToggleMic,
  micAvail = false,
  editLoading = false,
}) {
  const [input, setInput] = useState('');
  const pulseStyle = usePulse(isListening);
  const canChat = wsState === 'ready' || wsState === 'done' || wsState === 'processing';

  function handleSend() {
    const txt = input.trim();
    if (!txt || loading || !canChat) return;
    setInput('');
    onSend?.(txt);
  }

  return (
    <View style={fc.inputWrap}>
      {micAvail && (
        <Animated.View style={pulseStyle}>
          <TouchableOpacity
            style={[fc.micBtn, isListening && fc.micBtnActive]}
            onPress={onToggleMic}
            disabled={!canChat}
            activeOpacity={0.8}
          >
            <Text style={fc.micIcon}>{isListening ? '⏹' : '🎙'}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <TextInput
        style={[fc.input, !canChat && { opacity: 0.4 }]}
        placeholder={
          !canChat ? 'Önce video yükle patron...' :
          isListening ? 'Dinliyorum kanka...' :
          'Clipla\'ya söyle ne yapalım...'
        }
        placeholderTextColor={C.dim}
        value={isListening ? '' : input}
        onChangeText={t => { if (!isListening) setInput(t); }}
        onSubmitEditing={handleSend}
        returnKeyType="send"
        blurOnSubmit
        editable={canChat && !editLoading && !isListening}
        multiline
        maxLength={500}
      />

      <TouchableOpacity
        style={[fc.sendBtn, (!input.trim() || !canChat || loading) && fc.sendBtnOff]}
        onPress={handleSend}
        disabled={!input.trim() || !canChat || loading}
        activeOpacity={0.8}
      >
        <Text style={fc.sendIcon}>↑</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────
const fc = StyleSheet.create({
  // Liste
  list:        { flex: 1 },
  listContent: { padding: 16, paddingBottom: 8, flexGrow: 1 },

  // Mesaj satırı
  msgRow:        { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 10 },
  msgRowUser:    { flexDirection: 'row-reverse' },
  avatar:        { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(99,102,241,0.12)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.28)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarTxt:     { fontSize: 10, color: C.accent, fontWeight: '700' },
  bubble:        { maxWidth: '78%', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16 },
  bubbleAi:      { backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 4 },
  bubbleUser:    { backgroundColor: C.accent, borderBottomRightRadius: 4 },
  bubbleTxt:     { fontSize: 13, color: C.txt, lineHeight: 19 },
  bubbleTxtUser: { color: '#fff' },

  // Onay kartı
  confirmCard:   { marginHorizontal: 2, marginTop: 8, marginBottom: 4, padding: 14, backgroundColor: 'rgba(16,185,129,0.07)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.22)', borderRadius: 14 },
  confirmDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green, marginBottom: 8 },
  confirmLabel:  { fontSize: 9, color: C.green, letterSpacing: 2, fontWeight: '700', marginBottom: 8 },
  confirmRow:    { fontSize: 12, color: C.dim, lineHeight: 22 },
  confirmVal:    { color: C.txt },
  confirmHint:   { fontSize: 10, color: C.green, marginTop: 8, marginBottom: 4 },
  confirmBtns:   { flexDirection: 'row', gap: 8, marginTop: 8 },
  confirmYes:    { flex: 1, backgroundColor: C.green, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  confirmYesTxt: { color: '#041a0d', fontSize: 13, fontWeight: '700' },
  confirmNo:     { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  confirmNoTxt:  { color: C.dim, fontSize: 13 },

  // İlerleme kartı
  progressCard:    { flexDirection: 'row', alignItems: 'center', marginHorizontal: 2, marginTop: 8, marginBottom: 4, padding: 12, backgroundColor: C.card2, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  progressTxt:     { fontSize: 12, color: C.dim, marginBottom: 5 },
  progressTrack:   { height: 4, backgroundColor: C.muted, borderRadius: 2, overflow: 'hidden' },
  progressFill:    { height: 4, backgroundColor: C.accent, borderRadius: 2, overflow: 'hidden' },
  progressShimmer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 2 },

  // Dinleme ipucu
  listeningHint: { marginHorizontal: 2, marginTop: 6, padding: 8, backgroundColor: 'rgba(239,68,68,0.07)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)', alignItems: 'center' },
  listeningTxt:  { fontSize: 12, color: '#f87171' },

  // Boş ekran
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 32, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 34, marginBottom: 10 },
  emptyTitle: { fontSize: 17, color: C.txt, fontWeight: '700', marginBottom: 8 },
  emptyDesc:  { fontSize: 13, color: C.dim, textAlign: 'center', lineHeight: 20 },

  // Girdi alanı
  inputWrap:    { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10, paddingBottom: 14, borderTopWidth: 1, borderColor: C.border, backgroundColor: C.card },
  micBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  micBtnActive: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  micIcon:      { fontSize: 18 },
  input:        { flex: 1, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, color: C.txt, fontSize: 13, maxHeight: 100 },
  sendBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtnOff:   { opacity: 0.3 },
  sendIcon:     { color: '#fff', fontSize: 20, fontWeight: '700' },
});
