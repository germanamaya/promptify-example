import "server-only";
import type { Language } from "@/lib/i18n/messages";

export type CurrentUser = {
  oid: string;
  name: string;
  isAdministrator: boolean;
  language: Language;
};
