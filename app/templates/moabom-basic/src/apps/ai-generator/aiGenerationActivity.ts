/**
 * create-app 셸 AI 생성·대기열 진행 여부 — 메인 번들·IIFE 공유.
 * @see window.__MoabomAiGenerationActivity (메인 `src/index.ts`에서 주입)
 */
let busy = false;
const listeners = new Set<() => void>();

export function setAiGenerationBusy(next: boolean): void {
  if (busy === next) {
    return;
  }
  busy = next;
  listeners.forEach(listener => listener());
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
