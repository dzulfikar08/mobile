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
