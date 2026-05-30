# STT/TTS Voice Features for Muxy Mobile

**Date:** 2026-05-29
**Status:** Approved

## Overview

Add speech-to-text dictation and text-to-speech recap narration to Muxy Mobile, enabling hands-free terminal control via headset. The user can dictate terminal commands via STT and hear Claude Code recaps aloud via TTS.

## Architecture

```
src/
  voice/
    services/
      sttService.ts
      ttsService.ts
      recapOrchestrator.ts
    components/
      VoiceButton.tsx
    hooks/
      useSTT.ts
      useTTS.ts
      useRecap.ts
```

Three new service modules, one new UI component. No new screens or navigation changes.

### Existing code touched

- `TerminalView.tsx` — mount VoiceButton overlay
- `settingsStore.ts` — add voice settings
- `package.json` — add `expo-speech`, `@react-native-voice/voice`, `expo-av`

No changes to WebSocket transport, protocol, or state management architecture.

## STT Service — Dictation to Terminal Input

**Library:** `@react-native-voice/voice` (wraps iOS Speech / Android Google Speech)

### Flow

1. User taps VoiceButton → mic icon pulses
2. Native OS speech recognizer starts listening
3. Partial results shown in overlay near button
4. User stops speaking (or taps again) → final transcript sent as `terminalInput`
5. Newline appended so it acts like pressing Enter

### Behaviors

- Silence detection: auto-stops after ~3s (native OS)
- Manual stop: tap button to stop immediately and send
- Cancel: swipe overlay to discard without sending
- Language: defaults to device locale, configurable in settings

### Error handling

- No mic permission → prompt with explanation, graceful disable
- Recognition unavailable → toast, fall back to text input
- Network issues → native OS handles offline mode on iOS; Android may need downloaded language pack

### Interface

```
STTService
  start(locale?: string) → void
  stop() → Promise<string>
  cancel() → void
  onPartialResult(cb) → unsubscribe
  onError(cb) → unsubscribe
  isListening → boolean
```

No transcript history stored — fire-and-forget into the terminal.

## TTS Service — Speaking the Recap

**Library:** `expo-speech` (wraps iOS AVSpeechSynthesizer / Android TextToSpeech)

### Flow

1. Text passed from recap orchestrator
2. ANSI escape codes stripped via `src/lib/stripAnsi.ts`
3. Native TTS speaks cleaned text at configurable rate/pitch
4. Completion callback fires when done

### Behaviors

- Interruptible: starting STT or another recap cancels current speech immediately
- Queue: multiple recap chunks play sequentially, no overlap
- Rate: default 1.0x, configurable 0.5x–2.0x
- Language: matches device locale
- Audio session: uses `expo-av` audio session for Bluetooth headset compatibility and system audio ducking

### Interface

```
TTSService
  speak(text: string, options?: { rate?, pitch?, onDone? }) → void
  stop() → void
  isSpeaking → boolean
  onDone(cb) → unsubscribe
```

## Recap Orchestrator — The Glue

### Flow

1. User long-presses VoiceButton (or triggers via headset button)
2. Orchestrator sends `/recap\n` as `terminalInput` through existing WebSocket transport
3. Subscribes to `terminalOutput` events for the active pane only, buffers incoming chunks
4. Silence heuristic: if no new `terminalOutput` for 2 seconds after at least one chunk, considers recap complete
5. Strips ANSI from buffered output
6. Passes clean text to TTS service
7. Speaks the recap aloud

### State machine

```
idle → capturing → buffering → speaking → idle
```

- **idle:** nothing happening
- **capturing:** `/recap` sent, waiting for first output chunk
- **buffering:** receiving output chunks, waiting for silence gap
- **speaking:** TTS narrating the recap

### Edge cases

- No output within 10s → timeout, toast "No recap available", return to idle
- User sends STT during capture → cancel capture, process STT normally
- User triggers another recap while speaking → cancel current speech, start new recap
- Connection drops during capture → cancel, show error toast

### Interface

```
RecapOrchestrator
  start() → void
  cancel() → void
  state → 'idle' | 'capturing' | 'buffering' | 'speaking'
  onStateChange(cb) → unsubscribe
```

Depends on: WebSocket transport, TTSService, `stripAnsi` util.

## VoiceButton UI Component

Floating action button overlay on the terminal screen.

### Placement

Bottom-right corner, above KeyBar, with safe area padding. Position configurable left/right in settings.

### Interactions

| Action | Trigger | Behavior |
|--------|---------|----------|
| Dictate | Tap | Starts/stops STT. Mic pulses. Transcript preview above button. |
| Recap | Long-press (500ms) | Triggers recap orchestrator. Icon swaps to speaker. |

### Visual states

```
Default:     mic icon, muted color
Dictating:   mic icon, pulsing red, transcript preview above
Capturing:   receiving icon, spinning indicator
Speaking:    speaker icon, subtle wave animation
Error:       mic icon, brief red flash + toast
```

### Transcript preview

Pill-shaped overlay above button during dictation, showing partial STT results. Disappears once transcript is sent.

### Headset button integration

Uses `expo-av` audio session to detect Bluetooth headset button presses. Single press = toggle dictation, double press (within 300ms) = trigger recap. Falls back gracefully if headset doesn't support button events.

### Mounting

Inside `TerminalView.tsx` as sibling to terminal WebView, positioned absolutely.

## Settings

Added to `settingsStore.ts` under a "Voice" section in the existing settings modal.

| Setting | Type | Default | Notes |
|---------|------|---------|-------|
| `voiceEnabled` | boolean | true | Master toggle for all voice features |
| `sttLocale` | string | device locale | Language for speech recognition |
| `ttsRate` | number | 1.0 | Speech rate (0.5–2.0) |
| `voiceButtonPosition` | 'left' \| 'right' | 'right' | Floating button side |

## Permissions

- First STT use: request mic permission with clear explanation
- If denied: one-time toast explaining how to re-enable, disable STT gracefully
- TTS: no permission needed (native OS handles it)

## Error Handling

| Scenario | Handling |
|----------|----------|
| Mic permission denied | Toast + disable STT, TTS/recap still works |
| STT unavailable (no language pack) | Toast suggesting download, fall back to text input |
| TTS engine missing | Log + skip audio |
| Recap timeout (10s, no output) | Toast "No recap available", return to idle |
| WebSocket disconnect during recap | Cancel recap, existing reconnect handles connection |
| Bluetooth disconnect mid-dictation | Stop dictation, toast |

All errors surface as non-blocking toasts. Voice is an enhancement — the app works perfectly without it.
