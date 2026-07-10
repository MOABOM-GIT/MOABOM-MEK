/**
 * create-app 셸 AI 생성·대기열 진행 여부 — 메인 번들·IIFE 공유.
 * @see window.__MoabomAiGenerationActivity (메인 `src/index.ts`에서 주입)
 */
let busy = false;
let busyOwner: symbol | null = null;
const listeners = new Set<() => void>();

function notifyBusyListeners(): void {
  listeners.forEach(listener => listener());
}

export function setAiGenerationBusy(next: boolean): void {
  if (busy === next) {
    return;
  }
  if (!next) {
    busyOwner = null;
  }
  busy = next;
  notifyBusyListeners();
}

/** 이 인스턴스가 생성 busy를 소유한다. 다른 owner의 release는 무시한다. */
export function claimAiGenerationBusy(owner: symbol): void {
  busyOwner = owner;
  if (busy) {
    return;
  }
  busy = true;
  notifyBusyListeners();
}

/** 소유자만 busy를 해제한다. */
export function releaseAiGenerationBusy(owner: symbol): void {
  if (busyOwner !== owner) {
    return;
  }
  busyOwner = null;
  if (!busy) {
    return;
  }
  busy = false;
  notifyBusyListeners();
}

export function isAiGenerationBusy(): boolean {
  return busy;
}

export function subscribeAiGenerationBusy(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
