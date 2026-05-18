# Clipla-Y

**Sesli komutla AI destekli mobil video edit uygulaması.**

Videonu yükle, konuşarak düzenle. Altyazı ekle, beat sync uygula, arka planı kaldır, sesi iyileştir, kısa klipler üret — eller serbest.

> **Clipla-Y = Sesle çalışan, semantik olarak düşünen video edit motoru**

*Made with love in Antalya, Türkiye*

---

## Neden Clipla-Y?

Günümüzde video düzenleme hâlâ timeline sürükleme, kes-yapıştır ve manuel uğraş gerektiriyor.

Clipla-Y bunu değiştirir: **konuş, sistem anlasın ve yapsın.**

- Meme sesleri oynatan bir uygulama **değil**
- Viral içerik kopyalayan bir tool **değil**

Clipla-Y, kullanıcı niyetini anlayan AI tabanlı semantik edit sistemidir:
duygu (şok, komik, gerilim), zamanlama, yoğunluk — bunlara göre özgün, telifsiz efekt üretir.

---

## Temel Akış

```
Voice / Text → Intent → AI Plan → Onay → FFmpeg Pipeline → Output
```

İki sistem birlikte çalışır:

### 1. AI Sohbet (Edit Asistanı)

Kullanıcı edit hedefini konuşarak anlatır:
> "30 saniyeye indir, tempo hızlandır, YouTube Shorts için hazırla"

Sistem konuşmayı analiz eder, platform/süre/hedef çıkarır, edit planı oluşturur. Onay sonrası FFmpeg pipeline başlar.

### 2. Semantic Effect Engine

> "Şu kısmı daha komik yap"

`useEffectIntent.js` keyword matching ile intent çıkarır, efekt kategorisini tespit eder, doğrudan FFmpeg filtresi uygular.

---

## Özellikler

### Sesli Komut + AI Sohbet
- Türkçe ve İngilizce sesli komut
- SSE streaming ile gerçek zamanlı AI yanıtı (karakter karakter)
- Uzun konuşma destegi (context korunur)
- TTS geri bildirim: emoji ve markdown otomatik temizlenir, doğal sesli okuma sağlanır
- Sesle onay/red: "evet" → işlemi başlat, "hayır" / "iptal" → iptal

---

### Türkçe Filler ve Sessizlik Temizleme
- "ıı", "şey", "yani", "hani" otomatik temizlenir
- Doğal konuşma ritmi korunabilir
- Sessizlik tespiti: -30 dB eşiği, 0.5 saniye minimum

---

### Semantic Effect Engine

Efekt kategorileri:
- `impact` / vurgu — impact_shock, impact_emphasis
- `comedy_reaction` — komedi reaction
- `tension_build` — gerilim build
- `epic_moment`, `epic_reveal` — epik an
- `vintage_film` — vintage
- `neon_glow` — neon

Hepsi royalty-free FFmpeg filtreleri — telifsiz, özgün.

---

### Smart Shorts Generator
Rastgele kesmez, anlam analizi yapar:
- Konu bütünlüğü
- Cümle tamamlığı
- Giriş + gelişme + sonuç
- Duygusal peak / vurucu an

Her short tek başına anlamlı, izlenebilir ve paylaşılabilir.

---

### Multilingual Altyazı + Stil Şablonları

**Desteklenen diller:** Türkçe, İngilizce, Almanca, Fransızca, İspanyolca, Arapça, Rusça, Japonca, Çince

**Caption stil şablonları:**
| Stil | Açıklama |
|---|---|
| `bold` | Standart kalın beyaz |
| `neon` | Cyan neon parlama |
| `minimal` | İnce, sade |
| `cinematic` | Koyu kutulu sinema stili |
| `tiktok` | Sarı büyük TikTok stili |

Çeviri stack: Anthropic Claude Haiku (varsayılan) · LibreTranslate (opsiyonel, self-hosted)

---

### Beat Sync
Müzik ritmine göre otomatik görsel efekt:
- librosa ile beat detection (yoksa 120 BPM fallback)
- Efektler: `pulse`, `flash`, `zoom`
- FFmpeg hue filtresi ile senkron

---

### Arka Plan Kaldırma
- **Chromakey modu:** FFmpeg colorkey filtresi (yeşil / mavi / beyaz ekran)
- **AI modu:** rembg frame-by-frame (yüksek kalite, daha yavaş)
- Özelleştirilebilir renk, similarity ve blend parametreleri

---

### Ses İyileştirme
FFmpeg afftdn + loudnorm tabanlı 5 profil:
| Profil | Kullanım |
|---|---|
| `clean` | Genel gürültü azaltma |
| `voice_boost` | Ses netliği artırma |
| `denoise_only` | Sadece gürültü temizleme |
| `podcast` | Podcast kalitesi |
| `loud` | Güçlü sıkıştırma |

---

### Ses Efektleri (SFX)
- Royalty-free ses efekti kütüphanesi
- Timestamp'e göre yerleştirme
- Volume kontrolü

---

### Arka Plan Müziği
- Mood tabanlı müzik seçimi
- Start/end zamanı ayarı
- Ses seviyesi dengesi (varsayılan: %22)

---

### Video Birleştirme (Merge)
- 2–5 video seç, sırala, kırp, birleştir
- Geçiş efektleri: cut, fade, dissolve, wipe, slide, xfade
- Çözünürlük ölçekleme: kaynak, 1080p, 720p, 480p
- Her klip için başlangıç/bitiş zamanı (trim)

---

### Diğer Edit İşlemleri
| Özellik | Açıklama |
|---|---|
| Hız değiştirme | 0.25x – 4x |
| Renk düzenleme | Brightness, contrast, saturation, gamma, preset |
| Dönüştürme | Rotate, aspect ratio (16:9, 9:16, 1:1), flip |
| Metin kaplama | Pozisyon, font boyutu, renk, zaman aralığı |
| Filtre uygulama | Hazır FFmpeg filtreleri |
| Ters çevirme | Video tersine oynatma |
| Geri alma | Son edit işlemini geri al |
| Video analizi | Hook gücü, tempo, içerik değeri |

---

### On-Device STT Zinciri
1. **Web:** tarayıcı SpeechRecognition API (anlık, internetsiz)
2. **Native:** expo-speech-recognition (cihaz üstünde)
3. **Fallback:** ses kaydedilir → backend `/api/stt/transcribe` → Whisper

---

### Upload ile Gerçek Progress
- **Web:** XMLHttpRequest `onprogress` ile gerçek yüzde
- **Native:** expo-file-system `createUploadTask` ile ilerleme
- Maks dosya boyutu: 800 MB

---

## Auth & Güvenlik

- Supabase email + şifre kaydı / girişi
- GitHub OAuth
- Tüm API isteklerine Bearer token (`Authorization: Bearer ...`)
- Backend `security.py`: `API_SECRET_KEY` env var ile prod auth, yoksa dev mode
- Job sahipliği doğrulaması (başkasının jobId'sini kullanamazsın)

---

## Pro / Paywall Sistemi

### Free
- Günlük sınırlı video yükleme
- Temel edit ve altyazı

### Pro
- Sınırsız video
- Beat Sync, BG Removal, Audio Enhance, SFX, Müzik
- Gelişmiş efektler
- Premium altyazı (çoklu dil + stiller)
- Shorts generator

---

## Teknoloji Stack

| Katman | Teknoloji |
|---|---|
| Frontend | React Native / Expo (web + Android + iOS) |
| Flutter | Flutter portu aktif geliştirmede |
| Backend | FastAPI (Python 3.11+) |
| Video | FFmpeg |
| STT | Whisper (faster-whisper, small model) |
| AI | Anthropic Claude Haiku (chat + çeviri) |
| Beat Detection | librosa |
| BG Removal | rembg |
| DB / Auth | Supabase (PostgreSQL + RLS) |
| Çeviri | Anthropic / LibreTranslate (opsiyonel) |

---

## Backend API Endpoint'leri

| Endpoint | Açıklama |
|---|---|
| `POST /api/video/upload` | Video yükleme |
| `POST /api/chat` | AI sohbet |
| `POST /api/chat/stream` | AI sohbet SSE streaming |
| `POST /api/auto-edit/:id` | Otomatik edit başlat |
| `GET  /api/auto-edit/:id/status` | Edit durumu sorgula |
| `POST /api/shorts/:id` | Smart Shorts üret |
| `POST /api/subtitles/:id` | Altyazı yakma |
| `POST /api/effects/:id` | Semantic efekt uygula |
| `POST /api/sfx/:id` | Ses efekti ekle |
| `POST /api/music/:id` | Arka plan müziği ekle |
| `POST /api/beat-sync/:id` | Beat sync uygula |
| `POST /api/bg-remove/:id` | Arka plan kaldır |
| `POST /api/enhance-audio/:id` | Ses iyileştir |
| `POST /api/merge` | Çoklu video birleştir |
| `POST /api/trim-merge` | Kırp + birleştir |
| `POST /api/undo/:id` | Son işlemi geri al |
| `GET  /api/edit-history/:id` | Edit geçmişi |
| `GET  /api/preview/:id` | Önizleme |
| `POST /api/speed/:id` | Hız değiştir |
| `POST /api/color/:id` | Renk düzenle |
| `POST /api/transform/:id` | Döndür / kırp / çevir |
| `POST /api/text/:id` | Metin kaplama ekle |
| `POST /api/filters/:id` | Filtre uygula |
| `POST /api/reverse/:id` | Videoyu tersine çevir |
| `POST /api/analyze/:id` | Video analizi |
| `POST /api/stt/transcribe` | Whisper ses → metin |

---

## Kurulum

### Gereksinimler
- Node.js 20+
- Python 3.11+
- FFmpeg (PATH'de olmalı)
- `npm install -g expo-cli eas-cli`

### Backend

```bash
cd C:/Users/musta/Desktop/clipla/proje/backend
python -m venv venv
venv/Scripts/activate
pip install -r requirements.txt
pip install librosa soundfile rembg Pillow   # Beat Sync + BG Removal için

cp .env.example .env
# .env: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend

```bash
cd C:/Users/musta/Desktop/clipla-app
npm install
cp .env.example .env
# .env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY

npm run web        # Tarayıcı (http://localhost:8081)
npm run android    # Android emülatör
npm run ios        # iOS simülatör
```

### Gerçek Cihaz (Android / iOS)

`api.js` içindeki BASE_URL'i yerel ağ IP'nize göre değiştirin:
```js
const DEFAULT_MOBILE = 'http://192.168.1.X:8000'; // kendi IP'niz
```

Backend'i LAN'a açın:
```bash
venv/Scripts/python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### EAS Build

```bash
eas build --profile development
eas build --profile preview
eas build --profile production
```

---

## Proje Yapısı

```
App.js                    ← auth gate, header, PaywallModal
api.js                    ← tüm backend çağrıları + authHeaders
app.json / app.config.js  ← Expo config, extra.apiKey, extra.backendUrl

screens/
  WorkspaceScreen.js      ← tek sayfalık ana uygulama (tüm state burада)
  AuthScreen.js           ← email/şifre + GitHub OAuth

components/
  FloatingChat.js         ← sağ altta yüzen chat modal (streaming, onay kutusu)
  VideoMergeModal.js      ← video birleştirme bottom sheet (sıralama, trim, geçiş)
  NativeVideoPlayer.js    ← expo-video wrapper (done state preview)
  TemplateSelector.js     ← şablon seçici UI
  StepQuickEdit.js        ← hızlı edit adımı UI
  StepProcessing.js       ← işlem overlay
  PaywallModal.js         ← pro yükseltme modal
  ProBadge.js             ← header plan rozeti

hooks/
  useMicrophone.js        ← Web SpeechRecognition / Native expo-speech-recognition + Whisper
  useTTS.js               ← Web speechSynthesis / Native expo-speech
  useEditPolling.js       ← her 4s'de /status sorgular, altyazı auto-apply
  usePlan.js              ← AsyncStorage upload sayacı + pro flag
  useEffectIntent.js      ← keyword → efekt kategorisi eşleştirici

shared/
  theme.js                ← renk paleti + IS_WEB
  supabase.js             ← getSession, onAuthStateChange, signOut, DEV_MODE
  constants.js            ← SUB_LANGS, PLAT_LABELS, sesli komut matcherları

flutter/                  ← Flutter portu (aktif geliştirme)
supabase/migrations/      ← PostgreSQL migration dosyaları
web/                      ← Web entry point
```

---

## Roadmap

### Faz 1 — Tamamlandı
- Sesli komut + AI sohbet
- Filler/sessizlik temizleme
- Altyazı (yakma + çeviri, 9 dil)
- Auto-edit render
- Smart Shorts generator
- Supabase auth (email + GitHub OAuth)
- Upload progress bar

### Faz 2 — Tamamlandı
- Caption stil şablonları (bold, neon, minimal, cinematic, tiktok)
- Beat Sync (librosa beat detection)
- Arka plan kaldırma (chromakey + rembg AI)
- Ses iyileştirme (5 profil)
- SFX ses efektleri
- Arka plan müziği (mood tabanlı)
- Video birleştirme + trim-merge (2–5 video, geçiş efektleri)
- SSE streaming chat
- Geri alma (undo)
- Hız, renk, dönüştürme, metin, filtre, ters çevirme işlemleri
- Pro/Paywall sistemi
- Flutter portu başlatıldı

### Faz 3 — Planlanan
- On-device edit (küçük modeller)
- Güçlü virality AI (detaylı analiz)
- Kullanıcı marketplace (efekt paylaşımı)
- Kullanıcı kendi sesini efekt olarak yükleyebilir
- Topluluk özellikleri

---

## Telif ve Güvenlik

Clipla-Y:
- Yalnızca royalty-free veya AI üretimi içerik kullanır
- Hiçbir viral meme / film / müzik kullanmaz
- Kullanıcı verisini minimum tutar
- App Store ve Google Play uyumlu

---

## Felsefe

Video düzenleme bir iş değil, bir düşünce süreci olmalı.

**Clipla-Y bunu şuna çevirir: Konuş. Sistem anlasın. Video oluşsun.**

---

*Konus. Clipla-Y yapsın.*
