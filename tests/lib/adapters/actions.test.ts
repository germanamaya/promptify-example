import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { createActions } from "@/lib/adapters/actions";
import { createActionRunner } from "@/lib/adapters/run-action";
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
const missingId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

describe("actions", () => {
  let repos: ReturnType<typeof createFakeRepositories>;
  let principal: Principal | Error;
  let revalidate: Mock<() => void>;
  let actions: ReturnType<typeof createActions>;
  let categoryId: string;
  const events: unknown[] = [];

  beforeEach(() => {
    repos = createFakeRepositories();
    repos.db.seedUser({ oid: root.oid, displayName: root.name, isAdministrator: true });
    categoryId = repos.db.seedCategory({ name: "General" }).id;
    principal = ada;
    revalidate = vi.fn<() => void>();
    events.length = 0;

    const run = createActionRunner({
      readPrincipal: async () => {
        if (principal instanceof Error) throw principal;
        return principal;
      },
      resolveUser: (p) => resolveUser(repos.users, p),
    });
    actions = createActions({
      run,
      revalidate,
      users: repos.users,
      services: {
        prompts: new PromptService({ prompts: repos.prompts, categories: repos.categories }),
        categories: new CategoryService({ categories: repos.categories }),
        administrators: new AdministratorService({
          users: repos.users,
          audit: { recordAdministratorAssigned: async (event) => void events.push(event) },
          now: () => new Date(),
        }),
      },
    });
  });

  describe("entry point order", () => {
    it("rejects a missing principal without touching the database", async () => {
      principal = new UnauthenticatedError();

      const result = await actions.createPrompt(form({ title: "T", content: "C", categoryIds: categoryId }));

      expect(result).toEqual({ ok: false, error: "Authentication required" });
      expect(repos.db.users.has(ada.oid)).toBe(false);
    });

    it("answers a non-member with a forbidden message", async () => {
      principal = new ForbiddenError();

      const result = await actions.createPrompt(form({ title: "T", content: "C", categoryIds: categoryId }));

      expect(result).toEqual({ ok: false, error: "You are not allowed to do this" });
    });

    it("validates input before the User is upserted", async () => {
      const result = await actions.createPrompt(form({ title: "", content: "C", categoryIds: categoryId }));

      expect(result).toEqual({ ok: false, error: "Invalid input" });
      expect(repos.db.users.has(ada.oid)).toBe(false);
    });

    it("requires at least one Category before the User is upserted", async () => {
      const result = await actions.createPrompt(form({ title: "T", content: "C" }));

      expect(result).toEqual({ ok: false, error: "Invalid input" });
      expect(repos.db.users.has(ada.oid)).toBe(false);
    });
  });

  describe("input handling", () => {
    it("rejects arguments that are not FormData", async () => {
      const result = await actions.createPrompt({ title: "T", content: "C", categoryIds: [categoryId] } as never);

      expect(result).toEqual({ ok: false, error: "Invalid input" });
    });

    describe("language preference", () => {
      it("stores the selected language for the authenticated User and revalidates", async () => {
        const result = await actions.setUserLanguage("pt-PT");

        expect(result).toEqual({ ok: true, data: undefined });
        expect(repos.db.users.get(ada.oid)?.language).toBe("pt-PT");
        expect(revalidate).toHaveBeenCalled();
      });

      it("rejects unsupported languages before upserting the User", async () => {
        const result = await actions.setUserLanguage("fr");

        expect(result).toEqual({ ok: false, error: "Invalid input" });
        expect(repos.db.users.has(ada.oid)).toBe(false);
      });

      it("rejects an unauthenticated language change without writing", async () => {
        principal = new UnauthenticatedError();

        const result = await actions.setUserLanguage("es");

        expect(result).toEqual({ ok: false, error: "Authentication required" });
        expect(repos.db.users.has(ada.oid)).toBe(false);
        expect(revalidate).not.toHaveBeenCalled();
      });
    });

    it("rejects repeated fields", async () => {
      const data = form({ title: "T", content: "C", categoryIds: categoryId });
      data.append("title", "Another");

      expect(await actions.createPrompt(data)).toEqual({ ok: false, error: "Invalid input" });
    });

    it("rejects file uploads in place of text", async () => {
      const data = form({ content: "C", categoryIds: categoryId });
      data.append("title", new File(["x"], "x.txt"));

      expect(await actions.createPrompt(data)).toEqual({ ok: false, error: "Invalid input" });
    });

    it("rejects ids that are not uuids", async () => {
      expect(await actions.deletePrompt("1 OR 1=1")).toEqual({ ok: false, error: "Invalid input" });
      expect(await actions.deletePrompt(42 as never)).toEqual({ ok: false, error: "Invalid input" });
    });

    it("treats an empty description as absent", async () => {
      const result = await actions.createPrompt(form({ title: "T", content: "C", categoryIds: categoryId, description: "" }));

      expect(result.ok).toBe(true);
      expect([...repos.db.prompts.values()][0].description).toBeNull();
    });
  });

  describe("prompts", () => {
    it("accepts repeated Category fields and associates all selected Categories", async () => {
      const secondCategoryId = repos.db.seedCategory({ name: "Other" }).id;
      const data = form({ title: "T", content: "C" });
      data.append("categoryIds", categoryId);
      data.append("categoryIds", secondCategoryId);

      const result = await actions.createPrompt(data);

      expect(result.ok).toBe(true);
      expect([...repos.db.prompts.values()][0]).toMatchObject({
        categoryIds: [categoryId, secondCategoryId],
      });
    });

    it("creates a Prompt authored by the authenticated User and revalidates", async () => {
      const result = await actions.createPrompt(form({ title: "T", content: "C", categoryIds: categoryId }));

      expect(result.ok).toBe(true);
      const stored = [...repos.db.prompts.values()];
      expect(stored).toHaveLength(1);
      expect(stored[0].authorOid).toBe(ada.oid);
      expect(revalidate).toHaveBeenCalled();
    });

    it("ignores authorship and role fields sent by the client", async () => {
      const result = await actions.createPrompt(
        form({ title: "T", content: "C", categoryIds: categoryId, authorOid: bob.oid, isAdministrator: "true" }),
      );

      expect(result.ok).toBe(true);
      expect([...repos.db.prompts.values()][0].authorOid).toBe(ada.oid);
      expect(repos.db.users.get(ada.oid)?.isAdministrator).toBe(false);
    });

    it("lets the Author edit", async () => {
      const stored = repos.db.seedUser({ oid: ada.oid, displayName: ada.name });
      const prompt = repos.db.seedPrompt({ categoryId, authorOid: stored.oid, title: "Old" });

      const result = await actions.updatePrompt(prompt.id, form({ title: "New", content: "C", categoryIds: categoryId }));

      expect(result.ok).toBe(true);
      expect(repos.db.prompts.get(prompt.id)?.title).toBe("New");
    });

    it("blocks editing someone else's Prompt by id (IDOR)", async () => {
      repos.db.seedUser({ oid: bob.oid, displayName: bob.name });
      const prompt = repos.db.seedPrompt({ categoryId, authorOid: bob.oid, title: "Bob's" });

      const result = await actions.updatePrompt(prompt.id, form({ title: "Mine now", content: "C", categoryIds: categoryId }));

      expect(result).toEqual({ ok: false, error: "You are not allowed to do this" });
      expect(repos.db.prompts.get(prompt.id)?.title).toBe("Bob's");
      expect(revalidate).not.toHaveBeenCalled();
    });

    it("blocks deleting someone else's Prompt by id (IDOR)", async () => {
      repos.db.seedUser({ oid: bob.oid, displayName: bob.name });
      const prompt = repos.db.seedPrompt({ categoryId, authorOid: bob.oid });

      const result = await actions.deletePrompt(prompt.id);

      expect(result).toEqual({ ok: false, error: "You are not allowed to do this" });
      expect(repos.db.prompts.has(prompt.id)).toBe(true);
    });

    it("lets an Administrator delete someone else's Prompt", async () => {
      principal = root;
      repos.db.seedUser({ oid: bob.oid, displayName: bob.name });
      const prompt = repos.db.seedPrompt({ categoryId, authorOid: bob.oid });

      const result = await actions.deletePrompt(prompt.id);

      expect(result.ok).toBe(true);
      expect(repos.db.prompts.has(prompt.id)).toBe(false);
    });

    it("answers NotFound for a missing Prompt", async () => {
      expect(await actions.deletePrompt(missingId)).toEqual({ ok: false, error: "Prompt not found" });
    });
  });

  describe("categories", () => {
    it("forbids a plain User even if the client claims to be an Administrator", async () => {
      const result = await actions.createCategory(form({ name: "X", color: "#112233", isAdministrator: "true" }));

      expect(result).toEqual({ ok: false, error: "You are not allowed to do this" });
      expect(repos.db.categories.size).toBe(1);
    });

    it("lets an Administrator create, edit and delete", async () => {
      principal = root;

      expect(await actions.createCategory(form({ name: "Sales", color: "#112233" }))).toEqual({
        ok: true,
        data: { id: expect.any(String) },
      });
      const created = [...repos.db.categories.values()].find((c) => c.name === "Sales")!;
      expect(await actions.updateCategory(created.id, form({ name: "Sales2", color: "#112233" }))).toEqual({
        ok: true,
        data: undefined,
      });
      expect(repos.db.categories.get(created.id)?.name).toBe("Sales2");
      expect(await actions.deleteCategory(created.id)).toEqual({ ok: true, data: undefined });
      expect(repos.db.categories.has(created.id)).toBe(false);
    });

    it("translates Conflict when the Category still has Prompts", async () => {
      principal = root;
      repos.db.seedUser({ oid: bob.oid, displayName: bob.name });
      repos.db.seedPrompt({ categoryId, authorOid: bob.oid });

      expect(await actions.deleteCategory(categoryId)).toEqual({ ok: false, error: "Category has Prompts" });
    });
  });

  describe("administrators", () => {
    it("lets an Administrator promote an existing User and records the audit event", async () => {
      principal = root;
      repos.db.seedUser({ oid: bob.oid, displayName: bob.name });

      const result = await actions.promoteAdministrator(bob.oid);

      expect(result.ok).toBe(true);
      expect(repos.db.users.get(bob.oid)?.isAdministrator).toBe(true);
      expect(events).toEqual([
        { actorOid: root.oid, action: "administrator.assigned", targetId: bob.oid, timestamp: expect.any(Date) },
      ]);
      expect(revalidate).toHaveBeenCalled();
    });

    it("forbids a plain User from promoting themselves", async () => {
      const result = await actions.promoteAdministrator(ada.oid);

      expect(result).toEqual({ ok: false, error: "You are not allowed to do this" });
      expect(repos.db.users.get(ada.oid)?.isAdministrator).toBe(false);
    });

    it("refuses an invalid oid", async () => {
      principal = root;

      expect(await actions.promoteAdministrator("nope")).toEqual({ ok: false, error: "Invalid input" });
    });

    it("refuses to demote the last Administrator", async () => {
      principal = root;

      const result = await actions.demoteAdministrator(root.oid);

      expect(result).toEqual({ ok: false, error: "The last Administrator cannot be demoted" });
      expect(repos.db.users.get(root.oid)?.isAdministrator).toBe(true);
    });
  });

  describe("error translation", () => {
    it("hides unexpected errors behind a generic message", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      principal = new Error("connection string password=hunter2");

      const result = await actions.createPrompt(form({ title: "T", content: "C", categoryIds: categoryId }));

      expect(result).toEqual({ ok: false, error: "Something went wrong" });
      expect(spy.mock.calls).toEqual([["Unexpected error:", "Error"]]);
      spy.mockRestore();
    });
  });

  describe("every action", () => {
    const anyId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    const promptForm = () => form({ title: "T", content: "C", categoryIds: categoryId });
    const categoryForm = () => form({ name: "Sales", color: "#112233" });
    const forbidden = { ok: false, error: "You are not allowed to do this" };

    const calls: [string, () => Promise<unknown>][] = [
      ["createPrompt", () => actions.createPrompt(promptForm())],
      ["updatePrompt", () => actions.updatePrompt(anyId, promptForm())],
      ["deletePrompt", () => actions.deletePrompt(anyId)],
      ["createCategory", () => actions.createCategory(categoryForm())],
      ["updateCategory", () => actions.updateCategory(anyId, categoryForm())],
      ["deleteCategory", () => actions.deleteCategory(anyId)],
      ["promoteAdministrator", () => actions.promoteAdministrator(anyId)],
      ["demoteAdministrator", () => actions.demoteAdministrator(anyId)],
      ["setUserLanguage", () => actions.setUserLanguage("es")],
    ];

    it.each(calls)("%s rejects a missing principal without touching the database", async (_name, call) => {
      principal = new UnauthenticatedError();

      expect(await call()).toEqual({ ok: false, error: "Authentication required" });
      expect(repos.db.users.has(ada.oid)).toBe(false);
      expect(revalidate).not.toHaveBeenCalled();
    });

    it.each(calls)("%s rejects a non-member principal", async (_name, call) => {
      principal = new ForbiddenError();

      expect(await call()).toEqual(forbidden);
      expect(revalidate).not.toHaveBeenCalled();
    });

    it.each(["createCategory", "updateCategory", "deleteCategory", "promoteAdministrator", "demoteAdministrator"])(
      "%s forbids a plain User",
      async (name) => {
        const call = calls.find(([n]) => n === name)![1];

        expect(await call()).toEqual(forbidden);
        expect(revalidate).not.toHaveBeenCalled();
      },
    );
  });
});
