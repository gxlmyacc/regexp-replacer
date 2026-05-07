import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { repoIconFaviconPlugin } from './viteRepoIconFaviconPlugin';

/**
 * Chrome 扩展 UI 的 Vite 构建配置。
 *
 * 说明：
 * - 使用 base:'./' 生成相对资源路径，适配 chrome-extension:// URL。
 * - 默认输出到 release/chrome-extension/ui。
 * - 若设置环境变量 REGEXP_REPLACER_CHROME_RELEASE_DIR，则输出到 release/<dir>/ui。
 */
export default defineConfig({
  root: __dirname,
  plugins: [react(), repoIconFaviconPlugin()],
  base: './',
  resolve: {
    // 避免多个 React 实例导致 Invalid hook call
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: path.resolve(
      __dirname,
      '..',
      'release',
      process.env.REGEXP_REPLACER_CHROME_RELEASE_DIR || 'chrome-extension',
      'ui',
    ),
    emptyOutDir: true,
    sourcemap: false,
  },
});

