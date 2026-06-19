import { describe, expect, it } from 'vitest';
import {
  resolveNotificationFallbackPath,
  resolveNotificationNavigatePath,
} from './moabomNotificationNavigateUrl';

describe('moabomNotificationNavigateUrl', () => {
  it('레거시 /mypage 를 /me/profile 로 정규화한다', () => {
    expect(resolveNotificationNavigatePath('/mypage')).toBe('/me/profile');
    expect(resolveNotificationNavigatePath('https://mek360.com/mypage')).toBe('/me/profile');
  });

  it('비밀번호 변경 알림 경로를 account 탭으로 보낸다', () => {
    expect(resolveNotificationNavigatePath('/mypage/change-password')).toBe('/me/account');
  });

  it('이커머스 주문 경로는 유지한다', () => {
    expect(resolveNotificationNavigatePath('/mypage/orders/ORD-1001')).toBe('/mypage/orders/ORD-1001');
  });

  it('게시판 post_url 은 그대로 유지한다', () => {
    expect(resolveNotificationNavigatePath('/board/notice/42')).toBe('/board/notice/42');
  });

  it('url 이 없으면 type 기반 fallback 을 쓴다', () => {
    expect(resolveNotificationFallbackPath('password_changed')).toBe('/me/account');
    expect(resolveNotificationNavigatePath(null, 'board.comment_received')).toBe('/me/activity');
    expect(resolveNotificationNavigatePath(null, 'user_registered')).toBe('/me/profile');
  });
});
