"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LANGUAGE, type Language, type MessageKey, translate } from "@/lib/i18n/messages";

type LocaleContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: MessageKey, values?: Record<string, string | number>) => string;
};

const defaultValue: LocaleContextValue = {
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (key, values) => translate(DEFAULT_LANGUAGE, key, values),
};

const LocaleContext = createContext(defaultValue);

export function LocaleProvider({ language: initialLanguage, children }: {
  language: Language;
  children: ReactNode;
}) {
  const [language, setLanguage] = useState(initialLanguage);
  const t = useCallback((key: MessageKey, values?: Record<string, string | number>) =>
    translate(language, key, values), [language]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = translate(language, "meta.title");
    document.querySelector('meta[name="description"]')
      ?.setAttribute("content", translate(language, "meta.description"));
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function T({ id, values }: { id: MessageKey; values?: Record<string, string | number> }) {
  const { t } = useLocale();
  return t(id, values);
}
