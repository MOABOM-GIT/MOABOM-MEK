import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  enqueueMoabomAdminToast,
  confirmViaMoabomAdminToast,
  pushMoabomAdminToast,
  resetMoabomAdminToastEnqueueForTest,
} from '../moabomAdminToast';

type ToastRecord = { id: string; type: string; message: string; actions?: unknown[]; duration?: number };

/** state.update 로 전달된 업데이터를 실행해 누적된 toasts 배열을 추적한다. */
function trackToasts(): { current: ToastRecord[] } {
  const tracker = { current: [] as ToastRecord[] };
  (window as any).G7Core.state.update = vi.fn((fn: (prev: Record<string, unknown>) => Record<string, unknown>) => {
    const next = fn({ toasts: tracker.current });
    tracker.current = (next.toasts as ToastRecord[]) ?? tracker.current;
  });
  return tracker;
}

describe('moabomAdminToast', () => {
  beforeEach(() => {
    resetMoabomAdminToastEnqueueForTest();
    delete (window as any).G7Core.toast.enqueue;
  });

  it('enqueueMoabomAdminToast가 _global.toasts에 토스트를 적재해야 함', () => {
    const tracker = trackToasts();

    const id = enqueueMoabomAdminToast({ type: 'warning', message: '경고 메시지' });

    expect(id).toBeTruthy();
    expect(tracker.current).toHaveLength(1);
    expect(tracker.current[0]).toMatchObject({ type: 'warning', message: '경고 메시지' });
  });

  it('pushMoabomAdminToast가 기본 info 타입으로 적재해야 함', () => {
    const tracker = trackToasts();

    pushMoabomAdminToast('알림');

    expect(tracker.current[0]).toMatchObject({ type: 'info', message: '알림' });
  });

  it('confirmViaMoabomAdminToast 확인 버튼 클릭 시 true로 resolve해야 함', async () => {
    const tracker = trackToasts();

    const promise = confirmViaMoabomAdminToast({
      message: '삭제할까요?',
      confirmLabel: '삭제',
    });

    const toast = tracker.current[0];
    expect(toast.duration).toBe(0);
    expect(toast.actions).toHaveLength(1);

    await (toast.actions as Array<{ label: string; onClick: () => void }>)[0].onClick();

    await expect(promise).resolves.toBe(true);
  });

  it('confirmViaMoabomAdminToast 닫기(onDismiss) 시 false로 resolve해야 함', async () => {
    const tracker = trackToasts();

    const promise = confirmViaMoabomAdminToast({
      message: '삭제할까요?',
      confirmLabel: '삭제',
    });

    const toast = tracker.current[0] as ToastRecord & { onDismiss?: () => void };
    toast.onDismiss?.();

    await expect(promise).resolves.toBe(false);
  });
});
