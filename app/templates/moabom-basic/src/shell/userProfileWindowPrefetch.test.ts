import { describe, expect, it } from 'vitest';
import {
  buildUserProfilePayloadCacheKey,
  resolveUserProfileShellSearch,
} from './userProfileWindowPrefetch';

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
});
