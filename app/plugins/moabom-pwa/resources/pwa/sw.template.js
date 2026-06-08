import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

const __VERSION__ = '{{VERSION}}';
const __WORKBOX_MANIFEST__ = self.__WB_MANIFEST;
const __PRECACHE_MANIFEST__ = JSON.parse('__PRECACHE_MANIFEST_JSON__');
const precacheManifest = __PRECACHE_MANIFEST__.length > 0 ? __PRECACHE_MANIFEST__ : __WORKBOX_MANIFEST__;

/**
 * precacheAndRoute에 올라간 URL은 런타임 CacheFirst 라우트에 다시 걸리지 않게 한다.
 * 동일 URL에 이중 전략이 겹치면 캐시 키·만료 정책이 어긋날 수 있다(로드맵 B2).
 */
const precachedPathnames = new Set(
  (Array.isArray(precacheManifest) ? precacheManifest : [])
    .map((entry) => {
      const raw = typeof entry === 'string' ? entry : entry?.url;
      if (typeof raw !== 'string' || raw === '') {
        return null;
      }
      try {
        return new URL(raw, self.location.origin).pathname;
      } catch {
        return raw.startsWith('/') ? raw : `/${raw}`;
      }
    })
    .filter(Boolean),
);

const CACHE_PREFIX = 'moabom';
const ASSETS_CACHE = `${CACHE_PREFIX}-assets-v${__VERSION__}`;
const HTML_CACHE = `${CACHE_PREFIX}-html-v${__VERSION__}`;
const CDN_CACHE = `${CACHE_PREFIX}-cdn-v${__VERSION__}`;
const FRONTEND_DEFAULTS_CACHE = `${CACHE_PREFIX}-frontend-defaults-v${__VERSION__}`;
const LAYOUT_JSON_CACHE = `${CACHE_PREFIX}-layout-json-v${__VERSION__}`;

/** PWA 사용자 템플릿 — 이 prefix 아래 asset 만 SW cache-first 대상. */
const PWA_USER_TEMPLATE_ASSETS_PREFIX = '/api/templates/assets/moabom-basic/';

function isNonUserTemplateAssetPath(path) {
  if (!path.startsWith('/api/templates/assets/')) return false;
  if (path.startsWith(PWA_USER_TEMPLATE_ASSETS_PREFIX)) return false;
  return true;
}

function isBypassed(url) {
  if (['chrome-extension:', 'ws:', 'wss:'].includes(url.protocol)) return true;

  const path = url.pathname;
  if (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/api/admin' ||
    path.startsWith('/api/admin/')
  ) {
    return true;
  }
  return isNonUserTemplateAssetPath(path);
}

function isPublicLayoutJsonPath(path) {
  return /^\/api\/layouts\/(?!preview\/)[^/]+\/[a-zA-Z0-9_./-]+\.json$/.test(path);
}

function normalizeCacheKey(url) {
  const next = new URL(url.toString());
  next.hash = '';
  if ([...next.searchParams].length === 0) {
    return next.origin + next.pathname;
  }
  return next.toString();
}

const queryNormalizationPlugin = {
  async cacheKeyWillBeUsed({ request }) {
    // Cache API 키에는 URL만 필요하다. 원본 RequestInit(mode: "navigate" 등)을
    // 복사하면 브라우저가 금지하는 Request 조합이 생길 수 있으므로 문자열 키만 반환한다.
    return normalizeCacheKey(new URL(request.url));
  },
};

function createCacheGuardPlugin({ allowOpaque = false } = {}) {
  return {
    async cacheWillUpdate({ request, response }) {
      if (request.headers.has('Authorization')) return null;

      const cacheControl = response.headers.get('Cache-Control') ?? '';
      if (/\b(no-store|private)\b/i.test(cacheControl)) return null;

      if (response.status === 200) return response;
      if (allowOpaque && response.status === 0) return response;

      return null;
    },
  };
}

async function deleteStaleCaches(version) {
  const expectedSuffix = `-v${version}`;
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith(`${CACHE_PREFIX}-`) && !key.endsWith(expectedSuffix))
      .map((key) => caches.delete(key)),
  );
}

/**
 * 앱 실행 시점에만 자산 URL을 `ASSETS_CACHE`에 넣는 Lazy Precache (docs/moabom-pwa-lazy-precache.md).
 * 동일 출처만 허용. 개별 실패는 무시한다.
 *
 * @param {string[]} urls
 */
async function addUrlsToAssetsCache(urls) {
  const cache = await caches.open(ASSETS_CACHE);
  await Promise.allSettled(
    urls.map(async (urlStr) => {
      let href;
      let cacheKey;
      try {
        const u = new URL(urlStr, self.location.origin);
        if (u.origin !== self.location.origin) {
          return;
        }
        href = u.href;
        cacheKey = normalizeCacheKey(u);
      } catch {
        return;
      }
      try {
        const existing = await cache.match(cacheKey);
        if (existing) {
          return;
        }
        await cache.add(new Request(href, { credentials: 'same-origin' }));
      } catch {
        // 404·CORS 등 — 전체 흐름은 계속
      }
    }),
  );
}

cleanupOutdatedCaches();
precacheAndRoute(precacheManifest);

registerRoute(
  ({ url, request }) => {
    const path = url.pathname;
    return (
      request.method === 'GET' &&
      !isBypassed(url) &&
      !request.headers.has('Authorization') &&
      !precachedPathnames.has(path) &&
      (
        (path.startsWith('/api/templates/assets/') && /\/(css|js|img)\//.test(path)) ||
        (path.startsWith('/api/plugins/assets/') && /\/(?:dist\/)?(?:css|js|img)\//.test(path)) ||
        (path.startsWith('/build/core/') && path.endsWith('.min.js'))
      )
    );
  },
  new CacheFirst({
    cacheName: ASSETS_CACHE,
    plugins: [
      queryNormalizationPlugin,
      createCacheGuardPlugin(),
      // 앱·확장 수 증가 시 LRU 상한(로드맵 B5). precache는 별도 정책.
      new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 2592000 }),
    ],
  }),
);

registerRoute(
  ({ url, request }) => (
    request.method === 'GET' &&
    !isBypassed(url) &&
    !request.headers.has('Authorization') &&
    isPublicLayoutJsonPath(url.pathname)
  ),
  new CacheFirst({
    cacheName: LAYOUT_JSON_CACHE,
    plugins: [
      queryNormalizationPlugin,
      createCacheGuardPlugin(),
      new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 86400 }),
    ],
  }),
);

registerRoute(
  ({ url, request }) => (
    request.method === 'GET' &&
    !isBypassed(url) &&
    !request.headers.has('Authorization') &&
    (url.host === 'fonts.bunny.net' || url.host === 'cdnjs.cloudflare.com')
  ),
  new CacheFirst({
    cacheName: CDN_CACHE,
    plugins: [
      queryNormalizationPlugin,
      createCacheGuardPlugin({ allowOpaque: true }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 31536000 }),
    ],
  }),
);

registerRoute(
  ({ url, request }) => (
    request.method === 'GET' &&
    !isBypassed(url) &&
    !request.headers.has('Authorization') &&
    url.pathname === '/api/modules/moabom-system/public/frontend-defaults'
  ),
  new CacheFirst({
    cacheName: FRONTEND_DEFAULTS_CACHE,
    plugins: [
      createCacheGuardPlugin(),
      new ExpirationPlugin({ maxEntries: 1, maxAgeSeconds: 60 }),
    ],
  }),
);

registerRoute(
  ({ request, url }) => (
    request.method === 'GET' &&
    !isBypassed(url) &&
    !request.headers.has('Authorization') &&
    request.headers.get('Accept')?.includes('text/html')
  ),
  new NetworkFirst({
    cacheName: HTML_CACHE,
    networkTimeoutSeconds: 3,
    plugins: [queryNormalizationPlugin, createCacheGuardPlugin()],
  }),
);

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await deleteStaleCaches(__VERSION__);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();

    return;
  }

  if (event.data?.type === 'MOABOM_LAZY_PRECACHE') {
    const raw = Array.isArray(event.data.urls) ? event.data.urls : [];
    const urls = raw.filter((u) => typeof u === 'string').slice(0, 30);
    if (urls.length === 0) {
      return;
    }
    const run = addUrlsToAssetsCache(urls);
    if (typeof event.waitUntil === 'function') {
      event.waitUntil(run);
    } else {
      void run;
    }
  }
});
