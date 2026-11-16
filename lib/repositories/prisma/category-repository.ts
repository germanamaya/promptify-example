import "server-only";
import { NotFoundError } from "@/lib/errors";
import { Prisma } from "@/lib/generated/prisma/client";
import type { CategoryRepository } from "@/lib/repositories/types";
import type { PrismaClient } from "./client";
import { mapPrismaError, withSerializableRetry } from "./errors";

export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly client: PrismaClient) {}

  async list() {
    return this.client.category.findMany({ orderBy: { name: "asc" } });
  }

  async findById(id: string) {
    return this.client.category.findUnique({ where: { id } });
  }

  async create(data: { name: string; color: string }) {
    try {
      return await this.client.category.create({ data });
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async update(id: string, data: { name: string; color: string }) {
    try {
      return await this.client.category.update({ where: { id }, data });
    } catch (error) {
      const mapped = mapPrismaError(error);
      if (mapped instanceof NotFoundError) return null;
      throw mapped;
    }
  }

  async delete(id: string) {
    return withSerializableRetry(() =>
      this.client.$transaction(
        async (tx) => {
          const category = await tx.category.findUnique({ where: { id } });
          if (!category) return "not_found" as const;
          if ((await tx.promptCategory.count({ where: { categoryId: id } })) > 0) return "has_prompts" as const;
          await tx.category.delete({ where: { id } });
          return "deleted" as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }
}
