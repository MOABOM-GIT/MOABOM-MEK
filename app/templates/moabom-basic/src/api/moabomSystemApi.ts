import {
  createShellModuleApi,
  MoabomShellAuthExpiredError,
  MoabomShellAuthRequiredError,
  MoabomShellModuleApiError,
  requestShellJson,
} from './moabomShellHttp';
import type { MoabomApiResult } from './moabomAuthenticatedApi';
import type { MoabomSystemDefaults, MoabomSystemState } from '../types/moabomSystem';
import { setMoabomLocaleCatalog, type MoabomLocaleCatalog } from '../utils/moabomLocaleCatalog';
import { ensureMoabomShellBootLoaded, getMoabomShellBootData } from '../runtime/moabomShellBoot';
import { seedMoabomGeneratedAppLibrary } from '../runtime/moabomGeneratedAppLibraryLoad';
import type { MoabomGeneratedAppLibraryPayload } from '../runtime/moabomGeneratedAppLibraryLoad';
import { runMoabomShellRealtimeTask } from '../runtime/moabomShellRealtimeRequestCoalescer';

interface ApiSystemSettingsResponse {
  success?: boolean;
  message?: string;
  data?: {
    defaults?: MoabomSystemDefaults;
    settings?: Partial<MoabomSystemState>;
    defaults_revision?: number;
    locale_catalog?: MoabomLocaleCatalog;
    generated_app_library?: MoabomGeneratedAppLibraryPayload;
  };
}

type PublicFrontendDefaultsResult = {
  ok: boolean;
  defaults?: MoabomSystemDefaults;
  defaults_revision?: number;
  locale_catalog?: MoabomLocaleCatalog;
};

const FRONTEND_DEFAULTS_MEMORY_TTL_MS = 60_000;
const USER_SYSTEM_SETTINGS_MEMORY_TTL_MS = 30_000;
let publicFrontendDefaultsPromise: Promise<PublicFrontendDefaultsResult> | null = null;
let publicFrontendDefaultsCache: { value: PublicFrontendDefaultsResult; expiresAt: number } | null = null;
let userSystemSettingsPromise: Promise<MoabomApiResult<ApiSystemSettingsResponse['data']>> | null = null;
let userSystemSettingsCache: {
  value: MoabomApiResult<ApiSystemSettingsResponse['data']>;
  expiresAt: number;
} | null = null;

const systemModuleApi = createShellModuleApi('moabom-system');

function shellFailure<T>(error: unknown): MoabomApiResult<T> {
  if (error instanceof MoabomShellAuthRequiredError || error instanceof MoabomShellAuthExpiredError) {
    return { ok: false, success: false, message: error.message, kind: 'unauthorized' };
  }
  if (error instanceof MoabomShellModuleApiError) {
    return {
      ok: false,
      success: false,
      message: error.message,
      kind: error.status === 401 || error.status === 403 ? 'unauthorized' : 'transient',
    };
  }
  return {
    ok: false,
    success: false,
    message: error instanceof Error ? error.message : 'request failed',
    kind: 'transient',
  };
}

async function shellResult<T>(invoke: () => Promise<T>): Promise<MoabomApiResult<T>> {
  try {
    const data = await invoke();
    return { ok: true, success: true, data };
  } catch (error) {
    return shellFailure<T>(error);
  }
}

export function invalidateMoabomSystemSettingsCache(): void {
  userSystemSettingsCache = null;
}

function applyUserSettingsResponseSideEffects(
  data: ApiSystemSettingsResponse['data'] | undefined,
): void {
  if (data?.locale_catalog) {
    setMoabomLocaleCatalog(data.locale_catalog);
  }
  if (data?.generated_app_library) {
    seedMoabomGeneratedAppLibrary(data.generated_app_library);
  }
}

export function __resetMoabomPublicFrontendDefaultsCacheForTest(): void {
  publicFrontendDefaultsPromise = null;
  publicFrontendDefaultsCache = null;
  userSystemSettingsPromise = null;
  userSystemSettingsCache = null;
}

function publicDefaultsFromShellBoot(): PublicFrontendDefaultsResult | null {
  const boot = getMoabomShellBootData();
  if (!boot?.defaults) {
    return null;
  }
  if (boot.locale_catalog) {
    setMoabomLocaleCatalog(boot.locale_catalog);
  }
  return {
    ok: true,
    defaults: boot.defaults,
    defaults_revision: boot.defaults_revision ?? 0,
    locale_catalog: boot.locale_catalog,
  };
}

export async function fetchMoabomSystemSettings(): Promise<MoabomApiResult<ApiSystemSettingsResponse['data']>> {
  const now = Date.now();
  if (userSystemSettingsCache && userSystemSettingsCache.expiresAt > now) {
    applyUserSettingsResponseSideEffects(userSystemSettingsCache.value.data);
    return userSystemSettingsCache.value;
  }

  if (userSystemSettingsPromise) {
    return userSystemSettingsPromise;
  }

  userSystemSettingsPromise = (async () => {
    const result = await shellResult(() =>
      systemModuleApi<ApiSystemSettingsResponse['data']>('user/settings'),
    );
    applyUserSettingsResponseSideEffects(result.data);
    if (result.ok) {
      userSystemSettingsCache = {
        value: result,
        expiresAt: Date.now() + USER_SYSTEM_SETTINGS_MEMORY_TTL_MS,
      };
    }
    return result;
  })();

  try {
    return await userSystemSettingsPromise;
  } finally {
    userSystemSettingsPromise = null;
  }
}

export async function fetchMoabomPublicFrontendDefaults(): Promise<PublicFrontendDefaultsResult> {
  const now = Date.now();
  if (publicFrontendDefaultsCache && publicFrontendDefaultsCache.expiresAt > now) {
    return publicFrontendDefaultsCache.value;
  }

  const fromBoot = publicDefaultsFromShellBoot();
  if (fromBoot) {
    publicFrontendDefaultsCache = {
      value: fromBoot,
      expiresAt: now + FRONTEND_DEFAULTS_MEMORY_TTL_MS,
    };
    return fromBoot;
  }

  if (publicFrontendDefaultsPromise) {
    return publicFrontendDefaultsPromise;
  }

  publicFrontendDefaultsPromise = (async () => {
    await ensureMoabomShellBootLoaded();
    const afterBoot = publicDefaultsFromShellBoot();
    if (afterBoot) {
      publicFrontendDefaultsCache = {
        value: afterBoot,
        expiresAt: Date.now() + FRONTEND_DEFAULTS_MEMORY_TTL_MS,
      };
      return afterBoot;
    }

    const response = await fetch('/api/modules/moabom-system/public/frontend-defaults', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return { ok: false };
    }
    const payload = await response.json() as {
      success?: boolean;
      data?: {
        defaults?: MoabomSystemDefaults;
        defaults_revision?: number;
        locale_catalog?: MoabomLocaleCatalog;
      };
    };
    if (!payload.success || !payload.data?.defaults) {
      return { ok: false };
    }
    if (payload.data.locale_catalog) {
      setMoabomLocaleCatalog(payload.data.locale_catalog);
    }
    return {
      ok: true,
      defaults: payload.data.defaults,
      defaults_revision: payload.data.defaults_revision ?? 0,
      locale_catalog: payload.data.locale_catalog,
    };
  })();

  try {
    const value = await publicFrontendDefaultsPromise;
    if (value.ok) {
      publicFrontendDefaultsCache = {
        value,
        expiresAt: Date.now() + FRONTEND_DEFAULTS_MEMORY_TTL_MS,
      };
    }
    return value;
  } finally {
    publicFrontendDefaultsPromise = null;
  }
}

/** 관리자 defaults + (로그인 시) user settings — pull/merge SSOT */
export async function loadMoabomSettingsPayloadForMerge(isLoggedIn: boolean): Promise<{
  defaults?: MoabomSystemDefaults;
  settings?: Record<string, unknown>;
  defaults_revision: number;
  generated_app_library?: MoabomGeneratedAppLibraryPayload;
} | null> {
  return runMoabomShellRealtimeTask(
    isLoggedIn ? 'system:settings-merge:auth' : 'system:settings-merge:guest',
    async () => {
      if (isLoggedIn) {
        const r = await fetchMoabomSystemSettings();
        if (!r.ok) {
          return null;
        }
        const rev = typeof r.data?.defaults_revision === 'number' ? r.data.defaults_revision : 0;
        return {
          defaults: r.data?.defaults,
          settings: r.data?.settings as Record<string, unknown> | undefined,
          defaults_revision: rev,
          generated_app_library: r.data?.generated_app_library,
        };
      }
      const r = await fetchMoabomPublicFrontendDefaults();
      if (!r.ok || !r.defaults) {
        return null;
      }
      return {
        defaults: r.defaults,
        settings: {},
        defaults_revision: r.defaults_revision ?? 0,
      };
    },
    { minIntervalMs: 2_000 },
  );
}

/** @deprecated loadMoabomSettingsPayloadForMerge 사용 */
export async function fetchMoabomSystemBootstrap(isLoggedIn: boolean) {
  return loadMoabomSettingsPayloadForMerge(isLoggedIn);
}

/** 코어 프로필 언어 — `coreSyncLanguageFromMoabomPref` 결과를 POST (세션 경계, shell fetch) */
export async function updateCoreUserLanguage(language: string): Promise<{ ok: boolean }> {
  try {
    await requestShellJson('/api/user/profile/update-language', 'required', {
      method: 'POST',
      body: { language },
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function saveMoabomSystemSettings(
  settings: MoabomSystemState,
): Promise<MoabomApiResult<ApiSystemSettingsResponse['data']>> {
  const result = await shellResult(() =>
    systemModuleApi<ApiSystemSettingsResponse['data']>('user/settings', {
      method: 'PUT',
      body: settings,
    }),
  );
  if (result.data?.locale_catalog) {
    setMoabomLocaleCatalog(result.data.locale_catalog);
  }
  if (result.ok) {
    userSystemSettingsCache = {
      value: result,
      expiresAt: Date.now() + USER_SYSTEM_SETTINGS_MEMORY_TTL_MS,
    };
  } else {
    invalidateMoabomSystemSettingsCache();
  }
  return result;
}
