import { describe, expect, it } from 'vitest';
import { formatAppCommunityShellPath } from './moaShellCommunityUrl';
import { moaShellAppCommunityAppId } from './moaShellAppCommunityIds';

describe('moaShellCommunityUrl', () => {
  it('앱 리뷰 창 URL은 부모 생성앱 경로를 사용한다', () => {
    const appId = moaShellAppCommunityAppId(42);
    expect(formatAppCommunityShellPath({ appId, appCommunityServerId: 42 })).toBe('/app/generated-app-42');
  });
});
