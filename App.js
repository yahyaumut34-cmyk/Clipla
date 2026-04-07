/**
 * Clipla-Y — Ana uygulama
 * Wizard orchestration: Upload → Chat → Preview → Download
 */

import { StatusBar } from 'expo-status-bar';
import { useState, lazy, Suspense } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StepBar }   from './components/StepBar';
import { StepUpload } from './components/StepUpload'; // adım 0: hemen gerekli
import { C }          from './shared/theme';
import { Badge }      from './components/Badge';
import { ProBadge }   from './components/ProBadge';
import { usePlan }    from './hooks/usePlan';

// Lazy load: ilk ekranda görünmeyenler — bundle split
const StepChat     = lazy(() => import('./components/StepChat').then(m => ({ default: m.StepChat })));
const StepPreview  = lazy(() => import('./components/StepPreview').then(m => ({ default: m.StepPreview })));
const StepDownload = lazy(() => import('./components/StepDownload').then(m => ({ default: m.StepDownload })));
const PaywallModal = lazy(() => import('./components/PaywallModal').then(m => ({ default: m.PaywallModal })));

function LazyFallback() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={C.accent} size="large"/>
    </View>
  );
}

export default function App() {
  const [step, setStep]       = useState(0);
  const [jobData, setJobData] = useState(null);
  const [result, setResult]   = useState(null);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallReason, setPaywallReason]   = useState('effects');

  const planCtx = usePlan();

  function restart() { setStep(0); setJobData(null); setResult(null); }
  function goBack()  { if (step > 0) setStep(s => s - 1); }

  function showPaywall(reason = 'effects') {
    setPaywallReason(reason);
    setPaywallVisible(true);
  }

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="light"/>
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {step > 0 && (
            <TouchableOpacity onPress={goBack} style={s.backBtn}>
              <Text style={s.backBtnTxt}>←</Text>
            </TouchableOpacity>
          )}
          <Text style={s.headerLogo}>Clipla-Y</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ProBadge plan={planCtx.plan} onPress={() => showPaywall('effects')}/>
          <Badge label="BETA"/>
        </View>
      </View>
      <StepBar step={step}/>
      <Suspense fallback={<LazyFallback/>}>
        <View style={{ flex: 1 }}>
          {step === 0 && (
            <StepUpload
              planCtx={planCtx}
              onPaywall={() => showPaywall('upload_limit')}
              onDone={d => { setJobData(d); setStep(1); }}
            />
          )}
          {step === 1 && jobData && (
            <StepChat
              jobData={jobData}
              planCtx={planCtx}
              onPaywall={showPaywall}
              onDone={r => { setResult(r); setStep(2); }}
              onEffectApplied={data => setResult(prev =>
                prev ? { ...prev, download_url: data.download_url, output_url: data.output_url } : prev
              )}
            />
          )}
          {step === 2 && result  && (
            <StepPreview
              result={result}
              jobId={jobData?.jobId}
              originalFile={jobData?.file}
              planCtx={planCtx}
              onPaywall={showPaywall}
              onDone={() => setStep(3)}
              onUpdateResult={setResult}
            />
          )}
          {step === 3 && result  && <StepDownload result={result} onRestart={restart}/>}
        </View>

        {paywallVisible && (
          <PaywallModal
            visible={paywallVisible}
            reason={paywallReason}
            onUpgrade={async () => { await planCtx.upgrade(); setPaywallVisible(false); }}
            onClose={() => setPaywallVisible(false)}
          />
        )}
      </Suspense>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.bg },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerLogo: { fontSize: 22, color: C.txt, fontStyle: 'italic' },
  backBtn:    { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  backBtnTxt: { color: C.dim, fontSize: 16 },
});
