import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/** 메인 `vite.config.ts` 이후 실행 — yet-another-react-lightbox 전용 IIFE (React는 코어와 동일 external) */
export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
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
      entry: path.resolve(__dirname, 'src/components/composite/imageGalleryLightboxRegister.ts'),
      name: 'MoabomImageGalleryLightboxRegister',
      fileName: () => 'image-gallery-lightbox',
      formats: ['iife'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'ReactJSXRuntime',
        },
        extend: true,
        entryFileNames: 'js/image-gallery-lightbox.iife.js',
      },
    },
  },
});
