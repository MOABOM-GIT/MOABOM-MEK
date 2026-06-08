/** sirsoft-page 공개 슬러그와 연동되는 셸 전용 가상 앱 ID (앱 그리드에는 없음) */
export const MOA_SHELL_LEGAL_PAGE_TERMS_APP_ID = 'moa-shell-page-terms';

export const MOA_SHELL_LEGAL_PAGE_PRIVACY_APP_ID = 'moa-shell-page-privacy';

export const MOA_SHELL_LEGAL_PAGE_APP_IDS = [
  MOA_SHELL_LEGAL_PAGE_TERMS_APP_ID,
  MOA_SHELL_LEGAL_PAGE_PRIVACY_APP_ID,
] as const;

export type MoaShellLegalPageSlug = 'terms' | 'privacy';

export function moaShellLegalPageSlugFromAppId(appId: string): MoaShellLegalPageSlug | null {
  if (appId === MOA_SHELL_LEGAL_PAGE_TERMS_APP_ID) {
    return 'terms';
  }
  if (appId === MOA_SHELL_LEGAL_PAGE_PRIVACY_APP_ID) {
    return 'privacy';
  }

  return null;
}

export function isMoaShellLegalPageAppId(appId: string): boolean {
  return moaShellLegalPageSlugFromAppId(appId) !== null;
}
