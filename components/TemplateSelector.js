import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { EDIT_TEMPLATES } from '../shared/constants';
import { C } from '../shared/theme';

export function TemplateSelector({ selected, onSelect }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingVertical: 4 }}>
      {EDIT_TEMPLATES.map(t => {
        const active = selected?.id === t.id;
        return (
          <TouchableOpacity
            key={t.id}
            onPress={() => onSelect(t)}
            style={[
              st.card,
              active && { borderColor: t.color, backgroundColor: t.color + '18' },
            ]}>
            <Text style={st.emoji}>{t.emoji}</Text>
            <Text style={[st.label, active && { color: t.color }]}>{t.label}</Text>
            <Text style={st.desc}>{t.desc}</Text>
            {active && (
              <View style={[st.activeDot, { backgroundColor: t.color }]}>
                <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  card: {
    width: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.card,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  emoji:     { fontSize: 28 },
  label:     { fontSize: 13, color: C.txt, fontWeight: '600', textAlign: 'center' },
  desc:      { fontSize: 9, color: C.muted, textAlign: 'center', lineHeight: 13 },
  activeDot: { position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
