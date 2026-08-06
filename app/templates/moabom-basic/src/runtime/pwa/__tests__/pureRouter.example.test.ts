/**
 * Feature: moabom-pwa-service-worker
 *
 * Example / Smoke tests for `routeRequest`. Req 5.1~5.10 each get at least
 * one representative URL assertion.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.8, 5.10
 */
import { describe, expect, it } from 'vitest';

import { routeRequest } from '../pureRouter';

const base = (overrides: Partial<Parameters<typeof routeRequest>[0]> = {}) => ({
  method: 'GET' as const,
  hasAuthorization: false,
  accept: '',
  ...overrides,
});

describe('routeRequest — example smoke table', () => {
  it('Req 5.1 — /api/templates/assets/moabom-basic/css/components.css?v=… → cache-first', () => {
    const d = routeRequest({
      url: 'https://mek360.com/api/templates/assets/moabom-basic/css/components.css?v=1778130071',
      ...base(),
    });
    expect(d.strategy).toBe('cache-first');
    expect(d.cacheKey).toBe(
      'https://mek360.com/api/templates/assets/moabom-basic/css/components.css?v=1778130071',
    );
  });

  it('Req 5.1 — img 에셋도 cache-first', () => {
    const d = routeRequest({
      url: 'https://mek360.com/api/templates/assets/moabom-basic/img/logo.png?v=1',
      ...base(),
    });
    expect(d.strategy).toBe('cache-first');
  });

  it('Req 5.2 — /build/core/template-engine.min.js → cache-first', () => {
    const d = routeRequest({
      url: 'https://mek360.com/build/core/template-engine.min.js?v=abc',
      ...base(),
    });
    expect(d.strategy).toBe('cache-first');
  });

  it('템플릿 언어 JSON은 앱 메모리 캐시가 담당하므로 bypass', () => {
    const d = routeRequest({
      url: 'https://mek360.com/api/templates/moabom-basic/lang/ko.json?v=1778130071',
      ...base(),
    });
    expect(d.strategy).toBe('bypass');
    expect(d.cacheKey).toBeNull();
  });

  it('템플릿 routes/components JSON은 앱 메모리 캐시가 담당하므로 bypass', () => {
    const routes = routeRequest({
      url: 'https://mek360.com/api/templates/moabom-basic/routes.json?v=1778130071',
      ...base(),
    });
    const components = routeRequest({
      url: 'https://mek360.com/api/templates/moabom-basic/components.json?v=1778130071',
      ...base(),
    });
    expect(routes.strategy).toBe('bypass');
    expect(routes.cacheKey).toBeNull();
    expect(components.strategy).toBe('bypass');
    expect(components.cacheKey).toBeNull();
  });

  it('템플릿 config.json은 cache_version 기준점이므로 bypass', () => {
    const d = routeRequest({
      url: 'https://mek360.com/api/templates/moabom-basic/config.json',
      ...base(),
    });
    expect(d.strategy).toBe('bypass');
    expect(d.cacheKey).toBeNull();
  });

  it('공개 레이아웃 JSON은 cache-first', () => {
    const d = routeRequest({
      url: 'https://mek360.com/api/layouts/moabom-basic/home.json?v=1778130071',
      ...base(),
    });
    expect(d.strategy).toBe('cache-first');
    expect(d.cacheKey).toBe('https://mek360.com/api/layouts/moabom-basic/home.json?v=1778130071');
  });

  it('Req 5.3 — fonts.bunny.net → cache-first', () => {
    const d = routeRequest({
      url: 'https://fonts.bunny.net/css?family=inter:400',
      ...base(),
    });
    expect(d.strategy).toBe('cache-first');
  });

  it('Req 5.3 — cdnjs.cloudflare.com → cache-first', () => {
    const d = routeRequest({
      url: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
      ...base(),
    });
    expect(d.strategy).toBe('cache-first');
  });

  it('Req 5.4 — frontend-defaults → cache-first', () => {
    const d = routeRequest({
      url: 'https://mek360.com/api/modules/moabom-system/public/frontend-defaults',
      ...base(),
    });
    expect(d.strategy).toBe('cache-first');
  });

  it('shell-boot → stale-while-revalidate (SW StaleWhileRevalidate SSOT)', () => {
    const d = routeRequest({
      url: 'https://mek360.com/api/modules/moabom-system/public/shell-boot',
      ...base(),
    });
    expect(d.strategy).toBe('stale-while-revalidate');
  });

  it('Req 5.5 — pwa/version → bypass', () => {
    const d = routeRequest({
      url: 'https://mek360.com/api/plugins/moabom-pwa/version',
      ...base(),
    });
    expect(d.strategy).toBe('bypass');
  });

  it('Req 5.6 — user settings → bypass', () => {
    const d = routeRequest({
      url: 'https://mek360.com/api/modules/moabom-system/user/settings',
      ...base(),
    });
    expect(d.strategy).toBe('bypass');
  });

  it('Req 5.7 — 기타 /api/* → bypass', () => {
    const d = routeRequest({
      url: 'https://mek360.com/api/auth/login',
      ...base(),
    });
    expect(d.strategy).toBe('bypass');
  });

  it('Req 5.8 — HTML 문서 GET → network-first', () => {
    const d = routeRequest({
      url: 'https://mek360.com/',
      ...base({ accept: 'text/html,application/xhtml+xml' }),
    });
    expect(d.strategy).toBe('network-first');
  });

  it('Req 5.10 — non-GET 은 어떤 경로든 bypass', () => {
    const d = routeRequest({
      url: 'https://mek360.com/api/templates/assets/moabom-basic/css/components.css',
      ...base({ method: 'POST' }),
    });
    expect(d.strategy).toBe('bypass');
  });
});
