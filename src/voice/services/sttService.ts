import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import type {
  ExpoSpeechRecognitionResultEvent,
  ExpoSpeechRecognitionErrorEvent,
} from 'expo-speech-recognition';
import type { EventSubscription } from 'expo-modules-core';

export function isSTTAvailable(): boolean {
  return Platform.OS !== 'web';
}

export type STTState = 'idle' | 'listening' | 'error';

export class STTService {
  private state: STTState = 'idle';
  private readonly partialCallbacks: Set<(text: string) => void> = new Set();
  private readonly errorCallbacks: Set<(error: string) => void> = new Set();
  private readonly resultCallbacks: Set<(text: string) => void> = new Set();
  private subscriptions: EventSubscription[] = [];

  get currentState(): STTState {
    return this.state;
  }

  private setupListeners(): void {
    const subResult = ExpoSpeechRecognitionModule.addListener(
      'result',
      (event: ExpoSpeechRecognitionResultEvent) => {
        const transcript = event.results?.[0]?.transcript;
        if (!transcript) return;
        if (event.isFinal) {
          this.resultCallbacks.forEach((cb) => cb(transcript));
        } else {
          this.partialCallbacks.forEach((cb) => cb(transcript));
        }
      }
    );

    const subError = ExpoSpeechRecognitionModule.addListener(
      'error',
      (event: ExpoSpeechRecognitionErrorEvent) => {
        const msg = event.message ?? 'Speech recognition error';
        this.state = 'error';
        this.errorCallbacks.forEach((cb) => cb(msg));
        this.state = 'idle';
      }
    );

    const subEnd = ExpoSpeechRecognitionModule.addListener('end', () => {
      this.state = 'idle';
    });

    this.subscriptions = [subResult, subError, subEnd];
  }

  async start(locale?: string): Promise<void> {
    if (this.state === 'listening') return;

    const permResult = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permResult.granted) {
      throw new Error('Microphone permission not granted');
    }

    this.setupListeners();

    await ExpoSpeechRecognitionModule.start({
      lang: locale || 'en-US',
      interimResults: true,
      continuous: false,
      addsPunctuation: true,
    });
    this.state = 'listening';
  }

  async stop(): Promise<string> {
    if (this.state !== 'listening') return '';
    this.state = 'idle';

    return new Promise<string>((resolve) => {
      let resolved = false;

      const stopSub = ExpoSpeechRecognitionModule.addListener(
        'result',
        (event: ExpoSpeechRecognitionResultEvent) => {
          if (resolved) return;
          if (event.isFinal) {
            resolved = true;
            stopSub.remove();
            resolve(event.results?.[0]?.transcript ?? '');
          }
        }
      );

      ExpoSpeechRecognitionModule.stop();

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          stopSub.remove();
          resolve('');
        }
      }, 1000);
    }).finally(() => {
      this.teardownListeners();
    });
  }

  async cancel(): Promise<void> {
    if (this.state !== 'listening') return;
    this.state = 'idle';
    ExpoSpeechRecognitionModule.abort();
    this.teardownListeners();
  }

  onPartialResult(cb: (text: string) => void): () => void {
    this.partialCallbacks.add(cb);
    return () => {
      this.partialCallbacks.delete(cb);
    };
  }

  onResult(cb: (text: string) => void): () => void {
    this.resultCallbacks.add(cb);
    return () => {
      this.resultCallbacks.delete(cb);
    };
  }

  onError(cb: (error: string) => void): () => void {
    this.errorCallbacks.add(cb);
    return () => {
      this.errorCallbacks.delete(cb);
    };
  }

  destroy(): void {
    this.teardownListeners();
    this.state = 'idle';
    this.partialCallbacks.clear();
    this.errorCallbacks.clear();
    this.resultCallbacks.clear();
  }

  private teardownListeners(): void {
    this.subscriptions.forEach((sub) => sub.remove());
    this.subscriptions = [];
  }
}
