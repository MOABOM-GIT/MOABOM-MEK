/** Cloud Run·게이트웨이 일시 오류 — 짧은 백오프 재시도 대상 */
export function isTransientHttpStatus(status: number | undefined): boolean {
  return status === 502 || status === 503 || status === 504 || status === 429;
}

export function extractHttpStatusFromError(error: unknown): number | undefined {
  const e = error as { response?: { status?: number }; status?: number };
  return e?.response?.status ?? e?.status;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    window.setTimeout(resolve, ms);
  });
}

export interface TransientRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

/**
 * 502/503/504/429 에 한해 지수 백오프 재시도.
 * 게시판·공지·layout data_source 공통.
 */
export async function withTransientRetry<T>(
  fn: () => Promise<T>,
  options: TransientRetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 350;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const status = extractHttpStatusFromError(error);
      if (!isTransientHttpStatus(status) || attempt >= maxAttempts - 1) {
        throw error;
      }
      await sleep(baseDelayMs * (attempt + 1));
    }
  }

  throw lastError;
}

export async function fetchJsonWithTransientRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: TransientRetryOptions,
): Promise<Response> {
  return withTransientRetry(async () => {
    const response = await fetch(input, init);
    if (!response.ok && isTransientHttpStatus(response.status)) {
      const err = new Error(`HTTP ${response.status}`) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }
    return response;
  }, options);
}
