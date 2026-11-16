import { describe, expect, it, vi } from "vitest";
import { PrismaPromptRepository } from "@/lib/repositories/prisma/prompt-repository";
import type { PrismaClient } from "@/lib/repositories/prisma/client";

describe("Prisma Prompt search", () => {
  it("searches all three text fields and applies the same filter before paging and counting", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const client = {
      prompt: { findMany, count },
      $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
    };
    const repository = new PrismaPromptRepository(client as unknown as PrismaClient);

    await repository.list({ q: "informe", categoryId: "category", offset: 12, limit: 12 });

    const where = {
      promptCategories: { some: { categoryId: "category" } },
      OR: [
        { title: { contains: "informe" } },
        { description: { contains: "informe" } },
        { content: { contains: "informe" } },
      ],
    };
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where, skip: 12, take: 12,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }));
    expect(count).toHaveBeenCalledWith({ where });
  });
});
