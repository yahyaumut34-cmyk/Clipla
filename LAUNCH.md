# Clipla — Yayın Süreci (Sıralı)

## SENIN YAPMAN GEREKEN (Hesap/Ödeme)

Bunlar 100% senden geliyor — başka yolu yok:

### 1. Anthropic API Key Döndür (5 dakika, ÜCRETSİZ)
```
1. https://console.anthropic.com/settings/keys aç
2. Eski key'i "Disable" et
3. "Create Key" → kopyala
4. backend/.env dosyasında ANTHROPIC_API_KEY=... satırını güncelle
```

### 2. Railway Hesabı Aç + Backend Deploy (15 dakika, ÜCRETSİZ)
```
1. https://railway.app → GitHub ile giriş yap
2. "New Project" → "Deploy from GitHub Repo"
3. clipla/proje/backend klasörünü seç (veya tüm repo → root path: backend/)
4. Variables sekmesinden şunları ekle:
   ANTHROPIC_API_KEY   = sk-ant-...(yeni key)
   SUPABASE_URL        = https://xxx.supabase.co
   SUPABASE_SERVICE_KEY = eyJ...
   API_SECRET_KEY      = (rastgele şifre, min 32 karakter)
   PRO_API_KEYS        = (yukarıdakiyle aynı veya farklı)
   IP_HASH_SALT        = (rastgele şifre)
   CORS_ORIGINS        = *
   PUBLIC_BASE_URL     = (Railway'in verdiği URL, deploy bittikten sonra)
   WHISPER_MODEL       = small
   CLAUDE_ENHANCE      = true
5. Deploy bittikten sonra sağ üstteki URL'i kopyala
   örn: https://clipla-backend-production.up.railway.app
```

### 3. Expo Token Al (2 dakika, ÜCRETSİZ)
```
1. https://expo.dev/accounts/[kullanici]/settings/access-tokens
2. "Create Token" → "Token" kopyala
```

### 4. GitHub Secrets Ekle (10 dakika)
Terminalde (GitHub CLI kurulu olmalı — winget install GitHub.cli):
```powershell
gh auth login   # GitHub hesabınla giriş

.\setup_github_secrets.ps1 `
  -Repo "GITHUB_KULLANICIN/clipla-app" `
  -BackendUrl "https://clipla-backend.up.railway.app" `
  -ApiKey "backend-api-secret-key" `
  -ExpoToken "expo-token-buraya" `
  -SupabaseUrl "https://xxx.supabase.co" `
  -SupabaseAnonKey "eyJ..."
```

### 5. eas.json'ı Güncelle
`clipla-app/eas.json` dosyasını aç, şu alanları gerçek bilgilerle doldur:
```json
"ios": {
  "appleId": "apple-hesabin@email.com",
  "ascAppId": "App Store Connect'ten App ID",
  "appleTeamId": "Apple Team ID (10 haneli)"
}
```

### 6. EAS Credentials (15 dakika, ÜCRETSİZ)
```bash
cd C:\Users\musta\Desktop\clipla-app
npx eas-cli credentials --platform ios      # Apple ID ile giriş ister
npx eas-cli credentials --platform android  # Keystore otomatik oluşturur
```

### 7. Apple Developer Hesabı ($99/yıl) — iOS için zorunlu
```
1. https://developer.apple.com/programs/enroll/
2. Ödeme yap → 24-48 saat onay bekle
3. App Store Connect'te uygulama oluştur:
   https://appstoreconnect.apple.com → My Apps → + → New App
   Bundle ID: com.cliplav.app
```

### 8. Google Play Hesabı ($25 tek seferlik) — Android için zorunlu
```
1. https://play.google.com/console/u/0/signup
2. Ödeme yap → anında aktif
3. "Create app" → Package name: com.cliplav.app
```

---

## OTOMATİK OLAN (Kodda Zaten Hazır)

Yukarıdaki adımlar tamamlandıktan sonra bunlar otomatik çalışır:

- ✅ main branch'e push → GitHub Actions → EAS Build tetiklenir
- ✅ EAS Build biter → App Store Connect + Play Store'a otomatik gönderilir
- ✅ backend/ değişince → Railway'e otomatik deploy olur

---

## Kontrol Listesi

- [ ] Anthropic API key döndürüldü
- [ ] Railway deploy yapıldı, URL alındı
- [ ] Expo Token alındı
- [ ] GitHub Secrets eklendi (setup_github_secrets.ps1)
- [ ] eas.json'da Apple bilgileri dolduruldu
- [ ] `eas credentials` çalıştırıldı
- [ ] Apple Developer ($99) hesabı açıldı
- [ ] Google Play ($25) hesabı açıldı
- [ ] İlk EAS build GitHub Actions'dan tetiklendi

---

## Flutter (Sonra)

Flutter için önce:
```powershell
cd C:\Users\musta\Desktop\clipla-app\flutter
# Flutter PATH'te ise:
.\setup_native.ps1
# Sonra yukarıdaki flutter-build.yml workflow devreye girer
```
