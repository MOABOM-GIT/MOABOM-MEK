import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MoabomUiI18nTestProvider } from '../../i18n/moabomShellTestI18n';
import { resetSocialAuthProvidersCache } from '../../utils/socialAuth';
import { LoginPrompt } from './Moa_LoginPrompt';

function renderLoginPrompt(ui: React.ReactElement) {
  return render(<MoabomUiI18nTestProvider>{ui}</MoabomUiI18nTestProvider>);
}

describe('LoginPrompt', () => {
  beforeEach(() => {
    resetSocialAuthProvidersCache();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('관리자 설정에서 활성화된 SNS provider 버튼만 표시한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          providers: ['google', 'naver'],
        },
      }),
    }));

    renderLoginPrompt(<LoginPrompt />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '구글로 계속하기' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '네이버로 계속하기' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: '카카오로 계속하기' })).not.toBeInTheDocument();
  });

  it('활성화된 provider가 없으면 SNS 버튼을 표시하지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          providers: [],
        },
      }),
    }));

    renderLoginPrompt(<LoginPrompt />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/modules/moabom-social-auth/providers', {
        headers: { Accept: 'application/json' },
      });
    });

    expect(screen.queryByRole('button', { name: '구글로 계속하기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '네이버로 계속하기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '카카오로 계속하기' })).not.toBeInTheDocument();
  });

  it('이메일 로그인 버튼으로 인증 윈도우 로그인 모드를 연다', async () => {
    const onOpenAuth = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          providers: [],
        },
      }),
    }));

    renderLoginPrompt(<LoginPrompt onOpenAuth={onOpenAuth} />);

    const emailBtn = await screen.findByRole('button', { name: /이메일로 로그인/ });
    fireEvent.click(emailBtn);

    expect(onOpenAuth).toHaveBeenCalledWith('login');
  });
});
