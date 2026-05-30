import * as Speech from 'expo-speech';

export function isTTSAvailable(): boolean {
  return true;
}

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
