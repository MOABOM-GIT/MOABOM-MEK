import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchUserCreditsApi } from '../components/composite/mypage/myPageApi';
import {
  resolveActivityLevelProgress,
  type ActivityLevelProgress,
} from '../shell/moaActivityLevel';

type ActivityLevelCache = {
  progress: ActivityLevelProgress;
  fetchedAt: number;
};

let cache: ActivityLevelCache | null = null;
let inflight: Promise<ActivityLevelProgress | null> | null = null;

const LISTENERS = new Set<() => void>();
const CACHE_TTL_MS = 60_000;

function notifyListeners(): void {
  LISTENERS.forEach((listener) => listener());
}

export function invalidateMoabomActivityLevelCache(): void {
  cache = null;
  notifyListeners();
}

async function loadActivityLevel(force = false): Promise<ActivityLevelProgress | null> {
  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.progress;
  }
  if (!force && inflight) {
    return inflight;
  }

  inflight = (async () => {
    // limit=0: 원장 집계 생략 — 셸 부트 시 upstream timeout 완화
    const result = await fetchUserCreditsApi({ limit: 0, offset: 0 });
    if (!result.ok || !result.data) {
      return cache?.progress ?? null;
    }

    const rankingPoints = Number(result.data.ranking_points ?? result.data.level?.points ?? 0);
    const apiLevel = result.data.level;
    const progress = apiLevel
      ? {
          level: Number(apiLevel.level) || 1,
          slug: (apiLevel.slug as ActivityLevelProgress['slug']) || 'iron',
          points: Number(apiLevel.points ?? rankingPoints) || 0,
          current_threshold: Number(apiLevel.current_threshold) || 0,
          next_threshold: apiLevel.next_threshold == null ? null : Number(apiLevel.next_threshold),
          progress_ratio: Number(apiLevel.progress_ratio) || 0,
        }
      : resolveActivityLevelProgress(rankingPoints);

    cache = { progress, fetchedAt: Date.now() };
    notifyListeners();
    return progress;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/**
 * 로그인 시 활동 레벨(ranking_points) SSOT. earn 후 invalidate로 갱신.
 */
export function useMoabomActivityLevel(enabled: boolean): {
  level: ActivityLevelProgress | null;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [level, setLevel] = useState<ActivityLevelProgress | null>(() => cache?.progress ?? null);
  const [loading, setLoading] = useState(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const refresh = useCallback(async () => {
    if (!enabledRef.current) {
      setLevel(null);
      return;
    }
    setLoading(true);
    try {
      const progress = await loadActivityLevel(true);
      setLevel(progress);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLevel(null);
      return;
    }

    const onInvalidate = () => {
      void loadActivityLevel(true).then((progress) => {
        if (enabledRef.current) {
          setLevel(progress);
        }
      });
    };

    LISTENERS.add(onInvalidate);

    if (cache?.progress) {
      setLevel(cache.progress);
    }

    void loadActivityLevel(false).then((progress) => {
      if (enabledRef.current) {
        setLevel(progress);
      }
    });

    const onCreditChanged = () => {
      invalidateMoabomActivityLevelCache();
    };
    window.addEventListener('moabom:credit-changed', onCreditChanged);

    return () => {
      LISTENERS.delete(onInvalidate);
      window.removeEventListener('moabom:credit-changed', onCreditChanged);
    };
  }, [enabled]);

  return { level, loading, refresh };
}
