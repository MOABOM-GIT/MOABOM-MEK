#!/usr/bin/env node
/**
 * Moabom 단일 테스트 진입 — 위임 러너.
 *
 * 왜 위임인가:
 *   활성 템플릿(moabom-basic, moabom-admin_basic)은 각자의 node_modules 에
 *   vitest/@testing-library/jest-dom 를 설치한 독립 toolchain 이다.
 *   루트 vitest 의 `projects` 로 끌어오면 setup 의 `@testing-library/jest-dom/vitest`
 *   가 "다른" vitest 인스턴스의 expect 에 matcher 를 등록해
 *   `Invalid Chai property: toBeInTheDocument` 같은 거짓 실패가 발생한다.
 *   따라서 각 스위트를 "자기 디렉토리 + 자기 vitest 바이너리 + 자기 config" 로
 *   그대로 실행한다. 이것이 현재 동작을 100% 보존하는 유일한 위임 방식이다.
 *
 * 범위:
 *   - core: G7 코어 엔진(resources/js) + hello 샘플 → 루트 vitest.config.ts
 *   - active templates/modules/plugins: moabom-* 중 자체 vitest.config + 설치된 vitest
 *   - _bundled / sirsoft-* : 활성 SSOT 아님 → 제외 (.gcloudignore 와 동일 경계)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const passthrough = process.argv.slice(2);

/** suite 가 자체 vitest 바이너리를 가졌는지 */
function hasOwnVitest(dir) {
  return existsSync(path.join(dir, 'node_modules', '.bin', 'vitest'));
}
function hasVitestConfig(dir) {
  return ['ts', 'js', 'mjs', 'cjs'].some((ext) =>
    existsSync(path.join(dir, `vitest.config.${ext}`)),
  );
}

/** 활성 moabom-* 패키지 탐색 (templates/modules/plugins) */
function discoverActiveSuites() {
  const groups = ['templates', 'modules', 'plugins'];
  const suites = [];
  for (const group of groups) {
    const base = path.join(APP_ROOT, group);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) {
      if (!name.startsWith('moabom-')) continue; // 활성 SSOT 경계
      const dir = path.join(base, name);
      if (!hasVitestConfig(dir)) continue;
      suites.push({ id: `${group}/${name}`, dir });
    }
  }
  return suites.sort((a, b) => a.id.localeCompare(b.id));
}

function runSuite(label, dir) {
  process.stdout.write(`\n=== vitest :: ${label} ===\n`);
  const res = spawnSync('npx', ['vitest', 'run', ...passthrough], {
    cwd: dir,
    stdio: 'inherit',
    env: process.env,
  });
  return res.status ?? 1;
}

const results = [];

// 1) core (루트 config)
results.push({ label: 'core (resources/js + hello samples)', code: runSuite('core', APP_ROOT) });

// 2) 활성 moabom-* 위임
for (const suite of discoverActiveSuites()) {
  if (!hasOwnVitest(suite.dir)) {
    process.stdout.write(`\n--- SKIP ${suite.id}: 자체 node_modules vitest 미설치 (npm ci 필요) ---\n`);
    results.push({ label: suite.id, code: 0, skipped: true });
    continue;
  }
  results.push({ label: suite.id, code: runSuite(suite.id, suite.dir) });
}

process.stdout.write('\n================ vitest-all 요약 ================\n');
let failed = 0;
for (const r of results) {
  const status = r.skipped ? 'SKIP' : r.code === 0 ? 'PASS' : 'FAIL';
  if (!r.skipped && r.code !== 0) failed += 1;
  process.stdout.write(`  ${status}  ${r.label}\n`);
}
process.stdout.write('================================================\n');

if (failed > 0) {
  process.stdout.write(`\nvitest-all: ${failed} suite(s) FAILED\n`);
  process.exit(1);
}
process.stdout.write('\nvitest-all: 모든 스위트 통과\n');
