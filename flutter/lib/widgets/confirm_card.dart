import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../utils/constants.dart';
import '../utils/effect_intent.dart';

class ConfirmData {
  final String platform;
  final double? targetDurationSec;
  final String commandText;
  final String? subtitleLanguage;

  const ConfirmData({
    required this.platform,
    this.targetDurationSec,
    required this.commandText,
    this.subtitleLanguage,
  });
}

class ConfirmCard extends StatelessWidget {
  final ConfirmData data;
  final EffectCategory? detectedEffect;
  final bool effectApplying;
  final bool removeFillers;
  final bool preserveRhythm;
  final VoidCallback onConfirm;
  final VoidCallback onReject;
  final VoidCallback onEffectApply;
  final VoidCallback onEffectDismiss;
  final ValueChanged<bool> onRemoveFillers;
  final ValueChanged<bool> onPreserveRhythm;

  const ConfirmCard({
    super.key,
    required this.data,
    this.detectedEffect,
    this.effectApplying = false,
    required this.removeFillers,
    required this.preserveRhythm,
    required this.onConfirm,
    required this.onReject,
    required this.onEffectApply,
    required this.onEffectDismiss,
    required this.onRemoveFillers,
    required this.onPreserveRhythm,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: C.green.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: C.green.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'EDİT PLANI HAZIR',
            style: TextStyle(
              color: C.green, fontSize: 10,
              fontWeight: FontWeight.w600, letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 10),
          _row('Platform', kPlatLabels[data.platform] ?? data.platform),
          _row('Süre', data.targetDurationSec != null ? '${data.targetDurationSec!.toInt()}s' : 'Otomatik'),
          _row('Komut', data.commandText),
          if (data.subtitleLanguage != null && data.subtitleLanguage != 'tr')
            _row('Altyazı', kSubLangs[data.subtitleLanguage!] ?? data.subtitleLanguage!, valueColor: C.green),

          if (detectedEffect != null) ...[
            const SizedBox(height: 8),
            _effectRow(),
          ],

          const SizedBox(height: 12),
          const Divider(color: Color(0x261DB974), height: 1),
          const SizedBox(height: 10),

          _checkbox(
            label: "Filler kelimeleri temizle (ıı, şey, yani...)",
            value: removeFillers,
            onChanged: onRemoveFillers,
          ),
          if (removeFillers)
            Padding(
              padding: const EdgeInsets.only(left: 26, top: 4),
              child: _checkbox(
                label: "Doğal konuşma ritmini koru",
                value: preserveRhythm,
                onChanged: onPreserveRhythm,
                activeColor: C.accent,
              ),
            ),

          const SizedBox(height: 10),
          const Text(
            '🎤 "evet" de veya butona bas',
            style: TextStyle(fontSize: 10, color: C.green),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: onConfirm,
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: C.green,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Center(
                      child: Text('Evet, Başla',
                        style: TextStyle(color: Color(0xFF041A0D), fontSize: 13, fontWeight: FontWeight.w600)),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: GestureDetector(
                  onTap: onReject,
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      border: Border.all(color: C.border),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Center(
                      child: Text('Değiştir', style: TextStyle(color: C.dim, fontSize: 13)),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _row(String key, String? value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(fontSize: 12, color: C.muted, height: 1.8),
          children: [
            TextSpan(text: '$key: '),
            TextSpan(
              text: value ?? '',
              style: TextStyle(color: valueColor ?? C.txt),
            ),
          ],
        ),
      ),
    );
  }

  Widget _effectRow() {
    final effect = detectedEffect!;
    final effectColor = Color(effect.color);
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: effectColor.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: effectColor.withValues(alpha: 0.25)),
      ),
      child: Row(
        children: [
          Text(effect.emoji, style: const TextStyle(fontSize: 18)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Efekt Algılandı: ${effect.label}',
                    style: TextStyle(fontSize: 11, color: effectColor, fontWeight: FontWeight.w600)),
                Text(effect.description,
                    style: const TextStyle(fontSize: 10, color: C.muted)),
              ],
            ),
          ),
          GestureDetector(
            onTap: effectApplying ? null : onEffectApply,
            child: Opacity(
              opacity: effectApplying ? 0.5 : 1,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: effectColor,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text('Uygula',
                    style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600)),
              ),
            ),
          ),
          const SizedBox(width: 6),
          GestureDetector(
            onTap: onEffectDismiss,
            child: const Text('✕', style: TextStyle(color: C.muted, fontSize: 14)),
          ),
        ],
      ),
    );
  }

  Widget _checkbox({
    required String label,
    required bool value,
    required ValueChanged<bool> onChanged,
    Color activeColor = C.green,
  }) {
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: Row(
        children: [
          Container(
            width: 18,
            height: 18,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: value ? activeColor : C.border),
              color: value ? activeColor : Colors.transparent,
            ),
            child: value
                ? const Center(child: Text('✓', style: TextStyle(color: Colors.black, fontSize: 11, fontWeight: FontWeight.w700)))
                : null,
          ),
          const SizedBox(width: 8),
          Flexible(child: Text(label, style: const TextStyle(fontSize: 11, color: C.dim))),
        ],
      ),
    );
  }
}
