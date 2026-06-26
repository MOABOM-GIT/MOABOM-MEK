import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
    },

    build: {
        // 라이브러리 모드 설정
        lib: {
            entry: path.resolve(__dirname, 'resources/js/index.ts'),
            name: 'MoabomAuthHardening', // 전역 변수명 (IIFE 모드용)
            fileName: 'plugin',
            formats: ['iife'], // IIFE 포맷만 빌드
        },

        // 빌드 출력 설정
        outDir: 'dist',
        emptyOutDir: true,

        // 소스맵 생성
        sourcemap: true,

        rollupOptions: {
            external: ['react', 'react-dom', 'react/jsx-runtime'],
            output: {
                globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM',
                    'react/jsx-runtime': 'ReactJSXRuntime',
                },
                entryFileNames: 'js/plugin.iife.js',
                chunkFileNames: 'js/[name]-[hash].js',
            },
        },

        minify: 'esbuild',
        target: 'es2020',

        chunkSizeWarningLimit: 500,
    },

    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'resources/js'),
        },
    },
});
