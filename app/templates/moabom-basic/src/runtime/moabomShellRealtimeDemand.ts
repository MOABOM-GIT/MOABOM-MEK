/**
 * 로그인 Realtime 세션 — 접속 중 알림·채팅 인박스 private 채널을 유지한다.
 * (상대 메시지·친구요청 실시간 수신)
 *
 * Presence 목록/join/revision 은 MoabomPresenceProvider 의 presenceSurfaceActive 가 게이트.
 * 대화(conversation) 채널은 채팅 패널 훅이 별도로 on-demand 구독.
 *
 * uuid 레이스: 토큰은 있는데 AuthManager.getUser() 가 아직 비어 있으면
 * 짧은 재시도로만 바인딩하고, 그 사이에는 구독을 끊지 않는다.
 */

import { hasShellAccessToken } from '../api/moabomShellAccess';
import { getShellAuthUserUuid } from '../utils/presenceSettingsSync';
import {
  startMoabomShellChatSyncService,
  stopMoabomShellChatSyncService,
} from './moabomShellChatSyncService';
import {
  startMoabomShellRealtimeCoordinator,
  stopMoabomShellRealtimeCoordinator,
} from './moabomShellRealtimeCoordinator';
import {
  isMoabomShellPresenceRealtimeDemanded,
  resetMoabomShellPresenceRealtimeDemandForTest,
  setMoabomShellPresenceRealtimeDemand,
} from './moabomShellRealtimePresenceDemand';

const UUID_RETRY_MS = 200;
const UUID_RETRY_MAX_ATTEMPTS = 15; // ≤3s — secondary 직후 AuthManager 하이드레이션 대기

let userUuid: string | null = null;
let uuidRetryTimer: ReturnType<typeof setTimeout> | null = null;
let uuidRetryAttempt = 0;
let sessionWanted = false;
let tokenListenerInstalled = false;

function clearUuidRetry(): void {
  if (uuidRetryTimer !== null) {
    clearTimeout(uuidRetryTimer);
    uuidRetryTimer = null;
  }
  uuidRetryAttempt = 0;
}

function reconcileMoabomShellRealtimeSession(): void {
  if (!sessionWanted || !userUuid) {
    stopMoabomShellRealtimeCoordinator();
    stopMoabomShellChatSyncService();
    return;
  }

  startMoabomShellRealtimeCoordinator(userUuid);
  startMoabomShellChatSyncService();
}

function scheduleUuidRetry(): void {
  clearUuidRetry();
  if (!sessionWanted || userUuid || !hasShellAccessToken()) {
    return;
  }
  if (uuidRetryAttempt >= UUID_RETRY_MAX_ATTEMPTS) {
    return;
  }

  uuidRetryAttempt += 1;
  uuidRetryTimer = setTimeout(() => {
    uuidRetryTimer = null;
    if (!sessionWanted) {
      return;
    }
    const next = getShellAuthUserUuid();
    if (next) {
      userUuid = next;
      uuidRetryAttempt = 0;
      reconcileMoabomShellRealtimeSession();
      return;
    }
    if (hasShellAccessToken()) {
      scheduleUuidRetry();
    }
  }, UUID_RETRY_MS);
}

/**
 * 로그인 세션 바인딩.
 * - uuid 가 오면 즉시 알림/인박스 구독 + WS 장애 catch-up 활성화
 * - 토큰만 있고 uuid 미준비면 구독을 유지(끊지 않음)하고 짧게 재시도
 * - 로그아웃/토큰 없음이면 전부 해제
 */
export function bindMoabomShellRealtimeSession(options: {
  wanted: boolean;
  uuid?: string | null;
}): void {
  sessionWanted = options.wanted;
  if (!sessionWanted) {
    clearUuidRetry();
    userUuid = null;
    reconcileMoabomShellRealtimeSession();
    return;
  }

  const next = (options.uuid?.trim() || getShellAuthUserUuid() || null);
  if (next) {
    clearUuidRetry();
    if (userUuid !== next) {
      userUuid = next;
    }
    reconcileMoabomShellRealtimeSession();
    return;
  }

  // uuid 미준비 — 기존 구독이 있으면 유지, 없으면 재시도만 (null 로 teardown 금지)
  if (!userUuid) {
    scheduleUuidRetry();
  }
}

/** @deprecated bindMoabomShellRealtimeSession 사용 */
export function setMoabomShellRealtimeUser(uuid: string | null): void {
  if (!uuid) {
    if (!hasShellAccessToken()) {
      bindMoabomShellRealtimeSession({ wanted: false });
      return;
    }
    // 토큰 잔존 + uuid null → teardown 하지 않고 재시도
    bindMoabomShellRealtimeSession({ wanted: true, uuid: null });
    return;
  }
  bindMoabomShellRealtimeSession({ wanted: true, uuid });
}

export function getMoabomShellRealtimeUserUuid(): string | null {
  return userUuid;
}

export function installMoabomShellRealtimeSessionTokenListener(): void {
  if (tokenListenerInstalled || typeof window === 'undefined') {
    return;
  }
  tokenListenerInstalled = true;
  window.addEventListener('moabom:auth-token-changed', () => {
    if (!hasShellAccessToken()) {
      bindMoabomShellRealtimeSession({ wanted: false });
      return;
    }
    if (sessionWanted) {
      bindMoabomShellRealtimeSession({ wanted: true, uuid: getShellAuthUserUuid() });
    }
  });
}

export function resetMoabomShellRealtimeDemandForTest(): void {
  clearUuidRetry();
  sessionWanted = false;
  userUuid = null;
  tokenListenerInstalled = false;
  resetMoabomShellPresenceRealtimeDemandForTest();
  stopMoabomShellRealtimeCoordinator();
  stopMoabomShellChatSyncService();
}

/** @deprecated 세션은 로그인 단위 — 호환용 */
export function setMoabomShellRealtimeDemand(
  partial: Partial<{ notifications: boolean; chat: boolean; presence: boolean }>,
): void {
  if (typeof partial.presence === 'boolean') {
    setMoabomShellPresenceRealtimeDemand(partial.presence);
  }
  if (sessionWanted) {
    reconcileMoabomShellRealtimeSession();
  }
}

/** @deprecated */
export function getMoabomShellRealtimeDemand(): {
  notifications: boolean;
  chat: boolean;
  presence: boolean;
} {
  const active = Boolean(userUuid);
  return {
    notifications: active,
    chat: active,
    presence: active && isMoabomShellPresenceRealtimeDemanded(),
  };
}
