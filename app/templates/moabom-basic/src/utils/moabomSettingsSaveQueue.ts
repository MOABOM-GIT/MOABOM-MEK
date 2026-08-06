import type { MoabomSystemState } from '../types/moabomSystem';
import { saveMoabomSystemSettings } from '../api/moabomSystemApi';
import { getShellAccessScopeKey } from '../api/moabomShellAccess';

/**
 * 사용자 시스템 설정(`/api/modules/moabom-system/user/settings`) 저장 요청을 **직렬화**한다.
 *
 * 문제 배경: 마이페이지 환경설정에서 테마를 빠르게 연속 전환하면
 *   1. 네트워크 응답 순서가 뒤집혀(B 요청이 C 요청보다 늦게 도착) 서버에 이전 선택이 최종 저장될 수 있다.
 *   2. 저장 요청이 날아가는 동안 주기적 pull(`pullMoabomServerState`)이 서버 구버전 스냅샷을
 *      로컬로 덮어써 사용자가 방금 선택한 값이 화면에서 순간적으로 되돌아갔다가 다시 바뀐다.
 *
 * 해결: 마지막으로 확정된 `MoabomSystemState`만 서버에 전송하고, 이전에 예약된 요청은 폐기한다.
 *  - 큐에 **항상 가장 최근 상태 1개**만 유지한다.
 *  - 진행 중 PUT이 끝나면 마지막 상태로 한 번 더 PUT 한다 (중간 상태는 건너뜀).
 *  - `isSavingSettings()`와 `getLastSaveRequestAt()`으로 pull 측이 저장 중/직후 여부를 판단한다.
 */

let inflight: Promise<void> | null = null;
let pendingState: { state: MoabomSystemState; accessScopeKey: string } | null = null;
let lastRequestAt = 0;
let lastResolveAt = 0;
let settingsAccessScopeKey = 'guest';

/** 저장 요청이 마지막으로 발사된 시각(epoch ms) — pull 측이 저장 직후 덮어쓰기 방지에 사용 */
export function getLastSaveRequestAt(): number {
  return settingsAccessScopeKey === getShellAccessScopeKey() ? lastRequestAt : 0;
}

/** 저장 응답이 마지막으로 도착한 시각(epoch ms) */
export function getLastSaveResolveAt(): number {
  return settingsAccessScopeKey === getShellAccessScopeKey() ? lastResolveAt : 0;
}

/** 현재 저장 요청이 서버에서 응답 대기 중인지 여부 */
export function isSavingSettings(): boolean {
  return settingsAccessScopeKey === getShellAccessScopeKey() && inflight !== null;
}

/**
 * 저장 직후 **쿨다운 구간**(기본 600ms)에 있는지 여부.
 *
 * 저장 응답이 서버에 반영되기 전에 같은 탭/다른 훅의 `pullMoabomServerState`가
 * 구버전 settings를 그대로 돌려주면 로컬이 다시 뒤로 밀릴 수 있다.
 * 이 구간 안에서는 pull 측이 서버 `settings`를 로컬 appearance·preferences에 적용하지 않는다.
 *
 * @param windowMs 저장 응답 도착 후 쿨다운을 유지할 밀리초 (기본 600)
 */
export function isRecentlySavedSettings(windowMs = 600): boolean {
  if (settingsAccessScopeKey !== getShellAccessScopeKey()) {
    return false;
  }
  if (inflight !== null) {
    return true;
  }
  if (lastResolveAt === 0) {
    return false;
  }
  return Date.now() - lastResolveAt < windowMs;
}

async function drainQueue(): Promise<void> {
  while (pendingState !== null) {
    const next = pendingState;
    pendingState = null;
    if (next.accessScopeKey !== getShellAccessScopeKey()) {
      continue;
    }
    settingsAccessScopeKey = next.accessScopeKey;
    lastRequestAt = Date.now();
    try {
      await saveMoabomSystemSettings(next.state);
    } catch {
      /* 저장 실패는 조용히 스킵 (UI는 이미 낙관적으로 반영됨) */
    } finally {
      lastResolveAt = Date.now();
    }
  }
}

/**
 * 마지막으로 확정된 상태만 서버에 저장한다.
 *
 * 호출 패턴:
 *   queueSaveMoabomSystemSettings(stateA);   // PUT A 시작
 *   queueSaveMoabomSystemSettings(stateB);   // A 진행 중 → B를 pending 으로 교체
 *   queueSaveMoabomSystemSettings(stateC);   // A 진행 중 → pending 을 C로 덮어씀
 *   // A 완료 → pending(=C)을 PUT 으로 보냄 (B는 건너뜀)
 *
 * 반환값: 현재 호출이 관찰한 "마지막 flush"가 끝날 때 resolve 되는 Promise.
 */
export function queueSaveMoabomSystemSettings(state: MoabomSystemState): Promise<void> {
  const accessScopeKey = getShellAccessScopeKey();
  settingsAccessScopeKey = accessScopeKey;
  pendingState = { state, accessScopeKey };

  if (inflight) {
    return inflight;
  }

  inflight = drainQueue()
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** 테스트 전용: 큐 내부 상태 초기화 */
export function __resetMoabomSettingsSaveQueueForTest(): void {
  inflight = null;
  pendingState = null;
  lastRequestAt = 0;
  lastResolveAt = 0;
  settingsAccessScopeKey = 'guest';
}
