import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "@/app/page";
import { connection } from "next/server";

const queries = vi.hoisted(() => ({
  listPrompts: vi.fn(),
  listCategories: vi.fn(),
  getMe: vi.fn(),
}));
const container = vi.hoisted(() => vi.fn());
vi.mock("@/lib/container", () => ({ getContainer: container }));
vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const categoryId = "a0000000-0000-4000-8000-000000000001";
const prompt = {
  id: "b0000000-0000-4000-8000-000000000002",
  title: "Analiza un informe <script>alert(1)</script>",
  description: "Convierte los datos en decisiones.",
  categories: [
    { name: "Análisis", color: "#123456" },
    { name: "Marketing", color: "#654321" },
  ],
  authorName: "Ada",
  createdAt: "2026-11-10T12:00:00.000Z",
};

async function render(params: Record<string, string | string[]> = {}) {
  return renderToStaticMarkup(await Home({ searchParams: Promise.resolve(params) }));
}

describe("Promptify home", () => {
  beforeEach(() => {
    container.mockImplementation(() => ({ queries }));
    queries.listPrompts.mockResolvedValue({ ok: true, data: { items: [prompt], total: 25, page: 2, pageSize: 12 } });
    queries.listCategories.mockResolvedValue({ ok: true, data: [{ id: categoryId, name: "Análisis", color: "#123456" }] });
    queries.getMe.mockResolvedValue({ ok: true, data: { name: "Ada", isAdministrator: false } });
  });

  it("waits for a real request before initializing the database container", async () => {
    let requestReady = false;
    vi.mocked(connection).mockImplementationOnce(async () => { requestReady = true; });
    container.mockImplementationOnce(() => {
      expect(requestReady).toBe(true);
      return { queries };
    });
    await render();
  });

  it("renders real contributions as escaped text and links to their detail", async () => {
    const html = await render();
    expect(html).toContain("Promptify");
    expect(html).toContain("Biblioteca");
    expect(html).toContain("Convierte los datos");
    expect(html).toContain("Marketing");
    expect(html).toContain("Análisis");
    expect(html).toContain("Ada");
    expect(html).toContain(`/prompts/${prompt.id}`);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("Next.js logo");
    expect(html).toContain("/prompts/new");
  });

  it("passes search and Category to the backend and preserves them in pagination", async () => {
    const html = await render({ q: "informe", categoryId, page: "2" });
    expect(queries.listPrompts).toHaveBeenCalledWith({ q: "informe", categoryId, page: "2", pageSize: "12" });
    expect(html).toContain(`q=informe&amp;categoryId=${categoryId}&amp;page=3`);
    expect(html).toContain('aria-current="page"');
  });

  it("carries the filtered and paginated library URL into Prompt detail", async () => {
    const html = await render({ q: "informe", categoryId, page: "2" });
    const origin = `/?q=informe&categoryId=${categoryId}&page=2`;
    expect(html).toContain(`/prompts/${prompt.id}?from=${encodeURIComponent(origin)}`);
  });

  it("preserves the current library location when opening creation", async () => {
    const html = await render({ q: "informe", categoryId, page: "2" });
    const origin = `/?q=informe&categoryId=${categoryId}&page=2`;
    expect(html).toContain(`/prompts/new?from=${encodeURIComponent(origin)}`);
  });

  it("distinguishes no matches from an empty library", async () => {
    queries.listPrompts.mockResolvedValue({ ok: true, data: { items: [], total: 0, page: 1, pageSize: 12 } });
    expect(await render({ q: "inexistente" })).toContain("No encontramos");
    expect(await render()).toContain("El primer Prompt");
  });

  it("shows failed reads explicitly rather than an empty success state", async () => {
    queries.listPrompts.mockResolvedValue({ ok: false, error: "Something went wrong" });
    const html = await render();
    expect(html).toContain('role="alert"');
    expect(html).toContain("No pudimos");
    expect(html).not.toContain("El primer Prompt");
  });

  it("does not render a library when authentication fails", async () => {
    queries.getMe.mockResolvedValue({ ok: false, error: "Authentication required" });
    const html = await render();
    expect(html).toContain("sesión");
    expect(html).not.toContain(prompt.description);
  });

  it("does not silently accept duplicate search parameters", async () => {
    queries.listPrompts.mockResolvedValue({ ok: false, error: "Invalid input" });
    expect(await render({ q: ["a", "b"] })).toContain("filtros");
  });

  it("uses a compact working directory instead of a promotional discovery panel", async () => {
    const html = await render();
    expect(html).not.toContain("discovery-panel");
    expect(html).not.toContain("Descubre tu próxima");
    expect(html).toContain('class="prompt-list"');
    expect(html).toContain('aria-label="Filtrar por Categoría"');
    expect(html).toContain('role="status"');
  });

  it("offers logout through the Easy Auth endpoint to every User", async () => {
    const html = await render();
    expect(html).toContain('href="/.auth/logout"');
    expect(html).toContain("Cerrar sesión");
  });

  it("makes administration discoverable only for Administrators", async () => {
    expect(await render()).not.toContain('href="/administration"');
    queries.getMe.mockResolvedValue({ ok: true, data: { name: "Ada", isAdministrator: true } });
    expect(await render()).toContain('href="/administration"');
  });
});
