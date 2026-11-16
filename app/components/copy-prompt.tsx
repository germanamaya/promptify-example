"use client";

import { useState } from "react";
import { Icon } from "./ui-icon";
import { useLocale } from "./locale-provider";

export function CopyPrompt({ content, iconOnly = false }: { content: string; iconOnly?: boolean }) {
  const { t } = useLocale();
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }
  return (
    <div className="copy-control">
      <button className={`button button-primary${iconOnly ? " icon-button" : ""}`} type="button" aria-label={t("copy.copy")} title={t("copy.copy")} onClick={copy}><Icon name={status === "copied" ? "check" : "copy"} />{!iconOnly && (status === "copied" ? t("copy.copied") : t("copy.copy"))}</button>
      <span role={status === "error" ? "alert" : "status"}>{status === "error" ? t("copy.failure") : status === "copied" ? t("copy.ready") : ""}</span>
    </div>
  );
}
