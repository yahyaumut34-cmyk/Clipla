import 'package:flutter/material.dart';

// Clipla-Y renk paleti — shared/theme.js'den çevrildi
class C {
  static const Color bg     = Color(0xFF07090F);
  static const Color card   = Color(0xFF0D1219);
  static const Color border = Color(0x12FFFFFF); // rgba(255,255,255,0.07)
  static const Color accent = Color(0xFFE05C2A);
  static const Color green  = Color(0xFF1DB974);
  static const Color txt    = Color(0xFFDDE6F5);
  static const Color muted  = Color(0xFF3D5068);
  static const Color dim    = Color(0xFF8A9DB5);
  static const Color warn   = Color(0xFFFFD166);
  static const Color error  = Color(0xFFF87171);

  C._();
}

ThemeData buildAppTheme() {
  return ThemeData.dark().copyWith(
    scaffoldBackgroundColor: C.bg,
    colorScheme: const ColorScheme.dark(
      primary: C.accent,
      secondary: C.green,
      surface: C.card,
      error: C.error,
    ),
    cardTheme: const CardThemeData(
      color: C.card,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(12)),
        side: BorderSide(color: C.border),
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: C.bg,
      foregroundColor: C.txt,
      elevation: 0,
    ),
    textTheme: const TextTheme(
      bodyLarge:   TextStyle(color: C.txt,  fontSize: 14),
      bodyMedium:  TextStyle(color: C.dim,  fontSize: 13),
      bodySmall:   TextStyle(color: C.muted, fontSize: 11),
      titleLarge:  TextStyle(color: C.txt,  fontSize: 22, fontStyle: FontStyle.italic),
      titleMedium: TextStyle(color: C.txt,  fontSize: 16),
    ),
    dividerColor: C.border,
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: C.card,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: C.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: C.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: C.accent),
      ),
      hintStyle: const TextStyle(color: C.muted),
    ),
  );
}
