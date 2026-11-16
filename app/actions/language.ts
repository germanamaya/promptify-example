"use server";

import { getContainer } from "@/lib/container";

export async function setUserLanguage(language: string) {
  return getContainer().actions.setUserLanguage(language);
}
