import type { ComponentType } from 'react';
import type { App } from '../data/Moa_apps';
import { createAppShellMetadata } from './ai-generator/metadata';
import templateMetadata from '../../template.json';
import { postMoabomLazyPrecache } from '../runtime/moabomLazyPrecache';
import { shellBootChunkFileFor } from './shellBootApps';

export type MoabomShellAppComponent = ComponentType;

/**
 * 셸 앱 메타데이터 자동 발견 (컨벤션 기반 — 앱 추가 시 이 파일 무수정).
 *
 * 규약: `src/apps/<id>/metadata.ts` 가 App 1개를 export, 폴더명 == metadata.id,
 *       청크 = `moabom-shell-<id>.iife.js`. (빌드는 scripts/build-shell-apps.cjs 가 동일 규약으로 수행)
 *       create-app(ai-generator)만 폴더명≠id 라 명시 등록한다.
 */
const metadataModules = import.meta.glob<Record<string, unknown>>('./*/metadata.ts', { eager: true });

function isAppMetadata(value: unknown): value is App {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as App).id === 'string' &&
    typeof (value as App).icon === 'string'
  );
}

/** 발견된 셸 앱 메타데이터 목록 (그리드/디버그용 — 매니페스트가 1차 소스). */
export const MOABOM_SHELL_APP_METADATA: App[] = Object.values(metadataModules)
  .flatMap(mod => Object.values(mod))
  .filter(isAppMetadata)
  .filter(meta => meta.id !== createAppShellMetadata.id);

/** 앱 id → 별도 번들 파일명 (메인 `components.iife.js`에 포함하지 않음) */
const SHELL_APP_CHUNK_FILES: Record<string, string> = {
  // create-app 은 폴더명(ai-generator)≠id 라 별도 vite config(moabom-shell-create-app)로 빌드.
  [createAppShellMetadata.id]: 'moabom-shell-create-app.iife.js',
  ...Object.fromEntries(
    MOABOM_SHELL_APP_METADATA.map(meta => [meta.id, `moabom-shell-${meta.id}.iife.js`]),
  ),
};

/**
 * 해당 앱이 셸 청크로 렌더 가능한지(정적 맵 또는 shell-boot 매니페스트) 판정.
 * 신규 SDK 앱(app.json + 청크)도 셸 코드 수정 없이 렌더되도록 범용 분기에 사용한다.
 */
export function hasMoabomShellAppChunk(appId: string): boolean {
  return appId in SHELL_APP_CHUNK_FILES || shellBootChunkFileFor(appId) != null;
}
/** create-app 메타는 `createAppShellMetadata` — 그리드는 `Moa_SortableAppGrid` 타일, 번들은 `SHELL_APP_CHUNK_FILES` */

declare global {
  interface Window {
    moabomShellApps?: Record<string, ComponentType>;
  }
}

const shellLoadPromises = new Map<string, Promise<ComponentType>>();
const prefetchedChunkUrls = new Set<string>();
const SHELL_APP_CHUNK_LOAD_TIMEOUT_MS = 15_000;

function resolveShellChunkFile(appId: string): string | null {
  return SHELL_APP_CHUNK_FILES[appId] ?? shellBootChunkFileFor(appId) ?? null;
}

/**
 * 셸 앱 IIFE를 브라우저 preload 큐에 넣어 클릭 전에 네트워크를 시작한다.
 * 중복 호출·이미 로드된 앱은 무시한다.
 */
export function prefetchMoabomShellAppChunk(appId: string): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (window.moabomShellApps?.[appId]) {
    return;
  }

  const file = resolveShellChunkFile(appId);
  if (!file) {
    return;
  }

  const chunkUrl = shellChunkUrl(file);
  if (prefetchedChunkUrls.has(chunkUrl)) {
    return;
  }
  prefetchedChunkUrls.add(chunkUrl);

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'script';
  link.href = chunkUrl;
  document.head.appendChild(link);
  postMoabomLazyPrecache([chunkUrl], appId);
}

/**
 * 호버·창 오픈 직전에 청크 fetch·실행까지 백그라운드로 시작한다.
 */
export function warmMoabomShellAppChunk(appId: string): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (window.moabomShellApps?.[appId]) {
    return;
  }
  if (!resolveShellChunkFile(appId)) {
    return;
  }

  prefetchMoabomShellAppChunk(appId);
  void loadMoabomShellAppComponent(appId).catch(() => {
    // 사용자가 실제로 열 때 MoabomShellAppFromChunk 가 재시도한다.
  });
}

/** Vitest 격리 */
export function resetMoabomShellAppChunkCacheForTest(): void {
  shellLoadPromises.clear();
  prefetchedChunkUrls.clear();
}

function readComponentsBundleQuery(): string {
  if (typeof document === 'undefined') {
    return '';
  }
  const nodes = document.querySelectorAll('script[src*="components.iife"]');
  for (let i = nodes.length - 1; i >= 0; i--) {
    const src = nodes[i].getAttribute('src');
    if (!src) {
      continue;
    }
    const qIdx = src.indexOf('?');
    if (qIdx >= 0) {
      return src.slice(qIdx);
    }
  }
  return '';
}

function shellChunkUrl(file: string): string {
  const id = (templateMetadata as { identifier?: string }).identifier ?? 'moabom-basic';
  const base = `/api/templates/assets/${id}/js/${file}`;
  return `${base}${readComponentsBundleQuery()}`;
}

/**
 * 셸 앱 UI 컴포넌트를 반환합니다. 별도 번들이 아직이면 스크립트를 주입해 로드합니다.
 * (메인 번들이 IIFE 단일 파일이면 `React.lazy`로는 청크가 분리되지 않아 스크립트 분리를 사용합니다.)
 */
export function loadMoabomShellAppComponent(appId: string): Promise<ComponentType> {
  // 정적 맵 우선, 없으면 shell-boot 매니페스트(app.json)가 선언한 청크로 폴백 — 신규 SDK 앱.
  const file = SHELL_APP_CHUNK_FILES[appId] ?? shellBootChunkFileFor(appId);
  if (!file) {
    return Promise.reject(new Error(`Unknown moabom shell app: ${appId}`));
  }

  prefetchMoabomShellAppChunk(appId);

  const existing = typeof window !== 'undefined' ? window.moabomShellApps?.[appId] : undefined;
  if (existing) {
    return Promise.resolve(existing);
  }

  const pending = shellLoadPromises.get(appId);
  if (pending) {
    return pending;
  }

  const promise = new Promise<ComponentType>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('loadMoabomShellAppComponent requires a browser environment'));
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    const chunkUrl = shellChunkUrl(file);
    let settled = false;
    const cleanup = () => {
      shellLoadPromises.delete(appId);
      window.clearTimeout(timeoutId);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      script.remove();
      reject(error);
    };
    const timeoutId = window.setTimeout(() => {
      fail(new Error(`Timed out loading shell chunk: ${chunkUrl}`));
    }, SHELL_APP_CHUNK_LOAD_TIMEOUT_MS);

    script.src = chunkUrl;
    postMoabomLazyPrecache([chunkUrl], appId);
    script.onload = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const Comp = window.moabomShellApps?.[appId];
      if (Comp) {
        resolve(Comp);
      } else {
        reject(new Error(`Shell chunk loaded but app "${appId}" was not registered`));
      }
    };
    script.onerror = () => {
      fail(new Error(`Failed to load shell chunk: ${script.src}`));
    };
    document.head.appendChild(script);
  });

  shellLoadPromises.set(appId, promise);
  return promise;
}
