#!/usr/bin/env node
/*
 * 셸 앱 청크 빌드 러너 (컨벤션 기반 자동 발견).
 *
 * 목적: 앱을 추가할 때 vite config 신설 + package.json build 라인 추가 같은
 *       "중앙 파일 수동 편집"을 없앤다. `src/apps/<id>/shellRegister.ts` 만 있으면
 *       이 러너가 자동으로 발견해 `vite.shell-app.config.ts` 로 빌드한다.
 *
 * 규약:
 *   - 앱 폴더명 == metadata.id (예: consulting, cpap-mask) → 청크 moabom-shell-<id>.iife.js
 *   - 예외: ai-generator(=create-app) 는 폴더명≠id 이고 alias 가 특수해
 *           `vite.shell-create-app.config.ts` 로 따로 빌드한다(SKIP 목록).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const APPS_DIR = path.resolve(ROOT, 'src/apps');
const CONFIG = path.resolve(ROOT, 'vite.shell-app.config.ts');
const VITE_BIN = path.resolve(ROOT, 'node_modules/.bin/vite');

// 폴더명≠id 이거나 진입점이 아닌 디렉토리.
const SKIP = new Set(['ai-generator', 'generated', '__tests__']);

function discoverApps() {
  return fs
    .readdirSync(APPS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !SKIP.has(d.name))
    .map(d => d.name)
    .filter(name => fs.existsSync(path.resolve(APPS_DIR, name, 'shellRegister.ts')))
    .sort();
}

function main() {
  const apps = discoverApps();
  if (apps.length === 0) {
    console.log('[build-shell-apps] 발견된 셸 앱 없음 (skip)');
    return;
  }
  console.log(`[build-shell-apps] ${apps.length}개 앱: ${apps.join(', ')}`);

  for (const app of apps) {
    console.log(`\n[build-shell-apps] ==> ${app}`);
    execFileSync(VITE_BIN, ['build', '--config', CONFIG], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, MOABOM_SHELL_APP: app },
    });

    const out = path.resolve(ROOT, `dist/js/moabom-shell-${app}.iife.js`);
    if (!fs.existsSync(out)) {
      console.error(`[build-shell-apps] FAIL: ${out} 가 생성되지 않았습니다.`);
      process.exit(1);
    }
  }
  console.log(`\n[build-shell-apps] 완료 (${apps.length}개 청크)`);
}

main();
