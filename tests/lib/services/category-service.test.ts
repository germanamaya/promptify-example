import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { CategoryService } from "@/lib/services/category-service";
import type { CurrentUser } from "@/lib/services/types";
import { createFakeRepositories } from "../../fakes/repositories";

const admin: CurrentUser = { oid: "a0000000-0000-4000-8000-000000000001", name: "Admin", isAdministrator: true, language: "en" };
const user: CurrentUser = { oid: "b0000000-0000-4000-8000-000000000002", name: "User", isAdministrator: false, language: "en" };

describe("CategoryService", () => {
  let repos: ReturnType<typeof createFakeRepositories>;
  let service: CategoryService;

  beforeEach(() => {
    repos = createFakeRepositories();
    repos.db.seedUser(admin);
    repos.db.seedUser(user);
    service = new CategoryService({ categories: repos.categories });
  });

  describe("list", () => {
    it("lets any User list Categories ordered by name", async () => {
      repos.db.seedCategory({ name: "Zeta" });
      repos.db.seedCategory({ name: "Alpha" });

      const result = await service.list(user);

      expect(result.map((c) => c.name)).toEqual(["Alpha", "Zeta"]);
    });
  });

  describe("create", () => {
    it("lets an Administrator create a Category", async () => {
      const created = await service.create(admin, { name: "Sales", color: "#aabbcc" });

      expect(created).toMatchObject({ name: "Sales", color: "#aabbcc" });
      expect(await service.list(user)).toHaveLength(1);
    });

    it("forbids a plain User", async () => {
      await expect(service.create(user, { name: "Sales", color: "#aabbcc" })).rejects.toBeInstanceOf(ForbiddenError);
      expect(await service.list(user)).toHaveLength(0);
    });

    it("rejects a duplicate name with Conflict, ignoring case like the database collation", async () => {
      await service.create(admin, { name: "Sales", color: "#aabbcc" });

      await expect(service.create(admin, { name: "Sales", color: "#000000" })).rejects.toBeInstanceOf(ConflictError);
      await expect(service.create(admin, { name: "sALES", color: "#000000" })).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("update", () => {
    it("lets an Administrator edit a Category", async () => {
      const category = repos.db.seedCategory({ name: "Old" });

      const updated = await service.update(admin, category.id, { name: "New", color: "#010203" });

      expect(updated).toEqual({ id: category.id, name: "New", color: "#010203" });
    });

    it("forbids a plain User, even for a missing Category", async () => {
      await expect(
        service.update(user, "3f2504e0-4f89-41d3-9a0c-0305e82c3301", { name: "x", color: "#010203" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("throws NotFound for a missing Category", async () => {
      await expect(
        service.update(admin, "3f2504e0-4f89-41d3-9a0c-0305e82c3301", { name: "x", color: "#010203" }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("rejects renaming to another Category's name with Conflict", async () => {
      repos.db.seedCategory({ name: "Taken" });
      const other = repos.db.seedCategory({ name: "Other" });

      await expect(service.update(admin, other.id, { name: "Taken", color: "#010203" })).rejects.toBeInstanceOf(
        ConflictError,
      );
    });
  });

  describe("delete", () => {
    it("lets an Administrator delete an empty Category", async () => {
      const category = repos.db.seedCategory();

      await service.delete(admin, category.id);

      expect(repos.db.categories.has(category.id)).toBe(false);
    });

    it("forbids a plain User", async () => {
      const category = repos.db.seedCategory();

      await expect(service.delete(user, category.id)).rejects.toBeInstanceOf(ForbiddenError);
      expect(repos.db.categories.has(category.id)).toBe(true);
    });

    it("throws NotFound for a missing Category", async () => {
      await expect(service.delete(admin, "3f2504e0-4f89-41d3-9a0c-0305e82c3301")).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("rejects deleting a Category that has Prompts with Conflict", async () => {
      const category = repos.db.seedCategory();
      repos.db.seedPrompt({ categoryId: category.id, authorOid: user.oid });

      await expect(service.delete(admin, category.id)).rejects.toBeInstanceOf(ConflictError);
      expect(repos.db.categories.has(category.id)).toBe(true);
    });
  });
});
