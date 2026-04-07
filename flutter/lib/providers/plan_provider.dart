// usePlan.js'den çevrildi — AsyncStorage → SharedPreferences
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _kKeyPlan    = 'cliplay_plan';
const _kKeyUploads = 'cliplay_daily_uploads';
const _kKeyDate    = 'cliplay_daily_date';
const int _kFreeDailyUploads = 2;

class PlanProvider extends ChangeNotifier {
  String _plan = 'free';
  int _dailyUploads = 0;
  bool _loaded = false;

  String get plan => _plan;
  bool get loaded => _loaded;
  bool get isPro  => _plan == 'pro';

  int get uploadsRemaining =>
      isPro ? 999999 : (_kFreeDailyUploads - _dailyUploads).clamp(0, _kFreeDailyUploads);

  bool get canUpload              => isPro || uploadsRemaining > 0;
  bool get canUseEffects          => isPro;
  bool get canUseAdvancedSubtitles => isPro;
  bool get canGenerateShorts      => isPro;

  bool isSubtitleAllowed(String langCode) {
    if (isPro) return true;
    return ['tr', 'en'].contains(langCode);
  }

  /// Başlangıçta main.dart'tan çağrılır
  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _plan = prefs.getString(_kKeyPlan) ?? 'free';

    final storedDate  = prefs.getString(_kKeyDate) ?? '';
    final storedCount = prefs.getInt(_kKeyUploads) ?? 0;
    final today = _todayStr();

    if (storedDate == today) {
      _dailyUploads = storedCount;
    } else {
      _dailyUploads = 0;
      await prefs.setString(_kKeyDate, today);
      await prefs.setInt(_kKeyUploads, 0);
    }

    _loaded = true;
    notifyListeners();
  }

  Future<void> recordUpload() async {
    _dailyUploads++;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kKeyDate, _todayStr());
    await prefs.setInt(_kKeyUploads, _dailyUploads);
  }

  Future<void> upgrade() async {
    _plan = 'pro';
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kKeyPlan, 'pro');
  }

  Future<void> downgrade() async {
    _plan = 'free';
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kKeyPlan, 'free');
  }

  String _todayStr() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }
}
