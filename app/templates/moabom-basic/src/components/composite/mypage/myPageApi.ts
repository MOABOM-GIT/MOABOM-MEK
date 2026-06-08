import { getBearerToken } from '../../../api/moabomModuleApi';
import { moabomT } from '../../../i18n/moabomT';
import type {
  ApiActivityResponse,
  ApiAttendanceResponse,
  ApiAvatarResponse,
  ApiCreditResponse,
  ApiProfileResponse,
  ApiSimpleResponse,
  ProfileApiPayload,
} from './myPageTypes';

export { getBearerToken };

export async function fetchUserProfileApi(): Promise<ProfileApiPayload | null> {
  const token = getBearerToken();
  if (!token) return null;

  const response = await fetch('/api/me', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json() as ApiProfileResponse;
  if (!response.ok || !payload.success || !payload.data) {
    return null;
  }

  return payload.data;
}

export async function updateUserProfileApi(body: Record<string, unknown>): Promise<ApiProfileResponse & { ok: boolean }> {
  const token = getBearerToken();
  if (!token) {
    return { ok: false, success: false, message: moabomT('moa_mypage.api.auth_required') };
  }

  const response = await fetch('/api/me', {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json() as ApiProfileResponse;

  return { ...payload, ok: response.ok && !!payload.success };
}

export async function fetchUserCreditsApi(): Promise<ApiCreditResponse & { ok: boolean }> {
  const token = getBearerToken();
  if (!token) {
    return { ok: false, success: false, message: moabomT('moa_mypage.api.auth_required') };
  }

  const response = await fetch('/api/modules/moabom-credit/user/credits', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json() as ApiCreditResponse;

  return { ...payload, ok: response.ok && !!payload.success && !!payload.data };
}

export async function checkAttendanceApi(): Promise<ApiAttendanceResponse & { ok: boolean }> {
  const token = getBearerToken();
  if (!token) {
    return { ok: false, success: false, message: moabomT('moa_mypage.api.auth_required') };
  }

  const response = await fetch('/api/modules/moabom-credit/user/attendance', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  const payload = await response.json() as ApiAttendanceResponse;

  return { ...payload, ok: response.ok && !!payload.success };
}

export async function fetchUserActivitiesApi(type: string): Promise<ApiActivityResponse & { ok: boolean }> {
  const token = getBearerToken();
  if (!token) {
    return { ok: false, success: false, message: moabomT('moa_mypage.api.auth_required') };
  }

  const query = new URLSearchParams({ type, limit: '20' });
  // 2026-06-02 모듈 분리: moabom-system → moabom-personalization.
  const response = await fetch(`/api/modules/moabom-personalization/user/activities?${query.toString()}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json() as ApiActivityResponse;

  return { ...payload, ok: response.ok && !!payload.success && !!payload.data };
}

export async function verifyPasswordApi(password: string): Promise<ApiSimpleResponse & { ok: boolean }> {
  const token = getBearerToken();
  if (!token) {
    return { ok: false, success: false, message: moabomT('moa_mypage.api.auth_required') };
  }

  const response = await fetch('/api/me/verify-password', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ password }),
  });
  const payload = await response.json() as ApiSimpleResponse;

  return { ...payload, ok: response.ok && !!payload.success };
}

export async function changePasswordApi(currentPassword: string, password: string, passwordConfirmation: string): Promise<ApiSimpleResponse & { ok: boolean }> {
  const token = getBearerToken();
  if (!token) {
    return { ok: false, success: false, message: moabomT('moa_mypage.api.auth_required') };
  }

  const response = await fetch('/api/me/password', {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      current_password: currentPassword,
      password,
      password_confirmation: passwordConfirmation,
    }),
  });
  const payload = await response.json() as ApiSimpleResponse;

  return { ...payload, ok: response.ok && !!payload.success };
}

export async function withdrawUserApi(): Promise<ApiSimpleResponse & { ok: boolean }> {
  const token = getBearerToken();
  if (!token) {
    return { ok: false, success: false, message: moabomT('moa_mypage.api.auth_required') };
  }

  const response = await fetch('/api/me', {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await response.json() as ApiSimpleResponse;

  return { ...payload, ok: response.ok && !!payload.success };
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
  const token = getBearerToken();
  if (!token) {
    return { ok: false, success: false, message: moabomT('moa_mypage.api.auth_required') };
  }

  const formData = new FormData();
  formData.append('avatar', file);

  const response = await fetch('/api/me/avatar', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  const payload = await response.json() as ApiAvatarResponse;

  return { ...payload, ok: response.ok && !!payload.success };
}
