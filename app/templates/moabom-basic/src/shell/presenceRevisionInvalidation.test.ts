import { describe, expect, it } from 'vitest';
import {
  mergePresenceRefetchTargets,
  resolvePresenceRefetchTargets,
} from './presenceRevisionInvalidation';

describe('presenceRevisionInvalidation', () => {
  it('friendship revision 은 friends·online 만 refetch', () => {
    expect(resolvePresenceRefetchTargets('friendship_accepted')).toEqual({
      summary: false,
      online: true,
      friends: true,
    });
  });

  it('heartbeat 는 friends refetch 생략', () => {
    expect(resolvePresenceRefetchTargets('heartbeat')).toEqual({
      summary: true,
      online: true,
      friends: false,
    });
  });

  it('merge 는 debounce 구간 refetch 범위를 합친다', () => {
    const merged = mergePresenceRefetchTargets(
      resolvePresenceRefetchTargets('heartbeat'),
      resolvePresenceRefetchTargets('friendship_removed'),
    );
    expect(merged).toEqual({
      summary: true,
      online: true,
      friends: true,
    });
  });
});
