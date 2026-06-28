/**
 * 앱 SDK — shell-boot `apps[]`(모듈 app.json 집계) 런타임 소비 (Phase 4).
 *
 * 무손상 원칙(가산): 정적 `APPS`/`SHELL_APP_CHUNK_FILES` 는 유지하고, 매니페스트가
 * (1) 청크 로더에 chunk 파일을 공급하고 (2) 그리드에 신규 앱(id 미존재)만 추가한다.
 * 신규 앱 = 모듈 + app.json + 템플릿 청크 (셸 코드 무수정).
 */
import type { App } from '../data/Moa_apps';

export interface ShellAppManifestFrontend {
  template?: string | null;
  chunk?: string | null;
  global?: string | null;
}

export interface ShellAppManifest {
  id: string;
  module?: string;
  name?: string | Record<string, string>;
  description?: string | Record<string, string>;
  icon?: string;
  gradient?: string;
  category?: 'basic' | 'user';
  source?: 'system' | 'user-created';
  frontend?: ShellAppManifestFrontend;
  api_prefix?: string | null;
  permissions?: string[];
  tenant_scoped?: boolean;
  order?: number;
}

let bootApps: ShellAppManifest[] = [];

export function setShellBootApps(apps: ShellAppManifest[] | undefined): void {
  bootApps = Array.isArray(apps)
    ? apps.filter((a): a is ShellAppManifest => !!a && typeof a.id === 'string' && a.id.length > 0)
    : [];
}

export function getShellBootApps(): ShellAppManifest[] {
  return bootApps;
}

export function isShellBootAppId(appId: string): boolean {
  return bootApps.some(app => app.id === appId);
}

/** 매니페스트가 선언한 청크 파일명 (정적 맵에 없을 때 로더 폴백). */
export function shellBootChunkFileFor(appId: string): string | undefined {
  const manifest = bootApps.find(a => a.id === appId);
  const chunk = manifest?.frontend?.chunk;
  return chunk ? chunk : undefined;
}

function pickLocalized(value: string | Record<string, string> | undefined): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    return value.ko ?? value.en ?? Object.values(value)[0] ?? '';
  }
  return '';
}

export function shellBootAppToGrid(manifest: ShellAppManifest): App {
  return {
    id: manifest.id,
    name: pickLocalized(manifest.name) || manifest.id,
    description: pickLocalized(manifest.description),
    icon: manifest.icon ?? 'cube',
    gradient: manifest.gradient ?? 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    category: manifest.category === 'user' ? 'user' : 'basic',
    source: manifest.source === 'user-created' ? 'user-created' : 'system',
  };
}

/**
 * 기존 그리드 목록에 없는(id 기준) 부트 앱만 끝에 추가한다.
 * `create-app` 은 셸 기본 앱으로 직접 주입되므로 부트 매니페스트에서는 중복 제외한다.
 */
export function appendNewShellBootApps(
  base: App[],
  excludeIds: ReadonlySet<string> = new Set(['create-app']),
): App[] {
  const present = new Set(base.map(a => a.id));
  const additions = bootApps
    .filter(m => !present.has(m.id) && !excludeIds.has(m.id))
    .map(shellBootAppToGrid);

  return additions.length > 0 ? [...base, ...additions] : base;
}

/** Vitest: 부트 앱 캐시 초기화 */
export function resetShellBootAppsForTest(): void {
  bootApps = [];
}
