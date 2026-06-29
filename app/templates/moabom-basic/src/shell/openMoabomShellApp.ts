import { formatShellPath } from '../utils/moabomShellRoutes';
import { getMoaShellBoardBridge } from './moaShellBoardBridge';

/**
 * 셸에서 등록 앱을 연다. G7 `navigate` 대신 셸 창 스택·URL 동기화를 사용한다.
 * (프로필 유저 활동 탭 등 composite 컴포넌트 SSOT)
 */
export function openMoabomShellApp(appId: string, options?: { replace?: boolean }): void {
  const trimmed = appId.trim();
  if (!trimmed) {
    return;
  }

  const shellPath = formatShellPath({ kind: 'app', appId: trimmed });
  const bridge = getMoaShellBoardBridge();
  if (bridge?.openAppById) {
    bridge.openAppById(trimmed, { shellPath, replace: options?.replace === true });
    return;
  }

  // 브릿지 미장착(비셸) 폴백 — 히스토리만 갱신해 딥링크 복원에 맡긴다.
  if (typeof window === 'undefined') {
    return;
  }
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === shellPath) {
    return;
  }
  if (options?.replace) {
    window.history.replaceState({ moabomShell: true }, '', shellPath);
  } else {
    window.history.pushState({ moabomShell: true }, '', shellPath);
  }
  window.dispatchEvent(new CustomEvent('moabom-shell-path-changed'));
}
