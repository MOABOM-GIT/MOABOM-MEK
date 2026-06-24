import { describe, expect, it } from 'vitest';
import { resolvePublicProfileDisplayName } from './resolvePublicProfileDisplayName';
import { resolveUserProfileWindowTitle } from '../shell/userProfileWindowLayoutRuntime';

describe('resolvePublicProfileDisplayName', () => {
  it('닉네임이 있으면 닉네임을 반환한다', () => {
    expect(resolvePublicProfileDisplayName({ nickname: '모아봄', name: '홍길동' })).toBe('모아봄');
  });

  it('닉네임이 없으면 실명을 반환한다', () => {
    expect(resolvePublicProfileDisplayName({ name: '홍길동' })).toBe('홍길동');
  });
});

describe('resolveUserProfileWindowTitle', () => {
  it('프로필 데이터에서 닉네임을 윈도우 타이틀로 사용한다', () => {
    expect(resolveUserProfileWindowTitle({
      profile: { data: { nickname: '모아봄', name: '홍길동' } },
    })).toBe('모아봄');
  });
});
