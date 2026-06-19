/**
 * Moabom 홈 셸 인증 설정.
 * 토큰·401·refresh 처리는 G7 `AuthManager` / `G7Core.api` 순정 흐름에 맡긴다.
 */
type AuthManagerLike = {
  getInstance: () => {
    updateConfig: (type: 'user' | 'admin', partial: { loginPath?: string }) => void;
  };
};

function getG7Core(): {
  AuthManager?: AuthManagerLike;
} | undefined {
  return (window as { G7Core?: { AuthManager?: AuthManagerLike } }).G7Core;
}

/** `initTemplate` — loginPath 만 선반영 (TemplateApp 초기화 전에도 안전) */
export function bootstrapMoabomShellAuthConfig(): void {
  const authManager = getG7Core()?.AuthManager?.getInstance?.();
  if (!authManager?.updateConfig) return;
  authManager.updateConfig('user', { loginPath: '/auth/login' });
}
