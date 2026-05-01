import { en } from './en';
import { zhCN } from './zh-CN';

/** 与 en/zh-CN 结构一致的字典类型（供组件 props 约束文案）。 */
export type I18nMessages = typeof en;

export type LanguageCode = 'en' | 'zh-CN';

/** Webview 页面语言偏好持久化键（localStorage）。 */
const UI_LANGUAGE_STORAGE_KEY = 'regexpReplacer.uiLanguage';

/**
 * 读取用户已保存的界面语言；未配置或无效时返回 undefined。
 *
 * @returns 已保存的语言代码；无有效配置时为 undefined。
 */
export function readStoredUiLanguage(): LanguageCode | undefined {
  try {
    const raw = localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
    if (raw === 'en' || raw === 'zh-CN') return raw;
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * 将界面语言写入 localStorage，供下次打开面板时恢复。
 *
 * @param lang 语言代码。
 * @returns 无返回值。
 */
export function persistUiLanguage(lang: LanguageCode): void {
  try {
    localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // ignore
  }
}

/**
 * 首屏语言：以用户已保存的偏好为准，未保存时默认英语。
 *
 * @returns 首屏应使用的语言代码。
 */
export function getInitialUiLanguage(): LanguageCode {
  return readStoredUiLanguage() ?? 'en';
}

/**
 * 将 VS Code 语言代码归一化为 Webview 内部使用的语言代码。
 *
 * @param language VS Code 语言代码（如 `en`、`zh-cn`、`zh-hans`）。
 * @returns 归一化后的语言代码。
 */
export function normalizeLanguage(language: string): LanguageCode {
  const lower = (language ?? '').toLowerCase();
  if (lower.startsWith('zh')) return 'zh-CN';
  return 'en';
}

/**
 * 获取指定语言的字典；若不存在则回退英文。
 *
 * @param lang 语言代码。
 * @returns 文案字典对象。
 */
export function getDict(lang: LanguageCode) {
  return lang === 'zh-CN' ? zhCN : en;
}

