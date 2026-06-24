import { describe, expect, it } from 'vitest';
import type { OwnPresenceState } from '../api/moabomPresenceApi';
import {
  buildOwnPresenceFromSettings,
  patchOnlineUsersSelfPresence,
  resolvePresenceListStatusLine,
  resolvePresenceListUserStatus,
  resolvePresenceSubtitleForMode,
} from './presenceSettingsSync';
import type { MoabomTranslateFn } from '../i18n/moabomT';

const tStub = ((key: string) => key) as MoabomTranslateFn;

describe('presenceSettingsSync', () => {
  it('buildOwnPresenceFromSettings 는 pending availability 를 반영한다', () => {
    const previous: OwnPresenceState = {
      availability: 'online',
      subtitle_mode: 'profile_bio',
      presence_subtitle: null,
      is_reachable: true,
    };

    expect(buildOwnPresenceFromSettings({
      availability: 'away',
      subtitle_mode: 'profile_bio',
      pending: true,
    }, previous, { profileBio: null, activityText: null })).toEqual({
      availability: 'away',
      subtitle_mode: 'profile_bio',
      presence_subtitle: null,
      is_reachable: true,
    });
  });

  it('buildOwnPresenceFromSettings 는 subtitle_mode 변경 시 부제를 즉시 재계산한다', () => {
    const previous: OwnPresenceState = {
      availability: 'online',
      subtitle_mode: 'profile_bio',
      presence_subtitle: '한줄 소개',
      is_reachable: true,
    };

    expect(buildOwnPresenceFromSettings({
      subtitle_mode: 'hidden',
      pending: true,
    }, previous, { profileBio: '한줄 소개', activityText: '활동 중' })).toEqual({
      availability: 'online',
      subtitle_mode: 'hidden',
      presence_subtitle: null,
      is_reachable: true,
    });

    expect(buildOwnPresenceFromSettings({
      subtitle_mode: 'activity',
      pending: true,
    }, previous, { profileBio: '한줄 소개', activityText: '활동 중' })).toEqual({
      availability: 'online',
      subtitle_mode: 'activity',
      presence_subtitle: '활동 중',
      is_reachable: true,
    });
  });

  it('resolvePresenceSubtitleForMode 는 모드별 부제를 반환한다', () => {
    expect(resolvePresenceSubtitleForMode('profile_bio', { profileBio: '  bio  ' })).toBe('bio');
    expect(resolvePresenceSubtitleForMode('activity', { activityText: '게시판' })).toBe('게시판');
    expect(resolvePresenceSubtitleForMode('hidden', { profileBio: 'bio' })).toBeNull();
  });

  it('resolvePresenceListUserStatus 는 본인 행에 ownPresence 를 우선한다', () => {
    const own: OwnPresenceState = {
      availability: 'busy',
      subtitle_mode: 'profile_bio',
      presence_subtitle: null,
      is_reachable: true,
    };

    expect(resolvePresenceListUserStatus(
      { user_uuid: 'me', availability: 'online', is_online: true },
      own,
      'me',
    )).toEqual({
      availability: 'busy',
      isReachable: true,
    });
  });

  it('patchOnlineUsersSelfPresence 는 대상 uuid 행의 availability·부제를 갱신한다', () => {
    const next = patchOnlineUsersSelfPresence(
      [{
        session_key: 'a',
        user_uuid: 'me',
        display_name: 'Me',
        is_authenticated: true,
        is_online: true,
        availability: 'online',
        friendship: 'none',
      }],
      'me',
      { availability: 'away', isReachable: true, presenceSubtitle: '새 부제' },
    );

    expect(next[0]?.availability).toBe('away');
    expect(next[0]?.presence_subtitle).toBe('새 부제');
    expect(next[0]?.status_text).toBe('새 부제');
  });

  it('resolvePresenceListStatusLine 은 본인 행에 ownPresence 부제를 우선한다', () => {
    const own: OwnPresenceState = {
      availability: 'online',
      subtitle_mode: 'profile_bio',
      presence_subtitle: '낙관적 부제',
      is_reachable: true,
    };

    expect(resolvePresenceListStatusLine(
      tStub,
      {
        user_uuid: 'me',
        presence_subtitle: '서버 부제',
        status_text: '서버 부제',
        is_online: true,
      },
      own,
      'me',
      true,
    )).toBe('낙관적 부제');
  });
});
