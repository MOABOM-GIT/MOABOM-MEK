/**
 * create-app 셸 IIFE와 메인 번들이 공유하는 편집 대상 앱 id.
 * @see window.__MoabomCreateAppEdit (메인 `src/index.ts`에서 주입)
 */
let editServerId: number | null = null;
const listeners = new Set<() => void>();

export function setCreateAppEditServerId(id: number | null | undefined): void {
  const next = id != null && id > 0 ? id : null;
  if (editServerId === next) {
    return;
  }
  editServerId = next;
  listeners.forEach(listener => listener());
}

export function getCreateAppEditServerId(): number | null {
  return editServerId;
}

export function subscribeCreateAppEditServerId(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
