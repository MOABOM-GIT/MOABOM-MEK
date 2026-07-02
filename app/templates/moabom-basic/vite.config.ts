import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import dts from 'vite-plugin-dts';
import path from 'path';
import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync, unlinkSync, writeFileSync } from 'fs';
import { build as esbuild } from 'esbuild';
import { getManifest, injectManifest, type ManifestTransform } from 'workbox-build';

function toTemplateAssetUrl(url: string): string {
  return `/api/templates/assets/moabom-basic/${url.replace(/^\/+/, '')}`;
}

const pwaManifestTransform: ManifestTransform = (manifestEntries) => ({
  manifest: manifestEntries.map((entry) => ({
    ...entry,
    url: toTemplateAssetUrl(entry.url),
  })),
  warnings: [],
});

function copyDirRecursive(srcDir: string, destDir: string): void {
  if (!existsSync(srcDir)) return;

  mkdirSync(destDir, { recursive: true });
  for (const file of readdirSync(srcDir)) {
    const srcPath = path.resolve(srcDir, file);
    const destPath = path.resolve(destDir, file);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (stat.isFile()) {
      copyFileSync(srcPath, destPath);
    }
  }
}

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },

  plugins: [
    react(),
    tailwindcss(),
    dts({
      insertTypesEntry: true,
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'node_modules'],
    }),
    {
      name: 'copy-images',
      closeBundle() {
        const srcDir = path.resolve(__dirname, 'src/assets/images');
        const imgDir = path.resolve(__dirname, 'dist/img');
        mkdirSync(imgDir, { recursive: true });
        if (existsSync(srcDir)) {
          const files = readdirSync(srcDir);
          for (const file of files) {
            const srcPath = path.resolve(srcDir, file);
            if (statSync(srcPath).isFile()) {
              copyFileSync(srcPath, path.resolve(imgDir, file));
            }
          }
        }

        copyDirRecursive(
          path.resolve(__dirname, 'public/pwa/icons'),
          path.resolve(__dirname, 'dist/pwa/icons'),
        );

        // 자체 호스팅 웹폰트(Pretendard dynamic-subset woff2)를 dist/fonts 로 복사.
        // CSS(@font-face)는 components.css 에 인라인되며 url() 은 절대 API 경로
        // (/api/templates/assets/moabom-basic/fonts/...)라 별도 해시·재작성이 없다.
        copyDirRecursive(
          path.resolve(__dirname, 'src/assets/fonts'),
          path.resolve(__dirname, 'dist/fonts'),
        );
      },
    },
    {
      name: 'moabom-pwa-inject-manifest',
      async closeBundle() {
        const swSrc = path.resolve(__dirname, '../../plugins/moabom-pwa/resources/pwa/sw.template.js');
        const swBundleSrc = path.resolve(__dirname, 'dist/pwa/sw.template.bundle.js');
        const swDest = path.resolve(__dirname, 'dist/pwa/sw.bundled.js');
        const precacheDest = path.resolve(__dirname, 'dist/pwa/precache-manifest.json');

        mkdirSync(path.dirname(swDest), { recursive: true });

        try {
          await esbuild({
            entryPoints: [swSrc],
            bundle: true,
            format: 'iife',
            platform: 'browser',
            target: 'es2020',
            absWorkingDir: __dirname,
            nodePaths: [path.resolve(__dirname, 'node_modules')],
            outfile: swBundleSrc,
            minify: true,
          });

          await injectManifest({
            swSrc: swBundleSrc,
            swDest,
            globDirectory: path.resolve(__dirname, 'dist'),
            globPatterns: ['js/components.iife.js', 'css/components.css', 'img/**/*', 'pwa/icons/**/*'],
            manifestTransforms: [pwaManifestTransform],
            injectionPoint: 'self.__WB_MANIFEST',
          });

          const { manifestEntries } = await getManifest({
            globDirectory: path.resolve(__dirname, 'dist'),
            globPatterns: ['js/components.iife.js', 'css/components.css', 'img/**/*', 'pwa/icons/**/*'],
            manifestTransforms: [pwaManifestTransform],
          });
          writeFileSync(precacheDest, JSON.stringify(manifestEntries));

          if (existsSync(swBundleSrc)) {
            unlinkSync(swBundleSrc);
          }
        } catch (error) {
          console.error('[moabom-pwa] Workbox injectManifest failed:', error);
          process.exitCode = 1;
          throw error;
        }
      },
    },
  ],

  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'MoabomBasic', // 전역 변수명
      fileName: 'components',
      formats: ['iife'],
    },

    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,

    // 이미지를 base64로 인라인하지 않도록 설정 (0으로 설정하면 모든 이미지가 별도 파일로)
    assetsInlineLimit: 0,

    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],

      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'ReactJSXRuntime',
        },

        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'css/[name][extname]';
          }
          if (assetInfo.name?.match(/\.(woff|woff2|eot|ttf|otf)$/)) {
            return 'assets/fonts/[name][extname]';
          }
          if (assetInfo.name?.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) {
            return 'assets/images/[name][extname]';
          }
          return 'assets/[name][extname]';
        },

        entryFileNames: 'js/components.iife.js',
        chunkFileNames: 'js/[name]-[hash].js',
      },
    },

    minify: 'esbuild',
    target: 'es2020',
    chunkSizeWarningLimit: 1000,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      // tsconfig.json paths 와 동일 — dts·IDE·Vite 해석 일치
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
