import "server-only";

export type UserRecord = {
  oid: string;
  displayName: string;
  isAdministrator: boolean;
};

export type CategoryRecord = {
  id: string;
  name: string;
  color: string;
};

export type PromptRecord = {
  id: string;
  title: string;
  content: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  categories: CategoryRecord[];
  author: { oid: string; displayName: string };
};

export type PromptData = {
  title: string;
  content: string;
  description?: string;
  categoryIds: string[];
};

export type PromptListCriteria = {
  categoryId?: string;
  q?: string;
  offset: number;
  limit: number;
};

// Implementations throw ConflictError on unique/foreign-key/serialization violations.
export interface CategoryRepository {
  list(): Promise<CategoryRecord[]>;
  findById(id: string): Promise<CategoryRecord | null>;
  create(data: { name: string; color: string }): Promise<CategoryRecord>;
  update(id: string, data: { name: string; color: string }): Promise<CategoryRecord | null>;
  // Atomic: a Category with Prompts is never deleted.
  delete(id: string): Promise<"deleted" | "not_found" | "has_prompts">;
}

export interface PromptRepository {
  list(criteria: PromptListCriteria): Promise<{ items: PromptRecord[]; total: number }>;
  findById(id: string): Promise<PromptRecord | null>;
  create(data: PromptData & { authorOid: string }): Promise<PromptRecord>;
  update(id: string, data: PromptData): Promise<PromptRecord | null>;
  delete(id: string): Promise<boolean>;
}

export type DemoteResult = "demoted" | "not_administrator" | "not_found" | "last_administrator";
export type PromoteResult = "promoted" | "already_administrator" | "not_found";

export interface UserRepository {
  list(): Promise<UserRecord[]>;
  findByOid(oid: string): Promise<UserRecord | null>;
  // Never changes isAdministrator of an existing User.
  upsert(data: { oid: string; displayName: string }): Promise<UserRecord>;
  // `beforeCommit` runs inside the same unit of work; if it throws, the promotion is rolled back.
  promote(oid: string, beforeCommit: () => Promise<void>): Promise<PromoteResult>;
  // Atomic: the last Administrator is never demoted.
  demote(oid: string): Promise<DemoteResult>;
}
