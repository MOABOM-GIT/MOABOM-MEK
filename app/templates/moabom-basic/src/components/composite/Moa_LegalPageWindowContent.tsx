import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPublishedSirsoftPage } from '../../api/moabomSirsoftPageApi';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import type { MoaShellLegalPageSlug } from '../../shell/moaShellLegalPageIds';
import { Button } from '../basic/Button';
import { Div } from '../basic/Div';
import { HtmlContent } from './HtmlContent';

export interface LegalPageWindowContentProps {
  slug: MoaShellLegalPageSlug;
  /** API에서 받은 제목으로 윈도우 타이틀 갱신 */
  onResolvedTitle?: (title: string) => void;
}

/**
 * sirsoft-page 모듈 공개 페이지(이용약관·개인정보처리방침 등)를 셸 윈도우 안에 표시합니다.
 */
export const LegalPageWindowContent: React.FC<LegalPageWindowContentProps> = ({
  slug,
  onResolvedTitle,
}) => {
  const { t } = useMoabomShellT();
  const onResolvedTitleRef = useRef(onResolvedTitle);
  onResolvedTitleRef.current = onResolvedTitle;

  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [contentMode, setContentMode] = useState<string>('html');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchPublishedSirsoftPage(slug);
      const mode = (page.content_mode ?? 'html').toLowerCase();
      setContentMode(mode);
      setHtml(page.content ?? '');
      const trimmed = page.title?.trim();
      const notify = onResolvedTitleRef.current;
      if (trimmed && notify) {
        notify(trimmed);
      }
    } catch (e) {
      setHtml(null);
      setError(e instanceof Error ? e.message : t('moa_shell.center.legal_page_error'));
    } finally {
      setLoading(false);
    }
  }, [slug, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Div
      data-testid="moa-legal-page-window"
      className="moa-shell-app-window text-primary flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      {loading ? (
        <Div className="flex flex-1 items-center justify-center px-4 py-8 text-sm text-muted">
          {t('moa_shell.center.legal_page_loading')}
        </Div>
      ) : null}

      {!loading && error ? (
        <Div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
          <Div className="text-sm text-secondary">{error}</Div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            {t('moa_shell.center.legal_page_retry')}
          </Button>
        </Div>
      ) : null}

      {!loading && !error && html !== null ? (
        <Div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {html.trim().length > 0 ? (
            <HtmlContent content={html} isHtml={contentMode === 'html'} />
          ) : (
            <Div className="text-sm text-muted">{t('moa_shell.center.legal_page_empty')}</Div>
          )}
        </Div>
      ) : null}
    </Div>
  );
};
