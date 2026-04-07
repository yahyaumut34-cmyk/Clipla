# Clipla — iOS & Android Yayın Rehberi

## ADIM 1 — Backend'i Production'a Deploy Et

### 1.1 Anthropic API Key'i Döndür (ACİL)
Mevcut key ifşa oldu. Hemen yeni key al:
1. https://console.anthropic.com → API Keys → Create Key
2. Eski key'i Disable et
3. Yeni key'i backend `.env` dosyasına yaz

### 1.2 Railway.app ile Deploy (En Kolay)
```bash
# Railway CLI kur
npm install -g @railway/cli

# Giriş yap
railway login

# Backend klasöründe:
cd C:\Users\musta\Desktop\clipla\proje\backend
railway init
railway up

# Env var'ları Railway dashboard'dan ekle:
# PUBLIC_BASE_URL = https://xxx.up.railway.app
# ANTHROPIC_API_KEY = sk-ant-...yeni...
# SUPABASE_URL = https://xxx.supabase.co
# SUPABASE_SERVICE_KEY = eyJ...
# API_SECRET_KEY = (python -c "import secrets; print(secrets.token_urlsafe(32))")
# PRO_API_KEYS = (ayrı pro key)
# CORS_ORIGINS = *   (başlangıçta, sonra daralt)
# WHISPER_MODEL = small
```

> Not: Railway'de FFmpeg kurulu gelir. Disk kalıcı değil — outputs/ klasörü
> restart'ta silinir. Kalıcı storage için Railway Volume ekle (Ayarlar → Volumes).

### 1.3 Render.com Alternatifi
```
1. render.com → New → Web Service
2. GitHub repo bağla (backend klasörü root olarak seç)
3. Build Command: pip install -r requirements.txt
4. Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
5. Environment Variables: yukarıdaki aynı listeden ekle
```

### 1.4 Backend URL'i Not Al
Deploy bittikten sonra URL şuna benzer:
- Railway: `https://clipla-backend-production.up.railway.app`
- Render: `https://clipla-api.onrender.com`

Bu URL'i Expo ve Flutter build'lerinde kullanacaksın.

---

## ADIM 2 — Expo (React Native) — App Store + Play Store

### 2.1 EAS CLI Kur
```bash
npm install -g eas-cli
eas login   # Expo hesabınla giriş yap
```

### 2.2 Backend URL'i Güncelle
`eas.json` dosyasında `production` ve `preview` profillerindeki
`EXPO_PUBLIC_BACKEND_URL` değerini deploy ettiğin URL ile değiştir:
```json
"env": {
  "EXPO_PUBLIC_BACKEND_URL": "https://clipla-backend.up.railway.app"
}
```

### 2.3 API Key'i Güncelle
`eas.json`'a ekle (veya EAS Secret olarak):
```json
"env": {
  "EXPO_PUBLIC_BACKEND_URL": "https://...",
  "EXPO_PUBLIC_API_KEY": "buraya-backend-api-secret-key-yaz"
}
```

### 2.4 Apple — App Store (iOS)

**Gereksinimler:**
- Apple Developer Program üyeliği: https://developer.apple.com/programs/
- Yıllık ücret: $99

**Adımlar:**
```
1. developer.apple.com → Certificates → App ID oluştur
   - Bundle ID: com.cliplav.app

2. appstoreconnect.apple.com → Apps → + → New App
   - Bundle ID: com.cliplav.app seç
   - App adı, kategori, yaş seç

3. EAS otomatik sertifika yönetimi:
   eas credentials --platform ios
   (Apple ID ile giriş ister, provision profile + sertifika otomatik oluşturulur)

4. Build al:
   eas build --platform ios --profile production

5. Submit et:
   eas submit --platform ios --profile production
   (veya Transporter app ile .ipa yükle)

6. App Store Connect → TestFlight → Internal Testing başlat
```

**App Store için hazırlanması gerekenler:**
- [ ] Gizlilik Politikası URL'i (zorunlu — basit bir web sayfası olabilir)
- [ ] Destek URL'i
- [ ] Uygulama açıklaması (Türkçe + İngilizce)
- [ ] iPhone ekran görüntüleri: 6.7" (1290×2796) — en az 3 adet
- [ ] iPad ekran görüntüleri: 12.9" — en az 3 adet (tablet destekleniyorsa)
- [ ] 1024×1024 App Icon (assets/icon.png zaten hazır)

### 2.5 Google — Play Store (Android)

**Gereksinimler:**
- Google Play Developer hesabı: https://play.google.com/console
- Tek seferlik ücret: $25

**Adımlar:**
```
1. play.google.com/console → Create App
   - App adı, dil, uygulama türü seç
   - Package name: com.cliplav.app

2. EAS Android Keystore:
   eas credentials --platform android
   (Keystore otomatik oluşturulur ve EAS'te saklanır — YEDEK AL!)

3. Build al:
   eas build --platform android --profile production

4. Submit et:
   eas submit --platform android --profile production
   VEYA:
   - EAS'ten .aab dosyasını indir
   - Play Console → Internal Testing → Create Release → .aab yükle

5. İlk release için "Internal Testing" ile başla, sonra Production
```

**Play Store için hazırlanması gerekenler:**
- [ ] Gizlilik Politikası URL'i (zorunlu)
- [ ] Kısa açıklama (max 80 karakter)
- [ ] Uzun açıklama (max 4000 karakter)
- [ ] Ekran görüntüleri (min 2, max 8): 1080×1920 veya 1080×2400
- [ ] Feature Graphic: 1024×500
- [ ] 512×512 App Icon (assets/icon.png'den türetilir)
- [ ] İçerik derecelendirmesi anketi (Play Console'da doldurulur)

---

## ADIM 3 — Flutter — Android + iOS

### 3.1 Flutter SDK Kur
```
https://docs.flutter.dev/get-started/install/windows
```
PATH'e ekledikten sonra terminali yeniden aç.

### 3.2 Native Scaffold (Tek Seferlik)
```powershell
cd C:\Users\musta\Desktop\clipla-app\flutter
.\setup_native.ps1
```
Bu script:
- `flutter create .` çalıştırır (android/ ve ios/ klasörlerini oluşturur)
- AndroidManifest.xml'e izinleri ekler
- Info.plist'e iOS izinlerini ekler
- minSdk'yı 24'e ayarlar

### 3.3 Backend URL — Flutter Build
```bash
# Android App Bundle (Play Store)
flutter build appbundle --release \
  --dart-define=BACKEND_URL=https://api.clipla.com \
  --dart-define=API_KEY=buraya-api-key-yaz

# iOS (Mac'te çalıştır)
flutter build ios --release \
  --dart-define=BACKEND_URL=https://api.clipla.com \
  --dart-define=API_KEY=buraya-api-key-yaz
```

### 3.4 Android Keystore (setup_native.ps1 sonrası)
```bash
keytool -genkey -v \
  -keystore android/clipla-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias clipla \
  -dname "CN=Clipla, OU=Mobile, O=Cliplav, L=Istanbul, S=Istanbul, C=TR"

# android/key.properties dosyası oluştur:
storePassword=SIFREN
keyPassword=SIFREN
keyAlias=clipla
storeFile=clipla-release.jks
```

`android/app/build.gradle`'a signing ekle:
```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

### 3.5 iOS Signing (Mac Gerekli)
iOS build Mac olmadan mümkün değil.

**Seçenek A — Codemagic.io (bulut build, ücretsiz tier):**
```
1. codemagic.io → Connect GitHub
2. Flutter projeni seç
3. iOS signing → Apple Developer hesabın bağla
4. Build başlat → .ipa otomatik oluşur
```

**Seçenek B — GitHub Actions (Mac runner):**
```yaml
# .github/workflows/flutter-release.yml dosyası oluştur
# (RELEASE_SETUP.md yanındaki flutter-ci-template.yml'i kullan)
```

---

## Keystore Yedeği — ÖNEMLİ!

Android keystore'u kaybedersen uygulamayı güncelleyemezsin.

```bash
# Keystore'u güvenli bir yere kopyala:
cp android/clipla-release.jks ~/OneDrive/Clipla-Keystore-BACKUP.jks
# veya bulut depolama

# key.properties'i .gitignore'a ekle:
echo "android/key.properties" >> .gitignore
echo "android/clipla-release.jks" >> .gitignore
```

---

## Özet — Sıralı Komutlar

```bash
# 1. Backend deploy
railway up  (veya Render)

# 2. eas.json'da URL'i güncelle

# 3. iOS build
eas build --platform ios --profile production
eas submit --platform ios --profile production

# 4. Android build
eas build --platform android --profile production
eas submit --platform android --profile production

# 5. Flutter (sonra)
.\flutter\setup_native.ps1
flutter build appbundle --release --dart-define=BACKEND_URL=https://api.clipla.com
```
