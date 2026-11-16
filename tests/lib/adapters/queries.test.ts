import { beforeEach, describe, expect, it } from "vitest";
import { createActionRunner } from "@/lib/adapters/run-action";
import { createQueries } from "@/lib/adapters/queries";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import type { Principal } from "@/lib/identity/principal";
import { resolveUser } from "@/lib/identity/resolve-user";
import { AdministratorService } from "@/lib/services/administrator-service";
import { CategoryService } from "@/lib/services/category-service";
import { PromptService } from "@/lib/services/prompt-service";
import { createFakeRepositories } from "../../fakes/repositories";

const ada = { oid: "a0000000-0000-4000-8000-000000000001", name: "Ada" };
const bob = { oid: "b0000000-0000-4000-8000-000000000002", name: "Bob" };
const root = { oid: "c0000000-0000-4000-8000-000000000003", name: "Root" };

describe("queries", () => {
  let repos: ReturnType<typeof createFakeRepositories>;
  let principal: Principal | Error;
  let queries: ReturnType<typeof createQueries>;
  let categoryId: string;

  beforeEach(() => {
    repos = createFakeRepositories();
    repos.db.seedUser({ oid: ada.oid, displayName: ada.name });
    repos.db.seedUser({ oid: bob.oid, displayName: bob.name });
    repos.db.seedUser({ oid: root.oid, displayName: root.name, isAdministrator: true });
    categoryId = repos.db.seedCategory({ name: "General", color: "#112233" }).id;
    principal = ada;

    queries = createQueries({
      run: createActionRunner({
        readPrincipal: async () => {
          if (principal instanceof Error) throw principal;
          return principal;
        },
        resolveUser: (p) => resolveUser(repos.users, p),
      }),
      services: {
        prompts: new PromptService({ prompts: repos.prompts, categories: repos.categories }),
        categories: new CategoryService({ categories: repos.categories }),
        administrators: new AdministratorService({
          users: repos.users,
          audit: { recordAdministratorAssigned: async () => {} },
          now: () => new Date(),
        }),
      },
    });
  });

  it("lists Prompts with a per-screen DTO that hides oids and roles", async () => {
    repos.db.seedPrompt({ categoryId, authorOid: bob.oid, title: "Hello", content: "Body" });

    const result = await queries.listPrompts({});

    expect(result).toMatchObject({ ok: true, data: { total: 1, page: 1, pageSize: 20 } });
    const [item] = (result as { data: { items: Record<string, unknown>[] } }).data.items;
    expect(item).toMatchObject({ title: "Hello", authorName: "Bob", categories: [{ name: "General", color: "#112233" }] });
    expect(JSON.stringify(item)).not.toContain(bob.oid);
    expect(item).not.toHaveProperty("content");
    expect(item).not.toHaveProperty("authorOid");
  });

  it("returns all associated Categories in the Prompt list DTO", async () => {
    const secondCategory = repos.db.seedCategory({ name: "Other", color: "#445566" });
    await repos.prompts.create({
      title: "Multi-category",
      content: "Body",
      categoryIds: [categoryId, secondCategory.id],
      authorOid: bob.oid,
    } as never);

    const result = await queries.listPrompts({});

    expect(result).toMatchObject({
      ok: true,
      data: { items: [{ categories: [{ name: "General" }, { name: "Other" }] }] },
    });
  });

  it("validates pagination and filters from raw search params", async () => {
    expect(await queries.listPrompts({ pageSize: "500" })).toEqual({ ok: false, error: "Invalid input" });
    expect(await queries.listPrompts({ categoryId: "x" })).toEqual({ ok: false, error: "Invalid input" });
    expect((await queries.listPrompts({ page: "1", pageSize: "10", categoryId })).ok).toBe(true);
  });

  it("answers an unknown Category filter as invalid input", async () => {
    const result = await queries.listPrompts({ categoryId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301" });

    expect(result).toEqual({ ok: false, error: "Unknown Category" });
  });

  it("searches the whole library before pagination and combines search with Category", async () => {
    const otherCategory = repos.db.seedCategory({ name: "Other" });
    for (let i = 0; i < 13; i++) {
      repos.db.seedPrompt({ categoryId, authorOid: ada.oid, title: `Informe ${i}` });
    }
    repos.db.seedPrompt({ categoryId, authorOid: ada.oid, title: "Unrelated" });
    repos.db.seedPrompt({ categoryId: otherCategory.id, authorOid: ada.oid, title: "Informe elsewhere" });

    const result = await queries.listPrompts({ q: "  informe  ", categoryId, page: "2", pageSize: "12" });

    expect(result).toMatchObject({ ok: true, data: { total: 13, page: 2, items: [expect.objectContaining({ title: expect.stringContaining("Informe") })] } });
  });

  it("matches descriptions and content, not just titles", async () => {
    repos.db.seedPrompt({ categoryId, authorOid: ada.oid, title: "A", description: "Informe de ventas" });
    repos.db.seedPrompt({ categoryId, authorOid: ada.oid, title: "B", content: "Prepara un informe" });
    repos.db.seedPrompt({ categoryId, authorOid: ada.oid, title: "C" });

    expect(await queries.listPrompts({ q: "informe" })).toMatchObject({ ok: true, data: { total: 2 } });
  });

  it("validates repeated and oversized searches while treating whitespace as no search", async () => {
    expect(await queries.listPrompts({ q: ["one", "two"] })).toEqual({ ok: false, error: "Invalid input" });
    expect(await queries.listPrompts({ q: "x".repeat(201) })).toEqual({ ok: false, error: "Invalid input" });
    expect(await queries.listPrompts({ q: "   " })).toMatchObject({ ok: true });
  });

  it("accepts an unselected Category from the mobile filter form", async () => {
    expect(await queries.listPrompts({ categoryId: "", q: "" })).toMatchObject({ ok: true });
  });

  it("gets a Prompt with edit and delete capabilities for the viewer", async () => {
    const prompt = repos.db.seedPrompt({ categoryId, authorOid: ada.oid, content: "Body" });

    const asAuthor = await queries.getPrompt(prompt.id);
    expect(asAuthor).toMatchObject({ ok: true, data: { content: "Body", canEdit: true, canDelete: true } });

    principal = bob;
    const asOther = await queries.getPrompt(prompt.id);
    expect(asOther).toMatchObject({ ok: true, data: { canEdit: false, canDelete: false } });

    principal = root;
    const asAdmin = await queries.getPrompt(prompt.id);
    expect(asAdmin).toMatchObject({ ok: true, data: { canEdit: false, canDelete: true } });
    expect(JSON.stringify(asAdmin)).not.toContain(ada.oid);
  });

  it("rejects an invalid or unknown Prompt id", async () => {
    expect(await queries.getPrompt("nope")).toEqual({ ok: false, error: "Invalid input" });
    expect(await queries.getPrompt("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toEqual({
      ok: false,
      error: "Prompt not found",
    });
  });

  it("lists Categories", async () => {
    const result = await queries.listCategories();

    expect(result).toEqual({ ok: true, data: [{ id: categoryId, name: "General", color: "#112233" }] });
  });

  it("lists Users with their role only for Administrators", async () => {
    principal = root;

    expect(await queries.listUsers()).toEqual({
      ok: true,
      data: [
        { oid: ada.oid, name: "Ada", isAdministrator: false },
        { oid: bob.oid, name: "Bob", isAdministrator: false },
        { oid: root.oid, name: "Root", isAdministrator: true },
      ],
    });

    principal = ada;
    expect(await queries.listUsers()).toEqual({ ok: false, error: "You are not allowed to do this" });
  });

  it("returns the current User", async () => {
    principal = root;

    expect(await queries.getMe()).toEqual({ ok: true, data: { name: "Root", isAdministrator: true } });
  });

  it("rejects repeated or non-object search params", async () => {
    expect(await queries.listPrompts({ page: ["1", "2"] })).toEqual({ ok: false, error: "Invalid input" });
    expect(await queries.listPrompts(null)).toEqual({ ok: false, error: "Invalid input" });
    expect(await queries.listPrompts("page=1")).toEqual({ ok: false, error: "Invalid input" });
  });

  it("requires authentication for every read", async () => {
    principal = new UnauthenticatedError();

    expect(await queries.getMe()).toEqual({ ok: false, error: "Authentication required" });
    expect(await queries.listCategories()).toEqual({ ok: false, error: "Authentication required" });
    expect(await queries.listPrompts({})).toEqual({ ok: false, error: "Authentication required" });
    expect(await queries.getPrompt("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toEqual({
      ok: false,
      error: "Authentication required",
    });
  });

  it("rejects non-member principals on every read", async () => {
    principal = new ForbiddenError();
    const forbidden = { ok: false, error: "You are not allowed to do this" };

    expect(await queries.getMe()).toEqual(forbidden);
    expect(await queries.listCategories()).toEqual(forbidden);
    expect(await queries.listPrompts({})).toEqual(forbidden);
    expect(await queries.getPrompt("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toEqual(forbidden);
  });
});
