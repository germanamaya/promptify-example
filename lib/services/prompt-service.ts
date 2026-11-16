import "server-only";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { CategoryRepository, PromptData, PromptRepository } from "@/lib/repositories/types";
import type { PromptInput, PromptListQuery } from "@/lib/schemas/prompt";
import type { CurrentUser } from "./types";

export class PromptService {
  constructor(private readonly deps: { prompts: PromptRepository; categories: CategoryRepository }) {}

  async list(_user: CurrentUser, query: PromptListQuery) {
    if (query.categoryId) await this.requireCategory(query.categoryId);
    const { items, total } = await this.deps.prompts.list({
      categoryId: query.categoryId,
      q: query.q,
      offset: (query.page - 1) * query.pageSize,
      limit: query.pageSize,
    });
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async get(_user: CurrentUser, id: string) {
    const prompt = await this.deps.prompts.findById(id);
    if (!prompt) throw new NotFoundError("Prompt not found");
    return prompt;
  }

  async create(user: CurrentUser, input: PromptInput) {
    await this.requireCategories(input.categoryIds);
    return this.deps.prompts.create({ ...toPromptData(input), authorOid: user.oid });
  }

  async update(user: CurrentUser, id: string, input: PromptInput) {
    const existing = await this.get(user, id);
    if (existing.author.oid !== user.oid) throw new ForbiddenError();
    await this.requireCategories(input.categoryIds);
    const updated = await this.deps.prompts.update(id, toPromptData(input));
    if (!updated) throw new NotFoundError("Prompt not found");
    return updated;
  }

  async delete(user: CurrentUser, id: string) {
    const existing = await this.get(user, id);
    if (existing.author.oid !== user.oid && !user.isAdministrator) throw new ForbiddenError();
    await this.deps.prompts.delete(id);
  }

  private async requireCategories(categoryIds: string[]) {
    if (!categoryIds.length) throw new ValidationError("At least one Category is required");
    await Promise.all(categoryIds.map((categoryId) => this.requireCategory(categoryId)));
  }

  private async requireCategory(categoryId: string) {
    if (!(await this.deps.categories.findById(categoryId))) throw new ValidationError("Unknown Category");
  }
}

function toPromptData(input: PromptInput): PromptData {
  return {
    title: input.title,
    content: input.content,
    description: input.description,
    categoryIds: input.categoryIds,
  };
}
