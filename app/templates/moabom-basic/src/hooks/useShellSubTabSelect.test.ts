import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOABOM_SHELL_SUB_TAB_TRANSITION_MS } from '../layout/moabomShellPanelLayout';
import {
  useShellSubTabSelect,
  useShellSubTabSettle,
} from './useShellSubTabSelect';

describe('useShellSubTabSelect', () => {
  it('다른 탭이면 setActiveTab만 호출한다', () => {
    const setActiveTab = vi.fn();
    const onReselect = vi.fn();
    const { result } = renderHook(() => useShellSubTabSelect('a', 'a', setActiveTab, onReselect));

    act(() => {
      result.current('b');
    });

    expect(setActiveTab).toHaveBeenCalledWith('b');
    expect(onReselect).not.toHaveBeenCalled();
  });

  it('active·settled 가 같을 때만 onReselect를 호출한다', () => {
    const setActiveTab = vi.fn();
    const onReselect = vi.fn();
    const { result } = renderHook(() => useShellSubTabSelect('a', 'a', setActiveTab, onReselect));

    act(() => {
      result.current('a');
    });

    expect(setActiveTab).not.toHaveBeenCalled();
    expect(onReselect).toHaveBeenCalledTimes(1);
  });

  it('전환 중(active !== settled) 재클릭은 onReselect를 호출하지 않는다', () => {
    const setActiveTab = vi.fn();
    const onReselect = vi.fn();
    const { result } = renderHook(() => useShellSubTabSelect('b', 'a', setActiveTab, onReselect));

    act(() => {
      result.current('b');
    });

    expect(onReselect).not.toHaveBeenCalled();
    expect(setActiveTab).not.toHaveBeenCalled();
  });
});

describe('useShellSubTabSettle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('마운트 시 activeTab 과 즉시 동기화한다', () => {
    const { result } = renderHook(({ tab }) => useShellSubTabSettle(tab), {
      initialProps: { tab: 'a' as const },
    });

    expect(result.current).toBe('a');
  });

  it('activeTab 변경 후 transition ms 뒤 settled 가 갱신된다', () => {
    const { result, rerender } = renderHook(({ tab }) => useShellSubTabSettle(tab), {
      initialProps: { tab: 'a' as const },
    });

    rerender({ tab: 'b' });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(MOABOM_SHELL_SUB_TAB_TRANSITION_MS);
    });

    expect(result.current).toBe('b');
  });
});
