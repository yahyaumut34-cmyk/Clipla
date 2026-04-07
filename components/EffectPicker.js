/**
 * EffectPicker — 7 efekt kategorisini listeleyen modal
 *
 * Kullanım:
 *   <EffectPicker
 *     visible={pickerVisible}
 *     onSelect={(category, intensity) => { ... }}
 *     onClose={() => setPickerVisible(false)}
 *   />
 */

import { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView,
  StyleSheet, TextInput,
} from 'react-native';
import { EFFECT_CATEGORIES } from '../hooks/useEffectIntent';
import { C } from '../shared/theme';

export function EffectPicker({ visible, onSelect, onClose }) {
  const [intensity, setIntensity] = useState(0.8);
  const [selected, setSelected]   = useState(null);

  function handleSelect(categoryKey) {
    setSelected(categoryKey);
  }

  function handleApply() {
    if (!selected) return;
    onSelect?.(selected, intensity);
    setSelected(null);
    onClose?.();
  }

  const INTENSITY_STEPS = [
    { label: 'Hafif',    value: 0.4 },
    { label: 'Orta',     value: 0.7 },
    { label: 'Güçlü',   value: 1.0 },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>Efekt Seç</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.grid}>
              {Object.entries(EFFECT_CATEGORIES).map(([key, cat]) => {
                const isActive = selected === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[s.card, isActive && { borderColor: cat.color, backgroundColor: cat.color + '18' }]}
                    onPress={() => handleSelect(key)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.cardEmoji}>{cat.emoji}</Text>
                    <Text style={[s.cardLabel, isActive && { color: cat.color }]}>{cat.label}</Text>
                    <Text style={s.cardDesc}>{cat.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={s.intensityRow}>
              <Text style={s.intensityTitle}>Yoğunluk</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {INTENSITY_STEPS.map(step => (
                  <TouchableOpacity
                    key={step.value}
                    style={[s.intensityBtn, Math.abs(intensity - step.value) < 0.05 && s.intensityBtnActive]}
                    onPress={() => setIntensity(step.value)}
                  >
                    <Text style={[s.intensityBtnTxt, Math.abs(intensity - step.value) < 0.05 && { color: C.accent }]}>
                      {step.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[s.applyBtn, !selected && s.applyBtnDisabled]}
            onPress={handleApply}
            disabled={!selected}
          >
            <Text style={s.applyBtnTxt}>
              {selected
                ? `${EFFECT_CATEGORIES[selected].emoji} Uygula`
                : 'Bir efekt seçin'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet:            { backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
                      paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, maxHeight: '85%' },
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:            { fontSize: 18, color: C.txt, fontWeight: '700' },
  closeBtn:         { color: C.muted, fontSize: 18 },
  grid:             { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  card:             { width: '47%', borderWidth: 1, borderColor: C.border, borderRadius: 12,
                      backgroundColor: C.card, padding: 14, alignItems: 'center' },
  cardEmoji:        { fontSize: 28, marginBottom: 6 },
  cardLabel:        { fontSize: 12, color: C.txt, fontWeight: '600', marginBottom: 4, textAlign: 'center' },
  cardDesc:         { fontSize: 10, color: C.muted, textAlign: 'center', lineHeight: 14 },
  intensityRow:     { marginBottom: 20 },
  intensityTitle:   { fontSize: 11, color: C.muted, letterSpacing: 1.5, marginBottom: 10 },
  intensityBtn:     { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
                      borderColor: C.border, backgroundColor: C.card, alignItems: 'center' },
  intensityBtnActive: { borderColor: C.accent, backgroundColor: 'rgba(224,92,42,0.12)' },
  intensityBtnTxt:  { fontSize: 12, color: C.muted },
  applyBtn:         { backgroundColor: C.accent, borderRadius: 12, padding: 16, alignItems: 'center' },
  applyBtnDisabled: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  applyBtnTxt:      { color: '#fff', fontSize: 15, fontWeight: '600' },
});
