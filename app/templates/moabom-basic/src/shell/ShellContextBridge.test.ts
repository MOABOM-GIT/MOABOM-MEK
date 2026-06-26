import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { mergeShellContextIntoGlobalState, publishShellLayoutContext, getOrCreateShellVisitorId } from './ShellContextBridge';

describe('ShellContextBridge', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    });
    vi.stubGlobal('crypto', { randomUUID: () => '11111111-1111-4111-8111-111111111111' });
    (window as unknown as { G7Core?: unknown }).G7Core = {
      AuthManager: {
        getInstance: () => ({
          getUser: () => ({
            uuid: '22222222-2222-4222-8222-222222222222',
            name: '테스트',
            nickname: '닉',
          }),
        }),
      },
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as { G7Core?: unknown }).G7Core;
  });

  it('mergeShellContextIntoGlobalState 는 currentUser 를 주입한다', () => {
    const merged = mergeShellContextIntoGlobalState({});
    expect(merged.currentUser).toMatchObject({
      uuid: '22222222-2222-4222-8222-222222222222',
      name: '테스트',
    });
    expect(merged.shell).toMatchObject({
      visitorId: '11111111-1111-4111-8111-111111111111',
      isAuthenticated: true,
    });
  });

  it('publishShellLayoutContext 는 비로그인 시 currentUser null (게시판 guest 폼 분기)', () => {
    (window as unknown as { G7Core?: unknown }).G7Core = {
      AuthManager: { getInstance: () => ({ getUser: () => null }) },
    };
    const setGlobalState = vi.fn();
    const merged = publishShellLayoutContext({
      getGlobalState: () => ({}),
      setGlobalState,
    });
    expect(merged.currentUser).toBeNull();
    expect(setGlobalState).toHaveBeenCalledWith({
      currentUser: null,
      shell: expect.objectContaining({ isAuthenticated: false }),
    });
  });

  it('publishShellLayoutContext 는 templateApp 에 currentUser 를 발행한다', () => {
    const setGlobalState = vi.fn();
    publishShellLayoutContext({
      getGlobalState: () => ({ currentUser: { uuid: 'stale' } }),
      setGlobalState,
    });
    expect(setGlobalState).toHaveBeenCalledWith({
      currentUser: expect.objectContaining({
        uuid: '22222222-2222-4222-8222-222222222222',
      }),
      shell: expect.objectContaining({ isAuthenticated: true }),
    });
  });

  it('getOrCreateShellVisitorId 는 legacy presence key 를 재사용한다', () => {
    const getItem = vi.fn((key: string) => (
      key === 'moabom_presence_client_key' ? 'legacy-visitor' : null
    ));
    vi.stubGlobal('localStorage', { getItem, setItem: vi.fn() });
    expect(getOrCreateShellVisitorId()).toBe('legacy-visitor');
  });
});
