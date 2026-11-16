import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { PromptService } from "@/lib/services/prompt-service";
import type { CurrentUser } from "@/lib/services/types";
import { createFakeRepositories } from "../../fakes/repositories";

const missingId = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const author: CurrentUser = { oid: "a0000000-0000-4000-8000-000000000001", name: "Author", isAdministrator: false };
const other: CurrentUser = { oid: "b0000000-0000-4000-8000-000000000002", name: "Other", isAdministrator: false };
const admin: CurrentUser = { oid: "c0000000-0000-4000-8000-000000000003", name: "Admin", isAdministrator: true };

describe("PromptService", () => {
  let repos: ReturnType<typeof createFakeRepositories>;
  let service: PromptService;
  let categoryId: string;

  beforeEach(() => {
    repos = createFakeRepositories();
    [author, other, admin].forEach((u) => repos.db.seedUser(u));
    categoryId = repos.db.seedCategory({ name: "General" }).id;
    service = new PromptService({ prompts: repos.prompts, categories: repos.categories });
  });

  describe("list", () => {
    it("translates page and pageSize into an offset and a limit", async () => {
      const list = vi.spyOn(repos.prompts, "list");

      await service.list(other, { page: 1, pageSize: 20 });
      await service.list(other, { page: 3, pageSize: 10 });

      expect(list.mock.calls.map(([criteria]) => criteria)).toEqual([
        { categoryId: undefined, offset: 0, limit: 20 },
        { categoryId: undefined, offset: 20, limit: 10 },
      ]);
    });

    it("returns the page, page size and total reported by the repository", async () => {
      for (let i = 0; i < 3; i++) repos.db.seedPrompt({ categoryId, authorOid: author.oid });

      const result = await service.list(other, { page: 1, pageSize: 2 });

      expect(result).toMatchObject({ page: 1, pageSize: 2, total: 3 });
      expect(result.items).toHaveLength(2);
    });

    it("rejects a filter for a Category that does not exist and never queries Prompts", async () => {
      const list = vi.spyOn(repos.prompts, "list");

      await expect(service.list(other, { page: 1, pageSize: 20, categoryId: missingId })).rejects.toBeInstanceOf(
        ValidationError,
      );
      expect(list).not.toHaveBeenCalled();
    });

    it("passes an existing Category filter to the repository", async () => {
      const otherCategory = repos.db.seedCategory({ name: "Other" });
      const list = vi.spyOn(repos.prompts, "list");

      await service.list(other, { page: 1, pageSize: 20, categoryId: otherCategory.id });

      expect(list).toHaveBeenCalledWith({ categoryId: otherCategory.id, offset: 0, limit: 20 });
    });
  });

  describe("get", () => {
    it("lets any User view any Prompt", async () => {
      const stored = repos.db.seedPrompt({ categoryId, authorOid: author.oid, title: "Visible" });

      const prompt = await service.get(other, stored.id);

      expect(prompt.title).toBe("Visible");
      expect(prompt.author.oid).toBe(author.oid);
    });

    it("throws NotFound for a missing Prompt", async () => {
      await expect(service.get(other, missingId)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("create", () => {
    it("associates every selected Category with the Prompt", async () => {
      const secondCategory = repos.db.seedCategory({ name: "Other" });

      const prompt = await service.create(author, {
        title: "T",
        content: "C",
        categoryIds: [categoryId, secondCategory.id],
      });

      expect(prompt.categories.map(({ id }) => id)).toEqual([categoryId, secondCategory.id]);
    });

    it("makes the current User the Author", async () => {
      const prompt = await service.create(author, { title: "T", content: "C", categoryIds: [categoryId] });

      expect(prompt.author.oid).toBe(author.oid);
      expect(repos.db.prompts.get(prompt.id)?.authorOid).toBe(author.oid);
    });

    it("ignores any authorOid smuggled into the input", async () => {
      const input = { title: "T", content: "C", categoryIds: [categoryId], authorOid: other.oid } as never;

      const prompt = await service.create(author, input);

      expect(prompt.author.oid).toBe(author.oid);
    });

    it("rejects a Category that does not exist", async () => {
      await expect(service.create(author, { title: "T", content: "C", categoryIds: [missingId] })).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("update", () => {
    it("replaces the Prompt's Category associations", async () => {
      const secondCategory = repos.db.seedCategory({ name: "Other" });
      const stored = repos.db.seedPrompt({ categoryId, authorOid: author.oid });

      const updated = await service.update(author, stored.id, {
        title: "New",
        content: "Body",
        categoryIds: [secondCategory.id],
      });

      expect(updated.categories.map(({ id }) => id)).toEqual([secondCategory.id]);
    });

    it("lets the Author edit and keeps the Author", async () => {
      const stored = repos.db.seedPrompt({ categoryId, authorOid: author.oid });

      const updated = await service.update(author, stored.id, { title: "New", content: "Body", categoryIds: [categoryId] });

      expect(updated).toMatchObject({ title: "New", content: "Body" });
      expect(updated.author.oid).toBe(author.oid);
    });

    it("forbids another User", async () => {
      const stored = repos.db.seedPrompt({ categoryId, authorOid: author.oid, title: "Mine" });

      await expect(service.update(other, stored.id, { title: "Hacked", content: "x", categoryIds: [categoryId] })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      expect(repos.db.prompts.get(stored.id)?.title).toBe("Mine");
    });

    it("forbids an Administrator who is not the Author", async () => {
      const stored = repos.db.seedPrompt({ categoryId, authorOid: author.oid });

      await expect(service.update(admin, stored.id, { title: "x", content: "x", categoryIds: [categoryId] })).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });

    it("throws NotFound for a missing Prompt", async () => {
      await expect(service.update(author, missingId, { title: "x", content: "x", categoryIds: [categoryId] })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("rejects a Category that does not exist", async () => {
      const stored = repos.db.seedPrompt({ categoryId, authorOid: author.oid });

      await expect(
        service.update(author, stored.id, { title: "x", content: "x", categoryIds: [missingId] }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe("delete", () => {
    it("lets the Author delete", async () => {
      const stored = repos.db.seedPrompt({ categoryId, authorOid: author.oid });

      await service.delete(author, stored.id);

      expect(repos.db.prompts.has(stored.id)).toBe(false);
    });

    it("lets an Administrator delete someone else's Prompt", async () => {
      const stored = repos.db.seedPrompt({ categoryId, authorOid: author.oid });

      await service.delete(admin, stored.id);

      expect(repos.db.prompts.has(stored.id)).toBe(false);
    });

    it("forbids another User", async () => {
      const stored = repos.db.seedPrompt({ categoryId, authorOid: author.oid });

      await expect(service.delete(other, stored.id)).rejects.toBeInstanceOf(ForbiddenError);
      expect(repos.db.prompts.has(stored.id)).toBe(true);
    });

    it("throws NotFound for a missing Prompt", async () => {
      await expect(service.delete(author, missingId)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
