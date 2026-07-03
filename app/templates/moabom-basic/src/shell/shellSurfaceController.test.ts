import { describe, expect, it } from 'vitest';
import { profileSurfaceRemountKey } from './shellSurfaceController';

describe('shellSurfaceController', () => {
  it('profileSurfaceRemountKey 는 subject UUID 기반 remount key 를 만든다', () => {
    expect(profileSurfaceRemountKey('uuid-a', 'win-1')).toBe('profile:uuid-a');
    expect(profileSurfaceRemountKey('  ', 'win-1')).toBe('win-1');
    expect(profileSurfaceRemountKey(undefined, 'win-1')).toBe('win-1');
  });
});
