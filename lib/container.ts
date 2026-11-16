import "server-only";
import { revalidatePath } from "next/cache";
import { createActions } from "@/lib/adapters/actions";
import { createQueries } from "@/lib/adapters/queries";
import { createActionRunner } from "@/lib/adapters/run-action";
import { createAuditLog } from "@/lib/audit/application-insights";
import { readPrincipal } from "@/lib/identity/current-user";
import { resolveUser } from "@/lib/identity/resolve-user";
import { getPrismaClient } from "@/lib/repositories/prisma/client";
import { PrismaCategoryRepository } from "@/lib/repositories/prisma/category-repository";
import { PrismaPromptRepository } from "@/lib/repositories/prisma/prompt-repository";
import { PrismaUserRepository } from "@/lib/repositories/prisma/user-repository";
import { AdministratorService } from "@/lib/services/administrator-service";
import { CategoryService } from "@/lib/services/category-service";
import { PromptService } from "@/lib/services/prompt-service";

function build() {
  const client = getPrismaClient();
  const users = new PrismaUserRepository(client);
  const categories = new PrismaCategoryRepository(client);
  const prompts = new PrismaPromptRepository(client);

  const services = {
    prompts: new PromptService({ prompts, categories }),
    categories: new CategoryService({ categories }),
    administrators: new AdministratorService({
      users,
      audit: createAuditLog({
        connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
        nodeEnv: process.env.NODE_ENV,
      }),
      now: () => new Date(),
    }),
  };

  const run = createActionRunner({ readPrincipal, resolveUser: (principal) => resolveUser(users, principal) });

  return {
    actions: createActions({
      run,
      users,
      services,
      // No cached scope ever holds identity or roles; this refreshes every route after a change.
      revalidate: () => revalidatePath("/", "layout"),
    }),
    queries: createQueries({ run, services }),
  };
}

let container: ReturnType<typeof build> | undefined;

export function getContainer() {
  return (container ??= build());
}
