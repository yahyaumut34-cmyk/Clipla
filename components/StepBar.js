import { View, Text, StyleSheet } from 'react-native';

const QUICK_STEPS    = ['Şablon', 'İşleniyor', 'İndir'];
const ADVANCED_STEPS = ['Yükle', 'Konuş', 'Önizle', 'İndir'];

export function StepBar({ step, mode = 'advanced' }) {
  const steps = mode === 'quick' ? QUICK_STEPS : ADVANCED_STEPS;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', paddingVertical: 12 }}>
      {steps.map((s, i) => (
        <View key={i} style={{ alignItems: 'center', flex: 1 }}>
          <View style={[st.dot, step === i && st.dotOn, step > i && st.dotDone]}>
            <Text style={[st.dotTxt, (step === i || step > i) && st.dotTxtOn]}>
              {step > i ? '✓' : i + 1}
            </Text>
          </View>
          <Text style={[st.label, step === i && st.labelOn]}>{s}</Text>
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  dot:      { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d1219' },
  dotOn:    { borderColor: '#e05c2a', backgroundColor: 'rgba(224,92,42,0.15)' },
  dotDone:  { borderColor: '#1db974', backgroundColor: 'rgba(29,185,116,0.12)' },
  dotTxt:   { fontSize: 11, color: '#3d5068' },
  dotTxtOn: { color: '#dde6f5' },
  label:    { fontSize: 9, color: '#3d5068', marginTop: 4, letterSpacing: 0.5 },
  labelOn:  { color: '#e05c2a' },
});
