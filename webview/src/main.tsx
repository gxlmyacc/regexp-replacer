import React from 'react';
import * as ReactDOM from 'react-dom';
import 'regenerator-runtime/runtime';
import { App } from './App';
import { I18nProvider } from './i18n/I18nProvider';
import './styles/main.scss';

/**
 * Webview 入口渲染函数。
 *
 * @param rootEl React 挂载点元素。
 * @returns 无返回值。
 */
function render(rootEl: HTMLElement): void {
  ReactDOM.render(
    <React.StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </React.StrictMode>,
    rootEl,
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  render(rootEl);
}

