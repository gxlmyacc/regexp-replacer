import path from 'node:path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { repoIconFaviconPlugin } from './viteRepoIconFaviconPlugin';

export default defineConfig(({ mode }) => ({
  root: __dirname,
  plugins: [
    react(),
    repoIconFaviconPlugin(),
    mode === 'analyze'
      ? visualizer({
        filename: path.resolve(__dirname, '..', 'dist-webview', 'stats.html'),
        gzipSize: true,
        brotliSize: true,
        template: 'treemap',
        open: false,
      })
      : null,
  ].filter(Boolean),
  resolve: {
    // 避免 webview/node_modules 与根目录 node_modules 同时存在 react 导致 “Invalid hook call”
    dedupe: ['react', 'react-dom'],
    // Webview 运行在较新 Chromium：解析到轻量 es 产物，减少 @babel/runtime 打进 bundle（源码仍写 use-modal-ref）。
    alias: {
      'use-modal-ref': path.resolve(__dirname, '..', 'node_modules', 'use-modal-ref', 'es', 'index.js'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '..', 'dist-webview'),
    emptyOutDir: true,
    sourcemap: false,
    // 尽量减少单个 chunk 体积，并提升 zip 压缩率（VSIX 本质是 zip）。
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/monaco-editor/')) return 'monaco';
          // 不要单独拆 use-modal-ref：会触发 Rolldown 把 React/React-DOM 再整包打进该 chunk（约 130KB+ 重复），VSIX 反而更大。
          if (id.includes('node_modules/regenerator-runtime/')) return 'regenerator';
        },
      },
    },
  },
}));

