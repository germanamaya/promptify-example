"use client";

import Link from "next/link";
import { Icon } from "./ui-icon";
import { useLocale } from "./locale-provider";

export function PromptActions({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  return <div className="detail-actions" role="group" aria-label={t("prompt.actionGroup")}>{children}</div>;
}

export function EditPromptLink({ href, modal }: { href: string; modal: boolean }) {
  const { t } = useLocale();
  return (
    <Link
      className={`button button-secondary${modal ? " icon-button" : ""}`}
      replace={modal}
      scroll={false}
      aria-label={t("prompt.edit")}
      title={t("prompt.edit")}
      href={href}
    >
      {modal ? <Icon name="edit" /> : t("prompt.edit")}
    </Link>
  );
}
