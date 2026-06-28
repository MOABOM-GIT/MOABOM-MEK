import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type StoredGeneratedApp } from '../../api/moabomAppsApi';
import { loadVisibleGeneratedAppSession } from './generatedAppVisibleSessionCache';
import { useMoabomShellT } from 'moabom-shell-i18n';
import AppLoadingSpinner from '../../components/composite/AppLoadingSpinner';
import { Button } from '../../components/basic/Button';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { Span } from '../../components/basic/Span';
import {
  type LiquidGlassBackdropTone,
  liquidGlassBackdropClassName,
  resolveLiquidGlassBackdropToneFromHtml,
} from '../../components/composite/liquidGlassBackdropTone';
import { isShellAuthMember, useShellAuthStateKey } from '../../shell/moaShellAuthStateKey';
import { APP_SHELL_BODY_CLASS, APP_SHELL_DESC_CLASS, APP_SHELL_PANEL_BODY_CLASS, APP_WINDOW_BODY_CLASS } from '../appShellTypography';
import { resolveGeneratedAppFrameUrl, generatedAppFrameSandbox } from './generatedAppPreviewUrl';
import { useGeneratedAppToolbarDrag } from './useGeneratedAppToolbarDrag';

export interface GeneratedAppViewerProps {
  serverId: number;
  authStateKey?: string;
  onEditGeneratedApp?: (serverId: number) => void;
  onDeleteGeneratedApp?: (serverId: number) => void;
  onToggleGeneratedAppShare?: (serverId: number, nextShared: boolean) => void | Promise<void>;
  onOpenAppCommunity?: (serverId: number, options?: { title?: string; canWrite?: boolean }) => void;
  onResolvedTitle?: (title: string) => void;
}

export function GeneratedAppViewer({
  serverId,
  authStateKey: authStateKeyProp,
  onEditGeneratedApp,
  onDeleteGeneratedApp,
  onToggleGeneratedAppShare,
  onOpenAppCommunity,
  onResolvedTitle,
}: GeneratedAppViewerProps) {
  const { t } = useMoabomShellT();
  const storeAuthStateKey = useShellAuthStateKey();
  const authStateKey = authStateKeyProp ?? storeAuthStateKey;
  const isMember = isShellAuthMember(authStateKey);
  const [app, setApp] = useState<StoredGeneratedApp | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [probedTone, setProbedTone] = useState<LiquidGlassBackdropTone | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const {
    toolbarStyle,
    isDragging,
    resetPosition,
    ownerPointerHandlers,
    shouldSuppressOwnerClick,
  } = useGeneratedAppToolbarDrag(containerRef, toolbarRef);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');
    setIsMenuOpen(false);
    setProbedTone(null);
    resetPosition();
    setApp(null);
    setFrameUrl(null);
    setTitle('');

    void (async () => {
      try {
        const loaded = await loadVisibleGeneratedAppSession(serverId, authStateKey);
        if (cancelled) {
          return;
        }
        setApp(loaded);
        const resolvedTitle = loaded.title?.trim() || `App #${loaded.id}`;
        setTitle(resolvedTitle);
        if (loaded.title?.trim()) {
          onResolvedTitle?.(resolvedTitle);
        }
        setFrameUrl(resolveGeneratedAppFrameUrl(loaded));
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
  }, [serverId, t, authStateKey, onResolvedTitle, resetPosition]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [authStateKey]);

  useEffect(() => {
    if (isDragging) {
      setIsMenuOpen(false);
    }
  }, [isDragging]);

  // iframe 내부 프로브가 회신한 배경 톤 수신 (cross-origin 안전: 톤 문자열만 신뢰).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // 자기 iframe 이 보낸 톤만 수용 — 여러 앱 창이 열려도 창별로 독립 동작한다.
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      const data = event.data as { source?: string; type?: string; tone?: string } | null;
      if (!data || data.source !== 'moabom-app' || data.type !== 'backdrop-tone') {
        return;
      }
      if (data.tone === 'light' || data.tone === 'dark') {
        setProbedTone(data.tone);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // 오너 버튼의 현재 화면 위치를 iframe 좌표로 변환해 프로브에 측정 지점을 요청한다.
  const requestBackdropProbe = useCallback(() => {
    const frame = iframeRef.current;
    if (!frame?.contentWindow) {
      return;
    }
    const frameRect = frame.getBoundingClientRect();
    const button = toolbarRef.current?.querySelector<HTMLElement>('.generated-app-owner-button');
    const points: Array<{ x: number; y: number }> = [];
    if (button) {
      const rect = button.getBoundingClientRect();
      const cy = rect.top - frameRect.top + rect.height / 2;
      points.push(
        { x: rect.left - frameRect.left + rect.width / 2, y: cy },
        { x: rect.left - frameRect.left + 6, y: cy },
        { x: rect.right - frameRect.left - 6, y: cy },
      );
    } else {
      points.push({ x: 28, y: frameRect.height - 28 });
    }
    frame.contentWindow.postMessage(
      { source: 'moabom-shell', type: 'backdrop-probe', id: Date.now(), points },
      '*',
    );
  }, []);

  // 최초/드래그 종료 후 재측정 (드래그 중에는 생략).
  useEffect(() => {
    if (isDragging || !frameUrl) {
      return;
    }
    const timer = window.setTimeout(requestBackdropProbe, 140);
    return () => window.clearTimeout(timer);
  }, [isDragging, frameUrl, requestBackdropProbe]);

  const ownerNickname = app?.owner?.nickname?.trim() || '';
  const permissions = app?.permissions;
  const isPublished = Boolean(app?.visibility && app.visibility !== 'private') || Boolean(app?.is_shared);
  const handleToggleShare = async () => {
    if (!onToggleGeneratedAppShare) {
      return;
    }
    const nextPublished = !isPublished;
    setApp(prev => prev ? {
      ...prev,
      visibility: nextPublished ? 'tenant' : 'private',
      is_shared: nextPublished,
    } : prev);
    try {
      await onToggleGeneratedAppShare(serverId, nextPublished);
    } catch {
      setApp(prev => prev ? {
        ...prev,
        visibility: !nextPublished ? 'tenant' : 'private',
        is_shared: !nextPublished,
      } : prev);
    }
  };

  const canEdit = Boolean(isMember && permissions?.can_edit && onEditGeneratedApp);
  const canShare = Boolean(isMember && permissions?.can_share && onToggleGeneratedAppShare);
  const canDelete = Boolean(isMember && permissions?.can_delete && onDeleteGeneratedApp);
  const canCommunityRead = Boolean(permissions?.can_community_read !== false && onOpenAppCommunity);
  const canCommunityWrite = Boolean(isMember && permissions?.can_community_write);
  const hasActions = canEdit || canShare || canDelete || canCommunityRead;
  const staticTone = useMemo(
    () => resolveLiquidGlassBackdropToneFromHtml(app?.html),
    [app?.html],
  );
  // 런타임 프로브(실측) 우선, 미수신 시 HTML 정적 추정으로 폴백.
  const liquidGlassBackdropClass = liquidGlassBackdropClassName(probedTone ?? staticTone);

  if (isLoading) {
    return (
      <AppLoadingSpinner label={t('moa_apps_ai.viewer_loading')} fill />
    );
  }

  if (error) {
    return (
      <Div className={`${APP_WINDOW_BODY_CLASS} ${APP_SHELL_BODY_CLASS} flex min-h-[320px] items-center justify-center`}>
        <Div className={`${APP_SHELL_PANEL_BODY_CLASS} max-w-md text-center`}>
          <Icon name="exclamation-circle" className="mb-3 text-3xl text-red-500" />
          <Div className={APP_SHELL_BODY_CLASS}>{error}</Div>
        </Div>
      </Div>
    );
  }

  if (!frameUrl) {
    return (
      <Div className={`${APP_WINDOW_BODY_CLASS} ${APP_SHELL_BODY_CLASS} flex min-h-[320px] items-center justify-center`}>
        <Div className={`${APP_SHELL_PANEL_BODY_CLASS} max-w-md text-center`}>
          <Icon name="file-alt" className="mb-3 text-3xl text-faint" />
          <Div className={APP_SHELL_BODY_CLASS}>{t('moa_apps_ai.viewer_empty')}</Div>
          {title ? <Div className={`mt-2 ${APP_SHELL_DESC_CLASS}`}>{title}</Div> : null}
        </Div>
      </Div>
    );
  }

  return (
    <Div
      ref={containerRef}
      className={`${APP_WINDOW_BODY_CLASS} ${APP_SHELL_BODY_CLASS} relative h-full min-h-0 flex-1 overflow-hidden`}
    >
      {ownerNickname || canEdit || canShare || canDelete || canCommunityRead ? (
        <Div
          ref={toolbarRef}
          className={`generated-app-toolbar ${isDragging ? 'is-dragging' : ''}`}
          style={toolbarStyle}
        >
          <Button
            type="button"
            aria-label={ownerNickname || t('moa_apps_ai.preview_title')}
            title={ownerNickname || t('moa_apps_ai.preview_title')}
            {...ownerPointerHandlers}
            onClick={() => {
              if (shouldSuppressOwnerClick()) {
                return;
              }
              if (hasActions) {
                setIsMenuOpen(open => !open);
              }
            }}
            className={`liquid-glass ${liquidGlassBackdropClass} generated-app-owner-button ${hasActions ? 'is-actionable' : 'is-draggable'} ${hasActions && isMenuOpen ? 'is-open' : ''} ${isDragging ? 'is-dragging' : ''}`}
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
              className={`generated-app-action-menu liquid-glass ${liquidGlassBackdropClass} ${isMenuOpen ? 'is-open' : 'is-closed'}`}
            >
              {canEdit ? (
                <Button
                  type="button"
                  aria-label={t('moa_mypage.library.edit_app')}
                  title={t('moa_mypage.library.edit_app')}
                  onClick={() => onEditGeneratedApp?.(serverId)}
                  className="generated-app-action-button is-edit"
                >
                  <Icon name="edit" />
                  <Span>{t('moa_mypage.library.edit_app')}</Span>
                </Button>
              ) : null}
              {canShare ? (
                <Button
                  type="button"
                  aria-label={t(isPublished ? 'moa_mypage.library.unshare_app' : 'moa_mypage.library.share_app')}
                  title={t(isPublished ? 'moa_mypage.library.unshare_app' : 'moa_mypage.library.share_app')}
                  onClick={handleToggleShare}
                  className="generated-app-action-button is-share"
                >
                  <Icon name={isPublished ? 'share-alt' : 'share'} />
                  <Span>{t(isPublished ? 'moa_mypage.library.unshare_app' : 'moa_mypage.library.share_app')}</Span>
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  type="button"
                  aria-label={t('moa_mypage.library.delete_app')}
                  title={t('moa_mypage.library.delete_app')}
                  onClick={() => onDeleteGeneratedApp?.(serverId)}
                  className="generated-app-action-button is-danger"
                >
                  <Icon name="trash" />
                  <Span>{t('moa_mypage.library.delete_app')}</Span>
                </Button>
              ) : null}
              {canCommunityRead ? (
                <Button
                  type="button"
                  aria-label={t('moa_apps_ai.community.open')}
                  title={t('moa_apps_ai.community.open')}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAppCommunity?.(serverId, {
                      title: title || app?.title,
                      canWrite: canCommunityWrite,
                    });
                  }}
                  className="generated-app-action-button is-community"
                >
                  <Icon name="comments" />
                  <Span>{t('moa_apps_ai.community.open')}</Span>
                </Button>
              ) : null}
            </Div>
          ) : null}
        </Div>
      ) : null}
      <iframe
        ref={iframeRef}
        title={title || t('moa_apps_ai.preview_title')}
        className="generated-app-preview-frame"
        src={frameUrl}
        sandbox={generatedAppFrameSandbox(frameUrl, app?.app_type)}
        onLoad={() => {
          window.setTimeout(requestBackdropProbe, 140);
        }}
      />
    </Div>
  );
}
