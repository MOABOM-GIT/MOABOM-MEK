#!/usr/bin/env node
/*
 * 호스트/WSL 로컬 프론트 빌드 가드 (Cloud Build asset stage SSOT)
 *
 * 운영 dist 는 deploy/Dockerfile assets 스테이지가 생성한다. 호스트/WSL 에서
 * npm ci/npm run build 를 실행하면 Windows npm 폴백·UNC postinstall 실패로
 * node_modules 가 파손될 수 있고, stale dist 가 Cloud Build 입력에 섞인다.
 */
'use strict';

const fs = require('fs');

const RULE = 'Cloud Build asset stage SSOT: 호스트/WSL 로컬 프론트 빌드 금지';

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
  console.error('[guard]   조치: Linux Node 사용 또는 Cloud Build 경로만 사용.');
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
console.error('[guard] X 호스트/WSL 프론트 빌드 금지.');
console.error('[guard]   ' + RULE);
console.error('[guard]   운영 산출물은 ./deploy/build-and-deploy.sh 경로에서 Cloud Build 가 생성한다.');
console.error('');
process.exit(1);
