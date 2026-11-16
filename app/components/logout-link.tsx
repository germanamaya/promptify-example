"use client";

import { Icon } from "./ui-icon";
import { useLocale } from "./locale-provider";

export function LogoutLink({ className }: { className?: string }) {
  const { t } = useLocale();
  // Easy Auth owns the session. A plain anchor avoids next/link prefetching, which would fire the logout GET.
  return (
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a href="/.auth/logout" className={`logout-link ${className ?? ""}`.trim()} aria-label={t("nav.logout")} title={t("nav.logout")}>
      <Icon name="logout" />
    </a>
  );
}
