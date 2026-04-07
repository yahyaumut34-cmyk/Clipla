/**
 * ProBadge — plan durumunu gösteren küçük rozet
 *
 * Kullanım:
 *   <ProBadge plan={plan} />
 *   <ProBadge plan={plan} onPress={() => setPaywallVisible(true)} />
 */

import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { C } from '../shared/theme';

export function ProBadge({ plan, onPress }) {
  const isPro = plan === 'pro';

  const inner = (
    <View style={[s.badge, isPro ? s.badgePro : s.badgeFree]}>
      <Text style={[s.badgeTxt, isPro ? s.badgeProTxt : s.badgeFreeTxt]}>
        {isPro ? '👑 PRO' : 'FREE'}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
        {inner}
      </TouchableOpacity>
    );
  }

  return inner;
}

const s = StyleSheet.create({
  badge:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgePro:    { borderColor: 'rgba(255,209,102,0.5)', backgroundColor: 'rgba(255,209,102,0.12)' },
  badgeFree:   { borderColor: C.border, backgroundColor: C.card },
  badgeTxt:    { fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  badgeProTxt: { color: '#ffd166' },
  badgeFreeTxt:{ color: C.muted },
});
