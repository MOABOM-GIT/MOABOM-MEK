import {
  getG7ApiClient,
  moabomApiDelete,
  moabomApiGet,
  moabomApiPost,
  moabomApiPut,
  type MoabomApiResult,
} from '../../../api/moabomAuthenticatedApi';
import { getShellAccessToken } from '../../../api/moabomShellAccess';
import { moabomT } from '../../../i18n/moabomT';
import type {
  ActivityOverview,
  ApiAvatarResponse,
  ApiAttendanceResponse,
  CreditOverview,
  ProfileApiPayload,
} from './myPageTypes';

export async function fetchUserProfileApi(): Promise<ProfileApiPayload | null> {
  const result = await moabomApiGet<ProfileApiPayload>('/api/me');
  if (!result.ok || !result.data) {
    return null;
  }
  return result.data;
}

export async function updateUserProfileApi(
  body: Record<string, unknown>,
): Promise<MoabomApiResult<ProfileApiPayload>> {
  return moabomApiPut<ProfileApiPayload>('/api/me', body);
}

export async function fetchUserCreditsApi(): Promise<MoabomApiResult<CreditOverview>> {
  return moabomApiGet<CreditOverview>('/api/modules/moabom-credit/user/credits');
}

export async function checkAttendanceApi(): Promise<MoabomApiResult<ApiAttendanceResponse['data']>> {
  return moabomApiPost<ApiAttendanceResponse['data']>('/api/modules/moabom-credit/user/attendance', {});
}

export async function fetchUserActivitiesApi(
  type: string,
): Promise<MoabomApiResult<ActivityOverview>> {
  const query = new URLSearchParams({ type, limit: '20' });
  return moabomApiGet<ActivityOverview>(
    `/api/modules/moabom-personalization/user/activities?${query.toString()}`,
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
