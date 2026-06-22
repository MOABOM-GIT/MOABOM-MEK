import type { MoabomTranslateFn } from '../i18n/moabomT';
import type { ShellErrorCode } from './moaShellErrorIds';

const ERROR_TITLE_KEYS: Record<ShellErrorCode, string> = {
  403: 'errors.403_title',
  404: 'errors.404_title',
  500: 'errors.500_title',
  503: 'errors.503_title',
  maintenance: 'errors.maintenance_title',
};

/** 에러 윈도우 타이틀 — G7 errors.* 카탈로그 우선, 없으면 셸 fallback */
export function resolveErrorShellWindowTitle(code: ShellErrorCode, t: MoabomTranslateFn): string {
  const key = ERROR_TITLE_KEYS[code];
  const resolved = t(key);
  if (resolved !== key) {
    return resolved;
  }
  const fallbackKey = 'moa_shell.center.error_window';
  const fallback = t(fallbackKey, { code: String(code) });
  return fallback !== fallbackKey ? fallback : String(code);
}
