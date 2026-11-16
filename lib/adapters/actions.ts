import "server-only";
import { categoryInputSchema } from "@/lib/schemas/category";
import { idSchema, oidSchema } from "@/lib/schemas/common";
import { promptInputSchema } from "@/lib/schemas/prompt";
import { ValidationError } from "@/lib/errors";
import type { AdministratorService } from "@/lib/services/administrator-service";
import type { CategoryService } from "@/lib/services/category-service";
import type { PromptService } from "@/lib/services/prompt-service";
import { parseInput, readFormFields } from "./parse";
import type { ActionRunner } from "./run-action";

const PROMPT_FIELDS = ["title", "content", "description"] as const;
const CATEGORY_FIELDS = ["name", "color"] as const;

export function createActions(deps: {
  run: ActionRunner;
  revalidate: () => void;
  services: { prompts: PromptService; categories: CategoryService; administrators: AdministratorService };
}) {
  const { run, revalidate, services } = deps;

  // Revalidates only after the service accepted the change.
  const mutation = async <T>(result: Promise<T>) => {
    const value = await result;
    revalidate();
    return value;
  };

  const parsePromptForm = (form: unknown) => {
    if (!(form instanceof FormData)) throw new ValidationError("Invalid input");
    const fields = readFormFields(form, PROMPT_FIELDS);
    const categoryIds = form.getAll("categoryIds");
    if (categoryIds.some((id) => typeof id !== "string")) throw new ValidationError("Invalid input");
    return parseInput(promptInputSchema, { ...fields, categoryIds });
  };
  const parseCategoryForm = (form: unknown) => parseInput(categoryInputSchema, readFormFields(form, CATEGORY_FIELDS));

  return {
    createPrompt: (form: unknown) =>
      run(
        () => parsePromptForm(form),
        (user, input) => mutation(services.prompts.create(user, input).then((prompt) => ({ id: prompt.id }))),
      ),

    updatePrompt: (id: unknown, form: unknown) =>
      run(
        () => ({ id: parseInput(idSchema, id), input: parsePromptForm(form) }),
        (user, { id: promptId, input }) => mutation(services.prompts.update(user, promptId, input).then(() => undefined)),
      ),

    deletePrompt: (id: unknown) =>
      run(
        () => parseInput(idSchema, id),
        (user, promptId) => mutation(services.prompts.delete(user, promptId)),
      ),

    createCategory: (form: unknown) =>
      run(
        () => parseCategoryForm(form),
        (user, input) => mutation(services.categories.create(user, input).then((category) => ({ id: category.id }))),
      ),

    updateCategory: (id: unknown, form: unknown) =>
      run(
        () => ({ id: parseInput(idSchema, id), input: parseCategoryForm(form) }),
        (user, { id: categoryId, input }) =>
          mutation(services.categories.update(user, categoryId, input).then(() => undefined)),
      ),

    deleteCategory: (id: unknown) =>
      run(
        () => parseInput(idSchema, id),
        (user, categoryId) => mutation(services.categories.delete(user, categoryId)),
      ),

    promoteAdministrator: (oid: unknown) =>
      run(
        () => parseInput(oidSchema, oid),
        (user, targetOid) => mutation(services.administrators.promote(user, targetOid)),
      ),

    demoteAdministrator: (oid: unknown) =>
      run(
        () => parseInput(oidSchema, oid),
        (user, targetOid) => mutation(services.administrators.demote(user, targetOid)),
      ),
  };
}
