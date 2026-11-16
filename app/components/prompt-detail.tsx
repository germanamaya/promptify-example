import Link from "next/link";
import { connection } from "next/server";
import { getContainer } from "@/lib/container";
import { Brand } from "@/app/components/brand";
import { Icon } from "@/app/components/ui-icon";
import { CopyPrompt } from "@/app/components/copy-prompt";
import { ReadError } from "@/app/components/read-error";
import { DeletePrompt } from "@/app/components/delete-prompt";
import { PromptModal } from "./prompt-modal";
import { T } from "./locale-provider";
import { EditPromptLink, PromptActions } from "./prompt-actions";

export type PromptRouteProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function PromptDetail({ params, searchParams, modal = false }: PromptRouteProps & { modal?: boolean }) {
  await connection();
  const { from } = searchParams ? await searchParams : {};
  if (from !== undefined && (typeof from !== "string" || (from !== "/" && !from.startsWith("/?")))) {
    const error = <ReadError error="Invalid input" />;
    return modal ? <PromptModal title={<T id="library.columnPrompt" />} libraryHref="/">{error}</PromptModal> : error;
  }
  const libraryHref = from ?? "/";
  const { id } = await params;
  const result = await getContainer().queries.getPrompt(id);
  if (!result.ok) {
    const error = <ReadError error={result.error} />;
    return modal ? <PromptModal title={<T id="library.columnPrompt" />} libraryHref={libraryHref}>{error}</PromptModal> : error;
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
    <p className="detail-author"><T id="prompt.detailAuthor" values={{ name: prompt.authorName }} /> <span aria-hidden="true">·</span> <time dateTime={prompt.createdAt}>{new Intl.DateTimeFormat("es-ES", { dateStyle: "long", timeZone: "UTC" }).format(new Date(prompt.createdAt))}</time></p>
    {(modal || prompt.canEdit || prompt.canDelete) && <PromptActions>
      {modal && <CopyPrompt content={prompt.content} iconOnly />}
      {prompt.canEdit && <EditPromptLink modal={modal} href={`/prompts/${prompt.id}/edit?from=${encodeURIComponent(libraryHref)}`} />}
      {prompt.canDelete && <DeletePrompt id={prompt.id} title={prompt.title} libraryHref={libraryHref} iconOnly={modal} />}
    </PromptActions>}
    <div className="prompt-content-heading"><h2><T id="prompt.bodyHeading" /></h2>{!modal && <CopyPrompt content={prompt.content} />}</div>
    <pre className="prompt-content">{prompt.content}</pre>
    <p className="content-warning"><T id="prompt.reviewNotice" /></p>
  </>;
  if (modal) return <PromptModal title={prompt.title} libraryHref={libraryHref}>{content}</PromptModal>;
  return (
    <div className="supporting-page">
      <header className="supporting-header"><Brand /><Link className="text-link" href={libraryHref}><Icon name="back" /> <T id="nav.library" /></Link></header>
      <main className="detail-content">{content}</main>
    </div>
  );
}
