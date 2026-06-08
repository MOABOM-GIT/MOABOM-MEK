import { describe, expect, it } from 'vitest';
import {
  getCreateAppEditServerId,
  setCreateAppEditServerId,
  subscribeCreateAppEditServerId,
} from './moabomCreateAppEditSession';

describe('moabomCreateAppEditSession', () => {
  it('stores and notifies edit server id subscribers', () => {
    setCreateAppEditServerId(null);
    const seen: Array<number | null> = [];
    const unsubscribe = subscribeCreateAppEditServerId(() => {
      seen.push(getCreateAppEditServerId());
    });

    setCreateAppEditServerId(7);
    setCreateAppEditServerId(null);
    unsubscribe();

    expect(seen).toEqual([7, null]);
  });
});
