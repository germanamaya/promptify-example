import Link from "next/link";
import { connection } from "next/server";
import { getContainer } from "@/lib/container";
import { Brand } from "@/app/components/brand";
import { Icon } from "@/app/components/ui-icon";
import { PromptForm } from "@/app/components/prompt-form";
import { ReadError } from "@/app/components/read-error";
import { PromptModal } from "./prompt-modal";
import type { PromptRouteProps } from "./prompt-detail";
import { T } from "./locale-provider";

export async function PromptCreator({ searchParams, modal = false }: Pick<PromptRouteProps, "searchParams"> & { modal?: boolean } = {}) {
  await connection();
  const { from } = searchParams ? await searchParams : {};
  const validFrom = from === undefined || (typeof from === "string" && (from === "/" || from.startsWith("/?")));
  const libraryHref = validFrom && typeof from === "string" ? from : "/";
  const failure = (error: string) => modal
    ? <PromptModal title={<T id="library.create" />} libraryHref={libraryHref}><ReadError error={error} /></PromptModal>
    : <ReadError error={error} />;
  if (!validFrom) return failure("Invalid input");
  const { queries } = getContainer();
  const [me, categories] = await Promise.all([queries.getMe(), queries.listCategories()]);
  if (!me.ok) return failure(me.error);
  if (!categories.ok) return failure(categories.error);
  const content = <>
    {!modal && <h1><T id="prompt.createHeading" /></h1>}
    <p className="detail-description"><T id="prompt.createTagline" /></p>
    {categories.data.length > 0
      ? <PromptForm categories={categories.data} returnHref={libraryHref} />
      : <section className="empty-state"><h2><T id="prompt.noCategoryTitle" /></h2><p><T id="prompt.noCategoryDescription" /></p><Link className="button button-secondary" href={libraryHref} scroll={false}><T id="prompt.backLibrary" /></Link></section>}
  </>;
  if (modal) return <PromptModal title={<T id="library.create" />} libraryHref={libraryHref}>{content}</PromptModal>;
  return (
    <div className="supporting-page">
      <header className="supporting-header"><Brand /><Link className="text-link" href={libraryHref}><Icon name="back" /> <T id="nav.library" /></Link></header>
      <main className="creation-content">{content}</main>
    </div>
  );
}
