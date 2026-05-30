# STT/TTS Voice Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add speech-to-text dictation and text-to-speech recap narration to Muxy Mobile for hands-free terminal control via headset.

**Architecture:** Three isolated service modules (STT, TTS, RecapOrchestrator) wrapped by React hooks, surfaced through a single floating VoiceButton component on the terminal screen. Native OS engines for both STT and TTS — no cloud APIs needed.

**Tech Stack:** `@react-native-voice/voice` (STT), `expo-speech` (TTS), `expo-av` (audio session), `expo-location` (already available), Zustand (existing state).

**Spec:** `docs/superpowers/specs/2026-05-29-stt-tts-voice-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `src/lib/stripAnsi.ts` | Regex-based ANSI escape code stripping |
| `src/lib/stripAnsi.test.ts` | Tests for stripAnsi |
| `src/voice/services/sttService.ts` | Native OS speech recognition wrapper |
| `src/voice/services/ttsService.ts` | expo-speech TTS wrapper |
| `src/voice/services/recapOrchestrator.ts` | Sends /recap, captures output, triggers TTS |
| `src/voice/services/recapOrchestrator.test.ts` | Tests for recap orchestrator |
| `src/voice/hooks/useSTT.ts` | React hook binding STTService to component lifecycle |
| `src/voice/hooks/useTTS.ts` | React hook binding TTSService to component lifecycle |
| `src/voice/hooks/useRecap.ts` | React hook binding RecapOrchestrator to component lifecycle |
| `src/voice/components/VoiceButton.tsx` | Floating action button (tap=dictate, long-press=recap) |

### Modified files

| File | Change |
|------|--------|
| `package.json` | Add expo-speech, @react-native-voice/voice, expo-av |
| `src/state/settingsStore.ts` | Add voiceEnabled, sttLocale, ttsRate, voiceButtonPosition |
| `src/state/index.ts` | Re-export new voice settings |
| `src/components/terminal/TerminalView.tsx` | Mount VoiceButton overlay |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
npx expo install expo-speech expo-av
```

- [ ] **Step 2: Install voice recognition package**

```bash
npm install @react-native-voice/voice
```

- [ ] **Step 3: Verify installation**

```bash
npx expo-doctor
```

Expected: No dependency issues.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add voice dependencies (expo-speech, expo-av, react-native-voice)"
```

---

## Task 2: stripAnsi Utility

**Files:**
- Create: `src/lib/stripAnsi.ts`
- Create: `src/lib/stripAnsi.test.ts`

- [ ] **Step 1: Write tests for stripAnsi**

```typescript
import { stripAnsi } from './stripAnsi';

describe('stripAnsi', () => {
  it('returns plain text unchanged', () => {
    expect(stripAnsi('hello world')).toBe('hello world');
  });

  it('removes CSI escape sequences', () => {
    expect(stripAnsi('\x1b[31mred text\x1b[0m')).toBe('red text');
  });

  it('removes multiple CSI sequences', () => {
    expect(stripAnsi('\x1b[1;32;40mbold green\x1b[0m normal')).toBe('bold green normal');
  });

  it('removes OSC sequences (window title)', () => {
    expect(stripAnsi('\x1b]0;window title\x07remaining')).toBe('remaining');
  });

  it('removes OSC sequences with BEL terminator variant', () => {
    expect(stripAnsi('\x1b]2;title\x1b\\text')).toBe('text');
  });

  it('handles empty string', () => {
    expect(stripAnsi('')).toBe('');
  });

  it('removes cursor movement sequences', () => {
    expect(stripAnsi('\x1b[2J\x1b[Hcleared')).toBe('cleared');
  });

  it('removes SGR sequences (color/bold/underline)', () => {
    const input = '\x1b[38;5;196mcolored\x1b[0m \x1b[4munderlined\x1b[24m';
    expect(stripAnsi(input)).toBe('colored underlined');
  });

  it('preserves newlines and tabs', () => {
    expect(stripAnsi('line1\n\tline2')).toBe('line1\n\tline2');
  });

  it('removes bare ESC sequences', () => {
    expect(stripAnsi('\x1b[?25htext')).toBe('text');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/lib/stripAnsi.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement stripAnsi**

```typescript
const ANSI_PATTERN = /[][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><@]|\].*?(?:|\\)/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/lib/stripAnsi.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stripAnsi.ts src/lib/stripAnsi.test.ts
git commit -m "feat: add stripAnsi utility for terminal output cleaning"
```

---

## Task 3: Voice Settings in SettingsStore

**Files:**
- Modify: `src/state/settingsStore.ts`
- Modify: `src/state/index.ts`

- [ ] **Step 1: Add voice settings to the store state type and initial values**

In `src/state/settingsStore.ts`, update the `State` type to include:

```typescript
type State = {
  hasHydrated: boolean;
  hasOnboarded: boolean;
  useNerdFont: boolean;
  autoFocusTerminal: boolean;
  demoMode: boolean;
  voiceEnabled: boolean;
  sttLocale: string;
  ttsRate: number;
  voiceButtonPosition: 'left' | 'right';
};
```

Update the `Actions` type to include:

```typescript
type Actions = {
  setHasHydrated: (value: boolean) => void;
  setOnboarded: (value: boolean) => void;
  setUseNerdFont: (value: boolean) => void;
  setAutoFocusTerminal: (value: boolean) => void;
  setDemoMode: (value: boolean) => void;
  setVoiceEnabled: (value: boolean) => void;
  setSttLocale: (value: string) => void;
  setTtsRate: (value: number) => void;
  setVoiceButtonPosition: (value: 'left' | 'right') => void;
};
```

Add initial values and actions inside the `persist` callback:

```typescript
voiceEnabled: true,
sttLocale: '',
ttsRate: 1.0,
voiceButtonPosition: 'right',
setVoiceEnabled: (value) => set({ voiceEnabled: value }),
setSttLocale: (value) => set({ sttLocale: value }),
setTtsRate: (value) => set({ ttsRate: value }),
setVoiceButtonPosition: (value) => set({ voiceButtonPosition: value }),
```

Add `voiceEnabled`, `sttLocale`, `ttsRate`, and `voiceButtonPosition` to the `partialize` function so they persist.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/state/settingsStore.ts
git commit -m "feat: add voice settings to settings store"
```

---

## Task 4: TTS Service

**Files:**
- Create: `src/voice/services/ttsService.ts`

- [ ] **Step 1: Implement TTSService**

```typescript
import * as Speech from 'expo-speech';

export type TTSOptions = {
  rate?: number;
  pitch?: number;
  onDone?: () => void;
};

export class TTSService {
  private speaking = false;
  private readonly doneCallbacks: Set<() => void> = new Set();

  get isSpeaking(): boolean {
    return this.speaking;
  }

  async speak(text: string, options?: TTSOptions): Promise<void> {
    this.stop();
    this.speaking = true;

    await Speech.speak(text, {
      rate: options?.rate ?? 1.0,
      pitch: options?.pitch ?? 1.0,
      onDone: () => {
        this.speaking = false;
        this.doneCallbacks.forEach((cb) => cb());
        if (options?.onDone) options.onDone();
      },
      onStopped: () => {
        this.speaking = false;
      },
    });
  }

  stop(): void {
    if (!this.speaking) return;
    Speech.stop();
    this.speaking = false;
  }

  onDone(cb: () => void): () => void {
    this.doneCallbacks.add(cb);
    return () => {
      this.doneCallbacks.delete(cb);
    };
  }
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS (expo-speech types resolved).

- [ ] **Step 3: Commit**

```bash
git add src/voice/services/ttsService.ts
git commit -m "feat: add TTS service wrapping expo-speech"
```

---

## Task 5: STT Service

**Files:**
- Create: `src/voice/services/sttService.ts`

- [ ] **Step 1: Implement STTService**

```typescript
import Voice, {
  type SpeechResultsEvent,
  type SpeechErrorEvent,
} from '@react-native-voice/voice';

export type STTState = 'idle' | 'listening' | 'error';

export class STTService {
  private state: STTState = 'idle';
  private readonly partialCallbacks: Set<(text: string) => void> = new Set();
  private readonly errorCallbacks: Set<(error: string) => void> = new Set();
  private initialized = false;

  get currentState(): STTState {
    return this.state;
  }

  private ensureInit(): void {
    if (this.initialized) return;
    this.initialized = true;

    Voice.onSpeechPartialResults = (event: SpeechResultsEvent) => {
      if (event.value && event.value.length > 0) {
        this.partialCallbacks.forEach((cb) => cb(event.value![0]!));
      }
    };

    Voice.onSpeechError = (event: SpeechErrorEvent) => {
      const msg = event.error?.message ?? 'Speech recognition error';
      this.state = 'error';
      this.errorCallbacks.forEach((cb) => cb(msg));
      this.state = 'idle';
    };
  }

  async start(locale?: string): Promise<void> {
    this.ensureInit();
    if (this.state === 'listening') return;

    const locales = await Voice.getSpeechRecognitionServices();
    if (!locales || locales.length === 0) {
      throw new Error('Speech recognition is not available on this device');
    }

    await Voice.start(locale || 'en-US');
    this.state = 'listening';
  }

  async stop(): Promise<string> {
    if (this.state !== 'listening') return '';
    this.state = 'idle';

    await Voice.stop();

    const results = await Voice.getAllSpeechEvents();
    const lastResult = results?.speechResults?.[results.speechResults.length - 1];
    return lastResult?.value?.[0] ?? '';
  }

  async cancel(): Promise<void> {
    if (this.state !== 'listening') return;
    this.state = 'idle';
    await Voice.cancel();
  }

  onPartialResult(cb: (text: string) => void): () => void {
    this.partialCallbacks.add(cb);
    return () => {
      this.partialCallbacks.delete(cb);
    };
  }

  onError(cb: (error: string) => void): () => void {
    this.errorCallbacks.add(cb);
    return () => {
      this.errorCallbacks.delete(cb);
    };
  }

  destroy(): void {
    Voice.destroy().then(() => {
      Voice.removeAllListeners();
    });
    this.state = 'idle';
    this.partialCallbacks.clear();
    this.errorCallbacks.clear();
    this.initialized = false;
  }
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/voice/services/sttService.ts
git commit -m "feat: add STT service wrapping react-native-voice"
```

---

## Task 6: Recap Orchestrator

**Files:**
- Create: `src/voice/services/recapOrchestrator.ts`
- Create: `src/voice/services/recapOrchestrator.test.ts`

- [ ] **Step 1: Write tests for recap orchestrator**

The orchestrator depends on `client` (WSClient) for sending input and receiving output, and `TTSService` for speaking. We mock both.

```typescript
import { RecapOrchestrator } from './recapOrchestrator';
import { stripAnsi } from '@/lib/stripAnsi';

jest.mock('@/state/connection', () => ({
  client: {
    request: jest.fn(),
    on: jest.fn(() => jest.fn()),
  },
}));

jest.mock('./ttsService', () => {
  return {
    TTSService: jest.fn().mockImplementation(() => ({
      speak: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn(),
      isSpeaking: false,
      onDone: jest.fn(() => jest.fn()),
    })),
  };
});

import { client } from '@/state/connection';

const mockRequest = client.request as jest.MockedFunction<typeof client.request>;
const mockOn = client.on as jest.Mock;

describe('RecapOrchestrator', () => {
  let orchestrator: RecapOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator = new RecapOrchestrator('pane-123');
  });

  afterEach(() => {
    orchestrator.cancel();
  });

  it('starts in idle state', () => {
    expect(orchestrator.state).toBe('idle');
  });

  it('sends /recap command on start', async () => {
    mockRequest.mockResolvedValue({ type: 'ok' });
    mockOn.mockReturnValue(jest.fn());

    await orchestrator.start();

    expect(mockRequest).toHaveBeenCalledWith('terminalInput', {
      type: 'terminalInput',
      value: { paneID: 'pane-123', bytes: expect.any(String) },
    });
  });

  it('transitions to capturing after start', async () => {
    mockRequest.mockResolvedValue({ type: 'ok' });
    mockOn.mockReturnValue(jest.fn());

    await orchestrator.start();

    expect(orchestrator.state).toBe('capturing');
  });

  it('emits state changes via callback', async () => {
    const states: string[] = [];
    orchestrator.onStateChange((s) => states.push(s));

    mockRequest.mockResolvedValue({ type: 'ok' });
    mockOn.mockReturnValue(jest.fn());

    await orchestrator.start();

    expect(states).toContain('capturing');
  });

  it('cancels and returns to idle', async () => {
    mockRequest.mockResolvedValue({ type: 'ok' });
    mockOn.mockReturnValue(jest.fn());

    await orchestrator.start();
    orchestrator.cancel();

    expect(orchestrator.state).toBe('idle');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/voice/services/recapOrchestrator.test.ts --no-coverage
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement RecapOrchestrator**

```typescript
import { client } from '@/state/connection';
import { base64ToString, stringToBase64 } from '@/lib/base64';
import { stripAnsi } from '@/lib/stripAnsi';
import { TTSService } from './ttsService';

export type RecapState = 'idle' | 'capturing' | 'buffering' | 'speaking';

const SILENCE_TIMEOUT_MS = 2000;
const CAPTURE_TIMEOUT_MS = 10000;

export class RecapOrchestrator {
  private paneId: string;
  private tts: TTSService;
  private currentState: RecapState = 'idle';
  private readonly stateCallbacks: Set<(state: RecapState) => void> = new Set();
  private buffer: string[] = [];
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private captureTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubOutput: (() => void) | null = null;
  private receivedFirst = false;

  constructor(paneId: string) {
    this.paneId = paneId;
    this.tts = new TTSService();
  }

  get state(): RecapState {
    return this.currentState;
  }

  private setState(next: RecapState): void {
    if (this.currentState === next) return;
    this.currentState = next;
    this.stateCallbacks.forEach((cb) => cb(next));
  }

  async start(): Promise<void> {
    this.cancel();
    this.buffer = [];
    this.receivedFirst = false;
    this.setState('capturing');

    const recapBase64 = stringToBase64('/recap\n');
    await client.request('terminalInput', {
      type: 'terminalInput',
      value: { paneID: this.paneId, bytes: recapBase64 },
    });

    this.unsubOutput = client.on('terminalOutput', (event) => {
      if (event.value.paneID !== this.paneId) return;
      this.handleOutput(event.value.bytes);
    });

    this.captureTimer = setTimeout(() => {
      if (!this.receivedFirst) {
        this.cancel();
      }
    }, CAPTURE_TIMEOUT_MS);
  }

  cancel(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.captureTimer) {
      clearTimeout(this.captureTimer);
      this.captureTimer = null;
    }
    if (this.unsubOutput) {
      this.unsubOutput();
      this.unsubOutput = null;
    }
    this.tts.stop();
    this.buffer = [];
    this.receivedFirst = false;
    this.setState('idle');
  }

  onStateChange(cb: (state: RecapState) => void): () => void {
    this.stateCallbacks.add(cb);
    return () => {
      this.stateCallbacks.delete(cb);
    };
  }

  private handleOutput(base64Bytes: string): void {
    if (this.currentState === 'idle') return;

    if (!this.receivedFirst) {
      this.receivedFirst = true;
      if (this.captureTimer) {
        clearTimeout(this.captureTimer);
        this.captureTimer = null;
      }
    }

    this.setState('buffering');
    const text = base64ToString(base64Bytes);
    this.buffer.push(text);

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }
    this.silenceTimer = setTimeout(() => {
      this.finalize();
    }, SILENCE_TIMEOUT_MS);
  }

  private async finalize(): Promise<void> {
    if (this.unsubOutput) {
      this.unsubOutput();
      this.unsubOutput = null;
    }

    const raw = this.buffer.join('');
    const cleaned = stripAnsi(raw).trim();

    if (!cleaned) {
      this.setState('idle');
      return;
    }

    this.setState('speaking');
    this.buffer = [];

    await this.tts.speak(cleaned, {
      onDone: () => {
        this.setState('idle');
      },
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/voice/services/recapOrchestrator.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/voice/services/recapOrchestrator.ts src/voice/services/recapOrchestrator.test.ts
git commit -m "feat: add recap orchestrator for /recap capture and TTS"
```

---

## Task 7: React Hooks

**Files:**
- Create: `src/voice/hooks/useSTT.ts`
- Create: `src/voice/hooks/useTTS.ts`
- Create: `src/voice/hooks/useRecap.ts`

- [ ] **Step 1: Implement useSTT hook**

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';

import { STTService, type STTState } from '../services/sttService';

export type UseSTTResult = {
  state: STTState;
  partialText: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<string>;
  cancel: () => Promise<void>;
};

export function useSTT(locale?: string): UseSTTResult {
  const serviceRef = useRef<STTService | null>(null);
  const [state, setState] = useState<STTState>('idle');
  const [partialText, setPartialText] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const service = new STTService();
    serviceRef.current = service;

    const unsubPartial = service.onPartialResult((text) => {
      setPartialText(text);
    });

    const unsubError = service.onError((msg) => {
      setError(msg);
    });

    return () => {
      unsubPartial();
      unsubError();
      service.destroy();
      serviceRef.current = null;
    };
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setPartialText('');
    setState('listening');
    try {
      await serviceRef.current?.start(locale);
    } catch (err) {
      setState('idle');
      setError(err instanceof Error ? err.message : 'Failed to start speech recognition');
    }
  }, [locale]);

  const stop = useCallback(async () => {
    const result = await serviceRef.current?.stop() ?? '';
    setState('idle');
    setPartialText('');
    return result;
  }, []);

  const cancel = useCallback(async () => {
    await serviceRef.current?.cancel();
    setState('idle');
    setPartialText('');
  }, []);

  return { state, partialText, error, start, stop, cancel };
}
```

- [ ] **Step 2: Implement useTTS hook**

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';

import { TTSService } from '../services/ttsService';

export type UseTTSResult = {
  isSpeaking: boolean;
  speak: (text: string, rate?: number) => Promise<void>;
  stop: () => void;
};

export function useTTS(rate?: number): UseTTSResult {
  const serviceRef = useRef<TTSService | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const service = new TTSService();
    serviceRef.current = service;

    const unsub = service.onDone(() => {
      setIsSpeaking(false);
    });

    return () => {
      unsub();
      service.stop();
      serviceRef.current = null;
    };
  }, []);

  const speak = useCallback(
    async (text: string, overrideRate?: number) => {
      setIsSpeaking(true);
      await serviceRef.current?.speak(text, {
        rate: overrideRate ?? rate ?? 1.0,
      });
    },
    [rate],
  );

  const stop = useCallback(() => {
    serviceRef.current?.stop();
    setIsSpeaking(false);
  }, []);

  return { isSpeaking, speak, stop };
}
```

- [ ] **Step 3: Implement useRecap hook**

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';

import { RecapOrchestrator, type RecapState } from '../services/recapOrchestrator';

export type UseRecapResult = {
  state: RecapState;
  start: () => Promise<void>;
  cancel: () => void;
};

export function useRecap(paneId: string | undefined): UseRecapResult {
  const orchestratorRef = useRef<RecapOrchestrator | null>(null);
  const [state, setState] = useState<RecapState>('idle');

  useEffect(() => {
    if (!paneId) {
      orchestratorRef.current?.cancel();
      orchestratorRef.current = null;
      setState('idle');
      return;
    }

    const orchestrator = new RecapOrchestrator(paneId);
    orchestratorRef.current = orchestrator;

    const unsub = orchestrator.onStateChange((s) => {
      setState(s);
    });

    return () => {
      unsub();
      orchestrator.cancel();
      orchestratorRef.current = null;
    };
  }, [paneId]);

  const start = useCallback(async () => {
    if (!orchestratorRef.current) return;
    await orchestratorRef.current.start();
  }, []);

  const cancel = useCallback(() => {
    orchestratorRef.current?.cancel();
  }, []);

  return { state, start, cancel };
}
```

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/voice/hooks/useSTT.ts src/voice/hooks/useTTS.ts src/voice/hooks/useRecap.ts
git commit -m "feat: add React hooks for STT, TTS, and recap voice features"
```

---

## Task 8: VoiceButton Component

**Files:**
- Create: `src/voice/components/VoiceButton.tsx`

This is the floating action button. Tap = dictate, long-press = recap.

**Key design details:**
- Positioned absolutely at bottom-right (or left per settings), above KeyBar
- Uses `@expo/vector-icons` MaterialCommunityIcons (already in project)
- Animated pulse effect when listening (react-native-reanimated, already in project)
- Pill-shaped transcript preview during dictation

- [ ] **Step 1: Implement VoiceButton**

```typescript
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useSettingsStore } from '@/state';
import { useTokens } from '@/theme';
import { stringToBase64 } from '@/lib/base64';
import { sendTerminalInput } from '@/state';
import { useSTT } from '../hooks/useSTT';
import { useRecap, type RecapState } from '../hooks/useRecap';

type Props = {
  paneId: string;
};

const LONG_PRESS_MS = 500;

const ICON_MAP: Record<string, string> = {
  idle: 'microphone',
  listening: 'microphone',
  capturing: 'download',
  buffering: 'download',
  speaking: 'volume-high',
};

export function VoiceButton({ paneId }: Props) {
  const tokens = useTokens();
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const voiceButtonPosition = useSettingsStore((s) => s.voiceButtonPosition);
  const sttLocale = useSettingsStore((s) => s.sttLocale);

  const { state: sttState, partialText, error: sttError, start: startSTT, stop: stopSTT } = useSTT(sttLocale || undefined);
  const { state: recapState, start: startRecap, cancel: cancelRecap } = useRecap(paneId);

  const isActive = sttState === 'listening' || recapState !== 'idle';

  const pulseScale = useSharedValue(1);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const startPulse = useCallback(() => {
    pulseScale.value = withRepeat(
      withSequence(withTiming(1.15, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1,
      false,
    );
  }, []);

  const stopPulse = useCallback(() => {
    pulseScale.value = withTiming(1, { duration: 200 });
  }, []);

  const handlePress = useCallback(async () => {
    if (recapState !== 'idle') {
      cancelRecap();
      return;
    }
    if (sttState === 'listening') {
      const transcript = await stopSTT();
      if (transcript) {
        const base64 = stringToBase64(transcript + '\n');
        sendTerminalInput(paneId, base64);
      }
      stopPulse();
      return;
    }
    startPulse();
    await startSTT();
  }, [sttState, recapState, paneId, startSTT, stopSTT, cancelRecap, startPulse, stopPulse]);

  const handleLongPress = useCallback(async () => {
    if (sttState === 'listening') {
      await stopSTT();
      stopPulse();
    }
    await startRecap();
  }, [sttState, stopSTT, startRecap, stopPulse]);

  if (!voiceEnabled) return null;

  const iconName = ICON_MAP[recapState !== 'idle' ? recapState : sttState] ?? 'microphone';

  const bgColor = isActive
    ? tokens.status.danger
    : tokens.surface.tertiary;

  const iconColor = isActive
    ? '#FFFFFF'
    : tokens.text.muted;

  const positionStyle = voiceButtonPosition === 'left'
    ? { left: 16 }
    : { right: 16 };

  return (
    <View style={[styles.container, positionStyle]} pointerEvents="box-none">
      {sttState === 'listening' && partialText ? (
        <View style={[styles.preview, { backgroundColor: tokens.surface.tertiary }]}>
          <Text style={[styles.previewText, { color: tokens.text.secondary }]} numberOfLines={2}>
            {partialText}
          </Text>
        </View>
      ) : null}

      {sttError ? (
        <View style={[styles.preview, { backgroundColor: tokens.surface.tertiary }]}>
          <Text style={[styles.previewText, { color: tokens.status.danger }]} numberOfLines={2}>
            {sttError}
          </Text>
        </View>
      ) : null}

      <Animated.View style={pulseStyle}>
        <Pressable
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={LONG_PRESS_MS}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: bgColor, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <MaterialCommunityIcons name={iconName as any} size={22} color={iconColor} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  preview: {
    maxWidth: 200,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  previewText: {
    fontSize: 12,
  },
});
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/voice/components/VoiceButton.tsx
git commit -m "feat: add VoiceButton floating action component"
```

---

## Task 9: Integrate VoiceButton into TerminalView

**Files:**
- Modify: `src/components/terminal/TerminalView.tsx`

- [ ] **Step 1: Add VoiceButton import and render in TerminalView**

Add import at top of `TerminalView.tsx`:

```typescript
import { VoiceButton } from '@/voice/components/VoiceButton';
```

Add VoiceButton inside the JSX, right before the closing `</Animated.View>` of the slider (after the KeyBar conditional, before `</Animated.View>`). It needs to be inside the `Animated.View` with `slideStyle` but as a sibling to the `terminalArea` View:

```tsx
{sessionForUs?.kind === 'streaming' ? (
  <KeyBar onBytes={handleKeyBarBytes} />
) : null}
<VoiceButton paneId={paneId} />
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/terminal/TerminalView.tsx
git commit -m "feat: mount VoiceButton on terminal screen"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run full typecheck**

```bash
npm run typecheck
```

Expected: PASS — zero errors.

- [ ] **Step 2: Run full test suite**

```bash
npm run test -- --no-coverage
```

Expected: All tests PASS (existing + new stripAnsi and recapOrchestrator tests).

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: PASS — zero errors.

- [ ] **Step 4: Final commit with any lint fixes**

```bash
git add -A
git commit -m "chore: lint and typecheck fixes for voice feature"
```
