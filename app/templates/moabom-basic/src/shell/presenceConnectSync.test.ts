import { describe, expect, it } from 'vitest';
import type { PresenceOnlineUser } from '../api/moabomPresenceApi';
import {
  normalizePresenceConnectList,
  optimisticPromoteSelfInConnectList,
} from './presenceConnectSync';

function guest(sessionKey: string, visitorId?: string, lastSeen = '2026-06-24T10:00:00Z'): PresenceOnlineUser {
  return {
    session_key: sessionKey,
    visitor_id: visitorId ?? null,
    display_name: '방문자',
    is_authenticated: false,
    is_online: true,
    friendship: 'none',
    last_seen_at: lastSeen,
  };
}

describe('normalizePresenceConnectList', () => {
  it('guest 는 visitor_id 기준 1행만 남긴다', () => {
    const users = [
      guest('legacy-key', 'visitor-1', '2026-06-24T09:00:00Z'),
      guest('current-key', 'visitor-1', '2026-06-24T10:00:00Z'),
      guest('other', 'visitor-2'),
    ];

    const normalized = normalizePresenceConnectList(users);

    expect(normalized).toHaveLength(2);
    expect(normalized.find(u => u.visitor_id === 'visitor-1')?.session_key).toBe('current-key');
  });

  it('승격된 visitor_id guest 행은 제외한다', () => {
    const users: PresenceOnlineUser[] = [
      guest('guest-key', 'visitor-1'),
      {
        session_key: 'member-key',
        visitor_id: 'visitor-1',
        user_uuid: 'user-uuid-1',
        display_name: '회원',
        is_authenticated: true,
        is_online: true,
        friendship: 'none',
        last_seen_at: '2026-06-24T10:00:00Z',
      },
    ];

    const normalized = normalizePresenceConnectList(users);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.user_uuid).toBe('user-uuid-1');
  });

  it('viewer 본인 행은 항상 맨 위에 둔다', () => {
    const users: PresenceOnlineUser[] = [
      {
        session_key: 'other-key',
        user_uuid: 'user-other',
        display_name: '다른사람',
        is_authenticated: true,
        is_online: true,
        friendship: 'none',
        last_seen_at: '2026-06-24T12:00:00Z',
      },
      {
        session_key: 'self-key',
        user_uuid: 'user-self',
        display_name: '나',
        is_authenticated: true,
        is_online: true,
        friendship: 'none',
        last_seen_at: '2026-06-24T10:00:00Z',
      },
    ];

    const normalized = normalizePresenceConnectList(users, 'user-self');

    expect(normalized[0]?.user_uuid).toBe('user-self');
  });

  it('optimisticPromoteSelfInConnectList 는 내 guest 행을 member 1행으로 바꾼다', () => {
    const users: PresenceOnlineUser[] = [
      guest('legacy-key', 'visitor-me'),
      {
        session_key: 'member-key',
        visitor_id: 'visitor-me',
        user_uuid: 'user-uuid-1',
        display_name: '나',
        avatar: 'https://example.com/a.png',
        is_authenticated: true,
        is_online: true,
        availability: 'online',
        friendship: 'none',
        last_seen_at: '2026-06-24T10:00:00Z',
      },
    ];

    const next = optimisticPromoteSelfInConnectList(users, 'visitor-me', users[1]);

    expect(next).toHaveLength(1);
    expect(next[0]?.user_uuid).toBe('user-uuid-1');
    expect(next[0]?.display_name).toBe('나');
  });

  it('optimisticPromoteSelfInConnectList 는 동일 마스크 IP guest 잔여 행도 제거한다', () => {
    const users: PresenceOnlineUser[] = [
      {
        ...guest('guest-me', 'visitor-me'),
        client_ip_masked: '8.232.*.*',
      },
      {
        ...guest('guest-shadow', 'visitor-old'),
        client_ip_masked: '8.232.*.*',
      },
      {
        ...guest('guest-other', 'visitor-other'),
        client_ip_masked: '1.2.*.*',
      },
      {
        session_key: 'member-key',
        visitor_id: 'visitor-me',
        user_uuid: 'user-uuid-1',
        display_name: '나',
        is_authenticated: true,
        is_online: true,
        friendship: 'none',
        last_seen_at: '2026-06-24T10:00:00Z',
      },
    ];

    const next = optimisticPromoteSelfInConnectList(users, 'visitor-me', users[3]);

    expect(next).toHaveLength(2);
    expect(next[0]?.user_uuid).toBe('user-uuid-1');
    expect(next[1]?.visitor_id).toBe('visitor-other');
  });

  it('normalizePresenceConnectList 는 viewer IP 와 같은 guest shadow 를 숨긴다', () => {
    const users: PresenceOnlineUser[] = [
      {
        ...guest('guest-shadow', 'visitor-old'),
        client_ip_masked: '8.232.*.*',
      },
      {
        ...guest('guest-other', 'visitor-other'),
        client_ip_masked: '1.2.*.*',
      },
      {
        session_key: 'member-key',
        visitor_id: 'visitor-me',
        user_uuid: 'user-self',
        display_name: '나',
        is_authenticated: true,
        is_online: true,
        friendship: 'none',
        last_seen_at: '2026-06-24T10:00:00Z',
      },
    ];

    const normalized = normalizePresenceConnectList(users, 'user-self', '8.232.*.*');

    expect(normalized).toHaveLength(2);
    expect(normalized[0]?.user_uuid).toBe('user-self');
    expect(normalized[1]?.visitor_id).toBe('visitor-other');
  });
});
