import { PrismaMssql } from "@prisma/adapter-mssql";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaCategoryRepository } from "@/lib/repositories/prisma/category-repository";
import { PrismaPromptRepository } from "@/lib/repositories/prisma/prompt-repository";
import { PrismaUserRepository } from "@/lib/repositories/prisma/user-repository";
import type { CurrentUser } from "@/lib/services/types";
import { loadIntegrationUrls } from "./env";

// Connects with the runtime login (DML only), the same one production uses.
export function openDatabase() {
  const client = new PrismaClient({ adapter: new PrismaMssql(loadIntegrationUrls().runtime) });
  return {
    client,
    users: new PrismaUserRepository(client),
    categories: new PrismaCategoryRepository(client),
    prompts: new PrismaPromptRepository(client),
    async reset() {
      await client.prompt.deleteMany();
      await client.category.deleteMany();
      await client.user.deleteMany();
    },
    close: () => client.$disconnect(),
  };
}

export type TestDatabase = ReturnType<typeof openDatabase>;

export async function seedUser(
  client: PrismaClient,
  data: { oid?: string; displayName?: string; isAdministrator?: boolean } = {},
) {
  return client.user.create({
    data: {
      oid: data.oid ?? randomUUID(),
      displayName: data.displayName ?? "Test User",
      isAdministrator: data.isAdministrator ?? false,
    },
  });
}

export async function seedCategory(client: PrismaClient, data: { name?: string; color?: string } = {}) {
  return client.category.create({
    data: { name: data.name ?? `Category ${randomUUID().slice(0, 8)}`, color: data.color ?? "#112233" },
  });
}

export async function seedPrompt(
  client: PrismaClient,
  data: {
    categoryId?: string;
    categoryIds?: string[];
    authorOid: string;
    title?: string;
    content?: string;
    createdAt?: Date;
    updatedAt?: Date;
    id?: string;
  },
) {
  const { categoryId, categoryIds, ...promptData } = data;
  const selectedCategories = categoryIds ?? (categoryId ? [categoryId] : []);
  return client.prompt.create({
    data: {
      title: "Title",
      content: "Content",
      ...promptData,
      promptCategories: {
        create: selectedCategories.map((id) => ({ category: { connect: { id } } })),
      },
    },
  });
}

export const asCurrentUser = (user: { oid: string; displayName: string; isAdministrator: boolean }): CurrentUser => ({
  oid: user.oid,
  name: user.displayName,
  isAdministrator: user.isAdministrator,
});
