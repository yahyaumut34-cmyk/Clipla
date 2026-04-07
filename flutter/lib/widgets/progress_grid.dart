import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

const int kTotalBlocks = 100;

class ProgressGrid extends StatelessWidget {
  final int pct; // 0-100

  const ProgressGrid({super.key, required this.pct});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 3,
      runSpacing: 3,
      alignment: WrapAlignment.center,
      children: List.generate(kTotalBlocks, (i) {
        final filled = (i + 1) <= pct;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          width: 20,
          height: 20,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(3),
            color: filled
                ? C.green
                : C.green.withValues(alpha: 0.1),
            border: filled
                ? null
                : Border.all(color: C.green.withValues(alpha: 0.2)),
          ),
        );
      }),
    );
  }
}
