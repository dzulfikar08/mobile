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
