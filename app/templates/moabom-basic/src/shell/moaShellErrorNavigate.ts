import { replaceShellPath } from '../utils/moabomShellRoutes';
import type { MoaShellErrorBridge } from './moaShellErrorBridge';

function normalizeHomePath(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, '') || '/';
  return p === '/' || p === '';
}

/**
 * 에러 윈도우가 열린 상태에서 JSON `navigate` → `path: "/"` 를 윈도우 닫기로 변환.
 * @returns true 이면 코어 Router 호출을 생략한다.
 */
export function tryHandleErrorShellNavigate(
  pathWithQuery: string,
  bridge: MoaShellErrorBridge,
): boolean {
  if (!bridge.isActive()) {
    return false;
  }

  const q = pathWithQuery.indexOf('?');
  const pathname = q === -1 ? pathWithQuery : pathWithQuery.slice(0, q);

  if (normalizeHomePath(pathname)) {
    bridge.closeError();
    replaceShellPath('/');
    return true;
  }

  return false;
}
