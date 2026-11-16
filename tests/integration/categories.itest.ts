import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ValidationError } from "@/lib/errors";
import { CategoryService } from "@/lib/services/category-service";
import { PromptService } from "@/lib/services/prompt-service";
import { asCurrentUser, openDatabase, seedCategory, seedPrompt, seedUser } from "./support/db";

const db = openDatabase();
const { client } = db;
const categoryService = new CategoryService({ categories: db.categories });
const promptService = new PromptService({ prompts: db.prompts, categories: db.categories });
const rounds = 15;

beforeEach(() => db.reset());
afterAll(() => db.close());

describe("categories", () => {
  it("lists Categories ordered by name", async () => {
    await seedCategory(client, { name: "Zeta" });
    await seedCategory(client, { name: "Alpha" });

    expect((await db.categories.list()).map((c) => c.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("creates, finds and updates a Category", async () => {
    const created = await db.categories.create({ name: "Sales", color: "#aabbcc" });

    expect(await db.categories.findById(created.id)).toEqual(created);
    expect(await db.categories.update(created.id, { name: "Sales 2", color: "#010203" })).toEqual({
      id: created.id,
      name: "Sales 2",
      color: "#010203",
    });
    expect(await db.categories.update("3f2504e0-4f89-41d3-9a0c-0305e82c3301", { name: "x", color: "#010203" })).toBeNull();
  });

  it("rejects a duplicate name with Conflict, ignoring case", async () => {
    await db.categories.create({ name: "Sales", color: "#aabbcc" });

    await expect(db.categories.create({ name: "Sales", color: "#000000" })).rejects.toBeInstanceOf(ConflictError);
    await expect(db.categories.create({ name: "sALES", color: "#000000" })).rejects.toBeInstanceOf(ConflictError);
    expect(await client.category.count()).toBe(1);
  });

  it("rejects renaming to another Category's name with Conflict", async () => {
    await seedCategory(client, { name: "Taken" });
    const other = await seedCategory(client, { name: "Other" });

    await expect(db.categories.update(other.id, { name: "Taken", color: "#010203" })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("lets exactly one of several simultaneous creations with the same name win", async () => {
    for (let round = 0; round < rounds; round++) {
      await db.reset();

      const results = await Promise.allSettled(
        Array.from({ length: 6 }, () => db.categories.create({ name: "Race", color: "#112233" })),
      );

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      for (const result of results) {
        if (result.status === "rejected") expect(result.reason).toBeInstanceOf(ConflictError);
      }
      expect(await client.category.count()).toBe(1);
    }
  });
});

describe("category delete", () => {
  it("deletes an empty Category and reports a missing one", async () => {
    const category = await seedCategory(client);

    expect(await db.categories.delete(category.id)).toBe("deleted");
    expect(await db.categories.delete(category.id)).toBe("not_found");
  });

  it("refuses a Category that has Prompts", async () => {
    const author = await seedUser(client);
    const category = await seedCategory(client);
    await seedPrompt(client, { categoryId: category.id, authorOid: author.oid });

    expect(await db.categories.delete(category.id)).toBe("has_prompts");
    expect(await client.category.count()).toBe(1);
  });

  it("answers the service with Conflict when the Category has Prompts", async () => {
    const administrator = await seedUser(client, { isAdministrator: true });
    const category = await seedCategory(client);
    await seedPrompt(client, { categoryId: category.id, authorOid: administrator.oid });

    await expect(categoryService.delete(asCurrentUser(administrator), category.id)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("never ends with a Prompt whose Category was deleted while it was being created", async () => {
    const administrator = asCurrentUser(await seedUser(client, { isAdministrator: true }));
    const author = asCurrentUser(await seedUser(client));

    for (let round = 0; round < rounds; round++) {
      await client.prompt.deleteMany();
      await client.category.deleteMany();
      const category = await seedCategory(client);

      const [deletion, creation] = await Promise.allSettled([
        categoryService.delete(administrator, category.id),
        promptService.create(author, { title: "T", content: "C", categoryIds: [category.id] }),
      ]);

      const categoryExists = (await client.category.count({ where: { id: category.id } })) === 1;
      const promptCount = await client.promptCategory.count({ where: { categoryId: category.id } });

      expect(categoryExists || promptCount === 0, `round ${round}: orphan Prompt`).toBe(true);
      if (deletion.status === "fulfilled") {
        expect(creation.status).toBe("rejected");
        expect((creation as PromiseRejectedResult).reason).toSatisfy(
          (reason: unknown) => reason instanceof ConflictError || reason instanceof ValidationError,
        );
      } else {
        expect(deletion.reason).toBeInstanceOf(ConflictError);
        expect(promptCount).toBe(1);
      }
    }
  });
});
