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
});
