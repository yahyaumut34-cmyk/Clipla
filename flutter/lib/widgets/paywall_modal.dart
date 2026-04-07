import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

const _kReasonCopy = {
  'effects': (
    title: 'Efektler Pro ile',
    subtitle: "Şok, komedi, gerilim ve daha fazla\nsesli efekti kullanmak için Pro'ya geç.",
  ),
  'shorts': (
    title: 'Shorts Pro ile',
    subtitle: "AI ile kısa klip oluşturmak\nve viral anlar bulmak için Pro'ya geç.",
  ),
  'upload_limit': (
    title: 'Günlük limit doldu',
    subtitle: "Ücretsiz planda günde 2 video yükleyebilirsin.\nSınırsız yükleme için Pro'ya geç.",
  ),
  'subtitles': (
    title: 'Gelişmiş Altyazılar Pro ile',
    subtitle: "DE, FR, ES, PT, RU, ZH, JA, AR\naltyazı dilleri için Pro'ya geç.",
  ),
};

const _kProFeatures = [
  (emoji: '♾️', label: 'Sınırsız video yükleme'),
  (emoji: '✨', label: 'Tüm efekt kategorileri'),
  (emoji: '🎬', label: 'Shorts üretimi'),
  (emoji: '🌍', label: '10 dil altyazı desteği'),
  (emoji: '⚡', label: 'Öncelikli işleme'),
];

class PaywallModal extends StatelessWidget {
  final bool visible;
  final String reason;
  final VoidCallback onUpgrade;
  final VoidCallback onClose;

  const PaywallModal({
    super.key,
    required this.visible,
    this.reason = 'effects',
    required this.onUpgrade,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    if (!visible) return const SizedBox.shrink();

    final copy = _kReasonCopy[reason] ?? _kReasonCopy['effects']!;

    return Stack(
      children: [
        // Overlay
        GestureDetector(
          onTap: onClose,
          child: Container(color: Colors.black.withValues(alpha: 0.7)),
        ),
        Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Container(
              width: double.infinity,
              constraints: const BoxConstraints(maxWidth: 400),
              decoration: BoxDecoration(
                color: C.bg,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: C.warn.withValues(alpha: 0.25)),
              ),
              padding: const EdgeInsets.all(28),
              child: Stack(
                children: [
                  Column(
                    children: [
                      const Text('👑', style: TextStyle(fontSize: 44)),
                      const SizedBox(height: 12),
                      Text(copy.title,
                          style: const TextStyle(
                              color: C.txt, fontSize: 22, fontWeight: FontWeight.w700),
                          textAlign: TextAlign.center),
                      const SizedBox(height: 8),
                      Text(copy.subtitle,
                          style: const TextStyle(color: C.dim, fontSize: 13, height: 1.6),
                          textAlign: TextAlign.center),
                      const SizedBox(height: 24),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: C.card,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: C.border),
                        ),
                        child: Column(
                          children: _kProFeatures.map((f) => Padding(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            child: Row(
                              children: [
                                SizedBox(width: 24, child: Text(f.emoji, style: const TextStyle(fontSize: 18), textAlign: TextAlign.center)),
                                const SizedBox(width: 10),
                                Text(f.label, style: const TextStyle(color: C.txt, fontSize: 13)),
                              ],
                            ),
                          )).toList(),
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text('Clipla-Y Pro',
                          style: TextStyle(color: C.muted, fontSize: 11, letterSpacing: 1.5)),
                      const SizedBox(height: 4),
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('₺49.99', style: TextStyle(color: C.warn, fontSize: 32, fontWeight: FontWeight.w700)),
                          SizedBox(width: 4),
                          Padding(
                            padding: EdgeInsets.only(bottom: 4),
                            child: Text('/ay', style: TextStyle(color: C.muted, fontSize: 13)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        child: GestureDetector(
                          onTap: onUpgrade,
                          child: Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: C.warn,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Center(
                              child: Text("Pro'ya Yükselt",
                                  style: TextStyle(color: Color(0xFF1A1200), fontSize: 16, fontWeight: FontWeight.w700)),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      GestureDetector(
                        onTap: onClose,
                        child: const Text('Şimdi değil',
                            style: TextStyle(color: C.muted, fontSize: 12)),
                      ),
                    ],
                  ),
                  Positioned(
                    top: 0, right: 0,
                    child: GestureDetector(
                      onTap: onClose,
                      child: const Text('✕', style: TextStyle(color: C.muted, fontSize: 18)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
