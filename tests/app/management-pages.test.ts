import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queries = vi.hoisted(() => ({ getMe: vi.fn(), getPrompt: vi.fn(), listCategories: vi.fn(), listUsers: vi.fn() }));
vi.mock("@/lib/container", () => ({ getContainer: () => ({ queries }) }));
vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/app/actions/prompts", () => ({ createPrompt: vi.fn(), updatePrompt: vi.fn() }));
vi.mock("@/app/actions/categories", () => ({ createCategory: vi.fn(), updateCategory: vi.fn(), deleteCategory: vi.fn() }));
vi.mock("@/app/actions/administrators", () => ({ promoteAdministrator: vi.fn(), demoteAdministrator: vi.fn() }));

describe("Management pages", () => {
  beforeEach(() => {
    queries.getMe.mockResolvedValue({ ok: true, data: { name: "Ada", isAdministrator: true } });
    queries.listCategories.mockResolvedValue({ ok: true, data: [{ id: "cat", name: "Análisis", color: "#123456" }] });
    queries.listUsers.mockResolvedValue({ ok: true, data: [
      { oid: "a0000000-0000-4000-8000-000000000001", name: "Ada", isAdministrator: true },
      { oid: "b0000000-0000-4000-8000-000000000002", name: "Bruno", isAdministrator: false },
    ] });
    queries.getPrompt.mockResolvedValue({ ok: true, data: {
      id: "id", title: "Título existente", description: "Descripción existente", content: "<b>Texto literal</b>",
      categoryIds: ["cat"], categories: [{ name: "Análisis", color: "#123456" }], canEdit: true, canDelete: true,
    } });
  });

  it("renders Category creation, editing and removal plus role management", async () => {
    const { default: Administration } = await import("@/app/administration/page");
    const html = renderToStaticMarkup(await Administration());
    for (const text of ["Administración", "Crear Categoría", "Guardar Categoría", "Eliminar Categoría", "Usuarios y roles", "Ada", "Bruno", "Usuario", "Administrador"]) {
      expect(html).toContain(text);
    }
    expect(html).toContain('<h2 id="roles-title">Usuarios y roles</h2>');
    expect(html).not.toContain("OID del Usuario");
    expect(html).not.toContain("xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx");
    expect(html).toContain('value="Análisis"');
    expect(html).toContain('value="#123456"');
  });

  it("blocks non-Administrators before reading management data", async () => {
    queries.getMe.mockResolvedValue({ ok: true, data: { name: "Ada", isAdministrator: false } });
    const { default: Administration } = await import("@/app/administration/page");
    const html = renderToStaticMarkup(await Administration());
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("Asignar rol");
    expect(queries.listCategories).not.toHaveBeenCalled();
    expect(queries.listUsers).not.toHaveBeenCalled();
  });

  it("loads existing Prompt fields for the Author without interpreting content", async () => {
    const { default: Edit } = await import("@/app/prompts/[id]/edit/page");
    const html = renderToStaticMarkup(await Edit({
      params: Promise.resolve({ id: "id" }), searchParams: Promise.resolve({ from: "/?q=informe" }),
    }));
    expect(html).toContain('value="Título existente"');
    expect(html).toContain("Descripción existente");
    expect(html).toContain("&lt;b&gt;Texto literal&lt;/b&gt;");
    expect(html).toContain("Guardar cambios");
    expect(html).toContain('/prompts/id?from=%2F%3Fq%3Dinforme');
  });

  it("blocks editing by anyone other than the Author", async () => {
    const result = await queries.getPrompt();
    queries.getPrompt.mockResolvedValue({ ...result, data: { ...result.data, canEdit: false } });
    const { default: Edit } = await import("@/app/prompts/[id]/edit/page");
    const html = renderToStaticMarkup(await Edit({ params: Promise.resolve({ id: "id" }) }));
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("Guardar cambios");
  });

  it.each(["https://example.com", "//example.com", ["/", "/?q=x"]].map((from) => ({ from })))("rejects unsafe edit return locations: %j", async ({ from }) => {
    const { default: Edit } = await import("@/app/prompts/[id]/edit/page");
    const html = renderToStaticMarkup(await Edit({
      params: Promise.resolve({ id: "id" }), searchParams: Promise.resolve({ from }),
    }));
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("Guardar cambios");
  });

  it("uses the same Category name limit as the server schema", async () => {
    const { default: Administration } = await import("@/app/administration/page");
    const html = renderToStaticMarkup(await Administration());
    expect(html).toContain('maxLength="50"');
    expect(html).not.toContain('maxLength="80"');
  });

  it.each(["@/app/administration/loading", "@/app/prompts/[id]/edit/loading"])("provides an immediate loading boundary for %s", async (path) => {
    const { default: Loading } = await import(path);
    expect(renderToStaticMarkup(createElement(Loading))).toContain('aria-busy="true"');
  });
});
