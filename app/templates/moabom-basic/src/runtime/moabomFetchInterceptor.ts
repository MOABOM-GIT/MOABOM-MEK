/**
 * Moabom 통합 fetch 인터셉터.
 *
 * 과거에는 lang dedupe · user shell-state · shell-boot · shell-critical · ghost-routes 가
 * 각자 `window.fetch` 를 몽키패치해 5겹 래핑이 쌓였고, 모든 요청이 겹마다 URL 을 다시
 * 파싱했다. 여기서는 `window.fetch` 를 한 번만 패치하고, 각 기능은 핸들러를 등록한다.
 * URL·method 는 요청당 1회만 파싱해 컨텍스트로 전달한다.
 *
 * 핸들러 계약:
 *  - 처리하지 않을 요청은 즉시 `null`(또는 `undefined`) 반환 → 다음 핸들러/네이티브로 위임.
 *  - 처리할 요청은 `Response` 또는 `Promise<Response>` 반환.
 *  - 비동기 판정 후 처리를 포기할 때는 `Promise<null>` 반환 → 다음 핸들러/네이티브로 위임.
 *  - 네이티브 네트워크가 필요하면 `ctx.native` 를 사용한다(인터셉터 재진입 없음).
 */

export interface MoabomFetchContext {
  input: RequestInfo | URL;
  init?: RequestInit;
  /** 요청당 1회 파싱된 URL. 파싱 불가 시 null. */
  url: URL | null;
  /** upper-case HTTP method. */
  method: string;
  /** 인터셉터를 우회하는 원본 fetch (재진입 없음). */
  native: typeof fetch;
}

export type MoabomFetchHandler = (
  ctx: MoabomFetchContext,
) => Response | Promise<Response | null | undefined> | null | undefined;

const handlers: MoabomFetchHandler[] = [];
let installed = false;
let nativeFetch: typeof fetch | null = null;

function isThenable(value: unknown): value is Promise<Response | null | undefined> {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as { then?: unknown }).then === 'function'
  );
}

/** 인터셉터를 우회하는 원본 fetch. 설치 전이면 현재 window.fetch 를 bind 한다. */
export function getMoabomNativeFetch(): typeof fetch {
  if (nativeFetch) {
    return nativeFetch;
  }
  return window.fetch.bind(window);
}

function dispatch(ctx: MoabomFetchContext, index: number): Promise<Response> {
  if (index >= handlers.length) {
    return ctx.native(ctx.input, ctx.init);
  }

  let result: ReturnType<MoabomFetchHandler>;
  try {
    result = handlers[index](ctx);
  } catch {
    return dispatch(ctx, index + 1);
  }

  if (result == null) {
    return dispatch(ctx, index + 1);
  }

  if (result instanceof Response) {
    return Promise.resolve(result);
  }

  if (isThenable(result)) {
    return result.then(
      (awaited) => (awaited ? awaited : dispatch(ctx, index + 1)),
      () => dispatch(ctx, index + 1),
    );
  }

  return dispatch(ctx, index + 1);
}

/** window.fetch 를 1회 패치한다. 핸들러 등록 시 자동 호출된다. */
export function installMoabomFetchInterceptor(): void {
  if (installed || typeof window === 'undefined') {
    return;
  }
  installed = true;

  const native = window.fetch.bind(window);
  nativeFetch = native;

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let url: URL | null;
    try {
      const href =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      url = new URL(href, window.location.href);
    } catch {
      url = null;
    }

    const method = (
      init?.method
      ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();

    const ctx: MoabomFetchContext = { input, init, url, method, native };

    return dispatch(ctx, 0);
  }) as typeof fetch;
}

/**
 * 핸들러를 등록한다(등록 순서대로 평가). 첫 호출 시 인터셉터를 설치한다.
 * 경로 집합이 서로 겹치지 않으므로 등록 순서는 정확성에 영향을 주지 않는다.
 */
export function registerMoabomFetchHandler(handler: MoabomFetchHandler): void {
  if (typeof window === 'undefined') {
    return;
  }
  installMoabomFetchInterceptor();
  handlers.push(handler);
}

/** Vitest: 인터셉터·핸들러 초기화 */
export function resetMoabomFetchInterceptorForTest(): void {
  installed = false;
  nativeFetch = null;
  handlers.length = 0;
}
