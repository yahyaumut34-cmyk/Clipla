import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'theme/app_theme.dart';
import 'providers/plan_provider.dart';
import 'providers/wizard_provider.dart';
import 'services/tts_service.dart';
import 'services/stt_service.dart';
import 'services/edit_polling_service.dart';
import 'widgets/step_bar.dart';
import 'widgets/pro_badge.dart';
import 'widgets/badge_widget.dart';
import 'widgets/paywall_modal.dart';
import 'screens/step_upload_screen.dart';
import 'screens/step_chat_screen.dart';
import 'screens/step_preview_screen.dart';
import 'screens/step_download_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
  ));

  // PlanProvider init (SharedPreferences)
  final planProvider = PlanProvider();
  await planProvider.init();

  // Services
  final ttsService = TtsService();
  await ttsService.init();

  final sttService = SttService();
  await sttService.init();

  final wizardProvider  = WizardProvider();
  final editPolling     = EditPollingService(ttsService);

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: planProvider),
        ChangeNotifierProvider.value(value: wizardProvider),
        ChangeNotifierProvider.value(value: ttsService),
        ChangeNotifierProvider.value(value: sttService),
        ChangeNotifierProvider.value(value: editPolling),
      ],
      child: const CliplaApp(),
    ),
  );
}

class CliplaApp extends StatelessWidget {
  const CliplaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Clipla-Y',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: const WizardScreen(),
    );
  }
}

class WizardScreen extends StatelessWidget {
  const WizardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final wizard = context.watch<WizardProvider>();
    final plan   = context.watch<PlanProvider>();

    return PopScope(
      canPop: wizard.step == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) wizard.goBack();
      },
      child: Scaffold(
        backgroundColor: C.bg,
        body: SafeArea(
          child: Stack(
            children: [
              Column(
                children: [
                  // Header
                  _Header(
                    step: wizard.step,
                    plan: plan.plan,
                    onBack: wizard.goBack,
                    onPro: () => wizard.showPaywall('effects'),
                  ),
                  // Step bar
                  StepBar(step: wizard.step),
                  // Content
                  Expanded(
                    child: _stepContent(wizard.step),
                  ),
                ],
              ),
              // Paywall overlay
              if (wizard.paywallVisible)
                PaywallModal(
                  visible: wizard.paywallVisible,
                  reason: wizard.paywallReason,
                  onUpgrade: () async {
                    await plan.upgrade();
                    wizard.hidePaywall();
                  },
                  onClose: wizard.hidePaywall,
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _stepContent(int step) {
    switch (step) {
      case 0:  return const StepUploadScreen();
      case 1:  return const StepChatScreen();
      case 2:  return const StepPreviewScreen();
      case 3:  return const StepDownloadScreen();
      default: return const StepUploadScreen();
    }
  }
}

class _Header extends StatelessWidget {
  final int step;
  final String plan;
  final VoidCallback onBack;
  final VoidCallback onPro;

  const _Header({
    required this.step,
    required this.plan,
    required this.onBack,
    required this.onPro,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
      child: Row(
        children: [
          if (step > 0)
            GestureDetector(
              onTap: onBack,
              child: Container(
                width: 32, height: 32,
                decoration: BoxDecoration(
                  color: C.card,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: C.border),
                ),
                child: const Center(
                  child: Text('←', style: TextStyle(color: C.dim, fontSize: 16)),
                ),
              ),
            ),
          if (step > 0) const SizedBox(width: 8),
          const Text(
            'Clipla-Y',
            style: TextStyle(color: C.txt, fontSize: 22, fontStyle: FontStyle.italic),
          ),
          const Spacer(),
          ProBadge(plan: plan, onPress: onPro),
          const SizedBox(width: 8),
          const BadgeWidget(label: 'BETA'),
        ],
      ),
    );
  }
}
