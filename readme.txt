# Clipla-Y

Sesli komutla AI destekli mobil video edit uygulaması.
Videonu çek, konuşarak düzenle. Filler kelimeleri temizle, altyazı ekle, anlamlı Shorts üret, akıllı efektler yerleştir — hepsi eller serbest.

**Clipla-Y = Sesle çalışan, semantik olarak düşünen video edit motoru**

Made with love in Antalya, Turkiye

---

## Neden Clipla-Y?

Gunumuzde video duzenleme hala:

- timeline surükleme
- kes-yapistir
- manuel ugras

gerektiriyor.

Clipla-Y bunu degistirir:

Konus, sistem anlasın ve yapsın.

Ama en kritik fark:

- Meme sesleri oynatan bir uygulama DEGIL
- Viral icerik kopyalayan bir tool DEGIL

Clipla-Y, AI tabanli semantik edit sistemidir.

Kullanici niyetini anlar:

- duygu (sok, komik, gerilim)
- zamanlama
- yogunluk
- Meme sesleri istek → yapay zeka ile sohbet ederek verilir

ve buna gore ozgun, telifsiz efekt uretir veya secer.

---

## Core Sistem

```
Voice → Intent → Context → Effect → Edit → Output
```

Iki ayri sistem birlikte calisir:

### 1. AI Sohbet (Edit Asistani)
Kullanici edit hedefini konusarak anlatir:
> "30 saniyeye indir, tempo hizlandir, YouTube Shorts icin hazirla"

Sistem:
- konusmayi analiz eder
- platform, sure, hedef cikarir
- edit plani olusturur
- onay alindiktan sonra FFmpeg pipeline baslatir

### 2. Semantic Effect Engine
Kullanici sahnelere duygusal efekt ekler:
> "Su kismi daha komik yap"

Sistem:
- keyword matching ile intent cikarir (useEffectIntent.js)
- efekt kategorisini tespit eder (komedi reaction)
- uygun FFmpeg filtresi uygular
- dogrudan cikti URL doner — yeni bir edit baslangici OLMAZ

Iki sistem birbiriyle calisir:
- Sohbet → edit plani → "evet" onayi → render → sonuca efekt uygula

---

## Ana Ozellikler

### Sesli Komut + AI Sohbet

- Turkce ve Ingilizce sesli komut
- Uzun konusma destegi (context korunur)
- Islem sirasinda sesli geri bildirim: "Yuzde kirk tamamlandi"
- TTS: emoji ve markdown otomatik temizlenir, dogal sesli okuma saglanir

---

### Turkce Filler ve Sessizlik Temizleme

- "III", "sey", "yani", "hani" otomatik temizlenir
- Dogal konusma ritmi korunabilir
- Sessizlik tespiti: -30dB esigi, 0.5 saniye minimum

---

### Semantic Effect Engine

Kullanici:
- "sok efekti koy"
- "burayi daha eglenceli yap"
- "gerilim artir"

Sistem:
- Intent cikarir
- Efekt uretir/secer

Efekt kategorileri:
- impact / vurgu (impact_shock, impact_emphasis)
- komedi reaction (comedy_reaction)
- gerilim build (tension_build)
- epik an (epic_moment, epic_reveal)
- vintage (vintage_film)
- neon (neon_glow)

Hepsi royalty-free FFmpeg filtreleri — telifsiz, ozgun.

---

### Smart Shorts Generator

Clipla-Y shorts uretirken:
- rastgele kesmez
- sadece sureye bakmaz

Anlam analizi yapar:

Secim kriterleri:
- konu butunlugu
- cumle tamamligi
- giris + gelisme + sonuc
- duygusal peak / vurucu an

Her short:
- tek basina anlamli
- izlenebilir
- paylasilabilir olur

---

### Multilingual Altyazi Motoru

Desteklenen diller: Turkce, Ingilizce, Almanca, Fransizca, Ispanyolca, Arapca, Rusca, Japonca, Cinece

Ceviri stack:
- Anthropic Claude Haiku (varsayilan — ANTHROPIC_API_KEY gerektirir)
- LibreTranslate (opsiyonel, self-hosted — LIBRETRANSLATE_URL ile devreye girer)

---

### On-Device STT Zinciri

Konusma tanima kademe kademe calisir:

1. Web: tarayici SpeechRecognition API (anlik, internetsiz)
2. Native: expo-speech-recognition (cihaz ustunde)
3. Fallback: ses kaydedilir → backend /api/stt/transcribe → Whisper

"Offline" destegi: Web ve on-device modu internetsiz calisir. Backend Whisper fallback internet gerektirir.

---

### Basit Analiz (Virality Engine)

Kullanici sorar: "Bu video neden viral olabilir?"

Sistem:
- hook gucu
- tempo
- icerik degeri

gibi faktorlere gore sade aciklama verir. Garanti vermez, yonlendirir.

---

## Teknoloji Stack

- Frontend: React Native / Expo (web + Android + iOS)
- Flutter: Flutter portuna gecis aktif
- Backend: FastAPI (Python)
- Video: FFmpeg
- STT: Whisper (faster-whisper, small model varsayilan)
- AI: Claude Haiku (chat + altyazi cevirisi)
- Efekt: Procedural FFmpeg filtreleri (royalty-free)
- DB: Supabase (PostgreSQL, RLS)
- Ceviri: Anthropic / LibreTranslate (opsiyonel)

---

## Monetizasyon

### Free
- sinirli video yukleme (gunluk kota)
- temel edit
- basic efektler

### Pro
- sinirsiz video
- gelismis efektler
- premium altyazi (coklu dil)
- gelismis analiz

---

## Roadmap

### Faz 1 — Tamamlandi
- Sesli komut + AI sohbet
- Filler/sessizlik temizleme
- Altyazi (yakma + ceviri)
- Auto-edit render
- Smart Shorts generator
- Supabase entegrasyonu

### Faz 2 — Aktif Gelistirme
- Ses efekt sistemi (royalty-free ses dosyalari)
- Daha akilli intent detection (LLM tabanli)
- Flutter portu tamamlama
- On-device edit (kucuk modeller)

### Faz 3 — Planlanan
- Virality AI (guclu analiz)
- Kullanici marketplace (efekt paylasimi)
- Topluluk
- Kullanici kendi sesini efekt olarak yukleyebilir

---

## Kurulum

### Gereksinimler

- Node.js 20+
- Python 3.11+
- FFmpeg (PATH'de olmali)
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`

### Backend

```bash
cd C:/Users/musta/Desktop/clipla/proje/backend
python -m venv venv
venv/Scripts/activate          # Windows
pip install -r requirements.txt

cp .env.example .env
# .env dosyasini doldur: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd C:/Users/musta/Desktop/clipla-app
npm install
cp .env.example .env
# .env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_BACKEND_URL

npm run web       # tarayici
npm run android   # Android emulor (BASE_URL: 10.0.2.2:8000)
```

### Gercek Cihaz (Android/iOS)

`api.js` icindeki BASE_URL'i yerel ag IP'nize gore degistirin:
```js
// api.js
const BASE_URL = Platform.OS === 'web'
  ? 'http://127.0.0.1:8000'
  : 'http://192.168.1.X:8000';  // kendi IP'niz
```

Backend'i LAN'a ac:
```bash
venv/Scripts/python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## Telif ve Guvenlik

Clipla-Y:
- sadece royalty-free veya AI uretimi icerik kullanir
- hicbir viral meme / film / muzik kullanmaz
- kullanici verisini minimum tutar
- App Store ve Google Play uyumlu

---

## Felsefe

Video duzenleme bir is degil, bir dusunce sureci olmali.

Clipla-Y bunu suna cevirir: Konus. Sistem anlasın. Video olusun.

---

## Slogan

Konus. Clipla-Y yapsın.
