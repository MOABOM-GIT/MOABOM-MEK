import {
  getG7ApiClient,
  moabomApiDelete,
  moabomApiGet,
  moabomApiPost,
  moabomApiPut,
  type MoabomApiResult,
  type MoabomSessionErrorKind,
} from '../../../api/moabomAuthenticatedApi';
import { getShellAccessToken } from '../../../api/moabomShellAccess';
import {
  createShellModuleApi,
  MoabomShellAuthExpiredError,
  MoabomShellAuthRequiredError,
  MoabomShellModuleApiError,
} from '../../../api/moabomShellHttp';
import { moabomT } from '../../../i18n/moabomT';
import type {
  ActivityOverview,
  ApiAvatarResponse,
  ApiAttendanceResponse,
  CreditOverview,
  MarketingNotificationConsent,
  ProfileApiPayload,
} from './myPageTypes';

const creditApi = createShellModuleApi('moabom-credit');
const personalizationApi = createShellModuleApi('moabom-personalization');
const appsApi = createShellModuleApi('moabom-apps');

function shellModuleFailure<T>(error: unknown): MoabomApiResult<T> {
  if (error instanceof MoabomShellAuthRequiredError || error instanceof MoabomShellAuthExpiredError) {
    return {
      ok: false,
      success: false,
      message: error.message,
      kind: 'unauthorized',
    };
  }
  if (error instanceof MoabomShellModuleApiError) {
    return {
      ok: false,
      success: false,
      message: error.message,
      kind: error.status === 401 || error.status === 403 ? 'unauthorized' : 'transient',
      errors: undefined,
    };
  }
  return {
    ok: false,
    success: false,
    message: error instanceof Error ? error.message : moabomT('moa_mypage.api.auth_required'),
    kind: 'transient',
  };
}

async function shellModuleResult<T>(invoke: () => Promise<T>): Promise<MoabomApiResult<T>> {
  try {
    const data = await invoke();
    return { ok: true, success: true, data };
  } catch (error) {
    return shellModuleFailure<T>(error);
  }
}

export type ProfileFetchResult =
  | { ok: true; data: ProfileApiPayload }
  | { ok: false; kind: MoabomSessionErrorKind; message?: string };

export async function fetchUserProfileApi(): Promise<ProfileFetchResult> {
  const result = await moabomApiGet<ProfileApiPayload>('/api/me');
  if (result.ok && result.data) {
    return { ok: true, data: result.data };
  }
  return {
    ok: false,
    kind: result.kind === 'unauthorized' ? 'unauthorized' : 'transient',
    message: result.message,
  };
}

export async function updateUserProfileApi(
  body: Record<string, unknown>,
): Promise<MoabomApiResult<ProfileApiPayload>> {
  return moabomApiPut<ProfileApiPayload>('/api/me', body);
}

export async function fetchMarketingNotificationConsentApi(): Promise<MoabomApiResult<MarketingNotificationConsent>> {
  return moabomApiGet<MarketingNotificationConsent>(
    '/api/plugins/sirsoft-marketing/user/notification-consent',
  );
}

export async function updateMarketingNotificationConsentApi(
  enabled: boolean,
): Promise<MoabomApiResult<MarketingNotificationConsent>> {
  return moabomApiPut<MarketingNotificationConsent>(
    '/api/plugins/sirsoft-marketing/user/notification-consent',
    { enabled },
  );
}

export async function fetchUserCreditsApi(
  params: { limit?: number; offset?: number } = {},
): Promise<MoabomApiResult<CreditOverview>> {
  const query = new URLSearchParams();
  if (params.limit != null) {
    query.set('limit', String(params.limit));
  }
  if (params.offset != null) {
    query.set('offset', String(params.offset));
  }
  const suffix = query.toString();
  return shellModuleResult(() =>
    creditApi<CreditOverview>(`user/credits${suffix ? `?${suffix}` : ''}`),
  );
}

export async function checkAttendanceApi(): Promise<MoabomApiResult<ApiAttendanceResponse['data']>> {
  return shellModuleResult(() =>
    creditApi<ApiAttendanceResponse['data']>('user/attendance', {
      method: 'POST',
      body: {},
    }),
  );
}

export async function fetchUserActivitiesApi(
  type: string,
  params: { limit?: number; offset?: number } = {},
): Promise<MoabomApiResult<ActivityOverview>> {
  const query = new URLSearchParams({ type });
  if (params.limit != null) {
    query.set('limit', String(params.limit));
  }
  if (params.offset != null) {
    query.set('offset', String(params.offset));
  }
  return shellModuleResult(() =>
    personalizationApi<ActivityOverview>(`user/activities?${query.toString()}`),
  );
}

export async function fetchUserAppReviewsApi(
  params: { limit?: number; offset?: number } = {},
): Promise<MoabomApiResult<ActivityOverview>> {
  const query = new URLSearchParams();
  if (params.limit != null) {
    query.set('limit', String(params.limit));
  }
  if (params.offset != null) {
    query.set('offset', String(params.offset));
  }
  const suffix = query.toString();

  return shellModuleResult(() =>
    appsApi<ActivityOverview>(`apps/community/reviews${suffix ? `?${suffix}` : ''}`),
  );
}

export async function verifyPasswordApi(password: string): Promise<MoabomApiResult<void>> {
  return moabomApiPost<void>('/api/me/verify-password', { password });
}

export async function changePasswordApi(
  currentPassword: string,
  password: string,
  passwordConfirmation: string,
): Promise<MoabomApiResult<void>> {
  return moabomApiPut<void>('/api/me/password', {
    current_password: currentPassword,
    password,
    password_confirmation: passwordConfirmation,
  });
}

export async function withdrawUserApi(): Promise<MoabomApiResult<void>> {
  return moabomApiDelete<void>('/api/me');
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(moabomT('moa_mypage.api.image_load_failed')));
    };
    image.src = objectUrl;
  });
}

export async function cropAvatarToSquare(file: File, size = 200): Promise<File> {
  const image = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error(moabomT('moa_mypage.api.image_edit_unavailable'));
  }

  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
  const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);

  canvas.width = size;
  canvas.height = size;
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (nextBlob) {
        resolve(nextBlob);
        return;
      }
      reject(new Error(moabomT('moa_mypage.api.image_convert_failed')));
    }, 'image/jpeg', 0.9);
  });

  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}

export async function uploadUserAvatarApi(file: File): Promise<ApiAvatarResponse & { ok: boolean }> {
  if (!getShellAccessToken()) {
    return { ok: false, success: false, message: moabomT('moa_mypage.api.auth_required') };
  }

  const api = getG7ApiClient();
  if (!api) {
    return { ok: false, success: false, message: moabomT('moa_mypage.api.auth_required') };
  }

  const formData = new FormData();
  formData.append('avatar', file);

  try {
    const payload = await api.post<ApiAvatarResponse>('/api/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { ...payload, ok: !!payload.success };
  } catch (error) {
    const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      ?? moabomT('moa_mypage.api.auth_required');
    return { ok: false, success: false, message };
  }
}
