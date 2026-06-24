/**
 * 게시판 윈도우 — G7 layout JSON 로드·data_source fetch·DynamicRenderer 렌더 준비.
 * 코어 DataSourceManager는 템플릿 번들에 없으므로 G7Core.api + DataBindingEngine으로 최소 fetch.
 */
import type React from 'react';
import { resolveMoabomTemplateLangDictionary } from '../i18n/moabomTemplateLangJsonFetch';
import { getMoaShellBoardBridge } from './moaShellBoardBridge';
import { resolveShellAuthModeFromPath } from './moaShellBoardNavigate';
import { parseQuery } from './moaShellLayoutQuery';
import { withTransientRetry } from './moaShellTransientRetry';

export interface BoardComponentDefinition {
  id?: string;
  type?: string;
  name?: string;
  children?: BoardComponentDefinition[];
  default?: BoardComponentDefinition[];
  [key: string]: unknown;
}
type LayoutJson = {
  layout_name?: string;
  components?: BoardComponentDefinition[];
  slots?: Record<string, BoardComponentDefinition[]>;
  modals?: BoardComponentDefinition[];
  data_sources?: BoardDataSource[];
  scripts?: BoardLayoutScript[];
  computed?: Record<string, string>;
  initLocal?: Record<string, unknown>;
  initGlobal?: Record<string, unknown>;
  init_actions?: Array<{ handler?: string; params?: Record<string, unknown> }>;
  initActions?: Array<{ handler?: string; params?: Record<string, unknown> }>;
};

export type BoardWindowMode = 'write' | 'edit';

type BoardLayoutScript = {
  src: string;
  id: string;
  if?: string;
  conditions?: unknown;
  async?: boolean;
};

type BoardDataSource = {
  id: string;
  type?: string;
  endpoint?: string;
  method?: string;
  params?: Record<string, unknown>;
  auto_fetch?: boolean;
  auth_mode?: string;
  if?: string;
  fallback?: unknown;
  onError?: {
    handler?: string;
    params?: Record<string, unknown>;
  };
  errorHandling?: Record<string, {
    handler?: string;
    actions?: Array<{ handler?: string; params?: Record<string, unknown> }>;
    params?: Record<string, unknown>;
  }>;
  initLocal?: string | { key: string; path: string } | Record<string, string | Record<string, string>>;
  refetchOnMount?: boolean;
};

type TemplateAppLike = {
  getLayoutLoader?: () => {
    loadLayout: (templateId: string, layoutPath: string) => Promise<LayoutJson>;
  } | null;
  getConfig?: () => { templateId?: string; locale?: string };
  getGlobalState?: () => Record<string, unknown>;
  getActionDispatcher?: () => {
    dispatch?: (action: unknown, context?: unknown) => Promise<unknown>;
  } | null;
  setGlobalState?: (updates: Record<string, unknown>) => void;
};

type G7CoreLike = {
  getDynamicRenderer?: () => React.ComponentType<Record<string, unknown>> | null;
  getComponentRegistry?: () => unknown;
  getDataBindingEngine?: () => {
    evaluateExpression: (expr: string, ctx: Record<string, unknown>) => unknown;
  } | null;
  getTranslationEngine?: () => unknown;
  getActionDispatcher?: () => unknown;
  api?: {
    get: (path: string, opts?: { params?: Record<string, unknown> }) => Promise<unknown>;
  };
};

const TEMPLATE_ID = 'moabom-basic';

function getG7Core(): G7CoreLike | undefined {
  return (window as { G7Core?: G7CoreLike }).G7Core;
}

function getTemplateApp(): TemplateAppLike | undefined {
  return (window as { __templateApp?: TemplateAppLike }).__templateApp;
}

function evalBindingValue(
  value: unknown,
  ctx: Record<string, unknown>,
  engine: G7CoreLike['getDataBindingEngine'] extends () => infer R ? R : never,
): unknown {
  if (typeof value !== 'string' || !value.includes('{{')) {
    return value;
  }
  const match = value.match(/^\{\{(.+)\}\}$/s);
  if (!match || !engine) {
    return value;
  }
  try {
    return engine.evaluateExpression(match[1].trim(), ctx);
  } catch {
    return '';
  }
}

function evalScriptConditionValue(
  condition: unknown,
  ctx: Record<string, unknown>,
  engine: NonNullable<ReturnType<G7CoreLike['getDataBindingEngine']>>,
): boolean {
  if (condition == null) {
    return true;
  }

  if (typeof condition === 'string') {
    return Boolean(evalBindingValue(condition, ctx, engine));
  }

  if (typeof condition === 'object') {
    const spec = condition as { and?: unknown[]; or?: unknown[]; not?: unknown };
    if (Array.isArray(spec.and)) {
      return spec.and.every(item => evalScriptConditionValue(item, ctx, engine));
    }
    if (Array.isArray(spec.or)) {
      return spec.or.some(item => evalScriptConditionValue(item, ctx, engine));
    }
    if ('not' in spec) {
      return !evalScriptConditionValue(spec.not, ctx, engine);
    }
  }

  // 알 수 없는 conditions 형식은 스크립트 로딩을 막지 않는다.
  return true;
}

async function loadBoardLayoutScripts(
  scripts: BoardLayoutScript[] | undefined,
  conditionContext: Record<string, unknown>,
): Promise<void> {
  if (!scripts?.length || typeof document === 'undefined') {
    return;
  }

  const engine = getG7Core()?.getDataBindingEngine?.();
  const loadPromises: Promise<void>[] = [];

  for (const script of scripts) {
    if (!script?.src || !script?.id) {
      continue;
    }

    if (engine && script.if !== undefined && !evalScriptConditionValue(script.if, conditionContext, engine)) {
      continue;
    }
    if (engine && script.conditions !== undefined && !evalScriptConditionValue(script.conditions, conditionContext, engine)) {
      continue;
    }

    if (document.getElementById(script.id)) {
      continue;
    }

    loadPromises.push(new Promise(resolve => {
      const scriptEl = document.createElement('script');
      scriptEl.src = script.src;
      scriptEl.id = script.id;
      scriptEl.async = script.async ?? true;
      scriptEl.onload = () => resolve();
      scriptEl.onerror = () => resolve();
      document.head.appendChild(scriptEl);
    }));
  }

  if (loadPromises.length > 0) {
    await Promise.all(loadPromises);
  }
}

function resolveEndpoint(template: string, ctx: Record<string, unknown>, engine: NonNullable<ReturnType<G7CoreLike['getDataBindingEngine']>>): string {
  if (!template.includes('{{')) {
    return template;
  }
  return String(template).replace(/\{\{([^}]+)\}\}/g, (_, expr: string) => {
    try {
      const v = engine.evaluateExpression(expr.trim(), ctx);
      return v != null ? String(v) : '';
    } catch {
      return '';
    }
  });
}

export function extractBoardComponents(layout: LayoutJson): BoardComponentDefinition[] {
  const content = layout.slots?.content ?? layout.components ?? [];
  const modals = layout.modals ?? [];
  return [...content, ...modals];
}

function normalizeBoardComponentDefinition(component: BoardComponentDefinition): BoardComponentDefinition {
  const children = component.children?.map(normalizeBoardComponentDefinition);
  const fallbackChildren = component.default?.map(normalizeBoardComponentDefinition);

  return {
    ...component,
    ...(children ? { children } : {}),
    ...(component.type === 'extension_point' && !children?.length && fallbackChildren?.length
      ? { children: fallbackChildren }
      : {}),
  };
}

function normalizeBoardLayout(layout: LayoutJson): LayoutJson {
  return {
    ...layout,
    components: layout.components?.map(normalizeBoardComponentDefinition),
    slots: layout.slots
      ? Object.fromEntries(
          Object.entries(layout.slots).map(([key, value]) => [
            key,
            value.map(normalizeBoardComponentDefinition),
          ]),
        )
      : undefined,
    modals: layout.modals?.map(normalizeBoardComponentDefinition),
  };
}

function extractHttpStatus(error: unknown): number | undefined {
  const e = error as { response?: { status?: number }; status?: number };
  return e?.response?.status ?? e?.status;
}

function extractHttpBody(error: unknown): unknown {
  const e = error as { response?: unknown; data?: unknown };
  if (e?.response != null && typeof e.response === 'object' && 'data' in (e.response as object)) {
    return (e.response as { data?: unknown }).data;
  }
  return e?.response ?? e?.data;
}

function isIdentity428(status: number | undefined, body: unknown): boolean {
  return (
    status === 428 &&
    typeof body === 'object' &&
    body !== null &&
    (body as { error_code?: string }).error_code === 'identity_verification_required'
  );
}

async function boardApiGet(
  api: NonNullable<G7CoreLike['api']>,
  normalized: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const dispatch = (window as {
    G7Core?: { dispatch?: (a: { handler: string; params?: Record<string, unknown> }) => Promise<unknown> };
  }).G7Core?.dispatch;

  const attempt = () => api.get(normalized, { params });

  try {
    return await withTransientRetry(attempt);
  } catch (error) {
    const status = extractHttpStatus(error);
    const body = extractHttpBody(error);
    if (!isIdentity428(status, body)) {
      throw error;
    }

    const verification =
      typeof body === 'object' && body !== null && 'verification' in body
        ? (body as { verification?: { purpose?: string; policy_key?: string; provider_id?: string | null } })
            .verification
        : undefined;
    const purpose = verification?.purpose ?? 'sensitive_action';

    const verified = await dispatch?.({
      handler: 'ensureIdentityVerified',
      params: {
        purpose,
        policy_key: verification?.policy_key,
        provider_id: verification?.provider_id,
      },
    });

    if (!verified) {
      throw error;
    }

    return await attempt();
  }
}

function normalizeBoardApiResponse(raw: unknown): unknown {
  if (raw == null) {
    return raw;
  }

  if (typeof raw === 'object' && 'success' in (raw as object) && 'data' in (raw as object)) {
    return raw;
  }

  return { data: raw };
}

function setGlobalShellFlag(updates: Record<string, unknown>): void {
  const G7Core = (window as { G7Core?: { state?: { set?: (u: Record<string, unknown>) => void } } }).G7Core;
  G7Core?.state?.set?.(updates);
  const templateApp = getTemplateApp() as { setGlobalState?: (u: Record<string, unknown>) => void } | undefined;
  templateApp?.setGlobalState?.(updates);
}

async function runBoardSourceOnError(source: BoardDataSource): Promise<void> {
  if (source.onError?.handler === 'setState' && source.onError.params?.target === 'global') {
    const { target: _target, ...rest } = source.onError.params;
    setGlobalShellFlag(rest);
  }
}

async function runBoardSourceErrorHandling(
  source: BoardDataSource,
  status: number,
): Promise<'handled' | 'unhandled'> {
  const spec = source.errorHandling?.[String(status)];
  if (!spec) return 'unhandled';

  const G7Core = (window as { G7Core?: { dispatch?: (a: { handler: string; params?: Record<string, unknown> }) => Promise<unknown> } }).G7Core;
  const bridge = getMoaShellBoardBridge();

  if (spec.handler === 'sequence' && Array.isArray(spec.actions)) {
    for (const action of spec.actions) {
      if (action.handler === 'toast' && action.params) {
        await G7Core?.dispatch?.({ handler: 'toast', params: action.params });
        continue;
      }
      if (action.handler === 'navigate' && typeof action.params?.path === 'string') {
        const authMode = resolveShellAuthModeFromPath(action.params.path);
        if (authMode && bridge) {
          bridge.openAuth(authMode);
          continue;
        }
      }
      await G7Core?.dispatch?.({ handler: action.handler ?? 'noop', params: action.params });
    }
    return 'handled';
  }

  if (spec.handler === 'showErrorPage') {
    setGlobalShellFlag({ hasError: true });
    return 'handled';
  }

  if (spec.handler === 'suppress') {
    return 'handled';
  }

  await G7Core?.dispatch?.({ handler: spec.handler ?? 'noop', params: spec.params });
  return 'handled';
}

async function fetchBoardDataSources(
  sources: BoardDataSource[],
  route: Record<string, string>,
  query: Record<string, string | string[]>,
  globalState: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const G7Core = getG7Core();
  const engine = G7Core?.getDataBindingEngine?.();
  const api = G7Core?.api;
  if (!engine || !api) {
    throw new Error('G7Core engine unavailable');
  }

  const baseCtx: Record<string, unknown> = {
    route,
    query,
    _global: globalState,
    _local: {},
  };

  const result: Record<string, unknown> = {};

  setGlobalShellFlag({ hasError: false });

  const fetchOneSource = async (source: BoardDataSource): Promise<void> => {
    if (source.type === 'websocket' || source.auto_fetch === false) {
      return;
    }
    if (source.if) {
      const ok = evalBindingValue(`{{${source.if.replace(/^\{\{|\}\}$/g, '')}}}`, baseCtx, engine);
      if (!ok) return;
    }
    if (!source.endpoint) return;

    const endpoint = resolveEndpoint(source.endpoint, { ...baseCtx, ...result }, engine);
    const method = (source.method ?? 'GET').toUpperCase();
    const params: Record<string, unknown> = {};
    if (source.params) {
      for (const [key, val] of Object.entries(source.params)) {
        const resolved = evalBindingValue(val, { ...baseCtx, ...result }, engine);
        if (resolved !== '' && resolved != null) {
          params[key] = resolved;
        }
      }
    }

    const normalized = endpoint.startsWith('/api/')
      ? endpoint.substring(4)
      : endpoint.startsWith('/api')
        ? endpoint.substring(4) || '/'
        : endpoint;

    try {
      const data = method === 'GET'
        ? await boardApiGet(api, normalized, params)
        : await boardApiGet(api, normalized, params);
      result[source.id] = normalizeBoardApiResponse(data);
    } catch (error) {
      await runBoardSourceOnError(source);
      const status = extractHttpStatus(error);
      if (status != null) {
        const handled = await runBoardSourceErrorHandling(source, status);
        if (handled === 'handled' && source.fallback !== undefined) {
          result[source.id] = source.fallback;
          return;
        }
        if (handled === 'handled') {
          result[source.id] = null;
          return;
        }
      }
      if (source.fallback !== undefined) {
        result[source.id] = source.fallback;
        return;
      }
      throw error;
    }
  };

  await Promise.all(sources.map(source => fetchOneSource(source)));

  return result;
}

function extractDataSourcePayload(raw: unknown): unknown {
  if (raw != null && typeof raw === 'object' && 'data' in (raw as object)) {
    return (raw as { data?: unknown }).data ?? raw;
  }
  return raw;
}

function applyBoardDataSourceInitLocal(
  sources: BoardDataSource[],
  fetched: Record<string, unknown>,
  localState: Record<string, unknown>,
): { localState: Record<string, unknown>; forceLocalInit: boolean } {
  let forceLocalInit = false;

  for (const source of sources) {
    if (!source.initLocal) continue;
    const raw = fetched[source.id];
    if (raw == null) continue;

    if (source.refetchOnMount) {
      forceLocalInit = true;
    }

    const actualData = extractDataSourcePayload(raw);
    if (typeof source.initLocal === 'string') {
      localState[source.initLocal] = actualData;
    }
  }

  return { localState, forceLocalInit };
}

function createBoardTempKey(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

async function runBoardInitActions(
  layoutData: LayoutJson,
  dataContext: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const initActions = layoutData.initActions ?? layoutData.init_actions ?? [];
  const localState: Record<string, unknown> = {
    ...(typeof dataContext._local === 'object' && dataContext._local != null
      ? (dataContext._local as Record<string, unknown>)
      : {}),
  };

  const actionDispatcher = getTemplateApp()?.getActionDispatcher?.();
  const dispatch = actionDispatcher?.dispatch;

  if (typeof dispatch !== 'function') {
    if (!localState.tempKey) {
      localState.tempKey = createBoardTempKey();
    }
    return localState;
  }

  for (const action of initActions) {
    if (!action?.handler) continue;
    try {
      await dispatch(action, { dataContext: { ...dataContext, _local: localState } });
      const globalLocal = getTemplateApp()?.getGlobalState?.()?._local;
      if (globalLocal && typeof globalLocal === 'object') {
        Object.assign(localState, globalLocal as Record<string, unknown>);
      }
    } catch {
      /* init_actions 실패는 폼 렌더를 막지 않음 */
    }
  }

  if (!localState.tempKey) {
    localState.tempKey = createBoardTempKey();
  }

  return localState;
}

async function ensureBoardWindowTranslations(locale: string): Promise<void> {
  const engine = getG7Core()?.getTranslationEngine?.() as {
    loadTranslations?: (
      templateId: string,
      loc: string,
      apiBaseUrl?: string,
      bustCache?: boolean,
    ) => Promise<unknown>;
  } | null;

  if (engine?.loadTranslations) {
    try {
      await engine.loadTranslations(TEMPLATE_ID, locale, '/api');
      return;
    } catch {
      /* 엔진 로드 실패 시 fetch 폴백 */
    }
  }

  await resolveMoabomTemplateLangDictionary(locale);
}

/** idle 선로드 — 게시판 윈도우 첫 오픈 시 lang 병목 완화 */
export async function prefetchBoardWindowTranslations(): Promise<void> {
  const config = getTemplateApp()?.getConfig?.();
  const locale = config?.locale ?? 'ko';
  await ensureBoardWindowTranslations(locale);
}

export interface BoardWindowRenderPayload {
  DynamicRenderer: React.ComponentType<Record<string, unknown>>;
  /** G7 TemplateApp 과 동일 — layout.components 를 각각 DynamicRenderer 로 렌더 (Fragment 래핑 금지) */
  componentDefs: BoardComponentDefinition[];
  dataContext: Record<string, unknown>;
  translationContext: { templateId: string; locale: string };
  registry: unknown;
  bindingEngine: unknown;
  translationEngine: unknown;
  actionDispatcher: unknown;
  layoutName: string;
}

function resolveBoardLayoutPath(slug: string, postId?: string, mode?: BoardWindowMode): string {
  if (mode === 'write' || mode === 'edit') {
    return 'board/form';
  }
  if (typeof window !== 'undefined') {
    const parts = window.location.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts[0] === 'board' && decodeURIComponent(parts[1] ?? '') === slug) {
      if (parts[2] === 'write') {
        return 'board/form';
      }
      if (parts.length >= 4 && parts[3] === 'edit') {
        return 'board/form';
      }
    }
  }
  if (postId) {
    return 'board/show';
  }
  return 'board/index';
}

export async function loadBoardWindowRenderPayload(
  slug: string,
  postId: string | undefined,
  mode?: BoardWindowMode,
  queryOverride?: Record<string, string | string[]>,
): Promise<BoardWindowRenderPayload> {
  const layoutPath = resolveBoardLayoutPath(slug, postId, mode);
  const route: Record<string, string> = { slug, ...(postId ? { id: postId } : {}) };
  const query = queryOverride ?? parseQuery(typeof window !== 'undefined' ? window.location.search : '');

  return loadG7LayoutWindowPayload(layoutPath, route, query);
}

export async function loadG7LayoutWindowPayload(
  layoutPath: string,
  route: Record<string, string>,
  queryOverride?: Record<string, string | string[]>,
): Promise<BoardWindowRenderPayload> {
  const G7Core = getG7Core();
  const templateApp = getTemplateApp();
  const layoutLoader = templateApp?.getLayoutLoader?.();
  const DynamicRenderer = G7Core?.getDynamicRenderer?.();

  if (!layoutLoader || !DynamicRenderer) {
    throw new Error('Layout engine unavailable');
  }

  const config = templateApp?.getConfig?.();
  const locale = config?.locale ?? 'ko';

  const beforeLoad = (window as { __g7BeforeLayoutLoad?: (route: { path?: string; layout?: string }, lp: string, tid: string) => Promise<void> })
    .__g7BeforeLayoutLoad;

  const layoutDataPromise = layoutLoader
    .loadLayout(TEMPLATE_ID, layoutPath)
    .then(layout => normalizeBoardLayout(layout));
  const translationsPromise = ensureBoardWindowTranslations(locale);
  const beforeLoadPromise = beforeLoad
    ? beforeLoad(
      { path: Object.values(route).join('/'), layout: 'home' },
      layoutPath,
      TEMPLATE_ID,
    )
    : Promise.resolve();

  const [layoutData] = await Promise.all([
    layoutDataPromise,
    translationsPromise,
    beforeLoadPromise,
  ]);

  const query = queryOverride ?? parseQuery(typeof window !== 'undefined' ? window.location.search : '');
  const globalState = templateApp?.getGlobalState?.() ?? {};

  await loadBoardLayoutScripts(layoutData.scripts, {
    route,
    query,
    _global: globalState,
  });

  const fetched = await fetchBoardDataSources(
    layoutData.data_sources ?? [],
    route,
    query,
    globalState,
  );

  const baseLocal: Record<string, unknown> = {
    ...(layoutData.initLocal ?? {}),
    ...(typeof globalState._local === 'object' && globalState._local != null
      ? (globalState._local as Record<string, unknown>)
      : {}),
  };

  const { localState: localWithInit, forceLocalInit } = applyBoardDataSourceInitLocal(
    layoutData.data_sources ?? [],
    fetched,
    baseLocal,
  );

  const draftContext: Record<string, unknown> = {
    ...fetched,
    _local: localWithInit,
    _global: { ...globalState, ...(layoutData.initGlobal ?? {}) },
    route,
    query,
    $computed: layoutData.computed ?? {},
  };

  const localState = await runBoardInitActions(layoutData, draftContext);

  const dataContext: Record<string, unknown> = {
    ...draftContext,
    _local: localState,
    _localInit:
      Object.keys(localState).length > 0
        ? {
            ...localState,
            ...(forceLocalInit ? { _forceLocalInit: Date.now() } : {}),
          }
        : undefined,
  };

  const components = extractBoardComponents(layoutData);

  return {
    DynamicRenderer,
    componentDefs: components,
    dataContext,
    translationContext: {
      templateId: config?.templateId ?? TEMPLATE_ID,
      locale,
    },
    registry: G7Core?.getComponentRegistry?.(),
    bindingEngine: G7Core?.getDataBindingEngine?.(),
    translationEngine: G7Core?.getTranslationEngine?.(),
    actionDispatcher: templateApp?.getActionDispatcher?.() ?? G7Core?.getActionDispatcher?.(),
    layoutName: layoutData.layout_name ?? layoutPath,
  };
}

export function resolveBoardWindowTitle(
  slug: string,
  postId: string | undefined,
  fetched: Record<string, unknown>,
): string | null {
  if (postId) {
    const post = fetched.post as { data?: { title?: string; board?: { name?: string } } } | undefined;
    const title = post?.data?.title?.trim();
    if (title) return title;
    const boardName = post?.data?.board?.name?.trim();
    if (boardName) return boardName;
  } else {
    const posts = fetched.posts as { data?: { board?: { name?: string } } } | undefined;
    const boardName = posts?.data?.board?.name?.trim();
    if (boardName) return boardName;
  }
  return slug || null;
}
