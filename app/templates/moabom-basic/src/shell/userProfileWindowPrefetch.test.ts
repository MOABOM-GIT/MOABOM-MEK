import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  buildUserProfilePayloadCacheKey,
  invalidateUserProfileShellBindingCache,
  resolveUserProfileShellSearch,
} from './userProfileWindowPrefetch';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('userProfileWindowPrefetch', () => {
  it('캐시 키에 uuid·view·page를 포함한다', () => {
    expect(buildUserProfilePayloadCacheKey('uuid-1', 'profile', {})).toBe('uuid-1:profile:1');
    expect(buildUserProfilePayloadCacheKey('uuid-1', 'posts', { page: '3' })).toBe('uuid-1:posts:3');
  });

  it('profile 탭 URL에서는 page 쿼리를 제거한다', () => {
    expect(resolveUserProfileShellSearch('profile', '?page=2&foo=bar')).toBe('?foo=bar');
    expect(resolveUserProfileShellSearch('profile', '?page=2')).toBe('');
  });

  it('posts 탭 URL에서는 page 쿼리를 유지한다', () => {
    expect(resolveUserProfileShellSearch('posts', '?page=2')).toBe('?page=2');
  });

  it('invalidateUserProfileShellBindingCache는 프로필 data_source 바인딩 키만 무효화한다', () => {
    const invalidateCacheByKeys = vi.fn();
    vi.stubGlobal('window', {
      G7Core: {
        getDataBindingEngine: () => ({ invalidateCacheByKeys }),
      },
    });

    invalidateUserProfileShellBindingCache();

    expect(invalidateCacheByKeys).toHaveBeenCalledWith([
      'profile',
      'postStats',
      'recentPosts',
      'userProfile',
      'userPosts',
    ]);
  });
});
