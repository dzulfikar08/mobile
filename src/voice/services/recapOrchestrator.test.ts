import { base64ToString } from '@/lib/base64';
import { client } from '@/state/connection';

import { RecapOrchestrator } from './recapOrchestrator';

jest.mock('@/state/connection', () => ({
  client: {
    request: jest.fn().mockResolvedValue({ type: 'ok' }),
    on: jest.fn().mockReturnValue(jest.fn()),
  },
}));

jest.mock('@/state/settingsStore', () => ({
  useSettingsStore: {
    getState: jest.fn().mockReturnValue({ ttsRate: 1.0 }),
  },
}));

jest.mock('./ttsService', () => {
  return {
    TTSService: jest.fn().mockImplementation(() => ({
      speak: jest.fn().mockImplementation((_text: string, opts?: { onDone?: () => void }) => {
        if (opts?.onDone) opts.onDone();
        return Promise.resolve();
      }),
      stop: jest.fn(),
      isSpeaking: false,
      onDone: jest.fn(() => jest.fn()),
    })),
  };
});

const mockRequest = client.request as jest.MockedFunction<typeof client.request>;
const mockOn = client.on as jest.Mock;

describe('RecapOrchestrator', () => {
  let orchestrator: RecapOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    orchestrator = new RecapOrchestrator('pane-123');
  });

  afterEach(() => {
    jest.useRealTimers();
    orchestrator.cancel();
  });

  it('starts in idle state', () => {
    expect(orchestrator.state).toBe('idle');
  });

  it('sends /recap command on start', async () => {
    mockOn.mockReturnValue(jest.fn());

    await orchestrator.start();

    expect(mockRequest).toHaveBeenCalledWith('terminalInput', {
      type: 'terminalInput',
      value: { paneID: 'pane-123', bytes: expect.any(String) },
    });

    const call = mockRequest.mock.calls[0]![1]!;
    const bytes = (call as any).value.bytes;
    expect(base64ToString(bytes)).toBe('/recap\r');
  });

  it('transitions to capturing after start', async () => {
    mockOn.mockReturnValue(jest.fn());

    await orchestrator.start();

    expect(orchestrator.state).toBe('capturing');
  });

  it('emits state changes via callback', async () => {
    const states: string[] = [];
    orchestrator.onStateChange((s) => states.push(s));

    mockOn.mockReturnValue(jest.fn());

    await orchestrator.start();

    expect(states).toContain('capturing');
  });

  it('cancels and returns to idle', async () => {
    mockOn.mockReturnValue(jest.fn());

    await orchestrator.start();
    expect(orchestrator.state).toBe('capturing');

    orchestrator.cancel();
    expect(orchestrator.state).toBe('idle');
  });
});
