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
