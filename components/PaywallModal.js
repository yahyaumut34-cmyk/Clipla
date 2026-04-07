/**
 * PaywallModal — Pro'ya yükseltme ekranı
 *
 * Kullanım:
 *   <PaywallModal
 *     visible={paywallVisible}
 *     reason="effects"   // 'effects' | 'shorts' | 'upload_limit' | 'subtitles'
 *     onUpgrade={upgrade}
 *     onClose={() => setPaywallVisible(false)}
 *   />
 */

import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { C } from '../shared/theme';

const REASON_COPY = {
  effects: {
    title: 'Efektler Pro ile',
    subtitle: "Şok, komedi, gerilim ve daha fazla\nsesli efekti kullanmak için Pro'ya geç.",
  },
  shorts: {
    title: 'Shorts Pro ile',
    subtitle: "AI ile kısa klip oluşturmak\nve viral anlar bulmak için Pro'ya geç.",
  },
  upload_limit: {
    title: 'Günlük limit doldu',
    subtitle: "Ücretsiz planda günde 2 video yükleyebilirsin.\nSınırsız yükleme için Pro'ya geç.",
  },
  subtitles: {
    title: 'Gelişmiş Altyazılar Pro ile',
    subtitle: "DE, FR, ES, PT, RU, ZH, JA, AR\naltyazı dilleri için Pro'ya geç.",
  },
};

const PRO_FEATURES = [
  { emoji: '♾️', label: 'Sınırsız video yükleme' },
  { emoji: '✨', label: 'Tüm efekt kategorileri' },
  { emoji: '🎬', label: 'Shorts üretimi' },
  { emoji: '🌍', label: '10 dil altyazı desteği' },
  { emoji: '⚡', label: 'Öncelikli işleme' },
];

export function PaywallModal({ visible, reason = 'effects', onUpgrade, onClose }) {
  const copy = REASON_COPY[reason] || REASON_COPY.effects;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ color: C.muted, fontSize: 18 }}>✕</Text>
          </TouchableOpacity>

          <Text style={s.crown}>👑</Text>
          <Text style={s.title}>{copy.title}</Text>
          <Text style={s.subtitle}>{copy.subtitle}</Text>

          <View style={s.featuresBox}>
            {PRO_FEATURES.map(f => (
              <View key={f.label} style={s.featureRow}>
                <Text style={s.featureEmoji}>{f.emoji}</Text>
                <Text style={s.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>

          <View style={s.priceBox}>
            <Text style={s.priceLabel}>Clipla-Y Pro</Text>
            <Text style={s.price}>₺49.99 <Text style={{ fontSize: 13, color: C.muted }}>/ay</Text></Text>
          </View>

          <TouchableOpacity style={s.upgradeBtn} onPress={onUpgrade}>
            <Text style={s.upgradeBtnTxt}>Pro'ya Yükselt</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={{ marginTop: 14, alignItems: 'center' }}>
            <Text style={{ color: C.muted, fontSize: 12 }}>Şimdi değil</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet:        { backgroundColor: C.bg, borderRadius: 20, padding: 28, width: '100%', maxWidth: 400,
                  borderWidth: 1, borderColor: 'rgba(255,209,102,0.25)' },
  closeBtn:     { position: 'absolute', top: 16, right: 16 },
  crown:        { fontSize: 44, textAlign: 'center', marginBottom: 12 },
  title:        { fontSize: 22, color: C.txt, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  subtitle:     { fontSize: 13, color: C.dim, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  featuresBox:  { backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  featureRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  featureEmoji: { fontSize: 18, width: 24, textAlign: 'center' },
  featureLabel: { fontSize: 13, color: C.txt },
  priceBox:     { alignItems: 'center', marginBottom: 20 },
  priceLabel:   { fontSize: 11, color: C.muted, letterSpacing: 1.5, marginBottom: 4 },
  price:        { fontSize: 32, color: '#ffd166', fontWeight: '700' },
  upgradeBtn:   { backgroundColor: '#ffd166', borderRadius: 12, padding: 16, alignItems: 'center' },
  upgradeBtnTxt:{ color: '#1a1200', fontSize: 16, fontWeight: '700' },
});
