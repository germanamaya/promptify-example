"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPrompt, updatePrompt } from "@/app/actions/prompts";
import type { CategoryDto, PromptDetailDto } from "@/lib/dto/dtos";
import { actionErrorMessage } from "./read-error";

export function PromptForm({ categories, prompt, returnHref = "/" }: {
  categories: CategoryDto[]; prompt?: PromptDetailDto; returnHref?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    title: prompt?.title ?? "", description: prompt?.description ?? "",
    categoryIds: prompt?.categoryIds ?? [], content: prompt?.content ?? "",
  });
  const [error, submit, pending] = useActionState(async (_previous: string | null, form: FormData) => {
    if (form.getAll("categoryIds").length === 0) return "Selecciona al menos una Categoría.";
    const result = prompt
      ? await updatePrompt(prompt.id, form).then((result) => result.ok ? { ok: true as const, data: { id: prompt.id } } : result)
      : await createPrompt(form);
    if (!result.ok) {
      return actionErrorMessage(result.error);
    }
    const destination = prompt ? returnHref : `/prompts/${result.data.id}?from=${encodeURIComponent(returnHref)}`;
    router.replace(destination, { scroll: false });
    return null;
  }, null);

  return (
    <form action={submit} className="prompt-form" aria-busy={pending}>
      <div className="form-field">
        <label htmlFor="title">Título <span>Obligatorio</span></label>
        <input
          id="title" name="title" required maxLength={120}
          value={values.title}
          onChange={(event) => setValues({ ...values, title: event.target.value })}
          placeholder="Un nombre claro para lo que hace tu Prompt"
        />
      </div>
      <div className="form-field">
        <label htmlFor="description">Descripción <span>Opcional</span></label>
        <textarea
          id="description" name="description" rows={2} maxLength={500}
          value={values.description}
          onChange={(event) => setValues({ ...values, description: event.target.value })}
          placeholder="Explica cuándo resulta útil y qué se puede conseguir."
        />
      </div>
      <div className="form-field">
        <fieldset className="category-options" aria-describedby="category-selection-help" aria-required="true">
          <legend>Categorías <span>Obligatorio</span></legend>
          <p id="category-selection-help" className="field-hint">Selecciona al menos una Categoría.</p>
          <div className="category-choice-list">
            {categories.map((category) => (
              <label className="category-choice" key={category.id} htmlFor={`category-${category.id}`}>
                <input
                  id={`category-${category.id}`}
                  type="checkbox"
                  name="categoryIds"
                  value={category.id}
                  checked={values.categoryIds.includes(category.id)}
                  aria-describedby="category-selection-help"
                  onChange={(event) => setValues({
                    ...values,
                    categoryIds: event.target.checked
                      ? [...values.categoryIds, category.id]
                      : values.categoryIds.filter((id) => id !== category.id),
                  })}
                />
                <span className="category-dot" style={{ backgroundColor: category.color }} aria-hidden="true" />
                <span>{category.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="form-field">
        <label htmlFor="content">Contenido del Prompt <span>Obligatorio</span></label>
        <textarea
          className="content-input" id="content" name="content" rows={10} required maxLength={10000}
          value={values.content}
          onChange={(event) => setValues({ ...values, content: event.target.value })}
          placeholder="Escribe el texto completo que otros Usuarios podrán copiar."
          aria-describedby="content-warning"
        />
      </div>
      <p id="content-warning" className="content-warning">Todos los Usuarios podrán ver este Prompt. No incluyas secretos ni datos personales.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <Link href={returnHref} replace={Boolean(prompt)} scroll={false} className="button button-secondary" aria-disabled={pending} onNavigate={(event) => { if (pending) event.preventDefault(); }}>Cancelar</Link>
        <button className="button button-primary" disabled={pending} type="submit">
          {prompt ? pending ? "Guardando…" : "Guardar cambios" : pending ? "Publicando…" : "Publicar Prompt"}
        </button>
      </div>
    </form>
  );
}
