/**
 * Feature: moabom-pwa-service-worker
 *
 * Property 1 (P-RouterSpecificity), Property 2 (P-QueryNormalization),
 * Property 5 (P-AdminBypass) 는 본 파일에서 검증한다.
 *
 * - P1 Validates: Requirements 2.2, 2.3, 2.4, 5.5, 5.6, 5.7, 5.9, 5.10, 9.1, 9.2, 10.2
 * - P2 Validates: Requirements 6.1, 6.2, 6.3, 6.4, 10.3
 * - P5 Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 10.6
 */
import { describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

import {
  isBypassed,
  isNonUserTemplateAssetPath,
  normalizeCacheKey,
  routeRequest,
} from '../pureRouter';

/** path-safe 세그먼트 — 슬래시·쿼리·#·공백 없는 토큰. */
const arbPathSegment = fc
  .string({ minLength: 1, maxLength: 12 })
  .filter(s => /^[A-Za-z0-9_\-]+$/.test(s));

// -----------------------------------------------------------------------------
// P1 P-RouterSpecificity
// -----------------------------------------------------------------------------

describe('P1 P-RouterSpecificity', () => {
  it('admin 경로는 항상 bypass 전략만 반환한다', () => {
    const arbOtherTemplateId = arbPathSegment.filter(s => s !== 'moabom-basic');
    const arbAdminPath = fc.oneof(
      fc.constant('/admin'),
      arbPathSegment.map(s => `/admin/${s}`),
      arbPathSegment.map(s => `/api/admin/${s}`),
      fc.tuple(arbOtherTemplateId, arbPathSegment).map(
        ([tpl, rest]) => `/api/templates/assets/${tpl}/${rest}`,
      ),
    );

    fc.assert(
      fc.property(
        fc.record({
          path: arbAdminPath,
          method: fc.constantFrom<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET', 'POST', 'PUT', 'DELETE'),
          hasAuthorization: fc.boolean(),
          accept: fc.constantFrom('', 'text/html', 'application/json'),
        }),
        ({ path, method, hasAuthorization, accept }) => {
          const decision = routeRequest({
            url: `https://example.com${path}`,
            method,
            hasAuthorization,
            accept,
          });
          expect(decision.strategy).toBe('bypass');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('user settings API 는 항상 bypass 만 반환한다(GET·POST·Authorization 여부 무관)', () => {
    fc.assert(
      fc.property(
        fc.record({
          tail: arbPathSegment,
          method: fc.constantFrom<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET', 'POST', 'PUT', 'DELETE'),
          hasAuthorization: fc.boolean(),
        }),
        ({ tail, method, hasAuthorization }) => {
          const decision = routeRequest({
            url: `https://example.com/api/modules/moabom-system/user/${tail}`,
            method,
            hasAuthorization,
            accept: '',
          });
          expect(decision.strategy).toBe('bypass');
          expect(decision.cacheKey).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Authorization 헤더가 있으면 어떤 URL이든 bypass 이다', () => {
    fc.assert(
      fc.property(
        fc.record({
          path: fc.oneof(
            fc.constant('/'),
            arbPathSegment.map(s => `/${s}`),
            arbPathSegment.map(s => `/api/${s}`),
            arbPathSegment.map(s => `/api/templates/assets/moabom-basic/css/${s}.css`),
          ),
          method: fc.constantFrom<'GET' | 'POST'>('GET', 'POST'),
          accept: fc.constantFrom('', 'text/html', 'application/json'),
        }),
        ({ path, method, accept }) => {
          const decision = routeRequest({
            url: `https://example.com${path}`,
            method,
            hasAuthorization: true,
            accept,
          });
          expect(decision.strategy).toBe('bypass');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('PWA version 엔드포인트는 bypass 만 반환한다', () => {
    const decision = routeRequest({
      url: 'https://example.com/api/plugins/moabom-pwa/version',
      method: 'GET',
      hasAuthorization: false,
      accept: 'application/json',
    });
    expect(decision.strategy).toBe('bypass');
  });
});

// -----------------------------------------------------------------------------
// P2 P-QueryNormalization
// -----------------------------------------------------------------------------

describe('P2 P-QueryNormalization', () => {
  const arbParamKey = fc
    .string({ minLength: 1, maxLength: 8 })
    .filter(s => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s) && s !== 'v');
  const arbParamValue = fc.string({ maxLength: 16 }).filter(s => !s.includes('#'));

  it('v 파라미터를 포함한 모든 쿼리 파라미터의 키·값·순서는 원형 보존된다', () => {
    fc.assert(
      fc.property(
        fc.record({
          path: arbPathSegment.map(s => `/${s}`),
          paramMap: fc.array(fc.tuple(arbParamKey, arbParamValue), { maxLength: 5 }),
          vValue: fc.string({ maxLength: 12 }),
          vPosition: fc.nat(),
        }),
        ({ path, paramMap, vValue, vPosition }) => {
          // paramMap 과 v 를 임의 순서로 섞어 URL 생성
          const url = new URL(`https://example.com${path}`);
          const entries: Array<[string, string]> = paramMap.map(([k, v]) => [k, v]);
          const insertAt = entries.length === 0 ? 0 : vPosition % (entries.length + 1);
          entries.splice(insertAt, 0, ['v', vValue]);
          for (const [k, v] of entries) {
            url.searchParams.append(k, v);
          }

          const result = normalizeCacheKey(url);
          const resultUrl = new URL(result);

          // v 포함 원본 파라미터 개수 일치(같은 키 중복도 보존)
          const originalPairs = entries;
          const normalizedPairs = Array.from(resultUrl.searchParams.entries());
          expect(normalizedPairs.length).toBe(originalPairs.length);

          // 상대 순서 보존
          for (let i = 0; i < originalPairs.length; i++) {
            expect(normalizedPairs[i]?.[0]).toBe(originalPairs[i]?.[0]);
            expect(normalizedPairs[i]?.[1]).toBe(originalPairs[i]?.[1]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('v 없는 URL 은 입력과 동등(쿼리 없으면 쿼리 없는 URL 반환)', () => {
    const url1 = new URL('https://example.com/css/app.css');
    expect(normalizeCacheKey(url1)).toBe('https://example.com/css/app.css');

    const url2 = new URL('https://example.com/css/app.css?page=2&lang=ko');
    const result = normalizeCacheKey(url2);
    const parsed = new URL(result);
    expect(parsed.searchParams.get('page')).toBe('2');
    expect(parsed.searchParams.get('lang')).toBe('ko');
    expect(parsed.searchParams.has('v')).toBe(false);
  });

  it('`_t`/`ts`/`cacheBust` 등 v 이외의 버스트성 파라미터는 정규화 대상이 아니다(Req 6.4)', () => {
    const url = new URL('https://example.com/app.js?_t=111&ts=222&cacheBust=333&v=444');
    const result = normalizeCacheKey(url);
    const parsed = new URL(result);
    expect(parsed.searchParams.get('_t')).toBe('111');
    expect(parsed.searchParams.get('ts')).toBe('222');
    expect(parsed.searchParams.get('cacheBust')).toBe('333');
    expect(parsed.searchParams.get('v')).toBe('444');
  });

  it('프래그먼트(#…) 는 캐시 키에서 제거된다', () => {
    const url = new URL('https://example.com/app.js#section');
    expect(normalizeCacheKey(url)).toBe('https://example.com/app.js');
  });
});

// -----------------------------------------------------------------------------
// P5 P-AdminBypass
// -----------------------------------------------------------------------------

describe('P5 P-AdminBypass', () => {
  it('Sw_Bypass_Set 매칭 URL 은 항상 { strategy: "bypass", cacheKey: null } 반환', () => {
    const arbBypassUrl = fc.oneof(
      fc.constant('https://example.com/admin'),
      arbPathSegment.map(s => `https://example.com/admin/${s}`),
      arbPathSegment.map(s => `https://example.com/api/admin/${s}`),
      fc.tuple(arbPathSegment.filter(s => s !== 'moabom-basic'), arbPathSegment).map(
        ([tpl, rest]) => `https://example.com/api/templates/assets/${tpl}/${rest}`,
      ),
      arbPathSegment.map(s => `chrome-extension://${s}/x`),
      arbPathSegment.map(s => `ws://example.com/${s}`),
      arbPathSegment.map(s => `wss://example.com/${s}`),
    );

    fc.assert(
      fc.property(arbBypassUrl, url => {
        const decision = routeRequest({
          url,
          method: 'GET',
          hasAuthorization: false,
          accept: '',
        });
        expect(decision.strategy).toBe('bypass');
        expect(decision.cacheKey).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('isBypassed 는 bypass set URL 에 true, 일반 URL 에 false 를 반환한다', () => {
    expect(isBypassed(new URL('https://example.com/admin'))).toBe(true);
    expect(isBypassed(new URL('https://example.com/admin/users'))).toBe(true);
    expect(isBypassed(new URL('https://example.com/api/admin/roles'))).toBe(true);
    expect(isBypassed(new URL('https://example.com/api/templates/assets/sirsoft-admin_basic/css/a.css'))).toBe(
      true,
    );
    expect(isNonUserTemplateAssetPath('/api/templates/assets/sirsoft-admin_basic/css/a.css')).toBe(true);
    expect(isBypassed(new URL('chrome-extension://abcd/foo'))).toBe(true);
    expect(isBypassed(new URL('ws://example.com/reverb'))).toBe(true);
    expect(isBypassed(new URL('wss://example.com/reverb'))).toBe(true);

    // 유사 접두 (administrator 등) 는 bypass 아님
    expect(isBypassed(new URL('https://example.com/administrator'))).toBe(false);
    expect(isBypassed(new URL('https://example.com/admin-docs'))).toBe(false);
    // 일반 사용자 경로는 bypass 아님
    expect(isBypassed(new URL('https://example.com/api/templates/assets/moabom-basic/css/app.css'))).toBe(false);
    expect(isBypassed(new URL('https://example.com/me/settings'))).toBe(false);
  });

  it('mock FetchEvent 가 bypass URL 을 받아도 respondWith 가 호출되지 않는다 (SW fetch 리스너 계약)', () => {
    const respondWith = vi.fn();
    const fetchHandler = (evt: { request: { url: string }; respondWith: typeof respondWith }) => {
      const url = new URL(evt.request.url);
      if (isBypassed(url)) return;
      evt.respondWith(new Response('fake'));
    };

    fetchHandler({
      request: { url: 'https://example.com/admin/users' },
      respondWith,
    });
    expect(respondWith).not.toHaveBeenCalled();

    fetchHandler({
      request: { url: 'wss://example.com/reverb' },
      respondWith,
    });
    expect(respondWith).not.toHaveBeenCalled();

    // 일반 URL 은 respondWith 가 호출됨
    fetchHandler({
      request: { url: 'https://example.com/api/templates/assets/moabom-basic/css/a.css' },
      respondWith,
    });
    expect(respondWith).toHaveBeenCalledTimes(1);
  });
});
