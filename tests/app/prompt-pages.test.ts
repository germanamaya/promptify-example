import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Detail from "@/app/prompts/[id]/page";
import NewPrompt from "@/app/prompts/new/page";

const queries = vi.hoisted(() => ({ getPrompt: vi.fn(), getMe: vi.fn(), listCategories: vi.fn() }));
vi.mock("@/lib/container", () => ({ getContainer: () => ({ queries }) }));
vi.mock("@/app/actions/prompts", () => ({ createPrompt: vi.fn(), updatePrompt: vi.fn(), deletePrompt: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));

describe("Prompt supporting flows", () => {
  beforeEach(() => {
    queries.getMe.mockResolvedValue({ ok: true, data: { name: "Ada", isAdministrator: false } });
    queries.listCategories.mockResolvedValue({ ok: true, data: [{ id: "cat", name: "Análisis", color: "#123456" }] });
    queries.getPrompt.mockResolvedValue({
      ok: true,
      data: { id: "id", title: "Un Prompt", content: "<b>Texto literal</b>\nSegunda línea", description: null, categoryIds: ["cat"], categories: [{ name: "Análisis", color: "#123456" }], authorName: "Ada", createdAt: "2026-11-10T12:00:00Z", updatedAt: "2026-11-10T12:00:00Z", canEdit: false, canDelete: false },
    });
  });

  it("opens real Prompt content as plain text with a copy action", async () => {
    const html = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: "id" }) }));
    expect(queries.getPrompt).toHaveBeenCalledWith("id");
    expect(html).toContain("&lt;b&gt;Texto literal&lt;/b&gt;");
    expect(html).toContain("Copiar Prompt");
    expect(html).not.toContain("<b>Texto literal</b>");
    expect(html).not.toContain("Editar Prompt");
    expect(html).not.toContain("Eliminar Prompt");
  });

  it("renders every Category on the Prompt detail", async () => {
    const result = await queries.getPrompt();
    queries.getPrompt.mockResolvedValue({
      ...result,
      data: {
        ...result.data,
        categories: [
          { name: "Análisis", color: "#123456" },
          { name: "Marketing", color: "#654321" },
        ],
      },
    });

    const html = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: "id" }) }));

    expect(html).toContain("Análisis");
    expect(html).toContain("Marketing");
  });

  it("exposes edit and delete for the Author and preserves the return location", async () => {
    const result = await queries.getPrompt();
    queries.getPrompt.mockResolvedValue({ ...result, data: { ...result.data, canEdit: true, canDelete: true } });
    const html = renderToStaticMarkup(await Detail({
      params: Promise.resolve({ id: "id" }),
      searchParams: Promise.resolve({ from: "/?q=informe&page=2" }),
    }));
    expect(html).toContain('/prompts/id/edit?from=%2F%3Fq%3Dinforme%26page%3D2');
    expect(html).toContain("Editar Prompt");
    expect(html).toContain("Eliminar Prompt");
  });

  it("allows an Administrator to delete but not edit another Author's Prompt", async () => {
    const result = await queries.getPrompt();
    queries.getPrompt.mockResolvedValue({ ...result, data: { ...result.data, canDelete: true } });
    const html = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: "id" }) }));
    expect(html).not.toContain("Editar Prompt");
    expect(html).toContain("Eliminar Prompt");
  });

  it("returns explicitly to the originating library filters and page", async () => {
    const html = renderToStaticMarkup(await Detail({
      params: Promise.resolve({ id: "id" }),
      searchParams: Promise.resolve({ from: "/?q=informe&categoryId=category&page=2" }),
    }));
    expect(html).toContain('href="/?q=informe&amp;categoryId=category&amp;page=2"');
  });

  it.each(["https://example.com", "//example.com", "javascript:alert(1)", ["/", "/?q=a"]].map((from) => ({ from })))(
    "rejects an invalid or repeated return URL: %j",
    async ({ from }) => {
      const html = renderToStaticMarkup(await Detail({
        params: Promise.resolve({ id: "id" }),
        searchParams: Promise.resolve({ from }),
      }));
      expect(html).toContain('role="alert"');
      expect(html).toContain("filtros");
    },
  );

  it("renders the creation fields and sensitive-data warning", async () => {
    const html = renderToStaticMarkup(await NewPrompt());
    for (const field of ["title", "description", "categoryIds", "content"]) {
      expect(html).toContain(`name="${field}"`);
    }
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("secretos");
    expect(html).toContain("datos personales");
    expect(html).toContain("Publicar Prompt");
  });

  it("explains that a Category is required instead of offering a broken form", async () => {
    queries.listCategories.mockResolvedValue({ ok: true, data: [] });
    const html = renderToStaticMarkup(await NewPrompt());
    expect(html).toContain("Administrador");
    expect(html).not.toContain("Publicar Prompt");
  });
});
