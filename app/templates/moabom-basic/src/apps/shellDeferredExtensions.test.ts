import { describe, it, expect } from 'vitest';
import { getShellAppDeferredExtensionLoad } from './shellDeferredExtensions';

describe('shellDeferredExtensions', () => {
  it('등록되지 않은 셸 앱 ID는 undefined를 반환해야 한다', () => {
    expect(getShellAppDeferredExtensionLoad('no-such-shell-app')).toBeUndefined();
  });

  it('매핑이 비어 있으면 알려진 셸 앱 ID에도 undefined를 반환해야 한다', () => {
    expect(getShellAppDeferredExtensionLoad('create-app')).toBeUndefined();
    expect(getShellAppDeferredExtensionLoad('cpap-mask')).toBeUndefined();
  });
});
