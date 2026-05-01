import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Chrome 扩展 UI 的 Vite 构建配置。
 *
 * 说明：
 * - 使用 base:'./' 生成相对资源路径，适配 chrome-extension:// URL。
 * - 输出到仓库根目录的 chrome-extension/ui，作为扩展页面资源。
 */
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  base: './',
  resolve: {
    // 避免多个 React 实例导致 Invalid hook call
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: path.resolve(__dirname, '..', 'release', 'chrome-extension', 'ui'),
    emptyOutDir: true,
    sourcemap: false,
  },
});

