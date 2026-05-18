# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start dev server
npm run web        # Web browser (http://localhost:8081)
npm run android    # Android emulator
npm run ios        # iOS simulator
npm start          # Expo dev server (prompts for platform)

# Build with EAS
eas build --profile development
eas build --profile preview
eas build --profile production
```

There is no lint or test setup — the project has no testing framework configured.

### Backend Location & Running

```bash
# Backend is a separate FastAPI app:
cd C:/Users/musta/Desktop/clipla/proje/backend
venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

# For Android/iOS testing, change BASE_URL in api.js to the local network IP (e.g. 192.168.1.6)
```

## Architecture

**Clipla** is an AI-powered video editing app built with Expo (React Native). The user uploads a video, chats with an AI assistant via voice or text, and the backend processes the edit.

### Screen Flow

```
App.js
  ├─ session === undefined  → Loading spinner
  ├─ !session && !DEV_MODE → AuthScreen  (Supabase email + GitHub OAuth)
  └─ session || DEV_MODE   → WorkspaceScreen  (main app)
                               └─ PaywallModal  (overlaid)
```

`DEV_MODE` in `shared/supabase.js` bypasses auth entirely for local dev.

### WorkspaceScreen State Machine

`WorkspaceScreen` is the entire app in one file — it owns all state and orchestrates every sub-component.

```
'idle'
  ↓ single video selected + uploaded
'uploading'
  ↓ upload done
'ready'        ← VoiceCommandPanel visible here
  ↓ handleConfirm()
'processing'   ← useEditPolling polls /status every 4s
  ↓ onDone callback
'done'
  ↓ handleRestart()
'idle'
```

Multi-video path: selecting 2–5 videos → `VideoMergeModal` opens → upload + `trimMerge` API → `jobData` set → state goes to `'ready'`.

### Component Relationships

```
WorkspaceScreen (state owner)
├─ FloatingChat         — floating modal bottom-right; receives messages[], onSend, confirmData, editLoading
├─ VideoMergeModal      — alttan süzülen modal; handles video ordering, trim inputs, transition picker, upload progress
├─ VoiceCommandPanel    — collapsible panel in canvas (ready state); tappable command chips → onSend()
├─ NativeVideoPlayer    — expo-video wrapper for done state preview
└─ useMicrophone → handleTranscript → routes voice to:
     isConfirmWord    → handleConfirm()
     isRejectWord     → handleReject()
     "uygula"         → handleApplyEffect()
     isMergeUploadCmd → handleMergeUpload()
     /geçiş .../      → setMergeSettings transition
     isUndoCmd        → stub message
     isPreviewCmd     → status message
     else             → sendMsg() (AI chat)
```

### Key State Refs (Voice System)

WorkspaceScreen uses the same ref-based stable callback pattern as the original StepChat:

```javascript
const confirmDataRef    = useRef(null);
const detectedEffectRef = useRef(null);
const onTranscriptRef   = useRef(null);

// Stable callback passed to useMicrophone — never changes identity
const stableOnTranscript = useCallback(t => onTranscriptRef.current?.(t), []);

// handleTranscript re-assigned every render via ref
onTranscriptRef.current = handleTranscript;
```

**Why:** `useMicrophone` reinitializes SpeechRecognition if the callback identity changes. Refs let `handleTranscript` access fresh state without changing the callback reference.

### File Structure

```
App.js                       ← root: auth gate, header, PaywallModal
api.js                       ← all backend calls + authHeaders (Bearer token)
app.json                     ← extra.apiKey, extra.backendUrl
shared/theme.js              ← C color palette + IS_WEB
shared/supabase.js           ← getSession, onAuthStateChange, signOut, DEV_MODE
shared/constants.js          ← SUB_LANGS, PLAT_LABELS, detectSubtitleLang, isStartCommand, mergeCommand

screens/
  WorkspaceScreen.js         ← single-page workspace (entire app logic)
  AuthScreen.js              ← email/password + GitHub OAuth (Supabase)

components/
  FloatingChat.js            ← floating chat modal (messages, mic, confirm box, progress)
  VideoMergeModal.js         ← video merge/trim/reorder bottom sheet modal
  NativeVideoPlayer.js       ← expo-video wrapper
  TemplateSelector.js        ← (template UI)
  StepQuickEdit.js           ← quick edit step UI
  StepProcessing.js          ← processing overlay
  PaywallModal.js            ← pro upgrade modal
  ProBadge.js                ← plan badge in header

hooks/
  useMicrophone.js           ← Web SpeechRecognition / Native expo-speech-recognition + Whisper STT
  useTTS.js                  ← Web speechSynthesis / Native expo-speech
  useEditPolling.js          ← polls /auto-edit/{jobId}/status every 4s; handles subtitle auto-apply
  usePlan.js                 ← AsyncStorage-backed upload counter + pro flag
  useEffectIntent.js         ← keyword → effect category matcher
```

### API Authentication

```javascript
// api.js — key resolution order:
const API_KEY =
  Constants?.expoConfig?.extra?.apiKey  // app.json extra.apiKey (primary)
  || process.env.EXPO_PUBLIC_API_KEY    // .env fallback
  || (__DEV__ && '<dev-key>');          // hardcoded dev fallback

// Added to every request:
headers: { Authorization: `Bearer ${API_KEY}` }
```

Backend `services/security.py`: if `API_SECRET_KEY` env var is unset → dev mode (no auth). If set, all `/api/*` routes require the Bearer token (except `/health`, `/api/demo/verify`).

### Backend API

| Endpoint | Function in api.js |
|---|---|
| `POST /api/video/upload` | `uploadVideoWithProgress(file, onProgress)` |
| `POST /api/chat` | `sendChatMessage({ jobId, message, history })` |
| `POST /api/chat/stream` | `sendChatMessageStream({ ..., onChunk, onDone })` — SSE |
| `GET  /api/auto-edit/:id/status` | `getAutoEditStatus(jobId)` |
| `POST /api/auto-edit/:id` | `autoEdit(jobId, params)` |
| `POST /api/effects/:id` | `applyEffect(jobId, category, intensity)` |
| `POST /api/shorts/:id` | `generateShorts(jobId, opts)` |
| `POST /api/subtitles/:id` | `generateSubtitles(jobId, { language, style, ... })` |
| `POST /api/stt/transcribe` | `transcribeAudio(blob, filename, lang)` |
| `POST /api/merge` | `mergeVideos(jobIds, opts)` |
| `POST /api/trim-merge` | `trimMerge(clips, opts)` |
| `POST /api/beat-sync/:id` | `beatSync(jobId, opts)` |
| `POST /api/bg-remove/:id` | `removeBackground(jobId, opts)` |
| `POST /api/enhance-audio/:id` | `enhanceAudio(jobId, opts)` |
| `POST /api/music/:id` | `addMusic(jobId, opts)` |
| `POST /api/sfx/:id` | `addSoundEffect(jobId, opts)` |
| `POST /api/undo/:id` | `undoEdit(jobId)` |

### Platform Differences

`IS_WEB = Platform.OS === 'web'` gates all platform-specific behavior:
- **Web**: `<input type="file" multiple>` for picking, `SpeechRecognition` for voice, `SpeechSynthesis` for TTS
- **Native**: `expo-document-picker` with `allowsMultipleSelection: true`, `expo-speech-recognition` → Whisper fallback, `expo-speech` for TTS

### Pro/Plan System

- **Files:** `hooks/usePlan.js`, `components/PaywallModal.js`, `components/ProBadge.js`
- **Tracking:** AsyncStorage daily upload counter
- **Gated:** effects, shorts, subtitles, unlimited uploads
- **State:** local-only (`usePlan.upgrade()` just sets local state) — backend doesn't validate yet

### Edit Flow

1. Upload → backend returns `job_id` → `jobData` set, `wsState = 'ready'`
2. Chat turns hit `/api/chat`. When `ready_to_edit: true` + `edit_params` returned → `confirmData` set → confirm card shown in FloatingChat
3. Voice "evet" or button → `handleConfirm()` → `startEdit()` → `wsState = 'processing'`
4. `useEditPolling` polls every 4s. If subtitle language detected in chat → auto-applies `/api/subtitles` after edit
5. `onDone` callback → `result` set → `wsState = 'done'` → NativeVideoPlayer shows output
6. Download via `handleDownload()` (web: `<a>` download, native: `expo-sharing`)

### Development Tips

**Adding a voice command:**
1. Add matcher function (e.g. `isMyCmd(t)`) near top of `WorkspaceScreen.js`
2. Add case in `handleTranscript()` before the `sendMsg()` fallthrough
3. Optionally add chip to `VOICE_CMDS` array in `VoiceCommandPanel`

**Adding an effect:**
1. Add category to `EFFECT_CATEGORIES` in `hooks/useEffectIntent.js`
2. Add FFmpeg filter to `EFFECT_FILTERS` in backend `main.py`

**Switching backend environment:**
Change `BASE_URL` in `api.js` — `Platform.OS === 'web' ? 'http://127.0.0.1:8000' : 'http://192.168.1.6:8000'`

### Backend Structure

```
main.py              ← FastAPI app, auth middleware, major endpoints
services/
  security.py        ← Bearer token auth, job ownership, file validation
api/
  video.py           ← upload handler
  auto_edit.py       ← edit router
  merge.py           ← /merge and /trim-merge (xfade transitions, resolution scaling)
  shorts.py          ← semantic short-clip generation
  subtitles.py       ← subtitle burn-in with CAPTION_STYLE_PRESETS
  effects.py         ← FFmpeg-based visual effects
  beat_sync.py       ← librosa beat detection + FFmpeg pulse effect
  bg_remove.py       ← rembg AI / chromakey background removal
  audio_enhance.py   ← FFmpeg afftdn + loudnorm profiles
  music_bg.py        ← background music
  sfx.py             ← sound effects
```

**Required pip installs for full feature set:**
```bash
venv/Scripts/pip.exe install librosa soundfile rembg Pillow
```
