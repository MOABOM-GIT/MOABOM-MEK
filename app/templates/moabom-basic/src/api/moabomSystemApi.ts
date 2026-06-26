import { moabomApiGet, moabomApiPost, moabomApiPut, type MoabomApiResult } from './moabomAuthenticatedApi';
import type { MoabomSystemDefaults, MoabomSystemState } from '../types/moabomSystem';
import type { MoabomSettingsApiPayload } from '../utils/moabomSystemServerMerge';
import { setMoabomLocaleCatalog, type MoabomLocaleCatalog } from '../utils/moabomLocaleCatalog';
import { ensureMoabomShellBootLoaded, getMoabomShellBootData } from '../runtime/moabomShellBoot';
import { seedMoabomGeneratedAppLibrary } from '../runtime/moabomGeneratedAppLibraryLoad';
import type { MoabomGeneratedAppLibraryPayload } from '../runtime/moabomGeneratedAppLibraryLoad';

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
    const result = await moabomApiGet<ApiSystemSettingsResponse['data']>('/api/modules/moabom-system/user/settings');
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

/** 비로그인 셸/게스트용 — 플랫폼 기본값 + `defaults_revision` */
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
    const payload = (await response.json()) as {
      success?: boolean;
      data?: {
        defaults?: MoabomSystemDefaults;
        defaults_revision?: number;
        locale_catalog?: MoabomLocaleCatalog;
      };
    };

    const ok = response.ok && !!payload.success;
    const d = payload.data;
    if (d?.locale_catalog) {
      setMoabomLocaleCatalog(d.locale_catalog);
    }
    const result = {
      ok,
      defaults: d?.defaults,
      defaults_revision: typeof d?.defaults_revision === 'number' ? d.defaults_revision : 0,
      locale_catalog: d?.locale_catalog,
    };

    if (ok) {
      publicFrontendDefaultsCache = {
        value: result,
        expiresAt: Date.now() + FRONTEND_DEFAULTS_MEMORY_TTL_MS,
      };
    }

    return result;
  })();

  try {
    return await publicFrontendDefaultsPromise;
  } finally {
    publicFrontendDefaultsPromise = null;
  }
}

/** 로그인: user/settings, 비로그인: public/frontend-defaults 병합용 페이로드 */
export async function loadMoabomSettingsPayloadForMerge(isLoggedIn: boolean): Promise<MoabomSettingsApiPayload | null> {
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
}

/** 코어 프로필 언어 — `coreSyncLanguageFromMoabomPref` 결과를 POST */
export async function updateCoreUserLanguage(language: string): Promise<{ ok: boolean }> {
  const result = await moabomApiPost('/api/user/profile/update-language', { language });
  return { ok: result.ok };
}

export async function saveMoabomSystemSettings(
  settings: MoabomSystemState,
): Promise<MoabomApiResult<ApiSystemSettingsResponse['data']>> {
  const result = await moabomApiPut<ApiSystemSettingsResponse['data']>('/api/modules/moabom-system/user/settings', settings);
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
