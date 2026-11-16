"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { deletePrompt } from "@/app/actions/prompts";
import { errorMessage } from "./read-error";
import { Icon } from "./ui-icon";
import { useLocale } from "./locale-provider";

export function DeletePrompt({ id, title, libraryHref, iconOnly = false }: { id: string; title: string; libraryHref: string; iconOnly?: boolean }) {
  const { t } = useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [error, submit, pending] = useActionState(async () => {
    const result = await deletePrompt(id);
    if (!result.ok) return t(errorMessage(result.error));
    dialog.current?.close();
    router.replace(libraryHref, { scroll: false });
    return null;
  }, null);

  return <>
    <button className={`button button-danger-secondary${iconOnly ? " icon-button" : ""}`} type="button" aria-label={t("delete.prompt")} title={t("delete.prompt")} onClick={() => dialog.current?.showModal()}>{iconOnly ? <Icon name="trash" /> : t("delete.prompt")}</button>
    <dialog ref={dialog} className="confirmation-dialog" aria-labelledby="delete-title" aria-describedby="delete-description" onCancel={(event) => { if (pending) event.preventDefault(); }}>
      <h2 id="delete-title">{t("delete.title")}</h2>
      <p id="delete-description">{t("delete.description", { title })}</p>
      <form action={submit} aria-busy={pending}>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="button button-secondary" autoFocus disabled={pending} onClick={() => dialog.current?.close()}>{t("prompt.cancel")}</button>
          <button type="submit" className="button button-danger" disabled={pending}>{pending ? t("delete.pending") : t("delete.confirm")}</button>
        </div>
      </form>
    </dialog>
  </>;
}
