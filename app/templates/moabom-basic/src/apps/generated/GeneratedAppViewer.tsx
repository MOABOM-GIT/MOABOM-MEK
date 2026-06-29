import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type StoredGeneratedApp } from '../../api/moabomAppsApi';
import { loadVisibleGeneratedAppSession } from './generatedAppVisibleSessionCache';
import { pickGeneratedAppDisplayTitle } from './resolveGeneratedAppDisplayTitle';
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
import { handleMoabomAppFileDownloadMessage } from './generatedAppIframeBridge';
import { isWebsiteLinkAppType } from '../ai-generator/websiteLinkApp';
import { useGeneratedAppToolbarDrag } from './useGeneratedAppToolbarDrag';

// 멈춤 감지 워치독 — 앱 메인 스레드가 막히면 회신(pong)이 끊긴다.
// Origin-Agent-Cluster 로 iframe 이 독립 이벤트 루프를 가지므로, 부모 타이머는
// 앱 JS가 멈춰도 pong 부재를 감지할 수 있다.
// 단, 백그라운드 탭은 브라우저가 타이머·postMessage 를 스로틀하므로 visibility 기준으로 일시 정지한다.
const HEARTBEAT_PING_INTERVAL_MS = 2000;
const HEARTBEAT_FROZEN_THRESHOLD_MS = 6000;
// 첫 멈춤은 조용히 자동 재시작하고, 재시작 후에도 다시 멈추면 사용자에게 수동 재시작을 노출한다.
const MAX_AUTO_RELOAD = 1;
// iframe HTML·주입 스크립트·앱 JS 부트 대기 — 초과 시 빈 화면 고착 방지.
const FRAME_READY_FALLBACK_MS = 12_000;

export interface GeneratedAppViewerProps {
  serverId: number;
  authStateKey?: string;
  onEditGeneratedApp?: (serverId: number) => void;
  onDeleteGeneratedApp?: (serverId: number, displayTitle?: string) => void;
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
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [probedTone, setProbedTone] = useState<LiquidGlassBackdropTone | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastPongRef = useRef(0);
  const autoReloadCountRef = useRef(0);
  const frameReadyFallbackRef = useRef<number | null>(null);
  const {
    toolbarStyle,
    isDragging,
    resetPosition,
    ownerPointerHandlers,
    shouldSuppressOwnerClick,
  } = useGeneratedAppToolbarDrag(containerRef, toolbarRef);

  const clearFrameReadyFallback = useCallback(() => {
    if (frameReadyFallbackRef.current != null) {
      window.clearTimeout(frameReadyFallbackRef.current);
      frameReadyFallbackRef.current = null;
    }
  }, []);

  const markFrameReady = useCallback(() => {
    setIsFrameReady(prev => {
      if (prev) {
        return prev;
      }
      clearFrameReadyFallback();
      return true;
    });
  }, [clearFrameReadyFallback]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsFrameReady(false);
    setError('');
    setIsMenuOpen(false);
    setProbedTone(null);
    setFrozen(false);
    setReloadToken(0);
    autoReloadCountRef.current = 0;
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
        const resolvedTitle = pickGeneratedAppDisplayTitle(
          loaded.title?.trim(),
          loaded.prompt?.trim()?.slice(0, 80),
        ) || t('moa_apps_ai.untitled_app');
        setTitle(resolvedTitle);
        onResolvedTitle?.(resolvedTitle);
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
      if (!data || data.source !== 'moabom-app') {
        return;
      }
      // 워치독 생존 신호 — 앱 메인 스레드가 살아있다는 증거.
      if (data.type === 'heartbeat-pong') {
        lastPongRef.current = Date.now();
        markFrameReady();
        return;
      }
      if (data.type === 'file-download') {
        if (!handleMoabomAppFileDownloadMessage(data)) {
          const G7Core = (window as { G7Core?: { toast?: { error?: (message: string) => void } } }).G7Core;
          G7Core?.toast?.error?.(t('moa_apps_ai.download_failed'));
        }
        return;
      }
      if (data.type !== 'backdrop-tone') {
        return;
      }
      markFrameReady();
      if (data.tone === 'light' || data.tone === 'dark') {
        setProbedTone(data.tone);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [t, markFrameReady]);

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

  // 외부 웹사이트 연결은 우리 주입 스크립트(pong)가 없으므로 워치독 대상에서 제외한다.
  const isAiPreviewApp = Boolean(frameUrl) && !isWebsiteLinkAppType(app?.app_type);
  const isWebsiteLinkApp = isWebsiteLinkAppType(app?.app_type);
  const showFrameLoadingOverlay = Boolean(frameUrl) && !isFrameReady;

  const postHeartbeatPing = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: 'moabom-shell', type: 'heartbeat-ping', id: Date.now() },
      '*',
    );
  }, []);

  // 백그라운드 탭·다른 창 전환 시 ping/pong 이 스로틀되어 멈춤으로 오인하지 않도록 시계를 멈춘다.
  useEffect(() => {
    if (!isAiPreviewApp) {
      return;
    }
    const syncPageVisibility = () => {
      if (document.visibilityState !== 'visible') {
        lastPongRef.current = Date.now();
        return;
      }
      lastPongRef.current = Date.now();
      setFrozen(false);
      postHeartbeatPing();
    };
    document.addEventListener('visibilitychange', syncPageVisibility);
    return () => document.removeEventListener('visibilitychange', syncPageVisibility);
  }, [isAiPreviewApp, postHeartbeatPing]);

  // iframe src 변경·자동 재시작마다 준비 상태를 리셋하고, 응답 없을 때를 대비한 폴백을 둔다.
  useEffect(() => {
    if (!frameUrl) {
      setIsFrameReady(false);
      clearFrameReadyFallback();
      return;
    }
    setIsFrameReady(false);
    clearFrameReadyFallback();
    frameReadyFallbackRef.current = window.setTimeout(() => {
      markFrameReady();
    }, FRAME_READY_FALLBACK_MS);
    return () => {
      clearFrameReadyFallback();
    };
  }, [frameUrl, reloadToken, clearFrameReadyFallback, markFrameReady]);

  const handleFrameLoad = useCallback(() => {
    lastPongRef.current = Date.now();
    if (isWebsiteLinkApp) {
      markFrameReady();
      return;
    }
    // AI/Standard/Hosted 프리뷰 — 주입 스크립트 생존 신호(backdrop-tone·pong)까지 오버레이 유지.
    postHeartbeatPing();
    window.setTimeout(requestBackdropProbe, 140);
  }, [isWebsiteLinkApp, markFrameReady, postHeartbeatPing, requestBackdropProbe]);

  const restartFrame = useCallback(() => {
    autoReloadCountRef.current = 0;
    lastPongRef.current = Date.now();
    setFrozen(false);
    setReloadToken(token => token + 1);
  }, []);

  // 멈춤 감지 워치독: 주기적 ping → pong 미수신이 임계치를 넘으면 자동 1회 재시작,
  // 그래도 멈추면 사용자에게 수동 재시작 오버레이를 노출한다.
  useEffect(() => {
    if (!isAiPreviewApp) {
      return;
    }
    lastPongRef.current = Date.now();
    setFrozen(false);

    const ping = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      postHeartbeatPing();
    }, HEARTBEAT_PING_INTERVAL_MS);

    const watch = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        lastPongRef.current = Date.now();
        return;
      }
      if (Date.now() - lastPongRef.current <= HEARTBEAT_FROZEN_THRESHOLD_MS) {
        return;
      }
      if (autoReloadCountRef.current < MAX_AUTO_RELOAD) {
        autoReloadCountRef.current += 1;
        lastPongRef.current = Date.now();
        setReloadToken(token => token + 1);
      } else {
        setFrozen(true);
      }
    }, 1000);

    return () => {
      window.clearInterval(ping);
      window.clearInterval(watch);
    };
  }, [isAiPreviewApp, reloadToken, postHeartbeatPing]);

  // 자동 재시작 시 iframe src 에 nonce 를 붙여 강제 재로드한다(cross-origin contentWindow 직접 reload 불가).
  const watchedSrc = useMemo(() => {
    if (!frameUrl || !isAiPreviewApp || reloadToken === 0) {
      return frameUrl;
    }
    const separator = frameUrl.includes('?') ? '&' : '?';
    return `${frameUrl}${separator}__moa_reload=${reloadToken}`;
  }, [frameUrl, isAiPreviewApp, reloadToken]);

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
  const viewerShellClass = `${APP_WINDOW_BODY_CLASS} ${APP_SHELL_BODY_CLASS} relative h-full min-h-0 flex-1 overflow-hidden`;
  const showLoadingOverlay = isLoading || showFrameLoadingOverlay;

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

  if (!isLoading && !frameUrl) {
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
      className={viewerShellClass}
    >
      {!isLoading && frameUrl && (ownerNickname || canEdit || canShare || canDelete || canCommunityRead) ? (
        <Div
          ref={toolbarRef}
          className={`generated-app-toolbar ${isDragging ? 'is-dragging' : ''} ${showFrameLoadingOverlay ? 'is-frame-loading' : ''}`}
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
                  onClick={() => onDeleteGeneratedApp?.(serverId, title)}
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
      {frameUrl ? (
        <iframe
          ref={iframeRef}
          title={title || t('moa_apps_ai.preview_title')}
          className={`generated-app-preview-frame${showFrameLoadingOverlay ? ' is-loading' : ' is-ready'}`}
          src={watchedSrc ?? undefined}
          sandbox={generatedAppFrameSandbox(frameUrl, app?.app_type)}
          onLoad={handleFrameLoad}
        />
      ) : null}
      {showLoadingOverlay ? (
        <Div className="generated-app-frame-loading-overlay" aria-busy="true" aria-live="polite">
          <AppLoadingSpinner label={t('moa_apps_ai.viewer_loading')} fill />
        </Div>
      ) : null}
      {frozen ? (
        <Div className="generated-app-frozen-overlay">
          <Div className="generated-app-frozen-card glass-sm">
            <Icon name="exclamation-circle" className="generated-app-frozen-icon" aria-hidden />
            <Div className={APP_SHELL_BODY_CLASS}>{t('moa_apps_ai.frozen_title')}</Div>
            <Div className={`generated-app-frozen-desc ${APP_SHELL_DESC_CLASS}`}>
              {t('moa_apps_ai.frozen_description')}
            </Div>
            <Button
              type="button"
              variant="primary"
              size="medium"
              onClick={restartFrame}
              className="generated-app-frozen-restart"
            >
              <Icon name="sync" />
              <Span>{t('moa_apps_ai.frozen_restart')}</Span>
            </Button>
          </Div>
        </Div>
      ) : null}
    </Div>
  );
}
