/**
 * PWA Service Worker 라우팅 판정 순수 레이어.
 *
 * 본 파일은 외부 상태(localStorage · DOM · `fetch` · `Date.now`) 를 일체
 * 읽지 않으며, 오로지 인자로 전달된 `RouteInput` 만으로 결정(`RouteDecision`)
 * 을 생성한다. Property-based test(P1 P-RouterSpecificity · P2
 * P-QueryNormalization · P5 P-AdminBypass) 가 URL 공간 전반에 대해 검증할
 * 수 있도록 설계되었다.
 *
 * Spec: `.kiro/specs/moabom-pwa-service-worker/` Req 2, 5, 6, 9, 10 /
 *       Design §4.1 · §3.5
 */

/** 라우팅 판정에 필요한 최소 입력. */
export interface RouteInput {
  /** 절대 URL 문자열(쿼리 포함). */
  url: string;
  /** HTTP 메서드, upper-case. */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
  /** 요청 헤더에 Authorization 가 존재하는지 여부. 토큰 값은 불필요. */
  hasAuthorization: boolean;
  /** 요청 Accept 헤더(없으면 빈 문자열). 'text/html' 포함 여부로 문서 판정. */
  accept: string;
}

/** 허용된 캐시 전략 집합(Req 5). */
export type CacheStrategy =
  | 'stale-while-revalidate'
  | 'cache-first'
  | 'network-first'
  | 'bypass';

/** 라우팅 결정(순수). 저장 불가 요청은 `cacheKey: null`. */
export interface RouteDecision {
  strategy: CacheStrategy;
  /** 정규화된 캐시 키(URL 문자열). bypass · network-only 등 저장 불가 요청은 null. */
  cacheKey: string | null;
}

/** `Sw_Bypass_Set` 프로토콜 화이트리스트(SW 가 가로채지 않음). */
const BYPASS_PROTOCOLS: ReadonlySet<string> = new Set(['chrome-extension:', 'ws:', 'wss:']);

/** PWA 사용자 템플릿 — 이 prefix 아래 asset 만 cache-first 대상. Req 5.1. */
export const PWA_USER_TEMPLATE_ASSETS_PREFIX = '/api/templates/assets/moabom-basic/';

/** admin 관련 경로 접두. Req 2.2, 2.3. */
const ADMIN_PATH_PREFIXES: readonly string[] = ['/admin', '/api/admin'];

/**
 * `moabom-basic` 이외 템플릿 정적 asset (관리자·다른 사용자 템플릿 등).
 * SW 가 캐시하지 않도록 bypass 한다. 활성 관리자 템플릿 ID 에 의존하지 않는다.
 */
export function isNonUserTemplateAssetPath(path: string): boolean {
  if (!path.startsWith('/api/templates/assets/')) return false;
  if (path.startsWith(PWA_USER_TEMPLATE_ASSETS_PREFIX)) return false;
  return true;
}

/** frontend-defaults — 짧은 TTL cache-first. 초기 셸 pending을 줄이고 저장 API와 분리한다. */
const FRONTEND_DEFAULTS_PATH = '/api/modules/moabom-system/public/frontend-defaults';

/** shell-boot — 부트 JSON 통합(프론트 fetch 패치가 개별 API를 대체). */
const SHELL_BOOT_PATH = '/api/modules/moabom-system/public/shell-boot';

/** PWA version 엔드포인트 — SW가 가로채지 않고 브라우저 네트워크에 위임. Req 5.5. */
const PWA_VERSION_PATH = '/api/plugins/moabom-pwa/version';

/** 사용자 설정 API 경로 — 개인정보 응답이므로 SW가 가로채지 않음. */
const USER_API_PATH_PREFIX = '/api/modules/moabom-system/user/';

/** 외부 CDN 호스트 — cache-first 1년. Req 5.3. */
const CDN_HOSTS: ReadonlySet<string> = new Set(['fonts.bunny.net', 'cdnjs.cloudflare.com']);

/**
 * `Sw_Bypass_Set` 소속 여부. Req 2 · P5.
 *
 * admin 경로는 `/admin` 정확 일치 또는 `/admin/…` 접두 매칭이어야 하며,
 * `/administrator` 같은 "admin 접두 단어" 는 bypass 하지 않는다(Req 2 정확 경로 계약).
 */
export function isBypassed(url: URL): boolean {
  if (BYPASS_PROTOCOLS.has(url.protocol)) return true;

  const path = url.pathname;
  for (const prefix of ADMIN_PATH_PREFIXES) {
    if (path === prefix) return true;
    if (path.startsWith(prefix + '/')) return true;
  }
  if (isNonUserTemplateAssetPath(path)) return true;
  return false;
}

/**
 * `Query_Normalization` — 쿼리는 원형 보존하고 프래그먼트만 제거. Req 6 · P2.
 *
 * `v`는 확장 캐시 버전이므로 Cache Storage 키에 남긴다. 제거하면 버전 변경 후에도
 * 이전 JSON/에셋이 계속 반환될 수 있다.
 */
export function normalizeCacheKey(url: URL): string {
  const next = new URL(url.toString());
  next.hash = '';
  // 쿼리가 모두 비면 `?` 자체를 제거한다.
  if ([...next.searchParams].length === 0) {
    return next.origin + next.pathname + (next.hash || '');
  }
  return next.toString();
}

/** HTML 문서 요청 판정: `Accept` 헤더에 `text/html` 포함 + GET. Req 5.8. */
function isHtmlDocumentRequest(input: RouteInput): boolean {
  return input.method === 'GET' && input.accept.includes('text/html');
}

/** `/api/templates/assets/{vendor}/(css|js|img)/…` 매칭. Req 5.1. */
function isMoabomTemplateAssetPath(path: string): boolean {
  // moabom-basic 이외 템플릿 asset 은 isBypassed 단계에서 이미 걸러졌다.
  if (!path.startsWith('/api/templates/assets/')) return false;
  const parts = path.split('/');
  // /api/templates/assets/{vendor}/{kind}/…  → parts[4] = vendor, parts[5] = kind
  if (parts.length < 7) return false;
  const kind = parts[5];
  return kind === 'css' || kind === 'js' || kind === 'img';
}

/** 플러그인 정적 에셋 매칭. */
function isPluginAssetPath(path: string): boolean {
  if (!path.startsWith('/api/plugins/assets/')) return false;
  const parts = path.split('/');
  return parts.includes('js') || parts.includes('css') || parts.includes('img');
}

/** 공개 레이아웃 JSON. preview는 토큰 기반이라 SW 캐시 대상에서 제외한다. */
function isPublicLayoutJsonPath(path: string): boolean {
  return /^\/api\/layouts\/(?!preview\/)[^/]+\/[a-zA-Z0-9_./-]+\.json$/.test(path);
}

/** 코어 엔진 번들 매칭. Req 5.2. */
function isCoreBuildAsset(path: string): boolean {
  return path.startsWith('/build/core/') && path.endsWith('.min.js');
}

/**
 * 라우팅 판정. 외부 상태 참조 없음. Req 2, 5, 6, 9, 10.
 *
 * 판정 순서(요구사항 우선순위 그대로):
 *   1. `isBypassed` → `bypass`
 *   2. non-GET → `bypass`
 *   3. Authorization 헤더 존재 → `bypass` (Req 5.9 · 9.1)
 *   4. 경로별 규칙(정적 에셋 · 코어 번들 · CDN · 공개 레이아웃 · frontend-defaults)
 *   5. HTML 문서 → `network-first`
 *   6. 그 외 → `bypass` (SW가 가로채지 않고 브라우저 기본 네트워크 사용)
 */
export function routeRequest(input: RouteInput): RouteDecision {
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    // 파싱 불가한 URL 은 SW 가 건드리지 않음(정상 네트워크 경로 위임).
    return { strategy: 'bypass', cacheKey: null };
  }

  // 1) Bypass 집합
  if (isBypassed(parsed)) {
    return { strategy: 'bypass', cacheKey: null };
  }

  // 2) non-GET 은 SW 우회
  if (input.method !== 'GET') {
    return { strategy: 'bypass', cacheKey: null };
  }

  // 3) Authorization 포함 요청은 SW 우회(Req 5.9 · 9.1)
  if (input.hasAuthorization) {
    return { strategy: 'bypass', cacheKey: null };
  }

  const path = parsed.pathname;
  const host = parsed.host;

  // 4a) shell-boot · frontend-defaults → 짧은 TTL cache-first
  if (path === SHELL_BOOT_PATH || path === FRONTEND_DEFAULTS_PATH) {
    return { strategy: 'cache-first', cacheKey: normalizeCacheKey(parsed) };
  }

  // 4b) 외부 CDN → cache-first (Req 5.3)
  if (CDN_HOSTS.has(host)) {
    return { strategy: 'cache-first', cacheKey: normalizeCacheKey(parsed) };
  }

  // 4c) 정적 에셋 — 버전 쿼리로 무효화되므로 cache-first.
  if (isMoabomTemplateAssetPath(path) || isPluginAssetPath(path)) {
    return { strategy: 'cache-first', cacheKey: normalizeCacheKey(parsed) };
  }

  // 4d) 코어 엔진 번들 → cache-first.
  if (isCoreBuildAsset(path)) {
    return { strategy: 'cache-first', cacheKey: normalizeCacheKey(parsed) };
  }

  // 4e) 공개 레이아웃 JSON → cache-first.
  if (isPublicLayoutJsonPath(path)) {
    return { strategy: 'cache-first', cacheKey: normalizeCacheKey(parsed) };
  }

  // 4f) 템플릿 메타/언어 JSON을 포함한 민감/동적 API는 SW가 관여하지 않는다.
  if (
    path === PWA_VERSION_PATH ||
    path.startsWith(USER_API_PATH_PREFIX) ||
    path.startsWith('/api/')
  ) {
    return { strategy: 'bypass', cacheKey: null };
  }

  // 5) HTML 문서 → network-first (Req 5.8)
  if (isHtmlDocumentRequest(input)) {
    return { strategy: 'network-first', cacheKey: normalizeCacheKey(parsed) };
  }

  // 6) 그 외 — SW 우회
  return { strategy: 'bypass', cacheKey: null };
}
