import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queries = vi.hoisted(() => ({ getPrompt: vi.fn(), getMe: vi.fn(), listCategories: vi.fn() }));
vi.mock("@/lib/container", () => ({ getContainer: () => ({ queries }) }));
vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/app/actions/prompts", () => ({ createPrompt: vi.fn(), updatePrompt: vi.fn(), deletePrompt: vi.fn() }));

const props = () => ({
  params: Promise.resolve({ id: "id" }),
  searchParams: Promise.resolve({ from: "/?q=informe&categoryId=cat&page=2" }),
});

describe("URL-backed Prompt modals", () => {
  beforeEach(() => {
    queries.getMe.mockResolvedValue({ ok: true, data: { name: "Ada" } });
    queries.getPrompt.mockResolvedValue({ ok: true, data: {
      id: "id", title: "Un Prompt", content: "<b>Texto literal</b>", description: "Descripción",
      categoryIds: ["cat"], categories: [{ name: "Análisis", color: "#123456" }], authorName: "Ada",
      createdAt: "2026-11-10T12:00:00Z", canEdit: true, canDelete: true,
    } });
    queries.listCategories.mockResolvedValue({ ok: true, data: [{ id: "cat", name: "Análisis", color: "#123456" }] });
  });

  it("reserves /prompts/new for creation instead of reading new as a Prompt id", async () => {
    const { default: Create } = await import("@/app/@modal/(.)prompts/new/page");
    const html = renderToStaticMarkup(await Create({ searchParams: props().searchParams }));
    expect(html).toContain('<dialog');
    expect(html).toContain("Crear Prompt");
    expect(html).toContain("Publicar Prompt");
    expect(queries.getMe).toHaveBeenCalled();
    expect(queries.getPrompt).not.toHaveBeenCalled();
    expect(html).toContain('href="/?q=informe&amp;categoryId=cat&amp;page=2"');
  });

  it("does not offer creation when authentication fails", async () => {
    queries.getMe.mockResolvedValue({ ok: false, error: "Authentication required" });
    const { default: Create } = await import("@/app/@modal/(.)prompts/new/page");
    const html = renderToStaticMarkup(await Create({}));
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("Publicar Prompt");
  });

  it("explains missing Categories inside creation instead of showing an unusable form", async () => {
    queries.listCategories.mockResolvedValue({ ok: true, data: [] });
    const { default: Create } = await import("@/app/@modal/(.)prompts/new/page");
    const html = renderToStaticMarkup(await Create({}));
    expect(html).toContain('<dialog');
    expect(html).toContain("Necesitamos una Categoría");
    expect(html).not.toContain("Publicar Prompt");
  });

  it("provides a streaming loading boundary for the parallel modal slot", async () => {
    const { default: Loading } = await import("@/app/@modal/loading");
    const html = renderToStaticMarkup(Loading());
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('role="status"');
  });

  it("opens authorized detail inside a named dialog with accessible icon actions", async () => {
    const { default: Detail } = await import("@/app/@modal/(.)prompts/[id]/page");
    const html = renderToStaticMarkup(await Detail(props()));
    expect(queries.getPrompt).toHaveBeenCalledWith("id");
    expect(html).toContain('<dialog');
    expect(html).toContain('aria-labelledby="prompt-modal-title"');
    expect(html).toContain('id="prompt-modal-title"');
    expect(html).toContain('aria-label="Cerrar Prompt"');
    for (const action of ["Copiar Prompt", "Editar Prompt", "Eliminar Prompt"]) {
      expect(html).toContain(`aria-label="${action}"`);
      expect(html).toContain(`title="${action}"`);
    }
    expect(html).toContain("&lt;b&gt;Texto literal&lt;/b&gt;");
    expect(html).not.toContain("<b>Texto literal</b>");
    expect(html).not.toContain('class="supporting-page"');
    expect(html).toContain('/prompts/id/edit?from=%2F%3Fq%3Dinforme%26categoryId%3Dcat%26page%3D2');
  });

  it("does not expose edit or delete actions when server permissions forbid them", async () => {
    const result = await queries.getPrompt();
    queries.getPrompt.mockResolvedValue({ ...result, data: { ...result.data, canEdit: false, canDelete: false } });
    const { default: Detail } = await import("@/app/@modal/(.)prompts/[id]/page");
    const html = renderToStaticMarkup(await Detail(props()));
    expect(html).not.toContain('aria-label="Editar Prompt"');
    expect(html).not.toContain('aria-label="Eliminar Prompt"');
  });

  it("edits existing values in the dialog and keeps the originating library URL", async () => {
    const { default: Edit } = await import("@/app/@modal/(.)prompts/[id]/edit/page");
    const html = renderToStaticMarkup(await Edit(props()));
    expect(html).toContain('<dialog');
    expect(html).toContain('id="prompt-modal-title"');
    expect(html).toContain('value="Un Prompt"');
    expect(html).toContain("&lt;b&gt;Texto literal&lt;/b&gt;");
    expect(html).toContain("Guardar cambios");
    expect(html).toContain('name="categoryIds"');
    expect(html).toContain('name="categoryIds" checked="" value="cat"');
    expect(html).toContain('/prompts/id?from=%2F%3Fq%3Dinforme%26categoryId%3Dcat%26page%3D2');
    expect(html).not.toContain('class="supporting-page"');
  });

  it("checks edit permission before reading Categories or exposing the form", async () => {
    const result = await queries.getPrompt();
    queries.getPrompt.mockResolvedValue({ ...result, data: { ...result.data, canEdit: false } });
    const { default: Edit } = await import("@/app/@modal/(.)prompts/[id]/edit/page");
    const html = renderToStaticMarkup(await Edit(props()));
    expect(html).toContain('<dialog');
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("Guardar cambios");
    expect(queries.listCategories).not.toHaveBeenCalled();
  });

  it("keeps missing-Prompt errors dismissible inside the modal", async () => {
    queries.getPrompt.mockResolvedValue({ ok: false, error: "Prompt not found" });
    const { default: Detail } = await import("@/app/@modal/(.)prompts/[id]/page");
    const html = renderToStaticMarkup(await Detail(props()));
    expect(html).toContain('<dialog');
    expect(html).toContain('aria-label="Cerrar Prompt"');
    expect(html).toContain('role="alert"');
  });

  it.each(["https://example.com", "//example.com", ["/", "/?q=x"]].map((from) => ({ from })))(
    "rejects unsafe return locations before modal data access: %j", async ({ from }) => {
      const { default: Detail } = await import("@/app/@modal/(.)prompts/[id]/page");
      const html = renderToStaticMarkup(await Detail({ params: props().params, searchParams: Promise.resolve({ from }) }));
      expect(html).toContain('role="alert"');
      expect(queries.getPrompt).not.toHaveBeenCalled();
    },
  );

  it("clears the modal slot on library and unrelated navigations or direct loads", async () => {
    for (const path of ["@/app/@modal/page", "@/app/@modal/default", "@/app/@modal/[...catchAll]/page"]) {
      const { default: Empty } = await import(path);
      expect(Empty()).toBeNull();
    }
  });
});
