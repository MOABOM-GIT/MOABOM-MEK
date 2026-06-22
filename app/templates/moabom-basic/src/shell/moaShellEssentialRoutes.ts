/**
 * Ghost shell 스냅샷·DB routes 동기화 지연 시에도 셸 윈도우 라우트가 동작하도록
 * `routes.json` 에 반드시 있어야 하는 home 레이아웃 경로 (에러·게시판).
 */

export type ShellEssentialRoute = {
  path: string;
  layout: string;
  auth_required: boolean;
  meta?: { title?: string };
};

/** moabom-basic/routes.json 셸 윈도우 SSOT — DB 미반영 시 클라이언트·API 양쪽에서 보강 */
export const MOA_SHELL_ESSENTIAL_ROUTES: readonly ShellEssentialRoute[] = [
  {
    path: '/board/:slug',
    layout: 'home',
    auth_required: false,
    meta: { title: '게시판' },
  },
  {
    path: '/board/:slug/write',
    layout: 'home',
    auth_required: false,
    meta: { title: '게시글 작성' },
  },
  {
    path: '/board/:slug/:id',
    layout: 'home',
    auth_required: false,
    meta: { title: '게시글' },
  },
  {
    path: '/board/:slug/:id/edit',
    layout: 'home',
    auth_required: false,
    meta: { title: '게시글 수정' },
  },
  {
    path: '/404',
    layout: 'home',
    auth_required: false,
    meta: { title: '페이지를 찾을 수 없습니다' },
  },
  {
    path: '/403',
    layout: 'home',
    auth_required: false,
    meta: { title: '접근 권한이 없습니다' },
  },
  {
    path: '/500',
    layout: 'home',
    auth_required: false,
    meta: { title: '서버 오류' },
  },
  {
    path: '/503',
    layout: 'home',
    auth_required: false,
    meta: { title: '서비스 점검' },
  },
  {
    path: '/maintenance',
    layout: 'home',
    auth_required: false,
    meta: { title: '점검 중' },
  },
] as const;

function routePathKey(route: unknown): string | null {
  if (!route || typeof route !== 'object') {
    return null;
  }
  const path = (route as { path?: unknown }).path;
  return typeof path === 'string' ? path : null;
}

/** 기존 routes 배열에 누락된 셸 필수 경로를追加한다. */
export function mergeMoabomShellEssentialRoutes<T>(routes: T[]): T[] {
  const existing = new Set<string>();
  for (const route of routes) {
    const key = routePathKey(route);
    if (key) {
      existing.add(key);
    }
  }

  const merged = [...routes];
  for (const essential of MOA_SHELL_ESSENTIAL_ROUTES) {
    if (!existing.has(essential.path)) {
      merged.push(essential as T);
      existing.add(essential.path);
    }
  }

  return merged;
}

export function isMoabomBasicTemplateRoutesUrl(url: string): boolean {
  try {
    const u = new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost');

    return /\/api\/templates\/moabom-basic\/routes\.json$/.test(u.pathname);
  } catch {
    return false;
  }
}

type RoutesApiBody = {
  success?: boolean;
  data?: { routes?: unknown[] };
};

/** routes.json API 응답 본문에 필수 셸 라우트를 병합한다. */
export function mergeEssentialRoutesInRoutesApiBody(body: RoutesApiBody): RoutesApiBody {
  if (!body?.data || !Array.isArray(body.data.routes)) {
    return body;
  }

  return {
    ...body,
    data: {
      ...body.data,
      routes: mergeMoabomShellEssentialRoutes(body.data.routes),
    },
  };
}
