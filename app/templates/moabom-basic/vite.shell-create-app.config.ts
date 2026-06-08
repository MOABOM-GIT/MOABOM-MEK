import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/** 메인 `vite.config.ts` 이후 실행 — AI 앱 만들기 셸 전용 IIFE (React는 코어 번들과 동일 external) */
export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      'moabom-shell-i18n': path.resolve(__dirname, 'src/i18n/moabomShellI18nSingleton.ts'),
      'moabom-create-app-edit': path.resolve(__dirname, 'src/apps/ai-generator/moabomCreateAppEditSession.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2020',
    assetsInlineLimit: 0,
    lib: {
      entry: path.resolve(__dirname, 'src/apps/ai-generator/shellRegister.ts'),
      name: 'MoabomShellChunkCreateApp',
      fileName: () => 'moabom-shell-create-app',
      formats: ['iife'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'moabom-shell-i18n', 'moabom-create-app-edit'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'ReactJSXRuntime',
          'moabom-shell-i18n': '__MoabomShellI18n',
          'moabom-create-app-edit': '__MoabomCreateAppEdit',
        },
        exports: 'named',
        extend: true,
        entryFileNames: 'js/moabom-shell-create-app.iife.js',
      },
    },
  },
});
