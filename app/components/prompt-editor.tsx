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

export async function PromptEditor({ params, searchParams, modal = false }: PromptRouteProps & { modal?: boolean }) {
  await connection();
  const { id } = await params;
  const { from } = searchParams ? await searchParams : {};
  const validFrom = from === undefined || (typeof from === "string" && (from === "/" || from.startsWith("/?")));
  const libraryHref = validFrom && typeof from === "string" ? from : "/";
  const failure = (error: string) => modal
    ? <PromptModal title={<T id="prompt.editHeading" />} libraryHref={libraryHref}><ReadError error={error} /></PromptModal>
    : <ReadError error={error} />;
  if (!validFrom) return failure("Invalid input");
  const { queries } = getContainer();
  const result = await queries.getPrompt(id);
  if (!result.ok) return failure(result.error);
  if (!result.data.canEdit) return failure("You are not allowed to do this");
  const categories = await queries.listCategories();
  if (!categories.ok) return failure(categories.error);
  const returnHref = `/prompts/${result.data.id}?from=${encodeURIComponent(libraryHref)}`;
  const content = <>
    {!modal && <h1><T id="prompt.editHeading" /></h1>}
    <p className="detail-description"><T id="prompt.editNotice" /></p>
    <PromptForm categories={categories.data} prompt={result.data} returnHref={returnHref} />
  </>;
  if (modal) return <PromptModal title={<T id="prompt.editHeading" />} libraryHref={libraryHref}>{content}</PromptModal>;
  return <div className="supporting-page">
    <header className="supporting-header"><Brand /><Link className="text-link" href={returnHref}><Icon name="back" /> <T id="prompt.backLibrary" /></Link></header>
    <main className="creation-content">
      {content}
    </main>
  </div>;
}
