import { useEffect, useMemo, useState } from 'react';
import { fetchVisibleGeneratedApp, type StoredGeneratedApp } from '../../api/moabomAppsApi';
import { useMoabomShellT } from 'moabom-shell-i18n';
import AppLoadingSpinner from '../../components/composite/AppLoadingSpinner';
import { Button } from '../../components/basic/Button';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { Span } from '../../components/basic/Span';
import { APP_SHELL_BODY_CLASS, APP_SHELL_DESC_CLASS, APP_SHELL_PANEL_CLASS, APP_WINDOW_BODY_CLASS } from '../appShellTypography';
import { extractCompleteHtml, injectAiPreviewSafety } from '../ai-generator/aiHtmlUtils';

export interface GeneratedAppViewerProps {
  serverId: number;
  onEditGeneratedApp?: (serverId: number) => void;
  onDeleteGeneratedApp?: (serverId: number) => void;
  onToggleGeneratedAppShare?: (serverId: number, nextShared: boolean) => void | Promise<void>;
}

export function GeneratedAppViewer({
  serverId,
  onEditGeneratedApp,
  onDeleteGeneratedApp,
  onToggleGeneratedAppShare,
}: GeneratedAppViewerProps) {
  const { t } = useMoabomShellT();
  const [app, setApp] = useState<StoredGeneratedApp | null>(null);
  const [html, setHtml] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMember, setIsMember] = useState(false);

  useEffect(() => {
    const authManager = (window as { G7Core?: any }).G7Core?.AuthManager?.getInstance?.();
    if (!authManager) {
      setIsMember(false);
      return;
    }
    const apply = () => setIsMember(Boolean(authManager.isAuthenticated?.() && authManager.getUser?.()));
    apply();
    const off = authManager.on?.('authStateChange', (state: { isAuthenticated?: boolean; user?: unknown }) => {
      setIsMember(Boolean(state?.isAuthenticated && state?.user));
    });

    return () => {
      if (typeof off === 'function') {
        off();
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');
    setIsMenuOpen(false);
    setApp(null);
    setHtml('');
    setTitle('');

    void (async () => {
      try {
        const app = await fetchVisibleGeneratedApp(serverId);
        if (cancelled) {
          return;
        }
        setApp(app);
        setTitle(app.title?.trim() || `App #${app.id}`);
        setHtml(app.html ?? '');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('moa_apps_ai.viewer_error'));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [serverId, t]);

  const previewHtml = useMemo(
    () => extractCompleteHtml(html) || injectAiPreviewSafety(html),
    [html],
  );
  const ownerNickname = app?.owner?.nickname?.trim() || '';
  const permissions = app?.permissions;
  const isShared = Boolean(app?.is_shared);
  const handleToggleShare = async () => {
    if (!onToggleGeneratedAppShare) {
      return;
    }
    const nextShared = !isShared;
    setApp(prev => prev ? { ...prev, is_shared: nextShared } : prev);
    try {
      await onToggleGeneratedAppShare(serverId, nextShared);
    } catch {
      setApp(prev => prev ? { ...prev, is_shared: !nextShared } : prev);
    }
  };

  const canEdit = Boolean(isMember && permissions?.can_edit && onEditGeneratedApp);
  const canShare = Boolean(isMember && permissions?.can_share && onToggleGeneratedAppShare);
  const canDelete = Boolean(isMember && permissions?.can_delete && onDeleteGeneratedApp);
  const hasActions = canEdit || canShare || canDelete;

  if (isLoading) {
    return (
      <AppLoadingSpinner label={t('moa_apps_ai.viewer_loading')} fill />
    );
  }

  if (error) {
    return (
      <Div className={`${APP_WINDOW_BODY_CLASS} ${APP_SHELL_BODY_CLASS} flex min-h-[320px] items-center justify-center`}>
        <Div className={`${APP_SHELL_PANEL_CLASS} max-w-md text-center`}>
          <Icon name="exclamation-circle" className="mb-3 text-3xl text-red-500" />
          <Div className={APP_SHELL_BODY_CLASS}>{error}</Div>
        </Div>
      </Div>
    );
  }

  if (!previewHtml) {
    return (
      <Div className={`${APP_WINDOW_BODY_CLASS} ${APP_SHELL_BODY_CLASS} flex min-h-[320px] items-center justify-center`}>
        <Div className={`${APP_SHELL_PANEL_CLASS} max-w-md text-center`}>
          <Icon name="file-alt" className="mb-3 text-3xl text-faint" />
          <Div className={APP_SHELL_BODY_CLASS}>{t('moa_apps_ai.viewer_empty')}</Div>
          {title ? <Div className={`mt-2 ${APP_SHELL_DESC_CLASS}`}>{title}</Div> : null}
        </Div>
      </Div>
    );
  }

  return (
    <Div className={`${APP_WINDOW_BODY_CLASS} ${APP_SHELL_BODY_CLASS} relative h-full min-h-0 flex-1 overflow-hidden`}>
      {ownerNickname || canEdit || canShare || canDelete ? (
        <Div className="generated-app-toolbar">
          <Button
            type="button"
            aria-label={ownerNickname || t('moa_apps_ai.preview_title')}
            title={ownerNickname || t('moa_apps_ai.preview_title')}
            onClick={() => {
              if (hasActions) {
                setIsMenuOpen(open => !open);
              }
            }}
            className={`liquid-glass generated-app-owner-button ${hasActions ? 'is-actionable' : 'is-static'} ${hasActions && isMenuOpen ? 'is-open' : ''}`}
          >
            {hasActions ? (
              <Icon
                name="chevron-up"
                size="xs"
                className="generated-app-owner-caret"
                aria-hidden="true"
              />
            ) : null}
            <Span className="generated-app-owner-label" title={ownerNickname}>
              {ownerNickname}
            </Span>
          </Button>
          {hasActions ? (
            <Div
              className={`generated-app-action-menu liquid-glass ${isMenuOpen ? 'is-open' : 'is-closed'}`}
            >
              {canEdit ? (
                <Button
                  type="button"
                  aria-label={t('moa_mypage.library.edit_app')}
                  title={t('moa_mypage.library.edit_app')}
                  onClick={() => onEditGeneratedApp?.(serverId)}
                  variant="neutral"
                  size="xs"
                  className="generated-app-action-button is-edit"
                >
                  <Icon name="edit" />
                  <Span>{t('moa_mypage.library.edit_app')}</Span>
                </Button>
              ) : null}
              {canShare ? (
                <Button
                  type="button"
                  aria-label={t(isShared ? 'moa_mypage.library.unshare_app' : 'moa_mypage.library.share_app')}
                  title={t(isShared ? 'moa_mypage.library.unshare_app' : 'moa_mypage.library.share_app')}
                  onClick={handleToggleShare}
                  variant="neutral"
                  size="xs"
                  className="generated-app-action-button is-share"
                >
                  <Icon name={isShared ? 'share-alt' : 'share'} />
                  <Span>{t(isShared ? 'moa_mypage.library.unshare_app' : 'moa_mypage.library.share_app')}</Span>
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  type="button"
                  aria-label={t('moa_mypage.library.delete_app')}
                  title={t('moa_mypage.library.delete_app')}
                  onClick={() => onDeleteGeneratedApp?.(serverId)}
                  variant="neutral"
                  size="xs"
                  className="generated-app-action-button is-danger"
                >
                  <Icon name="trash" />
                  <Span>{t('moa_mypage.library.delete_app')}</Span>
                </Button>
              ) : null}
            </Div>
          ) : null}
        </Div>
      ) : null}
      <iframe
        title={title || t('moa_apps_ai.preview_title')}
        className="generated-app-preview-frame"
        srcDoc={previewHtml}
        sandbox="allow-scripts"
      />
    </Div>
  );
}
