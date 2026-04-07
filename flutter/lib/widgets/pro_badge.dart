import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class ProBadge extends StatelessWidget {
  final String plan;
  final VoidCallback? onPress;

  const ProBadge({super.key, required this.plan, this.onPress});

  @override
  Widget build(BuildContext context) {
    if (plan == 'pro') {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: C.warn.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: C.warn.withValues(alpha: 0.4)),
        ),
        child: const Text(
          'PRO',
          style: TextStyle(
            color: C.warn,
            fontSize: 10,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
          ),
        ),
      );
    }

    return GestureDetector(
      onTap: onPress,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: C.muted.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: C.border),
        ),
        child: const Text(
          'FREE',
          style: TextStyle(
            color: C.dim,
            fontSize: 10,
            fontWeight: FontWeight.w600,
            letterSpacing: 1.2,
          ),
        ),
      ),
    );
  }
}
