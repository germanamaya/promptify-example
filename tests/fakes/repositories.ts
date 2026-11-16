import { randomUUID } from "node:crypto";
import { ConflictError } from "@/lib/errors";
import type {
  CategoryRecord,
  CategoryRepository,
  DemoteResult,
  PromoteResult,
  PromptRecord,
  PromptListCriteria,
  PromptRepository,
  UserRecord,
  UserRepository,
} from "@/lib/repositories/types";

type StoredPrompt = {
  id: string;
  title: string;
  content: string;
  description: string | null;
  categoryIds: string[];
  authorOid: string;
  createdAt: Date;
  updatedAt: Date;
};

export class FakeDb {
  categories = new Map<string, CategoryRecord>();
  prompts = new Map<string, StoredPrompt>();
  users = new Map<string, UserRecord>();
  clock = () => new Date();

  seedUser(user: Partial<UserRecord> & { oid: string }): UserRecord {
    const record = { displayName: `User ${user.oid}`, isAdministrator: false, ...user };
    this.users.set(record.oid, record);
    return record;
  }

  seedCategory(data: Partial<CategoryRecord> = {}): CategoryRecord {
    const record = { id: randomUUID(), name: `Category ${this.categories.size}`, color: "#112233", ...data };
    this.categories.set(record.id, record);
    return record;
  }

  seedPrompt(data: Partial<Omit<StoredPrompt, "categoryIds">> & {
    categoryId?: string;
    categoryIds?: string[];
    authorOid: string;
  }): StoredPrompt {
    const now = this.clock();
    const { categoryId, categoryIds, ...rest } = data;
    const record: StoredPrompt = {
      id: randomUUID(),
      title: "Title",
      content: "Content",
      description: null,
      createdAt: now,
      updatedAt: now,
      categoryIds: categoryIds ?? (categoryId ? [categoryId] : []),
      ...rest,
    };
    this.prompts.set(record.id, record);
    return record;
  }

  toRecord(stored: StoredPrompt): PromptRecord {
    const { categoryIds, authorOid, ...rest } = stored;
    return {
      ...rest,
      categories: categoryIds.map((id) => this.categories.get(id)!).sort((a, b) => a.name.localeCompare(b.name)),
      author: { oid: authorOid, displayName: this.users.get(authorOid)!.displayName },
    };
  }
}

export class FakeCategoryRepository implements CategoryRepository {
  constructor(private readonly db: FakeDb) {}

  async list() {
    return [...this.db.categories.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async findById(id: string) {
    return this.db.categories.get(id) ?? null;
  }

  async create(data: { name: string; color: string }) {
    this.assertNameFree(data.name);
    return this.db.seedCategory(data);
  }

  async update(id: string, data: { name: string; color: string }) {
    const existing = this.db.categories.get(id);
    if (!existing) return null;
    this.assertNameFree(data.name, id);
    const updated = { ...existing, ...data };
    this.db.categories.set(id, updated);
    return updated;
  }

  async delete(id: string) {
    if (!this.db.categories.has(id)) return "not_found" as const;
    const inUse = [...this.db.prompts.values()].some((prompt) => prompt.categoryIds.includes(id));
    if (inUse) return "has_prompts" as const;
    this.db.categories.delete(id);
    return "deleted" as const;
  }

  private assertNameFree(name: string, exceptId?: string) {
    // SQL Server's default collation compares names case-insensitively.
    const taken = [...this.db.categories.values()].some(
      (c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== exceptId,
    );
    if (taken) throw new ConflictError();
  }
}

export class FakePromptRepository implements PromptRepository {
  constructor(private readonly db: FakeDb) {}

  async list({ categoryId, q, offset, limit }: PromptListCriteria) {
    const matching = [...this.db.prompts.values()]
      .filter((prompt) => !categoryId || prompt.categoryIds.includes(categoryId))
      .filter((prompt) => !q || [prompt.title, prompt.description, prompt.content]
        .some((value) => value?.toLowerCase().includes(q.toLowerCase())))
      .sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
      );
    return {
      items: matching.slice(offset, offset + limit).map((prompt) => this.db.toRecord(prompt)),
      total: matching.length,
    };
  }

  async findById(id: string) {
    const stored = this.db.prompts.get(id);
    return stored ? this.db.toRecord(stored) : null;
  }

  async create(data: { title: string; content: string; description?: string; categoryIds: string[]; authorOid: string }) {
    if (!data.categoryIds.every((id) => this.db.categories.has(id)) || !this.db.users.has(data.authorOid)) throw new ConflictError();
    const stored = this.db.seedPrompt({ ...data, description: data.description ?? null });
    return this.db.toRecord(stored);
  }

  async update(id: string, data: { title: string; content: string; description?: string; categoryIds: string[] }) {
    const existing = this.db.prompts.get(id);
    if (!existing) return null;
    if (!data.categoryIds.every((categoryId) => this.db.categories.has(categoryId))) throw new ConflictError();
    const updated = {
      ...existing,
      ...data,
      description: data.description ?? null,
      updatedAt: this.db.clock(),
    };
    this.db.prompts.set(id, updated);
    return this.db.toRecord(updated);
  }

  async delete(id: string) {
    return this.db.prompts.delete(id);
  }
}

export class FakeUserRepository implements UserRepository {
  constructor(private readonly db: FakeDb) {}

  async list() {
    return [...this.db.users.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async findByOid(oid: string) {
    return this.db.users.get(oid) ?? null;
  }

  async upsert(data: { oid: string; displayName: string }) {
    const existing = this.db.users.get(data.oid);
    const record = { isAdministrator: false, ...existing, displayName: data.displayName, oid: data.oid };
    this.db.users.set(data.oid, record);
    return record;
  }

  async promote(oid: string, beforeCommit: () => Promise<void>): Promise<PromoteResult> {
    const user = this.db.users.get(oid);
    if (!user) return "not_found";
    if (user.isAdministrator) return "already_administrator";
    user.isAdministrator = true;
    try {
      await beforeCommit();
    } catch (error) {
      user.isAdministrator = false;
      throw error;
    }
    return "promoted";
  }

  async demote(oid: string): Promise<DemoteResult> {
    const user = this.db.users.get(oid);
    if (!user) return "not_found";
    if (!user.isAdministrator) return "not_administrator";
    const administrators = [...this.db.users.values()].filter((u) => u.isAdministrator);
    if (administrators.length <= 1) return "last_administrator";
    user.isAdministrator = false;
    return "demoted";
  }
}

export function createFakeRepositories() {
  const db = new FakeDb();
  return {
    db,
    categories: new FakeCategoryRepository(db),
    prompts: new FakePromptRepository(db),
    users: new FakeUserRepository(db),
  };
}
