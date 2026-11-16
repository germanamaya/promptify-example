import Link from "next/link";
import type { MessageKey } from "@/lib/i18n/messages";
import { T } from "./locale-provider";

export function actionErrorMessage(error: string): MessageKey {
  switch (error) {
    case "Invalid input": return "error.actionInvalid";
    case "Unknown Category": return "error.unknownCategory";
    case "Category has Prompts": return "error.categoryHasPrompts";
    case "The change conflicts with existing data": return "error.conflict";
    case "Category not found": return "error.categoryNotFound";
    case "User not found": return "error.userNotFound";
    case "The last Administrator cannot be demoted": return "error.lastAdministrator";
    default: return errorMessage(error);
  }
}

export function errorMessage(error: string): MessageKey {
  switch (error) {
    case "Authentication required": return "error.auth";
    case "You are not allowed to do this": return "error.forbidden";
    case "Invalid input":
    case "Unknown Category": return "error.invalidFilters";
    case "Prompt not found": return "error.promptNotFound";
    default: return "error.generic";
  }
}

export function ReadError({ error }: { error: string }) {
  return (
    <section className="empty-state error-state" role="alert">
      <h1><T id="error.readTitle" /></h1>
      <p><T id={errorMessage(error)} /></p>
      <Link href="/" className="button button-secondary"><T id="error.backLibrary" /></Link>
    </section>
  );
}
