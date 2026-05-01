const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const globals = require('globals');

/**
 * ESLint 配置（Flat Config，适配 ESLint v9）。
 *
 * @returns ESLint 配置数组。
 */
function buildConfig() {
  return [
    {
      ignores: [
        '**/node_modules/**',
        '**/dist/**',
        '**/out/**',
        '**/coverage/**',
        '**/.history/**',
        '**/.vscode-test/**',
        'release/**',
        'dist-webview/**',
        'chrome-extension/**',
        'chrome-extension/ui/**',
      ],
    },
    js.configs.recommended,
    {
      files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    {
      files: ['**/*.{ts,tsx}'],
      languageOptions: {
        parser: tsParser,
        parserOptions: {
          ecmaVersion: 2022,
          sourceType: 'module',
          ecmaFeatures: { jsx: true },
        },
      },
      plugins: {
        '@typescript-eslint': tsPlugin,
      },
      rules: {
        ...tsPlugin.configs.recommended.rules,
        // TS 类型名（如 HTMLDivElement）会触发 no-undef，交由 TS 编译器兜底即可
        'no-undef': 'off',
        // 现有代码中 any 主要用于 VS Code/Webview 消息与兼容逻辑，先不强制收敛
        '@typescript-eslint/no-explicit-any': 'off',
        'react-hooks/exhaustive-deps': 'off',
      },
    },
    {
      files: ['webview/src/**/*.{ts,tsx,js,jsx}'],
      languageOptions: {
        globals: {
          ...globals.browser,
        },
      },
      plugins: {
        react: reactPlugin,
        'react-hooks': reactHooksPlugin,
      },
      settings: {
        react: { version: 'detect' },
      },
      rules: {
        ...reactPlugin.configs.recommended.rules,
        ...reactHooksPlugin.configs.recommended.rules,
        'react/react-in-jsx-scope': 'off',
        // React 16 使用 ReactDOM.render；避免 react 版本升级后产生的误报
        'react/no-deprecated': 'off',
        // 某些版本的 react-hooks 插件包含非标准规则，避免误报
        'react-hooks/refs': 'off',
        'react-hooks/exhaustive-deps': 'off',
        'react-hooks/set-state-in-effect': 'off',
        'react/no-unescaped-entities': 'off',
      },
    },
    {
      files: ['eslint.config.js'],
      languageOptions: {
        sourceType: 'commonjs',
        globals: {
          ...globals.node,
        },
      },
    },
    {
      files: ['src/**/*.{ts,js}', 'scripts/**/*.{ts,js,mjs,cjs}'],
      languageOptions: {
        globals: {
          ...globals.node,
        },
      },
    },
  ];
}

module.exports = buildConfig();

