"use client";

import Link from "next/link";
import { T, useLocale } from "./components/locale-provider";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useLocale();
  return (
    <main className="empty-state error-state" role="alert">
      <h1><T id="errorPage.title" /></h1>
      <p><T id="errorPage.description" /></p>
      <div className="error-actions"><button type="button" className="button button-primary" onClick={reset}>{t("errorPage.retry")}</button><Link className="button button-secondary" href="/">{t("errorPage.home")}</Link></div>
    </main>
  );
}
