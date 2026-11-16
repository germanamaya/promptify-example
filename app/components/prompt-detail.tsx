import Link from "next/link";
import { connection } from "next/server";
import { getContainer } from "@/lib/container";
import { Brand } from "@/app/components/brand";
import { Icon } from "@/app/components/ui-icon";
import { CopyPrompt } from "@/app/components/copy-prompt";
import { ReadError } from "@/app/components/read-error";
import { DeletePrompt } from "@/app/components/delete-prompt";
import { PromptModal } from "./prompt-modal";

export type PromptRouteProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function PromptDetail({ params, searchParams, modal = false }: PromptRouteProps & { modal?: boolean }) {
  await connection();
  const { from } = searchParams ? await searchParams : {};
  if (from !== undefined && (typeof from !== "string" || (from !== "/" && !from.startsWith("/?")))) {
    const error = <ReadError error="Invalid input" />;
    return modal ? <PromptModal title="Prompt" libraryHref="/">{error}</PromptModal> : error;
  }
  const libraryHref = from ?? "/";
  const { id } = await params;
  const result = await getContainer().queries.getPrompt(id);
  if (!result.ok) {
    const error = <ReadError error={result.error} />;
    return modal ? <PromptModal title="Prompt" libraryHref={libraryHref}>{error}</PromptModal> : error;
  }
  const prompt = result.data;
  const content = <>
    <div className="category-badges">
      {prompt.categories.map((category) => (
        <span className="category-badge" key={category.name}>
          <span className="category-dot" style={{ backgroundColor: category.color }} />{category.name}
        </span>
      ))}
    </div>
    {!modal && <h1>{prompt.title}</h1>}
    {prompt.description && <p className="detail-description">{prompt.description}</p>}
    <p className="detail-author">Por {prompt.authorName} <span aria-hidden="true">·</span> <time dateTime={prompt.createdAt}>{new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "UTC" }).format(new Date(prompt.createdAt))}</time></p>
    {(modal || prompt.canEdit || prompt.canDelete) && <div className="detail-actions" role="group" aria-label="Acciones del Prompt">
      {modal && <CopyPrompt content={prompt.content} iconOnly />}
      {prompt.canEdit && <Link className={`button button-secondary${modal ? " icon-button" : ""}`} replace={modal} scroll={false} aria-label="Editar Prompt" title="Editar Prompt" href={`/prompts/${prompt.id}/edit?from=${encodeURIComponent(libraryHref)}`}>{modal ? <Icon name="edit" /> : "Editar Prompt"}</Link>}
      {prompt.canDelete && <DeletePrompt id={prompt.id} title={prompt.title} libraryHref={libraryHref} iconOnly={modal} />}
    </div>}
    <div className="prompt-content-heading"><h2>El Prompt</h2>{!modal && <CopyPrompt content={prompt.content} />}</div>
    <pre className="prompt-content">{prompt.content}</pre>
    <p className="content-warning">Revisa el contenido antes de usarlo y no añadas secretos ni datos personales.</p>
  </>;
  if (modal) return <PromptModal title={prompt.title} libraryHref={libraryHref}>{content}</PromptModal>;
  return (
    <div className="supporting-page">
      <header className="supporting-header"><Brand /><Link className="text-link" href={libraryHref}><Icon name="back" /> Biblioteca</Link></header>
      <main className="detail-content">{content}</main>
    </div>
  );
}
