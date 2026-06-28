import { describe, expect, it } from 'vitest';
import { appCommunityRevisionChannel } from './moabomAppCommunitySocket';

describe('moabomAppCommunitySocket', () => {
  it('builds stable revision channel per app id', () => {
    expect(appCommunityRevisionChannel(42)).toBe('moabom-app-community.42');
  });
});
