import {
  assertShellAccessToken,
  createOptionalShellModuleApi,
  createShellModuleApi,
  hasShellAccessToken,
  MoabomShellAuthRequiredError,
} from './moabomShellHttp';
import type { AppTier, GeneratedAppPreviewFields } from '../apps/generated/generatedAppPreviewUrl';

export type { AppTier };

export type GeneratedAppVisibility = 'private' | 'tenant' | 'global';

export type AiAppType = 'general' | '3d' | 'game' | 'dataviz';

export interface GenerateAiAppPayload {
  prompt: string;
  app_type: AiAppType;
  model_id: string;
  tier?: AppTier;
  current_html?: string | null;
}

export interface GenerateAiAppResult {
  html: string;
  model_id: string;
  provider: string;
  fallback?: boolean;
  notice?: string | null;
  session_id?: number | null;
}

export interface StreamAiAppPayload extends GenerateAiAppPayload {
  session_id?: number | null;
  continue?: boolean;
  generation_mode?: 'generate' | 'append' | 'patch';
  generated_app_id?: number | null;
  lease_token?: string | null;
  queue_ticket?: string | null;
}

export interface AiGenerationSession {
  id: number;
  status: string;
  app_type: AiAppType;
  model_id: string;
  generated_app_id?: number | null;
  truncated: boolean;
  finish_reason?: string | null;
  messages: Array<Record<string, unknown>>;
  partial_raw?: string;
  updated_at?: string | null;
}

export interface StreamAiAppDonePayload extends GenerateAiAppResult {
  truncated?: boolean;
  finish_reason?: string | null;
  session_id?: number | null;
}

export interface StreamAiAppHandlers {
  onDelta?: (text: string, accumulated: string) => void;
  onSession?: (sessionId: number) => void;
  onDone?: (result: StreamAiAppDonePayload) => void;
  onError?: (message: string) => void;
  onQueueUpdate?: (queue: AiGenerationQueueState) => void;
}

export type AiGenerationQueueStatus = 'queued' | 'ready' | 'starting' | 'expired';

export interface AiGenerationQueueState {
  status: AiGenerationQueueStatus;
  ticketId: string;
  queuePosition: number;
  estimatedWaitSeconds: number;
  retryAfterSeconds: number;
  activeCount: number;
  maxActive: number;
  leaseToken?: string | null;
  message?: string;
}

export class AiGenerationQueueError extends Error {
  readonly queue: AiGenerationQueueState;

  constructor(message: string, queue: AiGenerationQueueState) {
    super(message);
    this.name = 'AiGenerationQueueError';
    this.queue = queue;
  }
}

export interface StoreGeneratedAppPayload {
  title: string;
  app_type: AiAppType;
  tier?: AppTier;
  model_id?: string | null;
  prompt?: string | null;
  html: string;
  visibility?: GeneratedAppVisibility;
  is_shared?: boolean;
  parent_app_id?: number | null;
  version?: number;
  metadata?: Record<string, unknown>;
}

export interface GeneratedAppOwner {
  id: number;
  nickname: string;
}

export interface GeneratedAppPermissions {
  is_owner: boolean;
  can_edit: boolean;
  can_share: boolean;
  can_delete: boolean;
  edit_mode: 'owner' | 'remix' | 'none';
}

export interface StoredGeneratedApp extends StoreGeneratedAppPayload, GeneratedAppPreviewFields {
  id: number;
  owner?: GeneratedAppOwner;
  permissions?: GeneratedAppPermissions;
  created_at?: string | null;
}

/** 목록 조회 응답 항목 (HTML 제외) */
export type StoredGeneratedAppSummary = Pick<
  StoredGeneratedApp,
  'id' | 'title' | 'app_type' | 'tier' | 'preview_url' | 'hosted_subdomain' | 'model_id' | 'prompt' | 'visibility' | 'is_shared' | 'metadata' | 'owner' | 'permissions' | 'created_at'
>;

export interface CpapUserProfile {
  gender: 'male' | 'female';
  ageGroup: '20s' | '30s' | '40s' | '50s' | '60s+';
  tossing: 'low' | 'medium' | 'high';
  mouthBreathing: boolean;
  pressure: 'low' | 'medium' | 'high';
  preferredTypes: string[];
}

export interface CpapRecommendation {
  type: string;
  name: string;
  confidence: number;
  reasons?: string[];
  tips?: string[];
}

export interface CpapMeasurementPayload {
  profile: CpapUserProfile;
  measurements: Record<string, number>;
  profile_measurements?: Record<string, number> | null;
  recommendation: CpapRecommendation;
  metadata?: Record<string, unknown>;
}

export interface CpapStoredMeasurement extends CpapMeasurementPayload {
  id: number;
  mask_type?: string | null;
  confidence?: number | null;
  created_at?: string | null;
}

const requestMoabomAppsApi = createShellModuleApi('moabom-apps');
const requestOptionalMoabomAppsApi = createOptionalShellModuleApi('moabom-apps');
const requestMoabomCpapApi = createShellModuleApi('moabom-cpap');

export async function generateAiApp(payload: GenerateAiAppPayload): Promise<GenerateAiAppResult> {
  return requestMoabomAppsApi<GenerateAiAppResult>('apps/ai/generate', {
    method: 'POST',
    body: payload,
  });
}

export async function fetchActiveAiGenerationSession(): Promise<AiGenerationSession | null> {
  if (!hasShellAccessToken()) {
    return null;
  }
  const data = await requestMoabomAppsApi<{ session: AiGenerationSession | null }>('apps/ai/sessions/active');
  return data.session ?? null;
}

export async function fetchAiGenerationSession(id: number): Promise<AiGenerationSession> {
  const data = await requestMoabomAppsApi<{ session: AiGenerationSession }>(`apps/ai/sessions/${id}`);
  return data.session;
}

export async function cancelAiGenerationSession(id: number): Promise<void> {
  await requestMoabomAppsApi<{ id: number }>(`apps/ai/sessions/${id}`, {
    method: 'DELETE',
  });
}

export async function cancelStreamingAiGenerationSession(): Promise<void> {
  await requestMoabomAppsApi<{ cancelled: boolean }>('apps/ai/sessions/streaming', {
    method: 'DELETE',
  });
}

export async function storeGeneratedApp(payload: StoreGeneratedAppPayload): Promise<StoredGeneratedApp> {
  return requestMoabomAppsApi<StoredGeneratedApp>('apps/generated', {
    method: 'POST',
    body: payload,
  });
}

export async function fetchGeneratedApps(): Promise<StoredGeneratedAppSummary[]> {
  const data = await requestMoabomAppsApi<{ items: StoredGeneratedAppSummary[] }>('apps/generated');
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchSharedGeneratedApps(): Promise<StoredGeneratedAppSummary[]> {
  const data = await requestOptionalMoabomAppsApi<{ items: StoredGeneratedAppSummary[] }>('apps/generated/shared');
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchGeneratedApp(id: number): Promise<StoredGeneratedApp> {
  return requestMoabomAppsApi<StoredGeneratedApp>(`apps/generated/${id}`);
}

export async function fetchVisibleGeneratedApp(id: number): Promise<StoredGeneratedApp> {
  if (hasShellAccessToken()) {
    try {
      return await requestMoabomAppsApi<StoredGeneratedApp>(`apps/generated/${id}`);
    } catch (error) {
      if (!(error instanceof MoabomShellAuthRequiredError)) {
        throw error;
      }
    }
  }
  return requestOptionalMoabomAppsApi<StoredGeneratedApp>(`apps/generated/shared/${id}`);
}

export async function updateGeneratedApp(id: number, payload: StoreGeneratedAppPayload): Promise<StoredGeneratedApp> {
  return requestMoabomAppsApi<StoredGeneratedApp>(`apps/generated/${id}`, {
    method: 'PUT',
    body: payload,
  });
}

export async function deleteGeneratedApp(id: number): Promise<void> {
  await requestMoabomAppsApi<{ id: number }>(`apps/generated/${id}`, {
    method: 'DELETE',
  });
}

export function isGeneratedAppPublished(item: Pick<StoredGeneratedAppSummary, 'visibility' | 'is_shared'>): boolean {
  if (item.visibility) {
    return item.visibility !== 'private';
  }

  return Boolean(item.is_shared);
}

export async function updateGeneratedAppVisibility(
  id: number,
  visibility: GeneratedAppVisibility,
): Promise<StoredGeneratedApp> {
  return requestMoabomAppsApi<StoredGeneratedApp>(`apps/generated/${id}/share`, {
    method: 'PATCH',
    body: { visibility },
  });
}

/** @deprecated use updateGeneratedAppVisibility */
export async function updateGeneratedAppShare(id: number, isShared: boolean): Promise<StoredGeneratedApp> {
  return updateGeneratedAppVisibility(id, isShared ? 'tenant' : 'private');
}

export async function fetchLatestCpapMeasurement(): Promise<CpapStoredMeasurement | null> {
  if (!hasShellAccessToken()) {
    return null;
  }
  const data = await requestMoabomCpapApi<{ measurement: CpapStoredMeasurement | null }>('apps/cpap-mask/measurements/latest');
  return data.measurement;
}

export async function storeCpapMeasurement(payload: CpapMeasurementPayload): Promise<CpapStoredMeasurement> {
  const data = await requestMoabomCpapApi<{ measurement: CpapStoredMeasurement }>('apps/cpap-mask/measurements', {
    method: 'POST',
    body: payload,
  });
  return data.measurement;
}

function parseSseChunk(buffer: string): { events: Array<{ event: string; data: string }>; rest: string } {
  const events: Array<{ event: string; data: string }> = [];
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';

  for (const part of parts) {
    if (!part.trim()) {
      continue;
    }
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of part.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trim());
      }
    }
    if (dataLines.length > 0) {
      events.push({ event, data: dataLines.join('\n') });
    }
  }

  return { events, rest };
}

function parseQueuePayload(
  payload: Record<string, unknown> | undefined,
  fallbackMessage = '',
): AiGenerationQueueState | null {
  if (!payload || payload.code !== 'ai_generation_queued') {
    return null;
  }

  return {
    status: (payload.status as AiGenerationQueueStatus) ?? 'queued',
    ticketId: String(payload.ticket_id ?? ''),
    queuePosition: Number(payload.queue_position ?? 0),
    estimatedWaitSeconds: Number(payload.estimated_wait_seconds ?? 0),
    retryAfterSeconds: Math.max(2, Number(payload.retry_after_seconds ?? 5)),
    activeCount: Number(payload.active_count ?? 0),
    maxActive: Number(payload.max_active ?? 0),
    leaseToken: typeof payload.lease_token === 'string' ? payload.lease_token : null,
    message: fallbackMessage,
  };
}

function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function fetchAiGenerationQueueStatus(ticketId: string): Promise<AiGenerationQueueState> {
  const data = await requestMoabomAppsApi<{ queue: Record<string, unknown> }>(
    `apps/ai/generate/queue?ticket=${encodeURIComponent(ticketId)}`,
  );
  const queue = data.queue ?? {};

  return {
    status: (queue.status as AiGenerationQueueStatus) ?? 'queued',
    ticketId: String(queue.ticket_id ?? ticketId),
    queuePosition: Number(queue.queue_position ?? 0),
    estimatedWaitSeconds: Number(queue.estimated_wait_seconds ?? 0),
    retryAfterSeconds: Math.max(2, Number(queue.retry_after_seconds ?? 5)),
    activeCount: Number(queue.active_count ?? 0),
    maxActive: Number(queue.max_active ?? 0),
    leaseToken: typeof queue.lease_token === 'string' ? queue.lease_token : null,
  };
}

export async function cancelAiGenerationQueue(ticketId: string): Promise<void> {
  await requestMoabomAppsApi<{ ticket_id: string }>('apps/ai/generate/queue', {
    method: 'DELETE',
    body: { ticket: ticketId },
  });
}

async function waitForQueueTurn(
  initial: AiGenerationQueueState,
  handlers: StreamAiAppHandlers,
  signal?: AbortSignal,
): Promise<{ leaseToken: string; ticketId: string }> {
  let queue = initial;

  while (!signal?.aborted) {
    handlers.onQueueUpdate?.(queue);
    await sleepMs(queue.retryAfterSeconds * 1000, signal);

    const next = await fetchAiGenerationQueueStatus(queue.ticketId);
    queue = { ...next, message: initial.message };

    if (queue.status === 'ready' && queue.leaseToken) {
      handlers.onQueueUpdate?.({ ...queue, status: 'starting' });
      return { leaseToken: queue.leaseToken, ticketId: queue.ticketId };
    }
  }

  throw new DOMException('Aborted', 'AbortError');
}

/** AI 앱 HTML SSE 스트리밍 생성 (대기열 자동 재시도 포함). */
export async function streamAiApp(
  payload: StreamAiAppPayload,
  handlers: StreamAiAppHandlers,
  signal?: AbortSignal,
  initialAccumulated = '',
): Promise<StreamAiAppDonePayload | null> {
  const token = assertShellAccessToken();
  let leaseToken = payload.lease_token ?? null;
  let queueTicket = payload.queue_ticket ?? null;

  while (!signal?.aborted) {
    const response = await fetch('/api/modules/moabom-apps/apps/ai/generate/stream', {
      method: 'POST',
      headers: {
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...payload,
        lease_token: leaseToken,
        queue_ticket: queueTicket,
      }),
      signal,
    });

    if (response.status === 429) {
      let message = 'AI 생성 대기열에 등록되었습니다.';
      let queueState: AiGenerationQueueState | null = null;
      try {
        const json = await response.json() as { message?: string; errors?: Record<string, unknown> };
        if (json.message) {
          message = json.message;
        }
        queueState = parseQueuePayload(json.errors, message);
      } catch {
        // ignore
      }

      if (!queueState?.ticketId) {
        handlers.onError?.(message);
        throw new Error(message);
      }

      handlers.onQueueUpdate?.(queueState);
      const ready = await waitForQueueTurn(queueState, handlers, signal);
      leaseToken = ready.leaseToken;
      queueTicket = ready.ticketId;
      continue;
    }

    if (!response.ok) {
      let message = '스트리밍 생성에 실패했습니다.';
      try {
        const json = await response.json() as { message?: string };
        if (json.message) {
          message = json.message;
        }
      } catch {
        // ignore
      }
      handlers.onError?.(message);
      throw new Error(message);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('스트리밍 응답 본문을 읽을 수 없습니다.');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let accumulated = initialAccumulated;
    let donePayload: StreamAiAppDonePayload | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseChunk(buffer);
      buffer = parsed.rest;

      for (const { event, data } of parsed.events) {
        if (event === 'session') {
          const payloadJson = JSON.parse(data) as { session_id?: number };
          if (payloadJson.session_id) {
            handlers.onSession?.(payloadJson.session_id);
          }
        } else if (event === 'delta') {
          const payloadJson = JSON.parse(data) as { text?: string };
          const text = payloadJson.text ?? '';
          if (text) {
            accumulated += text;
            handlers.onDelta?.(text, accumulated);
          }
        } else if (event === 'done') {
          donePayload = JSON.parse(data) as StreamAiAppDonePayload;
          handlers.onDone?.(donePayload);
        } else if (event === 'error') {
          const payloadJson = JSON.parse(data) as { message?: string };
          const message = payloadJson.message ?? '스트리밍 생성 중 오류가 발생했습니다.';
          handlers.onError?.(message);
          throw new Error(message);
        }
      }
    }

    return donePayload;
  }

  throw new DOMException('Aborted', 'AbortError');
}
