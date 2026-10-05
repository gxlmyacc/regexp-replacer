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
      vscode: path.resolve(vitestConfigDir, 'helpers', 'vscode.ts'),
      'use-modal-ref': path.resolve(vitestConfigDir, '..', '..', 'node_modules', 'use-modal-ref', 'es', 'index.js'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/webview/**/*.test.{ts,tsx}'],
    globals: true,
    coverage: {
      provider: 'v8',
      reportOnFailure: true,
      thresholds: { perFile: true, statements: 95, branches: 95, functions: 95, lines: 95 },
      reporter: ['text', 'html', 'json-summary', 'json'],
      // 所有手写运行时代码都参与逐文件验收；纯类型和测试代码不产生运行时行为。
      include: [
        'webview/src/**/*.{ts,tsx}',
        'src/**/*.ts',
        'chrome-extension/background.js',
      ],
      exclude: [
        '**/*.d.ts',
        'src/test-node/**',
        'src/types.ts',
        'webview/src/utils/regexHighlight/types.ts',
        'webview/src/utils/regexLint/types.ts',
      ],
    },
  },
});

