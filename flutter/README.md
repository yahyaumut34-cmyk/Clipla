# Clipla Flutter

React Native / Expo uygulamasının Flutter karşılığı. Backend (FastAPI) değişmez.

## Kurulum

### 1. Flutter projesi oluştur (ilk kez)

```bash
cd flutter
flutter create . --project-name clipla_flutter
# Mevcut dosyalar korunur (pubspec.yaml, lib/ overwrite sorulursa HAYIR de)
```

### 2. Bağımlılıkları yükle

```bash
flutter pub get
```

### 3. Backend URL

`lib/api/api_service.dart` içindeki `_kDefaultMobile` sabitini kendi yerel ağ IP'nle güncelle:

```dart
const String _kDefaultMobile = 'http://192.168.X.X:8000';
```

Backend başlatmak için:
```bash
cd C:/Users/musta/Desktop/clipla/proje/backend
venv/Scripts/python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### 4. Android izinleri

`android/app/src/main/AndroidManifest.xml` içine `<manifest>` tagı altına ekle:

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.READ_MEDIA_VIDEO"/>
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32"/>
```

### 5. iOS izinleri

`ios/Runner/Info.plist` içine ekle:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Clipla ses komutları için mikrofon kullanır</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>Clipla sesli komutları metne çevirmek için konuşma tanıma kullanır</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Clipla video paylaşımı için kütüphane erişimi ister</string>
```

### 6. Çalıştır

```bash
flutter run -d android
flutter run -d ios
```

## Dosya Yapısı

```
lib/
├── main.dart                        Wizard shell + MultiProvider
├── theme/app_theme.dart             C renk paleti, ThemeData
├── api/api_service.dart             Tüm HTTP çağrıları (← api.js)
├── models/                          JobData, EditResult, ChatMessage
├── providers/
│   ├── plan_provider.dart           Ücretsiz/Pro plan (← usePlan.js)
│   └── wizard_provider.dart         Step + state yönetimi (← App.js)
├── services/
│   ├── tts_service.dart             flutter_tts (← useTTS.js)
│   ├── stt_service.dart             speech_to_text + backend fallback (← useMicrophone.js)
│   └── edit_polling_service.dart    Timer polling (← useEditPolling.js)
├── utils/
│   ├── constants.dart               kSubLangs, kPlatLabels, keyword regex
│   └── effect_intent.dart           Keyword→efekt eşleşmesi (← useEffectIntent.js)
├── widgets/
│   ├── step_bar.dart                4 adım göstergesi
│   ├── progress_grid.dart           100 blok yükleme griidi
│   ├── video_player_widget.dart     video_player + chewie
│   ├── chat_bubble.dart             AI/kullanıcı baloncukları
│   ├── confirm_card.dart            Edit planı onay kartı
│   ├── effect_picker_widget.dart    Efekt seçici overlay
│   ├── virality_card.dart           Virality skoru
│   ├── paywall_modal.dart           Pro upgrade modal
│   ├── pro_badge.dart               PRO/FREE rozet
│   └── badge_widget.dart            Genel rozet
└── screens/
    ├── step_upload_screen.dart      Video seç + yükle (← StepUpload.js)
    ├── step_chat_screen.dart        Sesli/yazılı sohbet (← StepChat.js)
    ├── step_preview_screen.dart     Önizleme + altyazı + efekt (← StepPreview.js)
    └── step_download_screen.dart    İndir + paylaş (← StepDownload.js)
```

## Ses Sistemi

STT zinciri (`stt_service.dart`):
1. `speech_to_text` on-device (Android SpeechRecognizer / iOS SFSpeechRecognizer)
2. Boş/hata → `record` ile kayıt → `/api/stt/transcribe` backend fallback

Voice routing (`step_chat_screen.dart` → `_handleTranscript`):
- `"evet/tamam"` → edit onayla
- `"hayır/dur"` → planı reddet
- `"shorts/kısa klip"` → Shorts tabına geç + üret
- `"uygula"` + efekt → efekt uygula
- Diğer → `/api/chat` mesaj gönder
