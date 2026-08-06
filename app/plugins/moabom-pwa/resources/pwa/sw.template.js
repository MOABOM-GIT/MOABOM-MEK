import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
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
const SHELL_BOOT_CACHE = `${CACHE_PREFIX}-shell-boot-v${__VERSION__}`;
const LAYOUT_JSON_CACHE = `${CACHE_PREFIX}-layout-json-v${__VERSION__}`;
const WEBSITE_ICON_CACHE = `${CACHE_PREFIX}-website-icon-v${__VERSION__}`;

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

/** website-icon 은 icon_token 이 바뀌어도 동일 이미지 — pathname 만 캐시 키 */
function websiteIconCacheKey(url) {
  const next = new URL(url.toString());
  return next.origin + next.pathname;
}

const queryNormalizationPlugin = {
  async cacheKeyWillBeUsed({ request }) {
    // Cache API 키에는 URL만 필요하다. 원본 RequestInit(mode: "navigate" 등)을
    // 복사하면 브라우저가 금지하는 Request 조합이 생길 수 있으므로 문자열 키만 반환한다.
    return normalizeCacheKey(new URL(request.url));
  },
};

const websiteIconCacheKeyPlugin = {
  async cacheKeyWillBeUsed({ request }) {
    return websiteIconCacheKey(new URL(request.url));
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
        (path.startsWith('/api/templates/assets/') && /\/(css|js|img|fonts)\//.test(path)) ||
        (path.startsWith('/api/modules/assets/') && /\/(?:dist\/)?(?:css|js|img)\//.test(path)) ||
        (path.startsWith('/api/plugins/assets/') && /\/(?:dist\/)?(?:css|js|img)\//.test(path)) ||
        /^\/api\/templates\/[^/]+\/components\.json$/.test(path) ||
        (path.startsWith('/build/core/') && path.endsWith('.min.js')) ||
        path === '/api/modules/bundle.js' ||
        path === '/api/modules/bundle.css' ||
        path === '/api/plugins/bundle.js' ||
        path === '/api/plugins/bundle.css'
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
  ({ url, request }) => (
    request.method === 'GET' &&
    !isBypassed(url) &&
    !request.headers.has('Authorization') &&
    /^\/api\/modules\/moabom-apps\/apps\/generated\/\d+\/website-icon$/.test(url.pathname)
  ),
  new CacheFirst({
    cacheName: WEBSITE_ICON_CACHE,
    plugins: [
      websiteIconCacheKeyPlugin,
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
    url.pathname === '/api/modules/moabom-system/public/shell-boot'
  ),
  // StaleWhileRevalidate: 재방문 시 캐시를 즉시 반환하고 백그라운드에서 재검증한다.
  // NetworkFirst+0.4s 는 재방문에도 최대 0.4s origin RTT 를 기다렸으나, 부트 임계 경로는
  // stale 로 즉시 진행하는 편이 체감 지연이 낮다(콜드 최초 방문만 네트워크 대기).
  // 서버 revision 변경분은 다음 네비게이션에서 백그라운드 재검증으로 반영된다.
  new StaleWhileRevalidate({
    cacheName: SHELL_BOOT_CACHE,
    plugins: [
      createCacheGuardPlugin(),
      new ExpirationPlugin({ maxEntries: 2, maxAgeSeconds: 300 }),
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
    // 네트워크가 느리면 0.4s 후 stale HTML 로 즉시 페인트 (흰 화면 대기 축소).
    // 실시간·API 와 무관 — 문서 네비게이션만.
    networkTimeoutSeconds: 0.4,
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

/**
 * FCM / Web Push — 앱·PWA 종료 후에도 OS 알림.
 * Firebase messaging SW 없이도 HTTP v1 notification+data 페이로드를 표시한다.
 */
async function postFcmPushToOpenClients(message) {
  const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of allClients) {
    try {
      if (new URL(client.url).origin === self.location.origin) {
        client.postMessage(message);
      }
    } catch {
      // 닫히는 중인 client 는 건너뜀
    }
  }
}

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    try {
      const text = event.data ? event.data.text() : '';
      payload = text ? { data: { body: text } } : {};
    } catch {
      payload = {};
    }
  }

  const notification = payload.notification && typeof payload.notification === 'object'
    ? payload.notification
    : {};
  const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
  const title = String(notification.title || data.title || 'Moabom');
  const body = String(notification.body || data.body || '');
  const clickUrl = String(data.click_url || data.clickUrl || '/');
  const tag = data.tag || data.notification_type || undefined;
  const notificationType = typeof data.notification_type === 'string'
    ? data.notification_type
    : '';
  const notificationData = {
    click_url: clickUrl,
    notification_type: notificationType,
    subject: title,
    body,
    data,
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: body || undefined,
        tag: typeof tag === 'string' && tag !== '' ? tag : undefined,
        data: notificationData,
      }),
      postFcmPushToOpenClients({
        type: 'MOABOM_FCM_PUSH_RECEIVED',
        ...notificationData,
      }),
    ]),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawData = event.notification?.data;
  const notificationData = rawData && typeof rawData === 'object' ? rawData : {};
  const message = {
    type: 'MOABOM_FCM_NOTIFICATION_CLICK',
    click_url: typeof notificationData.click_url === 'string' ? notificationData.click_url : '/',
    notification_type: typeof notificationData.notification_type === 'string'
      ? notificationData.notification_type
      : '',
    data: notificationData.data && typeof notificationData.data === 'object'
      ? notificationData.data
      : {},
  };

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        try {
          if (new URL(client.url).origin !== self.location.origin) {
            continue;
          }
        } catch {
          continue;
        }
        if ('focus' in client) {
          await client.focus();
          client.postMessage(message);
          return;
        }
      }
      if (self.clients.openWindow) {
        const landingUrl = new URL('/', self.location.origin);
        landingUrl.searchParams.set('moabom_notification_click', JSON.stringify(message));
        await self.clients.openWindow(landingUrl.href);
      }
    })(),
  );
});
