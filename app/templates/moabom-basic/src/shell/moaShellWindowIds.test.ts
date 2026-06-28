import { describe, expect, it } from 'vitest';
import {
  moaShellAppCommunityAppId,
  moaShellBoardAppId,
  moaShellBoardSlugFromAppId,
  parseAppCommunityServerId,
} from './moaShellWindowIds';

describe('moaShellWindowIds', () => {
  it('게시판·앱 리뷰 appId round-trip', () => {
    expect(moaShellBoardAppId('notice')).toBe('moa-shell-board:notice');
    expect(moaShellBoardSlugFromAppId('moa-shell-board:notice')).toBe('notice');

    const communityId = moaShellAppCommunityAppId(42);
    expect(communityId).toBe('app-community-42');
    expect(parseAppCommunityServerId(communityId)).toBe(42);
  });
});
