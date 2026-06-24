import { withTransientRetry } from '../shell/moaShellTransientRetry';
import {
  createShellModuleApi,
  type ShellModuleRequest,
  type ShellRequestInit,
} from './moabomShellHttp';

/**
 * `moabomShellHttp` 모듈 API + 502/503 일시 오류 재시도.
 * 프로필 소셜·셸 단발 액션 SSOT.
 */
export function createTransientShellModuleApi(modulePrefix: string): ShellModuleRequest {
  const request = createShellModuleApi(modulePrefix);
  return <T>(path: string, init: ShellRequestInit = {}): Promise<T> =>
    withTransientRetry(() => request<T>(path, init));
}
