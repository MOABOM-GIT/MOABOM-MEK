import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Moa_MyPageActivityPanel } from '../Moa_MyPageActivityPanel';
import type { ActivityOverview } from '../myPageTypes';

const emptyOverview: ActivityOverview = {
  summary: {
    posts_count: 0,
    comments_count: 0,
    interactions_count: 0,
    likes_supported: false,
  },
  items: [],
};

const t = vi.fn((key: string) => {
  if (key === 'moa_mypage.activity.admin_session_notice') {
    return 'ADMIN_SESSION_NOTICE';
  }
  if (key.startsWith('moa_mypage.activity.')) {
    return key;
  }
  return key;
});

describe('Moa_MyPageActivityPanel', () => {
  it('관리자 안내가 켜지면 번역 문구를 표시한다', () => {
    render(
      <Moa_MyPageActivityPanel
        t={t}
        showAdminSessionNotice
        activityOverview={emptyOverview}
        activityFilter="all"
        setActivityFilter={vi.fn()}
        activityLoading={false}
        activityError=""
        onOpenActivity={vi.fn()}
      />,
    );

    expect(screen.getByTestId('mypage-activity-admin-notice')).toHaveTextContent('ADMIN_SESSION_NOTICE');
  });

  it('관리자 안내가 꺼지면 안내 블록을 렌더하지 않는다', () => {
    render(
      <Moa_MyPageActivityPanel
        t={t}
        showAdminSessionNotice={false}
        activityOverview={emptyOverview}
        activityFilter="all"
        setActivityFilter={vi.fn()}
        activityLoading={false}
        activityError=""
        onOpenActivity={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('mypage-activity-admin-notice')).toBeNull();
  });
});
