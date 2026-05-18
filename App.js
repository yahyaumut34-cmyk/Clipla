/**
 * Clipla-Y — Ana uygulama
 * Auth state + WorkspaceScreen
 */

import { useState, useEffect, Component } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';

import { WorkspaceScreen } from './screens/WorkspaceScreen';
import { AuthScreen }      from './screens/AuthScreen';
import { PaywallModal }    from './components/PaywallModal';
import { Badge }           from './components/Badge';
import { ProBadge }        from './components/ProBadge';
import { usePlan }         from './hooks/usePlan';
import { C }               from './shared/theme';
import { getSession, onAuthStateChange, signOut, DEV_MODE } from './shared/supabase';

const RootView = SafeAreaView;

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <ScrollView style={{ flex: 1, backgroundColor: C.bg, padding: 20 }}>
          <Text style={{ color: C.red, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Hata oluştu</Text>
          <Text style={{ color: '#fca5a5', fontSize: 13, marginBottom: 8 }}>{this.state.error?.message}</Text>
          <Text style={{ color: C.dim, fontSize: 11 }}>{this.state.error?.stack}</Text>
          <TouchableOpacity
            style={{ marginTop: 20, backgroundColor: C.green, borderRadius: 8, padding: 12, alignItems: 'center' }}
            onPress={() => this.setState({ error: null })}>
            <Text style={{ color: '#041a0d', fontWeight: '600' }}>Tekrar Dene</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  const [session, setSession]           = useState(undefined);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallReason, setPaywallReason]   = useState('effects');

  const planCtx = usePlan(session?.user?.id);

  useEffect(() => {
    if (DEV_MODE) { setSession(null); return; }
    getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: { subscription } } = onAuthStateChange((_, s) => setSession(s ?? null));
    return () => subscription.unsubscribe();
  }, []);

  function showPaywall(reason = 'effects') {
    setPaywallReason(reason);
    setPaywallVisible(true);
  }

  // Yükleniyor
  if (session === undefined) {
    return (
      <RootView style={s.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={s.logo}>Clipla-Y</Text>
          <ActivityIndicator color={C.accent} style={{ marginTop: 20 }}/>
        </View>
      </RootView>
    );
  }

  // Auth ekranı
  if (!session && !DEV_MODE) {
    return (
      <RootView style={s.safe}>
        <AuthScreen onAuth={setSession}/>
      </RootView>
    );
  }

  return (
    <RootView style={s.safe}>
      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.logo}>Clipla-Y</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ProBadge plan={planCtx.plan} onPress={() => showPaywall('effects')}/>
          <Badge label="BETA"/>
          <TouchableOpacity onPress={() => signOut()} style={s.iconBtn}>
            <Text style={s.iconBtnTxt}>çıkış</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Workspace ── */}
      <ErrorBoundary>
        <WorkspaceScreen
          session={session}
          planCtx={planCtx}
          onPaywall={showPaywall}
        />
        {paywallVisible && (
          <PaywallModal
            visible={paywallVisible}
            reason={paywallReason}
            onUpgrade={async () => { await planCtx.upgrade(); setPaywallVisible(false); }}
            onClose={() => setPaywallVisible(false)}
          />
        )}
      </ErrorBoundary>
    </RootView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.bg },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                paddingHorizontal: 18, paddingTop: 8, paddingBottom: 8,
                backgroundColor: C.bg, borderBottomWidth: 1, borderColor: C.border },
  logo:       { fontSize: 18, color: C.txt, fontStyle: 'italic', fontWeight: '800', letterSpacing: 0.5 },
  iconBtn:    { height: 28, paddingHorizontal: 10, borderRadius: 7, borderWidth: 1,
                borderColor: C.border, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  iconBtnTxt: { color: C.dim, fontSize: 11 },
});
