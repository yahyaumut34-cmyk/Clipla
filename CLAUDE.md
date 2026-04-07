# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start dev server (choose platform)
npm start          # Expo dev server (prompts for platform)
npm run android    # Android emulator
npm run ios        # iOS simulator
npm run web        # Web browser

# Build with EAS
eas build --profile development
eas build --profile preview
eas build --profile production
```

There is no lint or test setup — the project has no testing framework configured.

### Backend Location & Running

```bash
# Backend is separate React Native app: C:/Users/musta/Desktop/clipla/proje/backend/
cd C:/Users/musta/Desktop/clipla/proje/backend
venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000

# Or for Android/iOS testing, change BASE_URL in api.js to 192.168.1.6 (local network IP)
```

## Architecture

**Clipla** is an AI-powered video editing app built with Expo (React Native). The user uploads a video, has a voice/text conversation with an AI assistant to describe their edit, then the app sends the video to a backend for processing.

### File structure

```
App.js                     ← wizard orchestration only (step state, navigation)
api.js                     ← all backend API calls (root, platform-aware BASE_URL)
shared/theme.js            ← C color palette + IS_WEB constant
index.js                   ← entry point, SafeAreaProvider wrapper

components/
  StepBar.js               ← 4-step progress indicator
  StepUpload.js            ← video file picker + upload with progress
  StepChat.js              ← voice/text chat, edit confirmation, shorts tab
  StepPreview.js           ← video preview, subtitle generation, metrics
  StepDownload.js          ← download + native share (expo-sharing)
  NativeVideoPlayer.js     ← expo-video wrapper (used across components)

hooks/
  useMicrophone.js         ← platform-agnostic mic: Web SpeechRecognition / Native expo-av + STT
  useTTS.js                ← platform-agnostic TTS: Web speechSynthesis / Native expo-speech
  useEditPolling.js        ← auto-edit starter with 2s status polling + subtitle generation
```

**Switch backend environment** in `api.js` — `BASE_URL` is `Platform.OS === 'web' ? 'http://127.0.0.1:8000' : 'http://192.168.1.6:8000'` by default.

### Backend API (local: `http://127.0.0.1:8000`)

| Endpoint | Purpose |
|---|---|
| `POST /api/video/upload` | Upload video file, returns `job_id` |
| `POST /api/auto-edit/:jobId` | Run AI edit with `command_text`, `platform`, `target_duration_sec` |
| `GET /api/auto-edit/:jobId/status` | Poll edit progress |
| `POST /api/chat` | Chat turn with AI assistant, returns `reply`, `ready_to_edit`, `edit_params` (also extracts `platform` and `target_duration_sec` from message) |
| `POST /api/effects/:jobId` | Apply FFmpeg-based visual effect (category, intensity) → returns new video URL |
| `POST /api/shorts/:jobId` | Generate short clips with semantic analysis |
| `POST /api/subtitles/:jobId` | Burn subtitles into video (auto-applies if language detected in chat) |
| `POST /api/stt/transcribe` | Speech-to-text for voice input |

### Voice Control System (Core Feature)

The app uses a **voice interceptor pattern** in `StepChat.js`:

```
Microphone capture → onTranscript (stable callback via ref) → handleTranscript() → route to:
├─ isConfirmWord("evet/tamam") → startEdit() (confirm edit plan)
├─ isRejectWord("hayır/dur") → ask again (reject plan)
├─ isApplyEffectCmd("uygula") + detectedEffect → handleEffectSelect()
├─ isShortsCmd("shorts/kısa klip") → tab switch + generate
└─ otherwise → sendMsg() (normal chat)
```

**Key patterns:**
- `onTranscriptRef.current` + `stableOnTranscript` callback: prevents mic re-initialization on state changes
- `confirmDataRef`/`detectedEffectRef`: refs keep state accessible in voice callbacks
- `handleTranscript()` updated every render via ref assignment
- TTS appends "Onaylamak için 'evet' de." when edit plan ready

**Files involved:**
- `components/StepChat.js` — voice routing + confirmation UI
- `hooks/useMicrophone.js` — STT chain (Web SpeechRecognition → Native on-device → backend Whisper)
- `hooks/useTTS.js` — TTS with language support
- `hooks/useEffectIntent.js` — intent detection (keywords → effect category)

### Backend (FastAPI)

**Location:** `C:/Users/musta/Desktop/clipla/proje/backend/`

**To run:**
```bash
cd C:/Users/musta/Desktop/clipla/proje/backend
venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

**Structure:**
```
main.py                    ← FastAPI app + major endpoints (chat, upload, auto-edit, effects, status)
api/
  video.py                 ← video upload handler
  auto_edit.py             ← edit router
  shorts.py                ← shorts generation
  subtitles.py             ← subtitle burning
```

**Key backend features:**
- Chat API extracts platform (tiktok/instagram/youtube_shorts) and duration from user messages
- `/api/effects/{job_id}` applies FFmpeg filters per category (impact_shock, neon_glow, vintage_film, etc.)
- Effect application returns new video URL → frontend updates preview
- Auto-subtitle applied after edit if language detected in chat
- Subtitle language detection: `detectSubtitleLang()` in constants.js checks chat history

### Platform differences

`IS_WEB = Platform.OS === 'web'` gates all web-specific behavior:
- **Web**: uses `<input type="file">` for picking, `SpeechRecognition` API for voice, `SpeechSynthesis` for TTS, native `<video>` element for preview.
- **Native (iOS/Android)**: uses `expo-document-picker` for files, `expo-video` (`VideoView` + `useVideoPlayer`) for playback. No voice input on native.

### UI conventions

- Color palette is defined in the `C` object at the top of `App.js`.
- All `StyleSheet` objects are defined inline near the component that uses them (except the global `s` and `stb` at the bottom of the file).
- The UI is Turkish-language.

### Pro/Plan System (Frontend-only, no backend enforcement yet)

- **Files:** `hooks/usePlan.js`, `components/PaywallModal.js`, `components/ProBadge.js`
- **Tracking:** AsyncStorage + daily upload counter
- **Features gated:** effects, shorts, advanced subtitles, unlimited uploads
- **Current state:** Local-only (easily circumvented) — backend doesn't validate yet
- **Gotcha:** `usePlan.upgrade()` is simulated (just sets local state to 'pro')

### Edit flow

1. User uploads video → backend returns `job_id`.
2. `StepChat`: user types or speaks commands. Each message hits `/api/chat`. When the AI signals `ready_to_edit: true` with `edit_params`, a confirmation card appears.
3. User says "evet" via voice OR clicks "Evet, Başla" button → `startEdit()` triggers `/api/auto-edit/:jobId`.
4. `useEditPolling` polls `/api/auto-edit/{jobId}/status` every 4s until done.
5. If subtitle language detected in chat, `/api/subtitles/{jobId}` burns it automatically.
6. `StepPreview`: shows final video with quality scores.
7. `StepDownload`: MP4 download + native share.

---

## Architectural Patterns

### Ref-based Stable Callbacks (Voice System)

When `useMicrophone.onTranscript` is called, the callback must access latest state (confirmData, detectedEffect) without triggering mic re-init:

```javascript
// Refs hold state snapshot for voice callbacks
const confirmDataRef = useRef(null);
const detectedEffectRef = useRef(null);
const onTranscriptRef = useRef(null);

// Keep refs synced
useEffect(() => { confirmDataRef.current = confirmData; }, [confirmData]);

// Stable callback passed to useMicrophone (never changes)
const stableOnTranscript = useCallback((text) => onTranscriptRef.current?.(text), []);

// Update ref every render (not expensive)
onTranscriptRef.current = handleTranscript;
```

**Why:** useMicrophone detects callback identity changes and reinits SpeechRecognition if it changes. Refs let us call fresh handleTranscript without callback identity changing.

### Intent Detection → UI Popup Pattern

`useEffectIntent.detectIntent(message)` returns effect info if keywords match. Don't wait for user — show in confirm box immediately:

1. `detectIntent()` runs in `sendMsg()`
2. Sets `detectedEffect` state
3. `ChatFooter` renders effect card in confirm box
4. User can click "Uygula" or say "uygula" to apply

**Files:**
- `hooks/useEffectIntent.js` (keyword matcher + intensity calc)
- `components/EffectPicker.js` (manual effect selector modal)

### Polling with Overlap Protection

`useEditPolling` starts polling `/api/auto-edit/{jobId}/status`. Prevent overlapping requests:

```javascript
const pollActiveRef = useRef(false);
if (pollActiveRef.current) return; // skip, previous request still in flight
pollActiveRef.current = true;
try {
  // fetch status
} finally {
  pollActiveRef.current = false;
}
```

### Chat Command Accumulation

User may describe edit in multiple turns. `StepChat` accumulates via `pendingCommandRef`:

```javascript
if (!isStartCommand(msg)) {
  pendingCommandRef.current = mergeCommand(pendingCommandRef.current, msg);
}
// Then send to backend as full command string
```

Backend `/api/chat` also merges user history into final `command_text` (last 5 msgs).

---

## New Features & Files (Recent Additions)

### Effects System
- **Files:** `components/EffectPicker.js`, `hooks/useEffectIntent.js`, backend `/api/effects/{jobId}`
- **Flow:** Detect intent → show in confirm box → user confirms (button or voice "uygula") → POST to `/api/effects/{jobId}` → new video URL returned → App.js updates result state → StepPreview shows new video
- **Categories:** impact_shock, comedy_reaction, tension_build, crowd_laugh, impact_emphasis, fail_tone, epic_moment

### Subtitle Auto-Application
- **Location:** `useEditPolling.js` line 127 — now applies ALL languages (was skipping Turkish)
- **Flow:** `detectSubtitleLang()` in chat or AI reply → stored in `pendingSubLangRef` → passed to `/api/subtitles/{jobId}` after edit completes → new video URL returned

### Voice Confirmation (Auto-Edit)
- **Flow:** Edit plan ready → TTS says reply + "Onaylamak için 'evet' de." → user says "evet" → `handleTranscript` intercepts "evet" → calls `startEdit()` without manual click

### Shorts Generation with Voice Command
- **Location:** `StepChat` tab switching + `doGenerateShorts()`
- **Voice trigger:** User says "shorts" or "kısa klip" → `handleTranscript` routes to `isShortsCmd()` → switches tab + calls generation

---

## Known Bugs & Fixes

### useMicrophone.js — FIXED
- **Bug 1 (line 26):** `getSRModule()` recursively called itself instead of importing → infinite loop, on-device STT never worked
  - **Fix:** Changed to `_srModule = await import('expo-speech-recognition')`
- **Bug 2 (line 166):** Missing `await` on `getSRModule()` call → Promise returned, not module → `undefined` errors
  - **Fix:** Added `const mod = await getSRModule()`

### useEditPolling.js — INCOMPLETE (may need fix)
- Line 66: `stopPolling()` called at start to clean up previous interval (good)
- But if early return on line 77 (sync result), polling ref is null → should be safe

### Platform/Duration Extraction
- **Pattern:** Backend `/api/chat` now extracts platform + duration from entire message history
- **Keywords:** "tiktok", "instagram", "youtube", "shorts", "kısa", "dakika", "saniye", etc.
- **Fallback:** youtube_shorts + None (if not detected)

---

## Development Tips

### When adding voice commands:
1. Add keyword regex to `StepChat.js` (e.g., `isMyCmd()`)
2. Add case in `handleTranscript()` before `sendMsg()` fallthrough
3. Remember: voice callback runs in `onTranscriptRef.current`, so it won't see stale closures

### When adding effects:
1. Add category to `EFFECT_CATEGORIES` in `useEffectIntent.js`
2. Add FFmpeg filter to backend `EFFECT_FILTERS` in `main.py`
3. Effect auto-application via `onEffectApplied` callback (App.js merges into result state)

### Backend dev:
- Subtitle endpoint: `/api/subtitles/{job_id}` calls `generateSubtitles()`
- Always rebuild if modifying Whisper or Claude calls (they're lazy-loaded)
- `LAST_JOB_ID` tracks last upload for demo mode
