import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function findProjectRoot(startDir: string): string {
    let dir = startDir;
    while (dir !== path.dirname(dir)) {
        if (fs.existsSync(path.join(dir, 'artisan'))) return dir;
        dir = path.dirname(dir);
    }
    return path.resolve(startDir, '../..');
}

const rootDir = findProjectRoot(__dirname);

export default defineConfig({
    plugins: [react()],
    server: {
        fs: {
            allow: [rootDir],
        },
    },
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: [path.resolve(__dirname, 'src/test-setup.ts')],
        include: [
            'src/components/**/*.{test,spec}.{ts,tsx}',
            'src/api/**/*.{test,spec}.{ts,tsx}',
            'src/apps/**/*.{test,spec}.{ts,tsx}',
            'src/handlers/**/*.{test,spec}.{ts,tsx}',
            'src/utils/**/*.{test,spec}.{ts,tsx}',
            'src/i18n/**/*.{test,spec}.{ts,tsx}',
            // Runtime layer (system options 훅, 날씨 엔진 · 순수 함수 · effects · hooks)
            'src/runtime/**/*.{test,spec}.{ts,tsx}',
            // Pages(Moa_HomePage 통합 테스트 — 날씨 훅 · Provider 설치 회귀 포함)
            'src/pages/**/*.{test,spec}.{ts,tsx}',
            'src/shell/**/*.{test,spec}.{ts,tsx}',
        ],
    },
    resolve: {
        alias: {
            '@': path.resolve(rootDir, 'resources/js'),
            'moabom-shell-i18n': path.resolve(__dirname, 'src/i18n/moabomShellI18nSingleton.ts'),
            'moabom-create-app-edit': path.resolve(__dirname, 'src/apps/ai-generator/moabomCreateAppEditSession.ts'),
            'moabom-ai-generation-activity': path.resolve(__dirname, 'src/apps/ai-generator/aiGenerationActivity.ts'),
            '@moabom-consulting/simulation-model.json': path.resolve(
                __dirname,
                '../../modules/moabom-consulting/resources/simulation-model.json',
            ),
            '@moabom-cpap/recommend-rules.json': path.resolve(
                __dirname,
                '../../modules/moabom-cpap/resources/recommend-rules.json',
            ),
            '@moabom-cpap/recommend-parity-fixtures.json': path.resolve(
                __dirname,
                '../../modules/moabom-cpap/resources/recommend-parity-fixtures.json',
            ),
        },
    },
});
