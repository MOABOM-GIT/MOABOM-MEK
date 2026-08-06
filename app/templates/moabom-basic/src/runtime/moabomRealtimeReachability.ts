import { requestShellJson } from '../api/moabomShellHttp';

const API_BASE = '/api/modules/moabom-presence/user/realtime/challenge';

export type RealtimeReachabilityChallengePayload = {
  token?: string;
  expires_at?: string;
};

let challengeInFlight: Promise<void> | null = null;
let acknowledgedTokens = new Set<string>();

export function requestRealtimeReachabilityChallenge(): Promise<void> {
  if (challengeInFlight) {
    return challengeInFlight;
  }

  const promise = requestShellJson<{ expires_at?: string }>(
    API_BASE,
    'required',
    { method: 'POST' },
  ).then(() => undefined).catch(() => undefined).finally(() => {
    if (challengeInFlight === promise) {
      challengeInFlight = null;
    }
  });
  challengeInFlight = promise;

  return promise;
}

export async function acknowledgeRealtimeReachabilityChallenge(
  payload: RealtimeReachabilityChallengePayload,
): Promise<void> {
  const token = payload.token?.trim() ?? '';
  if (!token || acknowledgedTokens.has(token)) {
    return;
  }
  acknowledgedTokens.add(token);
  if (acknowledgedTokens.size > 20) {
    acknowledgedTokens = new Set([...acknowledgedTokens].slice(-10));
  }

  try {
    await requestShellJson<{ reachable?: boolean }>(
      `${API_BASE}/ack`,
      'required',
      {
        method: 'POST',
        body: { token },
      },
    );
  } catch {
    acknowledgedTokens.delete(token);
  }
}

export function resetRealtimeReachabilityForTest(): void {
  challengeInFlight = null;
  acknowledgedTokens.clear();
}
