/**
 * 셸 분리 번들(`moabom-shell-*.iife.js`)을 열기 전에 G7 순정 reload 액션으로
 * 선로딩할 모듈·플러그인 식별자 목록입니다.
 *
 * `module.json` / `plugin.json`의 `loading.strategy`가 `lazy` 또는 `layout`인 확장만
 * `G7Config.deferred*`에 포함되므로, 해당 앱이 런타임에 그 확장을 필요로 하면 여기에 매핑합니다.
 * (매핑이 비어 있으면 이 단계는 생략됩니다.)
 */
export type ShellDeferredExtensionParams = {
  moduleIdentifiers?: string[];
  pluginIdentifiers?: string[];
};

const SHELL_APP_DEFERRED_EXTENSIONS: Partial<Record<string, ShellDeferredExtensionParams>> = {
  // 예: 'create-app': { pluginIdentifiers: ['sirsoft-ckeditor5'] },
};

/**
 * 셸 앱 ID에 대응하는 지연 확장 로드 파라미터를 반환합니다.
 * 비어 있으면 선로딩 액션을 호출하지 않습니다.
 */
export function getShellAppDeferredExtensionLoad(
  appId: string,
): { moduleIdentifiers: string[]; pluginIdentifiers: string[] } | undefined {
  const raw = SHELL_APP_DEFERRED_EXTENSIONS[appId];
  if (!raw) {
    return undefined;
  }
  const moduleIdentifiers = raw.moduleIdentifiers ?? [];
  const pluginIdentifiers = raw.pluginIdentifiers ?? [];
  if (moduleIdentifiers.length === 0 && pluginIdentifiers.length === 0) {
    return undefined;
  }
  return { moduleIdentifiers, pluginIdentifiers };
}
