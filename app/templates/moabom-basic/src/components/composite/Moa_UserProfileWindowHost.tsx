import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMoabomShellT } from '../../i18n/MoabomUiI18nProvider';
import {
  loadUserProfileWindowRenderPayload,
  resolveUserProfileWindowTitle,
  type UserProfileWindowView,
} from '../../shell/userProfileWindowLayoutRuntime';
import {
  buildUserProfilePayloadCacheKey,
  getCachedUserProfilePayload,
  invalidateUserProfileShellBindingCache,
  resolveUserProfileWindowQuery,
  setCachedUserProfilePayload,
} from '../../shell/userProfileWindowPrefetch';
import type { BoardWindowRenderPayload } from '../../shell/boardWindowLayoutRuntime';
import { moaShellUserProfileUuidFromAppId } from '../../shell/moaShellUserProfileIds';
import { MOA_SHELL_BOARD_URL_EVENT } from '../../shell/moaShellBoardBridge';
import { Button } from '../basic/Button';
import { Div } from '../basic/Div';
import AppLoadingSpinner from './AppLoadingSpinner';
import { APP_WINDOW_BODY_CLASS } from '../../apps/appShellTypography';
import { MoaG7ContainerHost } from './Moa_G7ContainerHost';
import { SubTabBar } from './Moa_SubTabBar';
import { Moa_ChatPanel } from './Moa_ChatPanel';

export interface UserProfileWindowHostProps {
  appId: string;
  userUuid?: string;
  userProfileView?: UserProfileWindowView;
  authStateKey?: string;
  onResolvedTitle?: (title: string) => void;
  onViewChange?: (view: UserProfileWindowView) => void;
}

type ViewPayloadState = {
  profile: BoardWindowRenderPayload | null;
  posts: BoardWindowRenderPayload | null;
};

function extractFetchedData(payload: BoardWindowRenderPayload): Record<string, unknown> {
  const fetched: Record<string, unknown> = {};
  for (const key of Object.keys(payload.dataContext)) {
    if (!key.startsWith('_') && key !== 'route' && key !== 'query' && key !== '$computed') {
      fetched[key] = payload.dataContext[key];
    }
  }
  return fetched;
}

function renderPayloadPane(
  payload: BoardWindowRenderPayload,
  view: UserProfileWindowView,
  subjectUuid: string,
  paneClassName: string,
): React.ReactNode {
  const {
    DynamicRenderer,
    componentDefs,
    dataContext,
    translationContext,
    registry,
    bindingEngine,
    translationEngine,
    actionDispatcher,
    layoutName,
  } = payload;

  return (
    <Div className={paneClassName}>
      <MoaG7ContainerHost
        className="moa-user-profile-window-host flex-1 text-primary"
        layoutRoots={componentDefs}
        hostTestId={`moa-user-profile-window-host-${view}`}
      >
        {adaptedDefs => (
          <>
            {adaptedDefs.map((componentDef, index) => (
              <DynamicRenderer
                key={
                  componentDef.id
                    ? `${subjectUuid}_${componentDef.id}_${layoutName}_${view}`
                    : `user-profile-window-${subjectUuid}-${index}_${layoutName}_${view}`
                }
                componentDef={componentDef}
                dataContext={dataContext}
                translationContext={translationContext}
                registry={registry}
                bindingEngine={bindingEngine}
                translationEngine={translationEngine}
                actionDispatcher={actionDispatcher}
                isRootRenderer={index === 0}
              />
            ))}
          </>
        )}
      </MoaG7ContainerHost>
    </Div>
  );
}

export const UserProfileWindowHost: React.FC<UserProfileWindowHostProps> = ({
  appId,
  userUuid: userUuidProp,
  userProfileView = 'profile',
  authStateKey,
  onResolvedTitle,
  onViewChange,
}) => {
  const { t } = useMoabomShellT();
  const onResolvedTitleRef = useRef(onResolvedTitle);
  onResolvedTitleRef.current = onResolvedTitle;

  const userUuid = userUuidProp ?? moaShellUserProfileUuidFromAppId(appId) ?? '';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [viewPayloads, setViewPayloads] = useState<ViewPayloadState>({ profile: null, posts: null });
  const [urlEpoch, setUrlEpoch] = useState(0);
  const viewPayloadsRef = useRef(viewPayloads);
  viewPayloadsRef.current = viewPayloads;
  const prevUserUuidRef = useRef(userUuid);
  const hostRootRef = useRef<HTMLDivElement>(null);
  const slideViewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prevUserUuidRef.current === userUuid) {
      return;
    }
    const previousUserUuid = prevUserUuidRef.current;
    prevUserUuidRef.current = userUuid;
    if (previousUserUuid && previousUserUuid !== userUuid) {
      invalidateUserProfileShellBindingCache();
    }
    setViewPayloads({ profile: null, posts: null });
    setError(null);
    setLoading(true);
    setRefetching(false);
  }, [userUuid]);

  useEffect(() => {
    const onUrl = () => setUrlEpoch(v => v + 1);
    window.addEventListener(MOA_SHELL_BOARD_URL_EVENT, onUrl);
    return () => window.removeEventListener(MOA_SHELL_BOARD_URL_EVENT, onUrl);
  }, []);

  const applyResolvedTitle = useCallback((payload: BoardWindowRenderPayload, view: UserProfileWindowView) => {
    const title = resolveUserProfileWindowTitle(extractFetchedData(payload), view);
    if (title && onResolvedTitleRef.current) {
      onResolvedTitleRef.current(title);
    }
  }, []);

  const loadView = useCallback(async (
    view: UserProfileWindowView,
    query: Record<string, string | string[]>,
    options?: { force?: boolean },
  ): Promise<BoardWindowRenderPayload | null> => {
    if (!userUuid) {
      return null;
    }
    const cacheKey = buildUserProfilePayloadCacheKey(userUuid, view, query);
    if (!options?.force) {
      const cached = getCachedUserProfilePayload(cacheKey);
      if (cached) {
        return cached;
      }
    }
    const payload = await loadUserProfileWindowRenderPayload(userUuid, view, query);
    setCachedUserProfilePayload(cacheKey, payload);
    return payload;
  }, [userUuid]);

  const load = useCallback(async () => {
    if (!userUuid) {
      setError(t('moa_shell.center.user_profile_error'));
      setLoading(false);
      setRefetching(false);
      return;
    }

    const query = resolveUserProfileWindowQuery();
    const profileKey = buildUserProfilePayloadCacheKey(userUuid, 'profile', query);
    const postsKey = buildUserProfilePayloadCacheKey(userUuid, 'posts', query);
    const cachedProfile = getCachedUserProfilePayload(profileKey);
    const cachedPosts = getCachedUserProfilePayload(postsKey);
    const hasAnyCached = Boolean(cachedProfile || cachedPosts);
    const currentPayload = userProfileView === 'chat'
      ? (viewPayloadsRef.current.profile ?? viewPayloadsRef.current.posts)
      : viewPayloadsRef.current[userProfileView];
    const hasCurrent = Boolean(currentPayload);

    if (cachedProfile || cachedPosts) {
      setViewPayloads({
        profile: cachedProfile ?? viewPayloadsRef.current.profile,
        posts: cachedPosts ?? viewPayloadsRef.current.posts,
      });
      const active = userProfileView === 'posts'
        ? (cachedPosts ?? cachedProfile)
        : (cachedProfile ?? cachedPosts);
      if (active) {
        applyResolvedTitle(active, userProfileView);
      }
      const viewNeedsFetch = (userProfileView === 'posts' && !cachedPosts)
        || (userProfileView === 'profile' && !cachedProfile);
      if (viewNeedsFetch) {
        setRefetching(true);
        setLoading(false);
      } else {
        setLoading(false);
        setRefetching(false);
      }
      setError(null);
    } else if (!hasCurrent) {
      setLoading(true);
    } else {
      setRefetching(true);
    }
    setError(null);

    try {
      const needsProfile = !cachedProfile;
      const needsPosts = userProfileView === 'posts' && !cachedPosts;
      const [profileResult, postsResult] = await Promise.all([
        needsProfile ? loadView('profile', query) : Promise.resolve(cachedProfile ?? null),
        needsPosts ? loadView('posts', query) : Promise.resolve(cachedPosts ?? null),
      ]);

      setViewPayloads(prev => ({
        profile: profileResult ?? prev.profile,
        posts: postsResult ?? prev.posts,
      }));

      const activePayload = userProfileView === 'posts'
        ? (postsResult ?? cachedPosts ?? profileResult)
        : (profileResult ?? cachedProfile ?? postsResult);
      if (activePayload) {
        applyResolvedTitle(activePayload, userProfileView);
      }
    } catch (e) {
      if (!hasAnyCached && !hasCurrent) {
        setViewPayloads({ profile: null, posts: null });
      }
      setError(e instanceof Error ? e.message : t('moa_shell.center.user_profile_error'));
    } finally {
      setLoading(false);
      setRefetching(false);
    }
  }, [applyResolvedTitle, authStateKey, loadView, t, urlEpoch, userProfileView, userUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const active = userProfileView === 'chat'
      ? (viewPayloads.profile ?? viewPayloads.posts)
      : viewPayloads[userProfileView];
    if (active) {
      applyResolvedTitle(active, userProfileView);
    }
  }, [applyResolvedTitle, userProfileView, viewPayloads]);

  const handleTabChange = useCallback((view: UserProfileWindowView) => {
    if (view === userProfileView) {
      return;
    }
    onViewChange?.(view);
  }, [onViewChange, userProfileView]);

  useEffect(() => {
    const viewport = hostRootRef.current?.closest('.moa-app-window-viewport');
    if (viewport instanceof HTMLElement) {
      viewport.scrollTop = 0;
    }

    const track = slideViewportRef.current?.querySelector('.moa-user-profile-slide-track');
    if (track instanceof HTMLElement) {
      track.style.height = '';
      void track.offsetHeight;
    }

    slideViewportRef.current
      ?.querySelectorAll('.moa-user-profile-slide-pane__inner')
      .forEach(element => {
        if (element instanceof HTMLElement) {
          element.scrollTop = 0;
        }
      });
  }, [userProfileView]);

  const activePayload = userProfileView === 'chat'
    ? (viewPayloads.profile ?? viewPayloads.posts)
    : viewPayloads[userProfileView];

  const chatConversationUuid = useMemo(() => {
    if (userProfileView !== 'chat') {
      return undefined;
    }
    const query = resolveUserProfileWindowQuery();
    const raw = query.conversation;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed || undefined;
  }, [urlEpoch, userProfileView]);

  if (loading && !activePayload) {
    return (
      <Div className={`${APP_WINDOW_BODY_CLASS} flex min-h-0 min-w-0 flex-1 flex-col`}>
        <AppLoadingSpinner label={t('moa_shell.center.user_profile_loading')} fill />
      </Div>
    );
  }

  if (error && !activePayload) {
    return (
      <Div
        data-testid="moa-user-profile-window-error"
        className={`${APP_WINDOW_BODY_CLASS} flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 py-8 text-center`}
      >
        <Div className="text-sm text-secondary">{error}</Div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
          {t('moa_shell.center.board_retry')}
        </Button>
      </Div>
    );
  }

  if (!activePayload && !loading && !refetching) {
    return null;
  }

  const profileReady = viewPayloads.profile != null;
  const postsReady = viewPayloads.posts != null;
  const showRefetchOverlay = refetching && (
    (userProfileView === 'profile' && profileReady)
    || (userProfileView === 'posts' && postsReady)
  );
  const showChrome = Boolean(activePayload) || loading || refetching;

  if (!showChrome) {
    return null;
  }

  const profileTabs = [
    { id: 'profile' as const, label: t('moa_shell.center.user_profile_tab_profile') },
    { id: 'posts' as const, label: t('moa_shell.center.user_profile_tab_posts') },
    { id: 'chat' as const, label: t('moa_shell.center.user_profile_tab_chat') },
  ];

  const trackClassName = [
    'moa-user-profile-slide-track',
    userProfileView === 'posts' ? 'moa-user-profile-slide-track--posts' : '',
    userProfileView === 'chat' ? 'moa-user-profile-slide-track--chat' : '',
  ].filter(Boolean).join(' ');

  return (
    <Div
      ref={hostRootRef}
      className={`moa-user-profile-window-body ${APP_WINDOW_BODY_CLASS} relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden`}
    >
      <Div
        className="moa-user-profile-window-chrome shrink-0"
        role="tablist"
        aria-label={t('moa_shell.center.user_profile_window')}
      >
        <SubTabBar
          tabs={profileTabs}
          activeTab={userProfileView}
          onTabChange={id => handleTabChange(id as UserProfileWindowView)}
        />
      </Div>

      <Div ref={slideViewportRef} className="moa-user-profile-slide-viewport relative min-h-0 flex-1">
        {showRefetchOverlay ? (
          <Div
            className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-[1px]"
            aria-busy="true"
            role="status"
          >
            <AppLoadingSpinner label={t('moa_shell.center.user_profile_loading')} />
          </Div>
        ) : null}

        <Div className={trackClassName}>
          <Div className="moa-user-profile-slide-pane" aria-hidden={userProfileView !== 'profile'}>
            {profileReady && viewPayloads.profile
              ? renderPayloadPane(viewPayloads.profile, 'profile', userUuid, 'moa-user-profile-slide-pane__inner')
              : (
                <Div className="moa-user-profile-slide-pane__inner flex min-h-[12rem] items-center justify-center">
                  <AppLoadingSpinner label={t('moa_shell.center.user_profile_loading')} />
                </Div>
              )}
          </Div>
          <Div className="moa-user-profile-slide-pane" aria-hidden={userProfileView !== 'posts'}>
            {postsReady && viewPayloads.posts
              ? renderPayloadPane(viewPayloads.posts, 'posts', userUuid, 'moa-user-profile-slide-pane__inner')
              : (
                <Div className="moa-user-profile-slide-pane__inner flex min-h-[12rem] items-center justify-center">
                  <AppLoadingSpinner label={t('moa_shell.center.user_profile_loading')} />
                </Div>
              )}
          </Div>
          <Div className="moa-user-profile-slide-pane" aria-hidden={userProfileView !== 'chat'}>
            <Div className="moa-user-profile-slide-pane__inner moa-user-profile-slide-pane__inner--chat">
              {userProfileView === 'chat' ? (
                <Moa_ChatPanel
                  targetUserUuid={userUuid}
                  initialConversationUuid={chatConversationUuid}
                />
              ) : null}
            </Div>
          </Div>
        </Div>
      </Div>
    </Div>
  );
};
