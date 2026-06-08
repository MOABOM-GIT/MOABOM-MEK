import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// 루트 config 는 G7 코어 엔진(resources/js) + 학습용 hello 샘플만 책임진다.
// 활성 템플릿(moabom-basic, moabom-admin_basic)은 각자의 node_modules·alias·환경을
// 가진 독립 toolchain 이므로, 루트에서 직접 include 하면 템플릿 전용 alias 미해석 +
// vitest/@testing-library 인스턴스 이중화로 "거짓 실패"가 발생한다.
// 단일 진입으로 전체를 돌리려면 `npm run test:run`(scripts/vitest-all.mjs)을 쓴다.
// 그 러너가 코어와 각 템플릿을 자기 SSOT config 로 위임 실행한다.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./resources/js/tests/setup.ts'],
    include: [
      'resources/js/**/*.{test,spec}.{ts,tsx}',
      // 학습용 샘플 템플릿: __tests__ 디렉토리도 루트에서 회귀 커버리지 확보
      'templates/_bundled/gnuboard7-hello_admin_template/__tests__/**/*.{test,spec}.{ts,tsx}',
      'templates/_bundled/gnuboard7-hello_user_template/__tests__/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      // 활성/번들 템플릿 src 는 각자의 vitest.config 로 실행 (scripts/vitest-all.mjs).
      // hello 샘플은 위 include 의 __tests__ 경로로만 커버하므로 src 만 방어적으로 제외.
      'templates/**/src/**',
      // 업데이트/백업 임시 스테이징 디렉토리는 실제 코드가 아니므로 제외
      '**/_pending/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'resources/js/tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './resources/js'),
      '@core': path.resolve(__dirname, './resources/js/core'),
    },
  },
});
