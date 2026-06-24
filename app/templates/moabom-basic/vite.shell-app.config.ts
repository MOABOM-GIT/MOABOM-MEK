import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

/**
 * 셸 앱 공용 IIFE 빌드 (컨벤션 기반) — `scripts/build-shell-apps.cjs` 가 앱마다 호출.
 *
 * 규약(앱 1개 = 셸 코드 무수정):
 *   - 앱 폴더 `src/apps/<id>/` + 진입점 `shellRegister.ts`(window.moabomShellApps[id] 등록)
 *   - 폴더명 = metadata.id → 청크는 항상 `dist/js/moabom-shell-<id>.iife.js`
 *   - 어떤 앱을 빌드할지는 env `MOABOM_SHELL_APP=<id>` 로 지정한다.
 *
 * 앱별 추가 alias/external 이 필요하면 `src/apps/<id>/shell.build.ts` 가
 *   `export const shellBuild = { alias?, external?, globals? }` 를 제공하면 병합한다.
 *   (대부분의 앱은 불필요 — i18n/overlay 싱글톤만 external 로 공유한다.)
 */
const APP = process.env.MOABOM_SHELL_APP ?? '';
if (!/^[a-z][a-z0-9-]*$/.test(APP)) {
  throw new Error(`MOABOM_SHELL_APP 이 유효한 앱 id(kebab-case)가 아닙니다: "${APP}"`);
}

const APP_DIR = path.resolve(__dirname, 'src/apps', APP);
const ENTRY = path.resolve(APP_DIR, 'shellRegister.ts');
if (!fs.existsSync(ENTRY)) {
  throw new Error(`셸 진입점이 없습니다: src/apps/${APP}/shellRegister.ts`);
}

const studly = APP.split('-')
  .map(s => (s ? s[0].toUpperCase() + s.slice(1) : s))
  .join('');
const GLOBAL_NAME = `MoabomShellChunk${studly}`;
const CHUNK = `moabom-shell-${APP}`;

const baseAlias: Record<string, string> = {
  '@': path.resolve(__dirname, 'src'),
  '@components': path.resolve(__dirname, 'src/components'),
  'moabom-shell-i18n': path.resolve(__dirname, 'src/i18n/moabomShellI18nSingleton.ts'),
  'moabom-shell-overlay': path.resolve(__dirname, 'src/i18n/moabomShellOverlaySingleton.ts'),
  '@moabom-consulting/simulation-model.json': path.resolve(
    __dirname,
    '../../modules/moabom-consulting/resources/simulation-model.json',
  ),
  '@moabom-cpap/recommend-rules.json': path.resolve(
    __dirname,
    '../../modules/moabom-cpap/resources/recommend-rules.json',
  ),
};
const baseGlobals: Record<string, string> = {
  react: 'React',
  'react-dom': 'ReactDOM',
  'react/jsx-runtime': 'ReactJSXRuntime',
  'moabom-shell-i18n': '__MoabomShellI18n',
  'moabom-shell-overlay': '__MoabomShellOverlay',
};

// 앱별 빌드 오버라이드(선택) — 동기 require 로 읽어 alias/external/globals 병합.
let extraAlias: Record<string, string> = {};
let extraGlobals: Record<string, string> = {};
const overridePath = path.resolve(APP_DIR, 'shell.build.cjs');
if (fs.existsSync(overridePath)) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const o = require(overridePath) as { alias?: Record<string, string>; globals?: Record<string, string> };
  extraAlias = o.alias ?? {};
  extraGlobals = o.globals ?? {};
}

const alias = { ...baseAlias, ...extraAlias };
const globals = { ...baseGlobals, ...extraGlobals };

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [react()],
  resolve: { alias },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2020',
    assetsInlineLimit: 0,
    lib: {
      entry: ENTRY,
      name: GLOBAL_NAME,
      fileName: () => CHUNK,
      formats: ['iife'],
    },
    rollupOptions: {
      external: Object.keys(globals),
      output: {
        globals,
        exports: 'named',
        extend: true,
        entryFileNames: `js/${CHUNK}.iife.js`,
      },
    },
  },
});
