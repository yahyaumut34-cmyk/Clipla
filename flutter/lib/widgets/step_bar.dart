import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

const _kStepLabels = ['Yükle', 'Sohbet', 'Önizle', 'İndir'];

class StepBar extends StatelessWidget {
  final int step;

  const StepBar({super.key, required this.step});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      child: Row(
        children: List.generate(_kStepLabels.length * 2 - 1, (i) {
          if (i.isOdd) {
            // Connector line
            final leftDone = (i ~/ 2) < step;
            return Expanded(
              child: Container(
                height: 1,
                color: leftDone ? C.accent : C.border,
              ),
            );
          }
          final idx = i ~/ 2;
          final isDone   = idx < step;
          final isActive = idx == step;
          final dotColor = isDone || isActive ? C.accent : C.muted;
          return Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isDone
                      ? C.accent
                      : isActive
                          ? C.accent.withValues(alpha: 0.2)
                          : C.card,
                  border: Border.all(
                    color: isDone || isActive ? C.accent : C.border,
                    width: 1.5,
                  ),
                ),
                child: Center(
                  child: isDone
                      ? const Text('✓', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold))
                      : Text(
                          '${idx + 1}',
                          style: TextStyle(
                            color: isActive ? C.accent : C.muted,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                _kStepLabels[idx],
                style: TextStyle(
                  color: dotColor,
                  fontSize: 9,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ],
          );
        }),
      ),
    );
  }
}
