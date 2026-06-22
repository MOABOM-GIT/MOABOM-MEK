/**
 * 홈 셸 앱 사용량 telemetry — 오픈 HIT + 활성 시간을 시간 버킷으로 배치 전송한다.
 */

import { getShellAccessToken } from '../api/moabomShellAccess';
import { getMoabomShellBootData } from '../runtime/moabomShellBoot';

const USAGE_API = '/api/modules/moabom-system/public/shell/app-usage';
const FLUSH_INTERVAL_MS = 60_000;
const MIN_ACTIVE_FLUSH_SECONDS = 5;
const MAX_ACTIVE_CHUNK_SECONDS = 300;
const MAX_OPEN_HITS_PER_EVENT = 5;
const MAX_ACTIVE_SECONDS_PER_EVENT = 1800;
const MAX_EVENTS_PER_REQUEST = 20;

const SKIPPED_APP_IDS = new Set([
  'mypage',
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'create-app',
]);

type PendingUsage = {
  openHits: number;
  activeSeconds: number;
};

type UsageEvent = {
  app_id: string;
  bucket_hour: string;
  open_hits: number;
  active_seconds: number;
};

const pending = new Map<string, PendingUsage>();

let focusedAppId: string | null = null;
let focusStartedAt: number | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushInFlight = false;
let installed = false;

function currentBucketHour(): string {
  const date = new Date();
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

export function shouldTrackShellAppUsage(appId: string): boolean {
  if (!appId || SKIPPED_APP_IDS.has(appId)) {
    return false;
  }

  if (appId.startsWith('moa-shell-')) {
    return false;
  }

  return /^[a-z0-9][a-z0-9-]*$/.test(appId);
}

function getOrCreatePending(appId: string): PendingUsage {
  const existing = pending.get(appId);
  if (existing) {
    return existing;
  }

  const created = { openHits: 0, activeSeconds: 0 };
  pending.set(appId, created);

  return created;
}

function isDocumentActive(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

function accumulateFocusedTime(): void {
  if (!focusedAppId || focusStartedAt == null || !isDocumentActive()) {
    return;
  }

  const elapsedSeconds = Math.floor((Date.now() - focusStartedAt) / 1000);
  if (elapsedSeconds < MIN_ACTIVE_FLUSH_SECONDS) {
    return;
  }

  const chunk = Math.min(elapsedSeconds, MAX_ACTIVE_CHUNK_SECONDS);
  getOrCreatePending(focusedAppId).activeSeconds += chunk;
  focusStartedAt = Date.now();
}

function buildFlushEvents(): UsageEvent[] {
  const bucketHour = currentBucketHour();

  return Array.from(pending.entries())
    .map(([appId, usage]) => ({
      app_id: appId,
      bucket_hour: bucketHour,
      open_hits: Math.min(MAX_OPEN_HITS_PER_EVENT, Math.max(0, usage.openHits)),
      active_seconds: Math.min(MAX_ACTIVE_SECONDS_PER_EVENT, Math.max(0, usage.activeSeconds)),
    }))
    .filter(event => event.open_hits > 0 || event.active_seconds > 0)
    .slice(0, MAX_EVENTS_PER_REQUEST);
}

function applySentUsage(events: UsageEvent[]): void {
  for (const event of events) {
    const bucket = pending.get(event.app_id);
    if (!bucket) {
      continue;
    }

    bucket.openHits = Math.max(0, bucket.openHits - event.open_hits);
    bucket.activeSeconds = Math.max(0, bucket.activeSeconds - event.active_seconds);

    if (bucket.openHits === 0 && bucket.activeSeconds === 0) {
      pending.delete(event.app_id);
    }
  }
}

async function postUsageEvents(events: UsageEvent[], withAuth: boolean): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  const usageToken = getMoabomShellBootData()?.shell_rankings?.usage_ingest_token;
  if (usageToken) {
    headers['X-Moabom-Shell-Usage-Token'] = usageToken;
  }

  if (withAuth) {
    const token = getShellAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return fetch(USAGE_API, {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify({ events }),
    keepalive: true,
  });
}

export function recordShellAppOpen(appId: string): void {
  if (!shouldTrackShellAppUsage(appId)) {
    return;
  }

  getOrCreatePending(appId).openHits += 1;
}

export function syncShellAppFocus(appId: string | null): void {
  accumulateFocusedTime();

  if (appId && !shouldTrackShellAppUsage(appId)) {
    focusedAppId = null;
    focusStartedAt = null;
    return;
  }

  focusedAppId = appId;
  focusStartedAt = appId && isDocumentActive() ? Date.now() : null;
}

async function flushShellAppUsage(): Promise<void> {
  accumulateFocusedTime();

  if (pending.size === 0 || flushInFlight) {
    return;
  }

  const events = buildFlushEvents();
  if (events.length === 0) {
    return;
  }

  flushInFlight = true;

  try {
    let response = await postUsageEvents(events, true);

    if (response.status === 401 && getShellAccessToken()) {
      response = await postUsageEvents(events, false);
    }

    if (!response.ok) {
      return;
    }

    applySentUsage(events);
  } catch {
    // pending 유지 — 다음 flush에서 재시도
  } finally {
    flushInFlight = false;
  }
}

function scheduleFlush(): void {
  void flushShellAppUsage();
}

export function installShellAppUsageTracker(): () => void {
  if (installed || typeof window === 'undefined') {
    return () => {};
  }

  installed = true;

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      focusStartedAt = focusedAppId ? Date.now() : null;
      return;
    }

    accumulateFocusedTime();
    focusStartedAt = null;
    scheduleFlush();
  };

  const onPageHide = () => {
    accumulateFocusedTime();
    scheduleFlush();
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);
  flushTimer = setInterval(scheduleFlush, FLUSH_INTERVAL_MS);

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', onPageHide);
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    installed = false;
    void flushShellAppUsage();
  };
}

export function __resetShellAppUsageTrackerForTest(): void {
  pending.clear();
  focusedAppId = null;
  focusStartedAt = null;
  flushInFlight = false;
  installed = false;
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}
