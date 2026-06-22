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

export function createQueueStateFromPayload(
  payload: Record<string, unknown>,
  fallbackMessage = '',
): AiGenerationQueueState {
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

export function formatQueueWaitLabel(seconds: number): string {
  if (seconds <= 0) {
    return '';
  }
  if (seconds < 60) {
    return `${seconds}`;
  }
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `${minutes}`;
}

export function formatQueueWaitUnit(seconds: number, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (seconds <= 0) {
    return '';
  }
  if (seconds < 60) {
    return t('moa_apps_ai.queue.wait_unit_seconds', { count: seconds });
  }
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return t('moa_apps_ai.queue.wait_unit_minutes', { count: minutes });
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
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
