import { describe, expect, it } from "vitest";
import { actionErrorMessage } from "@/app/components/read-error";
import { translate } from "@/lib/i18n/messages";

describe("Mutation feedback", () => {
  it.each([
    ["Category has Prompts", "error.categoryHasPrompts", "contiene Prompts"],
    ["The change conflicts with existing data", "error.conflict", "conflicto"],
    ["Category not found", "error.categoryNotFound", "Categoría ya no existe"],
    ["User not found", "error.userNotFound", "Comprueba el OID"],
    ["The last Administrator cannot be demoted", "error.lastAdministrator", "último Administrador"],
    ["Invalid input", "error.actionInvalid", "campos"],
    ["Unknown Category", "error.unknownCategory", "seleccionada ya no está disponible"],
  ] as const)("offers an actionable message for %s", (error, key, expected) => {
    expect(actionErrorMessage(error)).toBe(key);
    expect(translate("es", key)).toContain(expected);
  });
});
