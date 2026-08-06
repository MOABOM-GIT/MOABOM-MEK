import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOABOM_SYSTEM_STORAGE_KEY } from '../../utils/moabomSystemStore';

/** 크레딧 탭 테스트: 런타임에 G7Core.t가 없으면 moabomT가 키 문자열을 그대로 반환하므로 ko.json과 동일한 스텁을 둡니다. */
const MY_PAGE_CREDIT_KO: Record<string, string> = {
  'moa_mypage.settings_ui.section_language': '언어',
  'moa_mypage.settings_ui.section_theme': '화면 테마',
  'moa_mypage.settings_ui.section_point_color': '포인트 컬러',
  'moa_mypage.settings_ui.section_background': '홈 배경',
  'moa_mypage.settings_ui.background_empty': '등록된 홈 배경이 없습니다.',
  'moa_mypage.settings_ui.section_system_options': '시스템 옵션',
  'moa_mypage.settings_ui.section_notifications': '알림 옵션',
  'moa_mypage.settings_ui.theme_aria': '{label} 테마 선택',
  'moa_mypage.settings_ui.theme_title': '{label} 테마',
  'moa_mypage.settings_ui.color_aria': '{color} 선택',
  'moa_mypage.settings_ui.custom_color_aria': '사용자 지정 포인트 컬러 선택',
  'moa_mypage.system_options.sound': '사운드 효과',
  'moa_mypage.system_options.animation': '애니메이션',
  'moa_mypage.system_options.haptic': '햅틱 피드백',
  'moa_mypage.system_options.notification_center': '알림센터 기록·배지 표시',
  'moa_mypage.system_options.toast': '토스트 알림',
  'moa_mypage.system_options.push': '시스템 알림',
  'moa_mypage.system_options.weather': '날씨 효과',
  'moa_mypage.notifications.center_label': '알림센터 기록·배지 표시',
  'moa_mypage.notifications.marketing_label': '마케팅 알림 동의',
  'moa_mypage.notifications.push_status.unsupported': '이 기기에서 지원하지 않음',
  'moa_mypage.credit.balance_label': '보유 크레딧',
  'moa_mypage.credit.amount_unit': '{amount} 크레딧',
  'moa_mypage.credit.total_earned': '총 적립',
  'moa_mypage.credit.total_used': '총 사용',
  'moa_mypage.credit.attendance': '출석체크',
  'moa_mypage.credit.attendance_loading': '출석체크 중…',
  'moa_mypage.credit.attendance_complete': '출석완료',
  'moa_mypage.credit.recent_title': '최근 내역',
  'moa_mypage.credit.loading_short': '불러오는 중',
  'moa_mypage.credit.loading_rows': '크레딧 내역을 불러오는 중입니다.',
  'moa_mypage.credit.empty': '아직 크레딧 내역이 없습니다.',
  'moa_mypage.credit.transaction_fallback': '크레딧 거래',
};

vi.mock('../../i18n/moabomT', () => ({
  moabomT(key: string, params?: Record<string, string | number>) {
    let s = MY_PAGE_CREDIT_KO[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.split(`{${k}}`).join(String(v));
      }
    }
    return s;
  },
}));

import React from 'react';
import { moabomT } from '../../i18n/moabomT';
import { MoabomUiI18nContext } from '../../i18n/MoabomUiI18nProvider';
import { MyPageWindowContent } from './Moa_MyPageWindowContent';

function renderMyPage(ui: React.ReactElement) {
  return render(
    <MoabomUiI18nContext.Provider value={{ t: moabomT, language: 'ko' }}>
      {ui}
    </MoabomUiI18nContext.Provider>,
  );
}

describe('MyPageWindowContent 크레딧 탭', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('이전 크레딧 호칭 대신 크레딧 호칭을 표시한다', async () => {
    localStorage.setItem('auth_token', 'token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          balance: 150,
          summary: {
            total_earned: 200,
            total_used: 50,
            transaction_count: 1,
          },
          transactions: [
            {
              id: 1,
              type: 'earn',
              type_label: '적립',
              amount: 150,
              balance_after: 150,
              description: '테스트 적립',
              created_at_human: '방금 전',
            },
          ],
        },
      }),
    }));

    renderMyPage(
      <MyPageWindowContent
        initialTab="credit"
        currentUser={{ name: '테스터', level: 1, point: 0 }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('보유 크레딧')).toBeInTheDocument();
      expect(screen.getByText('150 크레딧')).toBeInTheDocument();
      expect(screen.getByText('테스트 적립')).toBeInTheDocument();
    });

    expect(screen.queryByText(/MOA\s*크레딧/)).not.toBeInTheDocument();
  });

  it('같은 회원 객체가 갱신돼도 크레딧을 다시 로딩하지 않는다', async () => {
    localStorage.setItem('auth_token', 'token');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          balance: 120,
          summary: {
            total_earned: 120,
            total_used: 0,
            transaction_count: 0,
          },
          transactions: [],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const view = renderMyPage(
      <MyPageWindowContent
        initialTab="credit"
        currentUser={{ name: '테스터', level: 1, point: 120, memberKey: 'member-7' }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('120 크레딧')).toBeInTheDocument();
    });

    await act(async () => {
      view.rerender(
        <MoabomUiI18nContext.Provider value={{ t: moabomT, language: 'ko' }}>
          <MyPageWindowContent
            initialTab="credit"
            currentUser={{ name: '테스터 갱신', level: 1, point: 120, memberKey: 'member-7' }}
          />
        </MoabomUiI18nContext.Provider>,
      );
      await Promise.resolve();
    });

    const creditCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/moabom-credit/user/credits'));
    expect(creditCalls).toHaveLength(1);
    expect(screen.queryByText('크레딧 내역을 불러오는 중입니다.')).not.toBeInTheDocument();
  });

  it('크레딧 내역이 없으면 빈 상태를 표시한다', async () => {
    localStorage.setItem('auth_token', 'token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          balance: 0,
          summary: {
            total_earned: 0,
            total_used: 0,
            transaction_count: 0,
          },
          transactions: [],
        },
      }),
    }));

    renderMyPage(
      <MyPageWindowContent
        initialTab="credit"
        currentUser={{ name: '테스터', level: 1, point: 0 }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('아직 크레딧 내역이 없습니다.')).toBeInTheDocument();
    });
  });

  it('오늘 출석을 완료했으면 출석완료 버튼을 비활성화한다', async () => {
    localStorage.setItem('auth_token', 'token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          balance: 10,
          attendance: {
            checked_today: true,
            attendance_date: '2026-08-05',
            next_available_at: new Date(Date.now() + 60_000).toISOString(),
          },
          summary: {
            total_earned: 10,
            total_used: 0,
            transaction_count: 1,
          },
          transactions: [],
        },
      }),
    }));

    renderMyPage(
      <MyPageWindowContent
        initialTab="credit"
        currentUser={{ name: '테스터', level: 1, point: 10 }}
      />,
    );

    const attendanceButton = await screen.findByRole('button', { name: /출석완료/ });
    expect(attendanceButton).toBeDisabled();
  });

  it('날씨 효과는 시스템 옵션 토글만 표시하고 수동 위치 입력은 표시하지 않는다', async () => {
    localStorage.setItem('auth_token', 'token');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          defaults: {
            preferences: {
              languages: [{ id: 'ko', label: '한국어', enabled: true }],
              system_options: [
                { id: 'sound', label: '사운드 효과', on_by_default: true, user_editable: true },
                { id: 'animation', label: '애니메이션', on_by_default: true, user_editable: true },
                { id: 'notification_center', label: '알림센터 기록·배지 표시', on_by_default: true, user_editable: true },
                { id: 'toast', label: '토스트 알림', on_by_default: true, user_editable: true },
                { id: 'push', label: '시스템 알림', on_by_default: true, user_editable: true },
                { id: 'weather', label: '날씨 효과', on_by_default: false, user_editable: true },
                { id: 'weather', label: '날씨 효과', on_by_default: true, user_editable: true },
              ],
            },
            appearance: {
              themes: [{ id: 'light', label: '라이트', enabled: true }],
              point_color_presets: ['#6366f1'],
              home_background_items: [],
            },
          },
          settings: {
            preferences: {
              language: 'ko',
              systemOptions: {
                sound: true,
                animation: true,
                haptic: true,
                notification_center: true,
                toast: true,
                push: true,
                weather: false,
              },
            },
            appearance: {
              theme: 'light',
              pointColor: '#6366f1',
              backgroundImageId: '',
              fontSize: 3,
            },
            layout: {
              leftPanelOpen: true,
              rightPanelOpen: true,
              centerMode: 'moabom-apps',
            },
          },
          defaults_revision: 1,
        },
      }),
    }));

    renderMyPage(
      <MyPageWindowContent
        initialTab="settings"
        currentUser={{ name: '테스터', level: 1, point: 0, memberKey: '7' }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('날씨 효과')).toBeInTheDocument();
    });

    expect(screen.getAllByText('날씨 효과')).toHaveLength(1);
    expect(screen.queryByText('날씨 기준 위치')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('날씨 위치 변경')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/도시명/)).not.toBeInTheDocument();
    expect(screen.getByText('알림 옵션')).toBeInTheDocument();
    expect(screen.getByText('알림센터 기록·배지 표시')).toBeInTheDocument();
    expect(screen.getByText('토스트 알림')).toBeInTheDocument();
    expect(screen.getByText(/^시스템 알림 \(.+\)$/)).toBeInTheDocument();
  });

  it('디스크에만 반영된 최신 패널 layout 이 있을 때 설정 변경 저장으로 덮어쓰지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }));

    const baseState = {
      version: 1,
      layout: {
        leftPanelOpen: true,
        rightPanelOpen: true,
        centerMode: 'moabom-apps',
      },
      appearance: {
        theme: 'light',
        pointColor: '#6366f1',
        backgroundImageId: '',
        fontSize: 3,
      },
      preferences: {
        language: 'ko',
        systemOptions: {
          sound: true,
          animation: true,
          haptic: true,
          notification_center: true,
          toast: true,
          push: true,
          weather: false,
        },
      },
    };
    localStorage.setItem(MOABOM_SYSTEM_STORAGE_KEY, JSON.stringify(baseState));

    renderMyPage(
      <MyPageWindowContent
        initialTab="settings"
        currentUser={{ name: '테스터', level: 1, point: 0 }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('언어')).toBeInTheDocument();
    });

    localStorage.setItem(
      MOABOM_SYSTEM_STORAGE_KEY,
      JSON.stringify({
        ...baseState,
        layout: {
          ...baseState.layout,
          leftPanelOpen: false,
          rightPanelOpen: false,
        },
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'en' }));

    const stored = JSON.parse(localStorage.getItem(MOABOM_SYSTEM_STORAGE_KEY) ?? '{}');
    expect(stored.layout?.leftPanelOpen).toBe(false);
    expect(stored.layout?.rightPanelOpen).toBe(false);
    expect(stored.preferences?.language).toBe('en');
  });
});
