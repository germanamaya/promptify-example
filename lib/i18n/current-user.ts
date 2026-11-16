import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { getContainer } from "@/lib/container";

export const getCurrentUserForRequest = cache(async () => {
  await connection();
  return getContainer().queries.getMe();
});
