import { useCallback, useEffect, useRef, useState } from 'react';
import {
  APP_COMMUNITY_POSTS_PAGE_SIZE,
  createAppCommunityReview,
  deleteAppCommunityReview,
  fetchAppCommunityPosts,
  fetchAppCommunitySummary,
  updateAppCommunityReview,
  type AppCommunityListResponse,
  type AppCommunityPost,
  type AppCommunitySummary,
  type StoreAppCommunityReviewPayload,
} from '../../api/moabomAppCommunityApi';
import { MoabomShellAuthRequiredError } from '../../api/moabomShellHttp';
import {
  invalidateAppCommunitySessionCache,
  readAppCommunitySessionCache,
  writeAppCommunitySessionCache,
} from './appCommunitySessionCache';
import {
  subscribeAppCommunityRevisionChannel,
  unsubscribeAppCommunityRevisionChannel,
} from '../../runtime/moabomAppCommunitySocket';

export type AppCommunityView = 'list' | 'compose' | 'detail';

export interface UseAppCommunityOptions {
  appId: number;
  appTitle?: string;
  canWrite?: boolean;
  authStateKey?: string;
  onAuthRequired?: () => void;
}

function hasMorePosts(meta: AppCommunityListResponse['meta'] | null): boolean {
  return meta != null && meta.current_page < meta.last_page;
}

export function useAppCommunity({
  appId,
  canWrite = false,
  authStateKey = '',
  onAuthRequired,
}: UseAppCommunityOptions) {
  const initialCache = useRef(readAppCommunitySessionCache(appId));
  const [summary, setSummary] = useState<AppCommunitySummary | null>(initialCache.current?.summary ?? null);
  const [posts, setPosts] = useState<AppCommunityPost[]>(initialCache.current?.posts?.items ?? []);
  const [postsMeta, setPostsMeta] = useState<AppCommunityListResponse['meta'] | null>(
    initialCache.current?.posts?.meta ?? null,
  );
  const [selectedPost, setSelectedPost] = useState<AppCommunityPost | null>(null);
  const [view, setView] = useState<AppCommunityView>('list');
  const [isLoading, setIsLoading] = useState(!initialCache.current);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const pageRef = useRef(initialCache.current?.posts?.meta?.current_page ?? 1);
  const revisionRef = useRef(0);

  const applyListResponse = useCallback((
    list: AppCommunityListResponse,
    options: { append: boolean; previousItems?: AppCommunityPost[] },
  ) => {
    pageRef.current = list.meta.current_page;
    setPostsMeta(list.meta);
    const nextItems = options.append
      ? [...(options.previousItems ?? []), ...list.items]
      : list.items;
    setPosts(nextItems);
    writeAppCommunitySessionCache(appId, {
      posts: { items: nextItems, meta: list.meta },
    });
  }, [appId]);

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoading(true);
    }
    setError('');
    try {
      const [nextSummary, list] = await Promise.all([
        fetchAppCommunitySummary(appId),
        fetchAppCommunityPosts(appId, 1, APP_COMMUNITY_POSTS_PAGE_SIZE),
      ]);
      setSummary(nextSummary);
      applyListResponse(list, { append: false });
      writeAppCommunitySessionCache(appId, { summary: nextSummary });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load community');
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  }, [appId, applyListResponse]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || isLoading || !hasMorePosts(postsMeta)) {
      return;
    }

    setIsLoadingMore(true);
    setError('');
    try {
      const list = await fetchAppCommunityPosts(
        appId,
        pageRef.current + 1,
        APP_COMMUNITY_POSTS_PAGE_SIZE,
      );
      applyListResponse(list, { append: true, previousItems: posts });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load community');
    } finally {
      setIsLoadingMore(false);
    }
  }, [appId, applyListResponse, isLoading, isLoadingMore, posts, postsMeta]);

  useEffect(() => {
    if (initialCache.current) {
      void reload({ silent: true });
      return;
    }
    void reload();
  }, [reload]);

  const prevAuthStateKeyRef = useRef(authStateKey);

  useEffect(() => {
    if (prevAuthStateKeyRef.current === authStateKey) {
      return;
    }
    prevAuthStateKeyRef.current = authStateKey;
    invalidateAppCommunitySessionCache(appId);
    void reload({ silent: true });
  }, [appId, authStateKey, reload]);

  useEffect(() => {
    if (!canWrite && view === 'compose') {
      setSelectedPost(null);
      setView('list');
    }
  }, [canWrite, view]);

  useEffect(() => {
    const subscriptionKey = subscribeAppCommunityRevisionChannel(appId, (payload) => {
      if (payload.revision <= revisionRef.current) {
        return;
      }
      revisionRef.current = payload.revision;
      invalidateAppCommunitySessionCache(appId);
      void reload({ silent: true });
    });

    return () => {
      if (subscriptionKey) {
        unsubscribeAppCommunityRevisionChannel(subscriptionKey);
      }
    };
  }, [appId, reload]);

  const handleAuthError = useCallback((err: unknown): boolean => {
    if (err instanceof MoabomShellAuthRequiredError) {
      onAuthRequired?.();
      return true;
    }
    return false;
  }, [onAuthRequired]);

  const openCompose = useCallback(() => {
    setSelectedPost(null);
    setView('compose');
  }, []);

  const openDetail = useCallback((post: AppCommunityPost) => {
    setSelectedPost(post);
    setView('detail');
  }, []);

  const backToList = useCallback(() => {
    setSelectedPost(null);
    setView('list');
  }, []);

  const submitReview = useCallback(async (payload: StoreAppCommunityReviewPayload) => {
    setIsSaving(true);
    setError('');
    try {
      if (summary?.my_review?.id) {
        await updateAppCommunityReview(appId, summary.my_review.id, payload);
      } else {
        await createAppCommunityReview(appId, payload);
      }
      invalidateAppCommunitySessionCache(appId);
      setView('list');
      await reload();
    } catch (err) {
      if (!handleAuthError(err)) {
        setError(err instanceof Error ? err.message : 'Failed to save review');
      }
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [appId, handleAuthError, reload, summary?.my_review?.id]);

  const removeMyReview = useCallback(async () => {
    const reviewId = summary?.my_review?.id;
    if (!reviewId) {
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await deleteAppCommunityReview(appId, reviewId);
      invalidateAppCommunitySessionCache(appId);
      setView('list');
      await reload();
    } catch (err) {
      if (!handleAuthError(err)) {
        setError(err instanceof Error ? err.message : 'Failed to delete review');
      }
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [appId, handleAuthError, reload, summary?.my_review?.id]);

  const hasMyReview = Boolean(summary?.my_review?.id);
  const hasMore = hasMorePosts(postsMeta);
  const totalPostCount = postsMeta?.total ?? posts.length;

  return {
    summary,
    posts,
    postsMeta,
    totalPostCount,
    selectedPost,
    view,
    isLoading,
    isLoadingMore,
    hasMore,
    isSaving,
    error,
    canWrite,
    hasMyReview,
    reload,
    loadMore,
    openCompose,
    openDetail,
    backToList,
    submitReview,
    removeMyReview,
  };
}
