import "server-only";
import type { CategoryRecord, PromptRecord, UserRecord } from "@/lib/repositories/types";
import type { CurrentUser } from "@/lib/services/types";

export type CategoryDto = { id: string; name: string; color: string };

export type PromptListItemDto = {
  id: string;
  title: string;
  description: string | null;
  categories: { name: string; color: string }[];
  authorName: string;
  createdAt: string;
};

export type PromptListDto = {
  items: PromptListItemDto[];
  total: number;
  page: number;
  pageSize: number;
};

export type PromptDetailDto = {
  id: string;
  title: string;
  content: string;
  description: string | null;
  categoryIds: string[];
  categories: { name: string; color: string }[];
  authorName: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canDelete: boolean;
};

export type MeDto = { name: string; isAdministrator: boolean };
export type AdministratorUserDto = { oid: string; name: string; isAdministrator: boolean };

export const toCategoryDto = (category: CategoryRecord): CategoryDto => ({
  id: category.id,
  name: category.name,
  color: category.color,
});

export const toPromptListItemDto = (prompt: PromptRecord): PromptListItemDto => ({
  id: prompt.id,
  title: prompt.title,
  description: prompt.description,
  categories: prompt.categories.map(({ name, color }) => ({ name, color })),
  authorName: prompt.author.displayName,
  createdAt: prompt.createdAt.toISOString(),
});

export function toPromptDetailDto(prompt: PromptRecord, viewer: CurrentUser): PromptDetailDto {
  const isAuthor = prompt.author.oid === viewer.oid;
  return {
    id: prompt.id,
    title: prompt.title,
    content: prompt.content,
    description: prompt.description,
    categoryIds: prompt.categories.map(({ id }) => id),
    categories: prompt.categories.map(({ name, color }) => ({ name, color })),
    authorName: prompt.author.displayName,
    createdAt: prompt.createdAt.toISOString(),
    updatedAt: prompt.updatedAt.toISOString(),
    canEdit: isAuthor,
    canDelete: isAuthor || viewer.isAdministrator,
  };
}

export const toMeDto = (user: CurrentUser): MeDto => ({ name: user.name, isAdministrator: user.isAdministrator });

export const toAdministratorUserDto = (user: UserRecord): AdministratorUserDto => ({
  oid: user.oid,
  name: user.displayName,
  isAdministrator: user.isAdministrator,
});
