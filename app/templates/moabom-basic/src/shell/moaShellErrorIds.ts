/** 셸 전용 에러 윈도우 가상 앱 ID (단일 윈도우, errorCode 로 내용 갱신) */
export const MOA_SHELL_ERROR_APP_ID = 'moa-shell-error';

export type ShellErrorCode = 403 | 404 | 500 | 503 | 'maintenance';
type ShellErrorCodeSegment = `${ShellErrorCode}`;

const SHELL_ERROR_CODES = new Set<string>(['403', '404', '500', '503', 'maintenance']);

export function isShellErrorCode(value: string): value is ShellErrorCodeSegment {
  return SHELL_ERROR_CODES.has(value);
}

export function isMoaShellErrorAppId(appId: string): boolean {
  return appId === MOA_SHELL_ERROR_APP_ID;
}

/** HTTP·G7Error 코드 → 셸 에러 윈도우 코드 (401은 auth 전용) */
export function mapHttpStatusToShellErrorCode(status: number): ShellErrorCode | null {
  if (status === 401) {
    return null;
  }
  if (status === 403) return 403;
  if (status === 404) return 404;
  if (status === 500) return 500;
  if (status === 503) return 503;
  return null;
}

export function parseShellErrorCodeFromPath(segment: string): ShellErrorCode | null {
  const decoded = decodeURIComponent(segment);
  if (isShellErrorCode(decoded)) {
    return decoded as ShellErrorCode;
  }
  const asNum = Number(decoded);
  if (Number.isInteger(asNum) && isShellErrorCode(String(asNum))) {
    return asNum as ShellErrorCode;
  }
  return null;
}
