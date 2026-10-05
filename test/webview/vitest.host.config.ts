import { defineConfig } from 'vitest/config';
import base from './vitest.config';

/** 宿主单元覆盖率：复用统一配置，使用受控 VS Code API mock，不启动 Electron。 */
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['test/webview/host*.test.ts', 'test/webview/engine*.test.ts', 'test/webview/textChain.test.ts'],
    coverage: {
      ...base.test?.coverage,
      include: ['src/**/*.ts', 'chrome-extension/background.js'],
      reportsDirectory: 'coverage/vscode',
    },
  },
});

