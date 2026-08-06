import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type StoredGeneratedApp } from '../../api/moabomAppsApi';
import { loadVisibleGeneratedAppSession, invalidateVisibleGeneratedAppSession } from './generatedAppVisibleSessionCache';
import { peekGeneratedAppOpenSeed } from './generatedAppOpenSeed';
import { pickGeneratedAppDisplayTitle } from './resolveGeneratedAppDisplayTitle';
import { useMoabomShellT } from 'moabom-shell-i18n';
import AppLoadingSpinner from '../../components/composite/AppLoadingSpinner';
import { Button } from '../../components/basic/Button';
import { Div } from '../../components/basic/Div';
import { Icon } from '../../components/basic/Icon';
import { Span } from '../../components/basic/Span';
import { liquidGlassOverlayClass, MOA_LIQUID_GLASS_CHIP_CLASS } from './liquidGlassOverlay';
import { useIframeBackdropTone } from './useIframeBackdropTone';
import { isShellAuthMember, useShellAuthStateKey } from '../../shell/moaShellAuthStateKey';
import { APP_SHELL_BODY_CLASS, APP_SHELL_DESC_CLASS, APP_SHELL_PANEL_BODY_CLASS, APP_WINDOW_BODY_CLASS } from '../appShellTypography';
import { resolveGeneratedAppFrameUrl, generatedAppFrameSandbox } from './generatedAppPreviewUrl';
import {
  handleMoabomAppFileDownloadMessage,
  handleMoabomAppShellBridgeMessage,
} from './generatedAppIframeBridge';
import {
  isWebsiteLinkAppType,
  isWebsiteLinkNewWindowLaunch,
  normalizeWebsiteUrl,
} from '../ai-generator/websiteLinkApp';
import { useGeneratedAppToolbarDrag } from './useGeneratedAppToolbarDrag';
import { GeneratedAppVersionHistoryPanel } from './versionHistory/GeneratedAppVersionHistoryPanel';
import { GeneratedAppHostedDataConsole } from './hostedDataConsole/GeneratedAppHostedDataConsole';
import { pushInfoToast, pushWarningToast, showAppEditToast } from '../../runtime/moaShellToasts';

// 멈춤 감지 워치독 — 앱 메인 스레드가 막히면 회신(pong)이 끊긴다.
// Origin-Agent-Cluster 로 iframe 이 독립 이벤트 루프를 가지므로, 부모 타이머는
// 앱 JS가 멈춰도 pong 부재를 감지할 수 있다.
// 단, 백그라운드 탭은 브라우저가 타이머·postMessage 를 스로틀하므로 visibility 기준으로 일시 정지한다.
const HEARTBEAT_PING_INTERVAL_MS = 2000;
const HEARTBEAT_WATCH_INTERVAL_MS = 2000;
const HEARTBEAT_FROZEN_THRESHOLD_MS = 6000;
// 첫 멈춤은 조용히 자동 재시작하고, 재시작 후에도 다시 멈추면 사용자에게 수동 재시작을 노출한다.
const MAX_AUTO_RELOAD = 1;
// iframe onLoad 직후 pong/probe 전에도 오버레이를 일찍 내려 체감 지연을 줄인다.
const FRAME_READY_SOFT_MS = 180;
// pong·probe 미수신 시 절대 폴백 — 초과 시 빈 화면 고착 방지.
const FRAME_READY_FALLBACK_MS = 8_000;

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
  const [frozen, setFrozen] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [externalWindowBlocked, setExternalWindowBlocked] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dataConsoleOpen, setDataConsoleOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastPongRef = useRef(0);
  const autoReloadCountRef = useRef(0);
  const frameReadyFallbackRef = useRef<number | null>(null);
  const frameReadySoftRef = useRef<number | null>(null);
  const externalWindowRef = useRef<Window | null>(null);
  const {
    toolbarStyle,
    isDragging,
    handleClassName: ownerDragHandleClass,
    resetPosition,
    ownerPointerHandlers,
    shouldSuppressOwnerClick,
  } = useGeneratedAppToolbarDrag(containerRef, toolbarRef);

  const clearFrameReadySoft = useCallback(() => {
    if (frameReadySoftRef.current != null) {
      window.clearTimeout(frameReadySoftRef.current);
      frameReadySoftRef.current = null;
    }
  }, []);

  const clearFrameReadyFallback = useCallback(() => {
    if (frameReadyFallbackRef.current != null) {
      window.clearTimeout(frameReadyFallbackRef.current);
      frameReadyFallbackRef.current = null;
    }
    clearFrameReadySoft();
  }, [clearFrameReadySoft]);

  const markFrameReady = useCallback(() => {
    setIsFrameReady(prev => {
      if (prev) {
        return prev;
      }
      clearFrameReadyFallback();
      return true;
    });
  }, [clearFrameReadyFallback]);

  const getOwnerProbeAnchor = useCallback(
    () => toolbarRef.current?.querySelector<HTMLElement>('.generated-app-owner-button') ?? null,
    [],
  );

  const handleProbedTone = useCallback(() => {
    markFrameReady();
  }, [markFrameReady]);

  const { tone: liquidGlassTone, requestBackdropProbe } = useIframeBackdropTone({
    iframeRef,
    enabled: Boolean(frameUrl),
    staticHtml: app?.html ?? null,
    isDragging,
    contentKey: frameUrl,
    getAnchorElement: getOwnerProbeAnchor,
    fallbackCorner: 'bottom-left',
    onProbedTone: handleProbedTone,
  });

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsFrameReady(false);
    setError('');
    setIsMenuOpen(false);
    setFrozen(false);
    setReloadToken(0);
    setExternalWindowBlocked(false);
    setHistoryOpen(false);
    setDataConsoleOpen(false);
    autoReloadCountRef.current = 0;
    externalWindowRef.current = null;
    resetPosition();
    setApp(null);
    setFrameUrl(null);
    setTitle('');

    // 카탈로그 seed 로 website_link iframe 을 API 완료 전에 시작한다.
    const openSeed = peekGeneratedAppOpenSeed(serverId);
    if (openSeed?.title?.trim()) {
      setTitle(openSeed.title.trim());
    }
    if (
      isWebsiteLinkAppType(openSeed?.appType)
      && typeof openSeed?.websiteUrl === 'string'
      && openSeed.websiteUrl.trim()
    ) {
      const isNewWindow = isWebsiteLinkNewWindowLaunch({
        launch_mode: openSeed.launchMode,
      });
      if (isNewWindow) {
        setIsFrameReady(true);
        setIsLoading(false);
      } else {
        const seededUrl = normalizeWebsiteUrl(openSeed.websiteUrl);
        if (seededUrl) {
          setFrameUrl(seededUrl);
          setIsLoading(false);
        }
      }
    } else if (
      !isWebsiteLinkAppType(openSeed?.appType)
      && typeof openSeed?.previewUrl === 'string'
      && openSeed.previewUrl.trim()
    ) {
      // 공개 standard AI 앱: 토큰 없는 프리뷰 URL 로 show 완료 전 iframe 병렬 시작.
      // show 는 타이틀·권한·메타를 채우며 동일 URL 로 재확정(멱등).
      setFrameUrl(openSeed.previewUrl.trim());
    }

    void (async () => {
      try {
        const loaded = await loadVisibleGeneratedAppSession(serverId, authStateKey, { includeHtml: false });
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
        const nextFrameUrl = resolveGeneratedAppFrameUrl(loaded);
        setFrameUrl(nextFrameUrl);
        if (
          isWebsiteLinkAppType(loaded.app_type)
          && isWebsiteLinkNewWindowLaunch(loaded.metadata as Record<string, unknown> | undefined)
        ) {
          // 아이콘 클릭 시 openApp 이 이미 새창을 연다. 뷰어는 플레이스홀더만 표시.
          setIsFrameReady(true);
        }
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

  // iframe 브릿지 메시지: heartbeat-pong, file-download, shell bridge.
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
      if (handleMoabomAppShellBridgeMessage(data, {
        onToast: (message, severity) => {
          if (severity === 'success') {
            showAppEditToast('success', message);
          } else if (severity === 'warning' || severity === 'error') {
            pushWarningToast(message);
          } else {
            pushInfoToast(message);
          }
        },
        onOpenApp: (appId) => {
          window.dispatchEvent(new CustomEvent('moabom-shell-open-app', { detail: { appId } }));
        },
      })) {
        return;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [t, markFrameReady]);

  const isWebsiteLinkApp = isWebsiteLinkAppType(app?.app_type);
  const isNewWindowLaunch = Boolean(
    isWebsiteLinkApp
    && app?.metadata
    && isWebsiteLinkNewWindowLaunch(app.metadata as Record<string, unknown>),
  );
  // 외부 웹사이트 연결은 우리 주입 스크립트(pong)가 없으므로 워치독 대상에서 제외한다.
  // 새창 실행은 셸 iframe 을 쓰지 않으므로 워치독·로딩 오버레이 대상에서 제외한다.
  const isAiPreviewApp = Boolean(frameUrl) && !isWebsiteLinkAppType(app?.app_type);
  const showFrameLoadingOverlay = Boolean(frameUrl) && !isNewWindowLaunch && !isFrameReady;

  const openExternalWebsite = useCallback((url: string) => {
    const trimmed = url.trim();
    if (!trimmed) {
      return false;
    }

    try {
      const existing = externalWindowRef.current;
      if (existing && !existing.closed) {
        existing.focus();
        setExternalWindowBlocked(false);
        return true;
      }
    } catch {
      // cross-origin closed 검사 실패 시 새 창으로 재시도
    }

    const opened = window.open(trimmed, '_blank', 'noopener,noreferrer');
    if (!opened) {
      setExternalWindowBlocked(true);
      return false;
    }

    externalWindowRef.current = opened;
    setExternalWindowBlocked(false);
    return true;
  }, []);

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
    // AI/Standard/Hosted 프리뷰 — pong/probe 가 오면 즉시 ready. 없어도 soft 후 오버레이 해제.
    postHeartbeatPing();
    window.setTimeout(requestBackdropProbe, 140);
    clearFrameReadySoft();
    frameReadySoftRef.current = window.setTimeout(() => {
      markFrameReady();
    }, FRAME_READY_SOFT_MS);
  }, [
    clearFrameReadySoft,
    isWebsiteLinkApp,
    markFrameReady,
    postHeartbeatPing,
    requestBackdropProbe,
  ]);

  const restartFrame = useCallback(() => {
    autoReloadCountRef.current = 0;
    lastPongRef.current = Date.now();
    setFrozen(false);
    setReloadToken(token => token + 1);
  }, []);

  // 멈춤 감지 워치독: 주기적 ping → pong 미수신이 임계치를 넘으면 자동 1회 재시작,
  // 그래도 멈추면 사용자에게 수동 재시작 오버레이를 노출한다.
  // 문서·뷰어가 보이지 않으면 ping/watch 를 멈춘다 (전역 상주 CPU 방지).
  useEffect(() => {
    if (!isAiPreviewApp) {
      return;
    }
    lastPongRef.current = Date.now();
    setFrozen(false);

    let ping: number | null = null;
    let watch: number | null = null;
    let io: IntersectionObserver | null = null;
    let viewerVisible = true;

    const clearTimers = () => {
      if (ping !== null) {
        window.clearInterval(ping);
        ping = null;
      }
      if (watch !== null) {
        window.clearInterval(watch);
        watch = null;
      }
    };

    const startTimers = () => {
      if (ping !== null) {
        return;
      }
      lastPongRef.current = Date.now();
      ping = window.setInterval(() => {
        if (document.visibilityState !== 'visible' || !viewerVisible) {
          return;
        }
        postHeartbeatPing();
      }, HEARTBEAT_PING_INTERVAL_MS);

      watch = window.setInterval(() => {
        if (document.visibilityState !== 'visible' || !viewerVisible) {
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
      }, HEARTBEAT_WATCH_INTERVAL_MS);
    };

    const syncRunning = () => {
      const pageVisible = document.visibilityState === 'visible';
      if (pageVisible && viewerVisible) {
        startTimers();
      } else {
        clearTimers();
        lastPongRef.current = Date.now();
      }
    };

    const root = containerRef.current;
    if (root && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        ([entry]) => {
          viewerVisible = Boolean(entry?.isIntersecting);
          syncRunning();
        },
        { threshold: 0.05 },
      );
      io.observe(root);
    }

    document.addEventListener('visibilitychange', syncRunning);
    syncRunning();

    return () => {
      document.removeEventListener('visibilitychange', syncRunning);
      io?.disconnect();
      clearTimers();
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
  const canVersions = Boolean(isMember && permissions?.can_edit);
  const canDataConsole = Boolean(
    isMember && permissions?.can_edit && app?.tier === 'hosted',
  );
  const hasActions = canEdit || canShare || canDelete || canCommunityRead || canVersions || canDataConsole;
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
              // 스크롤 옵저버 없이, 클릭 순간에만 버튼 위치 배경을 재측정한다.
              requestBackdropProbe();
              if (hasActions) {
                setIsMenuOpen(open => !open);
              }
            }}
            className={liquidGlassOverlayClass(
              liquidGlassTone,
              MOA_LIQUID_GLASS_CHIP_CLASS,
              'generated-app-owner-button',
              ownerDragHandleClass,
              hasActions ? 'is-actionable' : '',
              hasActions && isMenuOpen ? 'is-open' : '',
            )}
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
              className={liquidGlassOverlayClass(
                liquidGlassTone,
                'generated-app-action-menu',
                isMenuOpen ? 'is-open' : 'is-closed',
              )}
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
              {canVersions ? (
                <Button
                  type="button"
                  aria-label={t('moa_apps_ai.versions.open')}
                  title={t('moa_apps_ai.versions.open')}
                  onClick={() => {
                    setDataConsoleOpen(false);
                    setHistoryOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="generated-app-action-button is-versions"
                >
                  <Icon name="history" />
                  <Span>{t('moa_apps_ai.versions.open')}</Span>
                </Button>
              ) : null}
              {canDataConsole ? (
                <Button
                  type="button"
                  aria-label={t('moa_apps_ai.data_console.open')}
                  title={t('moa_apps_ai.data_console.open')}
                  onClick={() => {
                    setHistoryOpen(false);
                    setDataConsoleOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="generated-app-action-button is-data"
                >
                  <Icon name="database" />
                  <Span>{t('moa_apps_ai.data_console.open')}</Span>
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
      {frameUrl && !isNewWindowLaunch ? (
        <iframe
          ref={iframeRef}
          title={title || t('moa_apps_ai.preview_title')}
          className={`generated-app-preview-frame${showFrameLoadingOverlay ? ' is-loading' : ' is-ready'}`}
          src={watchedSrc ?? undefined}
          sandbox={generatedAppFrameSandbox(frameUrl, app?.app_type)}
          onLoad={handleFrameLoad}
        />
      ) : null}
      {isNewWindowLaunch && frameUrl && !isLoading ? (
        <Div className="generated-app-external-launch">
          <Div className="generated-app-external-launch-card glass-sm">
            <Icon name="external-link" className="generated-app-external-launch-icon" aria-hidden />
            <Div className={APP_SHELL_BODY_CLASS}>
              {t('moa_apps_ai.external_launch_title', { title: title || t('moa_apps_ai.untitled_app') })}
            </Div>
            <Div className={`generated-app-external-launch-desc ${APP_SHELL_DESC_CLASS}`}>
              {externalWindowBlocked
                ? t('moa_apps_ai.external_launch_blocked')
                : t('moa_apps_ai.external_launch_description')}
            </Div>
            <Button
              type="button"
              variant="primary"
              size="medium"
              onClick={() => openExternalWebsite(frameUrl)}
              className="generated-app-external-launch-reopen"
            >
              <Icon name="external-link" />
              <Span>{t('moa_apps_ai.external_launch_reopen')}</Span>
            </Button>
          </Div>
        </Div>
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
      <GeneratedAppVersionHistoryPanel
        serverId={serverId}
        open={historyOpen}
        backdropTone={liquidGlassTone}
        onClose={() => setHistoryOpen(false)}
        onRestored={(restored) => {
          invalidateVisibleGeneratedAppSession(serverId);
          setApp(restored);
          setFrameUrl(resolveGeneratedAppFrameUrl(restored));
          setIsFrameReady(false);
          setReloadToken((token) => token + 1);
          setHistoryOpen(false);
          showAppEditToast('success', t('moa_apps_ai.versions.restore_success'));
        }}
        t={t}
      />
      <GeneratedAppHostedDataConsole
        serverId={serverId}
        open={dataConsoleOpen}
        backdropTone={liquidGlassTone}
        onClose={() => setDataConsoleOpen(false)}
        t={t}
      />
    </Div>
  );
}
