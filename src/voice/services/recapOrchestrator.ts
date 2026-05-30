import { client } from '@/state/connection';
import { base64ToString, stringToBase64 } from '@/lib/base64';
import { stripAnsi } from '@/lib/stripAnsi';
import { useSettingsStore } from '@/state/settingsStore';
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

    this.unsubOutput = client.on('terminalOutput', (event) => {
      if (event.value.paneID !== this.paneId) return;
      this.handleOutput(event.value.bytes);
    });

    const recapBase64 = stringToBase64('/recap\r');
    client
      .request('terminalInput', {
        type: 'terminalInput',
        value: { paneID: this.paneId, bytes: recapBase64 },
      })
      .catch(() => {});

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
    this.silenceTimer = null;

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

    try {
      const rate = useSettingsStore.getState().ttsRate;
      await this.tts.speak(cleaned, {
        rate,
        onDone: () => {
          this.setState('idle');
        },
      });
    } catch {
      this.setState('idle');
    }
  }
}
