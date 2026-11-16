import { describe, expect, it } from "vitest";
import { idSchema, oidSchema, paginationSchema } from "@/lib/schemas/common";
import { promptInputSchema, promptListQuerySchema } from "@/lib/schemas/prompt";
import { categoryInputSchema } from "@/lib/schemas/category";

const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("idSchema / oidSchema", () => {
  it("accepts a uuid and rejects anything else", () => {
    expect(idSchema.safeParse(uuid).success).toBe(true);
    expect(idSchema.safeParse("1; DROP TABLE").success).toBe(false);
    expect(idSchema.safeParse(42).success).toBe(false);
  });

  it("accepts a guid oid and rejects empty or malformed values", () => {
    expect(oidSchema.safeParse(uuid).success).toBe(true);
    expect(oidSchema.safeParse("").success).toBe(false);
    expect(oidSchema.safeParse("not-a-guid").success).toBe(false);
  });

  it("normalizes oids to lowercase", () => {
    expect(oidSchema.parse(uuid.toUpperCase())).toBe(uuid);
  });
});

describe("paginationSchema", () => {
  it("defaults to page 1 and 20 items", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("coerces strings from search params", () => {
    expect(paginationSchema.parse({ page: "3", pageSize: "50" })).toEqual({ page: 3, pageSize: 50 });
  });

  it.each([
    [{ pageSize: 51 }],
    [{ pageSize: 0 }],
    [{ page: 0 }],
    [{ page: -1 }],
    [{ page: 1.5 }],
    [{ page: 10_001 }],
    [{ page: "abc" }],
    [{ page: "" }],
  ])("rejects %o", (input) => {
    expect(paginationSchema.safeParse(input).success).toBe(false);
  });
});

describe("promptInputSchema", () => {
  const valid = { title: "Title", content: "Content", categoryIds: [uuid] };

  it("accepts one or more Categories and an optional description", () => {
    expect(promptInputSchema.safeParse(valid).success).toBe(true);
    expect(promptInputSchema.safeParse({ ...valid, categoryIds: [uuid, "00000000-0000-4000-8000-000000000001"] }).success).toBe(true);
    expect(promptInputSchema.safeParse({ ...valid, description: "About" }).success).toBe(true);
  });

  it.each<[string[]]>([
    [[]],
    [["abc"]],
    [[uuid, uuid]],
  ])("rejects invalid Category selections %o", (categoryIds) => {
    expect(promptInputSchema.safeParse({ ...valid, categoryIds }).success).toBe(false);
  });

  it("enforces length limits", () => {
    expect(promptInputSchema.safeParse({ ...valid, title: "" }).success).toBe(false);
    expect(promptInputSchema.safeParse({ ...valid, title: "a".repeat(121) }).success).toBe(false);
    expect(promptInputSchema.safeParse({ ...valid, title: "a".repeat(120) }).success).toBe(true);
    expect(promptInputSchema.safeParse({ ...valid, content: "" }).success).toBe(false);
    expect(promptInputSchema.safeParse({ ...valid, content: "a".repeat(10_001) }).success).toBe(false);
    expect(promptInputSchema.safeParse({ ...valid, content: "a".repeat(10_000) }).success).toBe(true);
    expect(promptInputSchema.safeParse({ ...valid, description: "a".repeat(501) }).success).toBe(false);
    expect(promptInputSchema.safeParse({ ...valid, description: "a".repeat(500) }).success).toBe(true);
  });

  it("rejects a blank title and a non-uuid category", () => {
    expect(promptInputSchema.safeParse({ ...valid, title: "   " }).success).toBe(false);
  });

  it("never lets authorOid, createdAt or updatedAt through", () => {
    const parsed = promptInputSchema.parse({
      ...valid,
      authorOid: uuid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(Object.keys(parsed).sort()).toEqual(["categoryIds", "content", "title"]);
  });
});

describe("promptListQuerySchema", () => {
  it("combines pagination with an optional category filter", () => {
    expect(promptListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(promptListQuerySchema.parse({ categoryId: uuid, page: "2" })).toEqual({
      categoryId: uuid,
      page: 2,
      pageSize: 20,
    });
  });

  it("rejects an invalid category filter", () => {
    expect(promptListQuerySchema.safeParse({ categoryId: "x" }).success).toBe(false);
  });
});

describe("categoryInputSchema", () => {
  it("accepts a name and a #RRGGBB color", () => {
    expect(categoryInputSchema.safeParse({ name: "Marketing", color: "#1a2B3c" }).success).toBe(true);
  });

  it.each([
    [{ name: "", color: "#112233" }],
    [{ name: "a".repeat(51), color: "#112233" }],
    [{ name: "   ", color: "#112233" }],
    [{ name: "Ok", color: "red" }],
    [{ name: "Ok", color: "#12345" }],
    [{ name: "Ok", color: "#GGGGGG" }],
    [{ name: "Ok", color: "#1122334" }],
  ])("rejects %o", (input) => {
    expect(categoryInputSchema.safeParse(input).success).toBe(false);
  });
});
