declare const acquireVsCodeApi:
  | undefined
  | (() => {
      postMessage: (message: unknown) => void;
      getState: () => unknown;
      setState: (state: unknown) => void;
    });

export type WebviewRequest =
  | { type: 'getConfig' }
  | { type: 'setConfig'; payload: unknown }
  | { type: 'exportCommands'; payload: unknown }
  | { type: 'importCommands' }
  | { type: 'getLanguage' }
  | { type: 'showInfo'; payload: { message: string } }
  | { type: 'showError'; payload: { message: string } };

export type WebviewResponse =
  | { type: 'config'; payload: unknown }
  | { type: 'language'; payload: { language: string } }
  | { type: 'info'; payload: { message: string } }
  | { type: 'error'; payload: { message: string } };

/**
 * 获取 VS Code Webview API，并统一封装消息发送。
 *
 * @returns Webview API 包装对象。
 */
export function createVscodeApi() {
  const apiFactory =
    typeof acquireVsCodeApi === 'function'
      ? acquireVsCodeApi
      : (globalThis as any).acquireVsCodeApi;

  // 在 Vite dev server（浏览器打开）场景下，acquireVsCodeApi 不存在；这里提供一个本地 mock，
  // 以便开发时能打开预留页面并调试 UI。
  if (typeof apiFactory !== 'function') {
    const stateKey = 'regexpReplacer.__mockState__';
    const configKey = 'regexpReplacer.commands';
    const seededKey = 'regexpReplacer.__mockSeeded__';
    const seedUrl = '/regexpReplacer.dev.commands.json';

    const readJson = <T,>(key: string, fallback: T): T => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    };

    const writeJson = (key: string, value: unknown) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // ignore
      }
    };

    const emit = (msg: WebviewResponse) => {
      window.postMessage(msg, '*');
    };

    /**
     * 触发浏览器下载 JSON 文件（仅 dev mock 使用）。
     *
     * @param filename 文件名。
     * @param data JSON 数据。
     * @returns 无返回值。
     */
    const downloadJson = (filename: string, data: unknown) => {
      try {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      } catch {
        // ignore
      }
    };

    /**
     * 打开文件选择器并读取 JSON（仅 dev mock 使用）。
     *
     * @returns 读取到的 JSON 值；读取失败返回 undefined。
     */
    const pickJsonFile = async (): Promise<unknown | undefined> => {
      return await new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) {
            resolve(undefined);
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            try {
              resolve(JSON.parse(String(reader.result ?? '')));
            } catch {
              resolve(undefined);
            }
          };
          reader.onerror = () => resolve(undefined);
          reader.readAsText(file);
        };
        input.click();
      });
    };

    return {
      postMessage(message: WebviewRequest) {
        if (message.type === 'getConfig') {
          const existing = localStorage.getItem(configKey);
          const existingIsEmptyArray = existing?.trim() === '[]';
          if (existing && !existingIsEmptyArray) {
            emit({ type: 'config', payload: readJson(configKey, []) });
            return;
          }

          // 首次启动：从本地预置 JSON 读取测试命令（可被后续 setConfig 覆盖到 localStorage）
          // 注意：只有在成功写入 commands 后才标记 seeded，避免“第一次 fetch 失败导致永远不再重试”。
          const seeded = localStorage.getItem(seededKey) === '1';
          if (seeded && existing) {
            emit({ type: 'config', payload: readJson(configKey, []) });
            return;
          }
          fetch(seedUrl)
            .then(async (r) => (r.ok ? await r.json() : []))
            .then((data) => {
              const next = Array.isArray(data) ? data : [];
              writeJson(configKey, next);
              localStorage.setItem(seededKey, '1');
              emit({ type: 'config', payload: readJson(configKey, []) });
            })
            .catch(() => {
              // fetch 失败时不写 seeded 标记，允许下次继续重试
              emit({ type: 'config', payload: [] });
            });
          return;
        }
        if (message.type === 'setConfig') {
          writeJson(configKey, message.payload);
          emit({ type: 'config', payload: readJson(configKey, []) });
          return;
        }
        if (message.type === 'exportCommands') {
          downloadJson('regexp-replacer.commands.json', message.payload);
          emit({ type: 'info', payload: { message: 'Exported.' } });
          return;
        }
        if (message.type === 'importCommands') {
          pickJsonFile().then((data) => {
            if (!Array.isArray(data)) {
              emit({ type: 'error', payload: { message: 'Invalid JSON.' } });
              return;
            }
            writeJson(configKey, data);
            emit({ type: 'config', payload: readJson(configKey, []) });
          });
          return;
        }
        if (message.type === 'getLanguage') {
          const language = (navigator.language || 'en').toLowerCase();
          emit({ type: 'language', payload: { language } });
          return;
        }
        if (message.type === 'showInfo') {
          emit({ type: 'info', payload: { message: (message.payload as any)?.message ?? 'Info' } });
          return;
        }
        if (message.type === 'showError') {
          emit({ type: 'error', payload: { message: (message.payload as any)?.message ?? 'Unknown error' } });
        }
      },
      getState<T>(): T | undefined {
        return readJson<T | undefined>(stateKey, undefined);
      },
      setState<T>(state: T) {
        writeJson(stateKey, state);
      },
    };
  }

  const api = apiFactory();

  return {
    postMessage(message: WebviewRequest) {
      api.postMessage(message);
    },
    getState<T>(): T | undefined {
      return api.getState() as T | undefined;
    },
    setState<T>(state: T) {
      api.setState(state);
    },
  };
}

