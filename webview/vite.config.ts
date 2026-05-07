import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { repoIconFaviconPlugin } from './viteRepoIconFaviconPlugin';

export default defineConfig({
  root: __dirname,
  plugins: [react(), repoIconFaviconPlugin()],
  resolve: {
    // 避免 webview/node_modules 与根目录 node_modules 同时存在 react 导致 “Invalid hook call”
    dedupe: ['react', 'react-dom'],
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
          if (id.includes('node_modules/use-modal-ref/')) return 'use-modal-ref';
          if (id.includes('node_modules/regenerator-runtime/')) return 'regenerator';
        },
      },
    },
  },
});

