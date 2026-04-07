// App.js wizard state'ini taşır
import 'package:flutter/foundation.dart';
import '../models/job_data.dart';
import '../models/edit_result.dart';

class WizardProvider extends ChangeNotifier {
  int _step = 0;
  JobData? _jobData;
  EditResult? _result;
  bool _paywallVisible = false;
  String _paywallReason = 'effects';

  int get step => _step;
  JobData? get jobData => _jobData;
  EditResult? get result => _result;
  bool get paywallVisible => _paywallVisible;
  String get paywallReason => _paywallReason;

  void nextStep() {
    _step++;
    notifyListeners();
  }

  void goBack() {
    if (_step > 0) {
      _step--;
      notifyListeners();
    }
  }

  void restart() {
    _step = 0;
    _jobData = null;
    _result = null;
    _paywallVisible = false;
    notifyListeners();
  }

  void setJobData(JobData data) {
    _jobData = data;
    notifyListeners();
  }

  void setResult(EditResult result) {
    _result = result;
    notifyListeners();
  }

  void updateResultUrl(String downloadUrl) {
    if (_result != null) {
      _result = _result!.copyWith(downloadUrl: downloadUrl, outputUrl: downloadUrl);
      notifyListeners();
    }
  }

  void showPaywall(String reason) {
    _paywallReason = reason;
    _paywallVisible = true;
    notifyListeners();
  }

  void hidePaywall() {
    _paywallVisible = false;
    notifyListeners();
  }
}
