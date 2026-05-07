import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const vitestConfigDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Webview 单元测试配置（Vitest）。
 *
 * @returns Vitest 配置对象。
 */
export default defineConfig({
  resolve: {
    // 与 webview/vite.config.ts 一致，保证 vi.mock('use-modal-ref') 与源码解析到同一 es 入口。
    alias: {
      'use-modal-ref': path.resolve(vitestConfigDir, '..', '..', 'node_modules', 'use-modal-ref', 'es', 'index.js'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/webview/**/*.test.{ts,tsx}'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // 仅统计“Webview 核心逻辑层”的源码，避免 UI 大组件/产物文件把分母拉爆导致覆盖率虚低。
      include: [
        'webview/src/features/**/*.{ts,tsx}',
        'webview/src/hooks/**/*.{ts,tsx}',
        'webview/src/utils/**/*.{ts,tsx}',
        'webview/src/components/**/*.{ts,tsx}',
        'webview/src/App.tsx',
        'src/replace/**/*.{ts}',
      ],
      exclude: [
        '**/*.d.ts',
        'webview/src/main.tsx',
        'webview/src/bridge/**',
        'webview/src/toast/**',
        'webview/src/hooks/useTesterMatchesCm.ts',
        'webview/src/hooks/paneSplitDrag.ts',
      ],
    },
  },
});

