import type {
  ShellAppRankingsPayload,
  ShellUserRankingsPayload,
} from '../shell/moaShellRankingTypes';

const SHELL_RANKINGS_BASE = '/api/modules/moabom-system/public/shell/rankings';

const RANKING_MEMORY_TTL_MS = 60_000;

type RankingCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

let appRankingsCache: RankingCacheEntry<ShellAppRankingsPayload> | null = null;
let userRankingsCache: RankingCacheEntry<ShellUserRankingsPayload> | null = null;
let appRankingsPromise: Promise<ShellAppRankingsPayload> | null = null;
let userRankingsPromise: Promise<ShellUserRankingsPayload> | null = null;

export function __resetShellRankingsCacheForTest(): void {
  appRankingsCache = null;
  userRankingsCache = null;
  appRankingsPromise = null;
  userRankingsPromise = null;
}

const USER_AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#667eea,#764ba2)',
  'linear-gradient(135deg,#ff9a9e,#fecfef)',
  'linear-gradient(135deg,#84fab0,#8fd3f4)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
  'linear-gradient(135deg,#ffecd2,#fcb69f)',
  'linear-gradient(135deg,#06b6d4,#2563eb)',
  'linear-gradient(135deg,#34d399,#0d9488)',
] as const;

export function shellRankingAvatarLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return '?';
  }

  const parts = trimmed.split(/[\s_]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
  }

  return trimmed.slice(0, 2).toUpperCase();
}

export function shellRankingAvatarGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % USER_AVATAR_GRADIENTS.length;
  }

  return USER_AVATAR_GRADIENTS[hash] ?? USER_AVATAR_GRADIENTS[0];
}

async function fetchRankings<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`shell rankings request failed: ${response.status}`);
  }

  const payload = await response.json() as {
    success?: boolean;
    data?: T;
  };

  if (!payload.success || !payload.data) {
    throw new Error('shell rankings payload invalid');
  }

  return payload.data;
}

export async function fetchShellAppRankings(limit = 30): Promise<ShellAppRankingsPayload> {
  const now = Date.now();
  if (appRankingsCache && appRankingsCache.expiresAt > now) {
    return appRankingsCache.value;
  }

  if (appRankingsPromise) {
    return appRankingsPromise;
  }

  appRankingsPromise = (async () => {
    const data = await fetchRankings<ShellAppRankingsPayload>(
      `${SHELL_RANKINGS_BASE}/apps?limit=${encodeURIComponent(String(limit))}`,
    );
    appRankingsCache = {
      value: data,
      expiresAt: Date.now() + RANKING_MEMORY_TTL_MS,
    };
    return data;
  })();

  try {
    return await appRankingsPromise;
  } finally {
    appRankingsPromise = null;
  }
}

export async function fetchShellUserRankings(limit = 30): Promise<ShellUserRankingsPayload> {
  const now = Date.now();
  if (userRankingsCache && userRankingsCache.expiresAt > now) {
    return userRankingsCache.value;
  }

  if (userRankingsPromise) {
    return userRankingsPromise;
  }

  userRankingsPromise = (async () => {
    const data = await fetchRankings<ShellUserRankingsPayload>(
      `${SHELL_RANKINGS_BASE}/users?limit=${encodeURIComponent(String(limit))}`,
    );
    userRankingsCache = {
      value: data,
      expiresAt: Date.now() + RANKING_MEMORY_TTL_MS,
    };
    return data;
  })();

  try {
    return await userRankingsPromise;
  } finally {
    userRankingsPromise = null;
  }
}
