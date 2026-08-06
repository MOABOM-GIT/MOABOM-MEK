import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getMoabomNativeFetch,
  registerMoabomFetchHandler,
  resetMoabomFetchInterceptorForTest,
} from './moabomFetchInterceptor';

describe('moabomFetchInterceptor', () => {
  afterEach(() => {
    resetMoabomFetchInterceptorForTest();
    vi.unstubAllGlobals();
  });

  function stubNative(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
    const native = vi.fn(impl);
    vi.stubGlobal('fetch', native);
    return native;
  }

  it('핸들러가 처리하지 않으면(null) 네이티브로 위임한다', async () => {
    const native = stubNative(async () => new Response('native', { status: 200 }));
    const handler = vi.fn(() => null);
    registerMoabomFetchHandler(handler);

    const res = await fetch('https://example.com/api/anything');

    expect(handler).toHaveBeenCalledTimes(1);
    expect(native).toHaveBeenCalledTimes(1);
    expect(await res.text()).toBe('native');
  });

  it('핸들러가 Response 를 반환하면 네이티브를 호출하지 않는다', async () => {
    const native = stubNative(async () => new Response('native', { status: 200 }));
    registerMoabomFetchHandler(() => new Response('handled', { status: 201 }));

    const res = await fetch('https://example.com/api/x');

    expect(res.status).toBe(201);
    expect(await res.text()).toBe('handled');
    expect(native).not.toHaveBeenCalled();
  });

  it('URL·method 를 요청당 1회만 파싱해 컨텍스트로 전달한다', async () => {
    stubNative(async () => new Response('', { status: 200 }));
    const seen: Array<{ pathname?: string; method: string }> = [];
    registerMoabomFetchHandler((ctx) => {
      seen.push({ pathname: ctx.url?.pathname, method: ctx.method });
      return null;
    });

    await fetch('https://example.com/api/foo', { method: 'post' });

    expect(seen).toEqual([{ pathname: '/api/foo', method: 'POST' }]);
  });

  it('비동기 판정 후 null 을 반환하면 다음 핸들러/네이티브로 위임한다', async () => {
    const native = stubNative(async () => new Response('native', { status: 200 }));
    const first = vi.fn(async () => null);
    const second = vi.fn(() => new Response('second', { status: 202 }));
    registerMoabomFetchHandler(first);
    registerMoabomFetchHandler(second);

    const res = await fetch('https://example.com/api/y');

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(202);
    expect(native).not.toHaveBeenCalled();
  });

  it('핸들러 예외는 다음 핸들러/네이티브로 폴백한다', async () => {
    const native = stubNative(async () => new Response('native', { status: 200 }));
    registerMoabomFetchHandler(() => {
      throw new Error('boom');
    });

    const res = await fetch('https://example.com/api/z');

    expect(await res.text()).toBe('native');
    expect(native).toHaveBeenCalledTimes(1);
  });

  it('ctx.native 는 인터셉터를 우회한다(재진입 없음)', async () => {
    const native = stubNative(async () => new Response('native', { status: 200 }));
    let handlerCalls = 0;
    registerMoabomFetchHandler((ctx) => {
      handlerCalls += 1;
      if (handlerCalls > 1) {
        return new Response('reentry', { status: 500 });
      }
      // 핸들러 내부에서 native 를 다시 호출해도 인터셉터를 재진입하지 않아야 한다.
      return ctx.native('https://example.com/api/inner');
    });

    const res = await fetch('https://example.com/api/outer');

    expect(handlerCalls).toBe(1);
    expect(native).toHaveBeenCalledTimes(1);
    expect(await res.text()).toBe('native');
  });

  it('getMoabomNativeFetch 는 설치 후 캡처된 네이티브를 반환한다', async () => {
    const native = stubNative(async () => new Response('native', { status: 200 }));
    registerMoabomFetchHandler(() => null);

    expect(getMoabomNativeFetch()).toBe(native);
  });
});
