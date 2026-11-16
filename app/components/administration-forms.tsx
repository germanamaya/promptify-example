"use client";

import { useActionState, useRef, useState } from "react";
import type { AdministratorUserDto, CategoryDto } from "@/lib/dto/dtos";
import { createCategory, updateCategory, deleteCategory } from "@/app/actions/categories";
import { promoteAdministrator, demoteAdministrator } from "@/app/actions/administrators";
import { actionErrorMessage } from "./read-error";
import { useLocale } from "./locale-provider";

type Feedback = { error?: string; success?: string } | null;

function FormFeedback({ feedback }: { feedback: Feedback }) {
  return <>{feedback?.error && <p className="form-error" role="alert">{feedback.error}</p>}
    {feedback?.success && <p className="form-success" role="status">{feedback.success}</p>}</>;
}

export function CategoryForm({ category }: { category?: CategoryDto }) {
  const { t } = useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  const suffix = category?.id ?? "new";
  const [values, setValues] = useState({ name: category?.name ?? "", color: category?.color ?? "#28745a" });
  const [feedback, submit, pending] = useActionState<Feedback, FormData>(async (_previous, form) => {
    const deleting = form.get("intent") === "delete";
    const result = deleting && category ? await deleteCategory(category.id)
      : category ? await updateCategory(category.id, form) : await createCategory(form);
    if (!result.ok) return { error: t(actionErrorMessage(result.error)) };
    dialog.current?.close();
    if (!category) setValues({ name: "", color: "#28745a" });
    return { success: t(deleting ? "feedback.categoryDeleted" : category ? "feedback.categorySaved" : "feedback.categoryCreated") };
  }, null);
  return <div className="category-management">
    <form action={submit} className="category-management-form" aria-label={category ? t("admin.editCategory", { name: category.name }) : t("admin.createCategoryLabel")} aria-busy={pending}>
      <div className="form-field">
        <label htmlFor={`category-name-${suffix}`}>{t("admin.name")}</label>
        <input id={`category-name-${suffix}`} name="name" required maxLength={50} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} disabled={pending} placeholder={t("admin.categoryNamePlaceholder")} />
      </div>
      <div className="form-field color-field">
        <label htmlFor={`category-color-${suffix}`}>{t("admin.color")}</label>
        <input id={`category-color-${suffix}`} name="color" type="color" value={values.color} onChange={(event) => setValues({ ...values, color: event.target.value })} disabled={pending} required />
      </div>
      <button type="submit" className={`button ${category ? "button-secondary" : "button-primary"}`} disabled={pending}>{pending ? t("admin.saving") : category ? t("admin.saveCategory") : t("admin.createCategory")}</button>
      {category && <button className="button button-danger-secondary" type="button" disabled={pending} onClick={() => dialog.current?.showModal()}>{t("admin.deleteCategory")}</button>}
    </form>
    <FormFeedback feedback={feedback} />
    {category && <dialog ref={dialog} className="confirmation-dialog" aria-labelledby={`delete-category-${suffix}`} onCancel={(event) => { if (pending) event.preventDefault(); }}>
      <h2 id={`delete-category-${suffix}`}>{t("admin.deleteCategoryTitle", { name: category.name })}</h2>
      <p>{t("admin.deleteCategoryWarning")}</p>
      <FormFeedback feedback={feedback?.error ? feedback : null} />
      <form action={submit} className="form-actions">
        <button className="button button-secondary" type="button" autoFocus disabled={pending} onClick={() => dialog.current?.close()}>{t("admin.cancel")}</button>
        <button className="button button-danger" name="intent" value="delete" disabled={pending}>{pending ? t("admin.deleting") : t("admin.confirmDelete")}</button>
      </form>
    </dialog>}
  </div>;
}

export function AdministratorForm({ users }: { users: AdministratorUserDto[] }) {
  const { t } = useLocale();
  return <ul className="role-management-list" aria-label={t("admin.rolesList")}>
    {users.map((user) => <AdministratorUserRow key={user.oid} user={user} />)}
  </ul>;
}

function AdministratorUserRow({ user }: { user: AdministratorUserDto }) {
  const { t } = useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  const [feedback, submit, pending] = useActionState<Feedback, FormData>(async (_previous, form) => {
    const oid = String(form.get("oid") ?? "").trim();
    const demoting = form.get("intent") === "demote";
    const result = demoting ? await demoteAdministrator(oid) : await promoteAdministrator(oid);
    if (!result.ok) return { error: t(actionErrorMessage(result.error)) };
    dialog.current?.close();
    return { success: t(demoting ? "feedback.roleRemoved" : "feedback.roleAssigned") };
  }, null);
  const dialogId = `demote-user-${user.oid}`;
  return <li className="role-management-row">
    <div className="role-user-details">
      <strong>{user.name}</strong>
      <span className={`role-badge ${user.isAdministrator ? "role-badge-administrator" : "role-badge-user"}`}>
        {user.isAdministrator ? t("nav.roleAdministrator") : t("nav.roleUser")}
      </span>
    </div>
    <form action={submit} className="role-user-actions" aria-busy={pending}>
      <input type="hidden" name="oid" value={user.oid} />
      {user.isAdministrator
        ? <button className="button button-danger-secondary" type="button" disabled={pending} onClick={() => dialog.current?.showModal()} aria-label={t("admin.removeRoleLabel", { name: user.name })}>{t("admin.removeRole")}</button>
        : <button className="button button-primary" type="submit" name="intent" value="promote" disabled={pending} aria-label={t("admin.assignRoleLabel", { name: user.name })}>{pending ? t("admin.updating") : t("admin.assignRole")}</button>}
      <FormFeedback feedback={feedback} />
      {user.isAdministrator && <dialog ref={dialog} className="confirmation-dialog" aria-labelledby={`${dialogId}-title`} onCancel={(event) => { if (pending) event.preventDefault(); }}>
        <h2 id={`${dialogId}-title`}>{t("admin.demoteTitle", { name: user.name })}</h2>
        <p>{t("admin.demoteDescription", { name: user.name })}</p>
        <FormFeedback feedback={feedback?.error ? feedback : null} />
        <div className="form-actions">
          <button className="button button-secondary" type="button" autoFocus disabled={pending} onClick={() => dialog.current?.close()}>{t("admin.cancel")}</button>
          <button className="button button-danger" type="submit" name="intent" value="demote" disabled={pending}>{pending ? t("admin.updating") : t("admin.removeRole")}</button>
        </div>
      </dialog>}
    </form>
  </li>;
}
