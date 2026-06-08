import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MoabomUiI18nTestProvider } from '../../i18n/moabomShellTestI18n';
import { LegalPageWindowContent } from './Moa_LegalPageWindowContent';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LegalPageWindowContent', () => {
  it('로드 후 HtmlContent 영역에 본문이 표시된다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 1,
            slug: 'terms',
            title: '서비스 이용약관',
            content: '<p data-testid="inner-p">약관 본문</p>',
            content_mode: 'html',
          },
        }),
      }),
    );

    const onResolvedTitle = vi.fn();

    render(
      <MoabomUiI18nTestProvider>
        <LegalPageWindowContent slug="terms" onResolvedTitle={onResolvedTitle} />
      </MoabomUiI18nTestProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('moa-legal-page-window')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('약관 본문')).toBeInTheDocument();
    });

    expect(onResolvedTitle).toHaveBeenCalledWith('서비스 이용약관');
  });
});
