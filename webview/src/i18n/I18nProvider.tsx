import React, { createContext, memo, useCallback, useContext, useMemo, useState } from 'react';
import { getDict, getInitialUiLanguage, persistUiLanguage, type I18nMessages, type LanguageCode } from './index';

export type I18nContextValue = {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: I18nMessages;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export type I18nProviderProps = {
  children: React.ReactNode;
};

/**
 * Webview i18n Provider：集中管理语言状态与字典，避免在 App 中层层透传 labels。
 *
 * @param props 组件属性。
 * @returns React 元素。
 */
export const I18nProvider = memo(function I18nProvider(props: I18nProviderProps): React.ReactElement {
  const { children } = props;
  const [lang, setLangState] = useState<LanguageCode>(() => getInitialUiLanguage());

  const setLang = useCallback((next: LanguageCode) => {
    persistUiLanguage(next);
    setLangState(next);
  }, []);

  const t = useMemo(() => getDict(lang), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
});

/**
 * 读取当前 i18n 上下文：语言代码、字典与 setLang。
 *
 * @returns i18n 上下文对象。
 */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within <I18nProvider>.');
  return ctx;
}

