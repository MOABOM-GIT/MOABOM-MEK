import { afterEach, describe, expect, it } from 'vitest';
import { buildShellAuthStateKey, resetShellAuthStateKeyForTest } from './moaShellAuthStateKey';

describe('moaShellAuthStateKey', () => {
  afterEach(() => {
    resetShellAuthStateKeyForTest('');
  });

  it('buildShellAuthStateKey — memberKey 없으면 빈 문자열', () => {
    expect(buildShellAuthStateKey()).toBe('');
    expect(buildShellAuthStateKey(null)).toBe('');
    expect(buildShellAuthStateKey('  ')).toBe('');
  });

  it('buildShellAuthStateKey — member id trim', () => {
    expect(buildShellAuthStateKey(' 42 ')).toBe('42');
  });
});
