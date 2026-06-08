#!/usr/bin/env node
/*
 * 호스트/WSL 로컬 빌드 가드 (deploy/README.md 골든룰)
 *
 * 배경(RF-20): WSL 호스트에서 `npm ci`/`npm run build` 를 돌리면
 * PATH 의 npm 이 Windows npm(/mnt/c/...) 으로 폴백되어 esbuild postinstall 이
 * UNC 경로에서 실패 → node_modules 파손(workbox-build package.json 누락 등).
 * moabom-basic dist 는 Cloud Build asset stage 가 생성한다.
 *
 * 정책:
 *  - Windows npm/node 가 WSL 경로에서 실행 → 항상 하드 차단(override 불가).
 *  - 컨테이너(Cloud Build/Docker) 빌드 컨텍스트 → 허용.
 *  - 그 외 호스트/WSL 로컬 빌드 → 차단.
 */
'use strict';

const fs = require('fs');

const RULE = "deploy/README.md 골든룰: 호스트/WSL 로컬 빌드 금지 — dist 는 Cloud Build asset stage 산출물";

function norm(p) {
  return String(p || '').replace(/\\/g, '/').toLowerCase();
}

const execpath = norm(process.env.npm_execpath);
const nodeExec = norm(process.execPath);
const userAgent = norm(process.env.npm_config_user_agent);

const windowsToolchain =
  process.platform === 'win32' ||
  /\/mnt\/[a-z]\//.test(execpath) ||
  /\/mnt\/[a-z]\//.test(nodeExec) ||
  /program files/.test(execpath) ||
  /program files/.test(nodeExec) ||
  /win32/.test(userAgent);

if (windowsToolchain) {
  console.error('');
  console.error('[guard] X Windows npm/node 가 WSL 경로에서 실행됨 — node_modules 파손 위험 (UNC/postinstall 실패).');
  console.error('[guard]   exec: ' + (process.env.npm_execpath || process.execPath));
  console.error('[guard]   조치: Linux Node 사용 (예: `nvm use 22`) 또는 WSL 네이티브 node 설치.');
  console.error('[guard]   ' + RULE);
  console.error('');
  process.exit(1);
}

function isContainerBuild() {
  if (fs.existsSync('/.dockerenv')) return true;
  if (process.env.MOABOM_BUILD_ENV === 'cloudbuild') return true;
  if (process.env.BUILDER_OUTPUT || process.env.CLOUD_BUILD || process.env.KOKORO_BUILD_ID) return true;
  return false;
}

if (isContainerBuild()) {
  process.exit(0);
}

console.error('');
console.error('[guard] X moabom-basic 로컬 빌드 금지.');
console.error('[guard]   ' + RULE);
console.error('[guard]   배포: ./deploy/build-and-deploy.sh (Cloud Build 가 dist 를 생성해 이미지에 패키징).');
console.error('');
process.exit(1);
