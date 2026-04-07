import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class BadgeWidget extends StatelessWidget {
  final String label;
  final Color? color;

  const BadgeWidget({super.key, required this.label, this.color});

  @override
  Widget build(BuildContext context) {
    final bg = (color ?? C.accent).withValues(alpha: 0.12);
    final fg = color ?? C.accent;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: fg.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 10,
          fontWeight: FontWeight.w600,
          letterSpacing: 1.2,
        ),
      ),
    );
  }
}
