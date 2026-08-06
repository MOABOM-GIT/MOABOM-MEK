import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestShellJson } = vi.hoisted(() => ({
  requestShellJson: vi.fn(),
}));

vi.mock('../api/moabomShellHttp', () => ({
  requestShellJson,
}));

import {
  acknowledgeRealtimeReachabilityChallenge,
  requestRealtimeReachabilityChallenge,
  resetRealtimeReachabilityForTest,
} from './moabomRealtimeReachability';

describe('moabomRealtimeReachability', () => {
  beforeEach(() => {
    requestShellJson.mockReset();
    requestShellJson.mockResolvedValue({});
    resetRealtimeReachabilityForTest();
  });

  it('동시 challenge 요청을 하나로 합친다', async () => {
    await Promise.all([
      requestRealtimeReachabilityChallenge(),
      requestRealtimeReachabilityChallenge(),
    ]);

    expect(requestShellJson).toHaveBeenCalledTimes(1);
    expect(requestShellJson).toHaveBeenCalledWith(
      '/api/modules/moabom-presence/user/realtime/challenge',
      'required',
      { method: 'POST' },
    );
  });

  it('같은 challenge token을 한 번만 ACK한다', async () => {
    await acknowledgeRealtimeReachabilityChallenge({ token: 'token-1' });
    await acknowledgeRealtimeReachabilityChallenge({ token: 'token-1' });

    expect(requestShellJson).toHaveBeenCalledTimes(1);
    expect(requestShellJson).toHaveBeenCalledWith(
      '/api/modules/moabom-presence/user/realtime/challenge/ack',
      'required',
      {
        method: 'POST',
        body: { token: 'token-1' },
      },
    );
  });
});
