import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// 빌드·IDE — 활성 moabom-admin_basic SSOT (Cloud Run 이미지에 _bundled/sirsoft 없음)
const adminBasicRoot = path.resolve(
    __dirname,
    "../../templates/moabom-admin_basic/src/components/basic",
);

export default defineConfig({
    define: {
        "process.env.NODE_ENV": JSON.stringify("production"),
    },
    plugins: [react()],
    resolve: {
        alias: {
            "@admin-basic": adminBasicRoot,
        },
    },
    build: {
        lib: {
            entry: path.resolve(__dirname, "js/index.ts"),
            name: "MoabomSystem",
            fileName: "module",
            formats: ["iife"],
        },
        outDir: "dist",
        emptyOutDir: true,
        sourcemap: true,
        rollupOptions: {
            external: ["react", "react-dom", "react/jsx-runtime"],
            output: {
                globals: {
                    react: "React",
                    "react-dom": "ReactDOM",
                    "react/jsx-runtime": "ReactJSXRuntime",
                },
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name?.endsWith(".css")) {
                        return "css/module[extname]";
                    }
                    return "assets/[name][extname]";
                },
                entryFileNames: "js/module.iife.js",
                chunkFileNames: "js/[name]-[hash].js",
            },
        },
        minify: "esbuild",
        target: "es2020",
        chunkSizeWarningLimit: 800,
    },
});
