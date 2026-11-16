"use client";

import { useState } from "react";
import { setUserLanguage } from "@/app/actions/language";
import { LANGUAGES, isLanguage, type Language, type MessageKey } from "@/lib/i18n/messages";
import { useLocale } from "./locale-provider";

const languageNameKeys: Record<Language, MessageKey> = {
  en: "language.english",
  es: "language.spanish",
  it: "language.italian",
  "pt-PT": "language.portuguese",
  de: "language.german",
};

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { language, setLanguage, t } = useLocale();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function changeLanguage(value: string) {
    if (!isLanguage(value) || value === language || saving) return;
    setSaving(true);
    setError(false);
    try {
      const result = await setUserLanguage(value);
      if (!result.ok) {
        setError(true);
        return;
      }
      setLanguage(value);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`language-switcher ${className}`.trim()} aria-busy={saving}>
      <label className="sr-only" htmlFor={`language-select-${className || "profile"}`}>{t("language.label")}</label>
      <select
        id={`language-select-${className || "profile"}`}
        aria-label={t("language.label")}
        value={language}
        disabled={saving}
        onChange={(event) => void changeLanguage(event.target.value)}
      >
        {LANGUAGES.map((option) => <option key={option} value={option}>{t(languageNameKeys[option])}</option>)}
      </select>
      {error && <span className="language-error" role="alert">{t("language.saveError")}</span>}
    </div>
  );
}
