import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../utils/effect_intent.dart';

class EffectPickerWidget extends StatelessWidget {
  final bool visible;
  final bool applying;
  final void Function(String category, double intensity) onSelect;
  final VoidCallback onClose;

  const EffectPickerWidget({
    super.key,
    required this.visible,
    required this.applying,
    required this.onSelect,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    if (!visible) return const SizedBox.shrink();
    return Stack(
      children: [
        GestureDetector(
          onTap: onClose,
          child: Container(color: Colors.black.withValues(alpha: 0.6)),
        ),
        Align(
          alignment: Alignment.bottomCenter,
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              color: C.card,
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              border: Border(top: BorderSide(color: C.border)),
            ),
            child: SafeArea(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('EFEKT SEÇ',
                          style: TextStyle(color: C.dim, fontSize: 11, letterSpacing: 1.5, fontWeight: FontWeight.w600)),
                      GestureDetector(onTap: onClose, child: const Text('✕', style: TextStyle(color: C.muted, fontSize: 18))),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: kEffectCategories.entries.map((e) {
                      final cat = e.value;
                      final color = Color(cat.color);
                      return GestureDetector(
                        onTap: applying ? null : () => onSelect(cat.category, 0.8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(
                            color: color.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: color.withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(cat.emoji, style: const TextStyle(fontSize: 16)),
                              const SizedBox(width: 6),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(cat.label,
                                      style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
                                  Text(cat.description,
                                      style: const TextStyle(color: C.muted, fontSize: 9)),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  if (applying) ...[
                    const SizedBox(height: 12),
                    const Row(
                      children: [
                        SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: C.accent, strokeWidth: 2)),
                        SizedBox(width: 8),
                        Text('Efekt uygulanıyor...', style: TextStyle(color: C.dim, fontSize: 12)),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
