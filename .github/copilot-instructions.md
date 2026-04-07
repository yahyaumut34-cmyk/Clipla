---
description: "Workspace instructions for the Clipla app frontend. Use for React Native/Expo voice chat and video editing work."
applyTo:
  - "**/*"
---

# Clipla App Workspace Instructions

## Project scope

This repository is the frontend for the Clipla app, a React Native / Expo project focused on AI-powered video editing with voice-driven commands. The app is built for web and native targets, but the current workspace is the frontend app only.

The backend is separate and located at `C:/Users/musta/Desktop/clipla/proje/backend/`.

## Key commands

- `npm start` - starts the Expo development server
- `npm run web` - starts Expo in web mode
- `npm run android` - starts Expo for Android emulator
- `npm run ios` - starts Expo for iOS simulator

There is no lint or automated test framework configured in this repository.

## Important files

- `App.js` - main wizard orchestration, step navigation, top-level state
- `api.js` - backend API calls, platform-aware `BASE_URL`
- `components/StepChat.js` - voice/text chat interface, voice routing, edit confirmation
- `hooks/useMicrophone.js` - STT chain and microphone handling
- `hooks/useTTS.js` - TTS wrapper for web/native
- `hooks/useEditPolling.js` - edit status polling and subtitle auto-application
- `hooks/useEffectIntent.js` - local effect intent extraction from text
- `components/EffectPicker.js` - manual effect selection UI
- `shared/constants.js` - shared helpers like subtitle language detection and command matching
- `shared/theme.js` - color palette and `IS_WEB` constant

## Voice/chat system notes

The app uses a voice interceptor pattern in `StepChat.js`: captured speech is routed through a stable callback ref, parsed for confirmation/rejection, effect commands, shorts commands, subtitle language selection, and falls back to normal chat.

Common voice flows:
- `evet`, `tamam` → confirm edit plan
- `hayır`, `dur`, `değiştir` → reject or revise plan
- `uygula` → apply detected effect
- `shorts`, `kısa klip` → switch to shorts mode
- `altyazı <dil>` → set subtitle language

The frontend also detects effect intent locally via `useEffectIntent.js` and uses `useTTS.js` for spoken feedback.

### TTS text sanitization

`useTTS.js` strips emoji (Unicode 15.1 full range) and markdown formatting (`**`, `*`, `#`, `---`, `` ` ``, `|`) before speaking. This is critical — the AI backend is instructed not to use emoji or markdown in replies, but the client-side strip is the safety net. Do NOT remove the `stripForTTS()` call in `useTTS.js`.

### STT cascade (native)

1. `expo-speech-recognition` (on-device, no network needed)
2. `expo-av` recording → POST `/api/stt/transcribe` → Whisper (backend fallback)

`expo-speech-recognition` is declared in `app.json` plugins with `NSSpeechRecognitionUsageDescription` for iOS. The permission request happens in `useMicrophone.js` on mount.

### Two AI systems — important distinction

- **AI Chat** (`/api/chat`): Handles edit goal extraction — platform, duration, command text. Produces `edit_params` when `ready_to_edit: true`.
- **Semantic Effect Engine** (`useEffectIntent.js` + `/api/effects/:jobId`): Keyword-based local intent detection → FFmpeg filter. Runs independently of the chat edit flow.

## Backend integration

The frontend calls these backend endpoints:
- `POST /api/video/upload`
- `POST /api/chat`
- `POST /api/auto-edit/:jobId`
- `GET /api/auto-edit/:jobId/status`
- `POST /api/effects/:jobId`
- `POST /api/shorts/:jobId`
- `POST /api/subtitles/:jobId`
- `POST /api/stt/transcribe`

For local web development, `api.js` uses `http://127.0.0.1:8000`; for native devices it may use a LAN IP.

## Development conventions

- Preserve the existing Turkish-language UI style and voice command patterns.
- Keep changes small and focused, especially around `StepChat.js`, voice hooks, and edit polling.
- Prefer using existing abstractions instead of introducing unnecessary new layers.
- Avoid adding lint/test scaffolding unless explicitly requested.

## How to use these instructions

When working on tasks in this repository, follow the project conventions above and use the app's existing voice/chat architecture as the baseline. If a request involves the voice system, prioritize `StepChat.js`, `useMicrophone.js`, `useTTS.js`, `useEffectIntent.js`, and `useEditPolling.js`.
1