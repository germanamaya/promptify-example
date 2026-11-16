import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import { DEFAULT_LANGUAGE } from "@/lib/i18n/messages";
import type { Language } from "@/lib/i18n/messages";
import type { DemoteResult, PromoteResult, UserRecord, UserRepository } from "@/lib/repositories/types";
import type { PrismaClient } from "./client";
import { mapPrismaError, withSerializableRetry } from "./errors";

const SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 };

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly client: PrismaClient) {}

  async list(): Promise<UserRecord[]> {
    return this.client.user.findMany({ orderBy: { displayName: "asc" } });
  }

  async findByOid(oid: string): Promise<UserRecord | null> {
    return this.client.user.findUnique({ where: { oid } });
  }

  async upsert(data: { oid: string; displayName: string }): Promise<UserRecord> {
    // SQL Server has no native upsert: two first requests of the same User can race on the unique oid.
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.client.user.upsert({
          where: { oid: data.oid },
          create: { oid: data.oid, displayName: data.displayName, isAdministrator: false, language: DEFAULT_LANGUAGE },
          update: { displayName: data.displayName },
        });
      } catch (error) {
        const raced = (error as { code?: unknown } | null)?.code === "P2002";
        if (raced && attempt < 3) continue;
        throw mapPrismaError(error);
      }
    }
  }

  async setLanguagePreference(oid: string, language: Language): Promise<void> {
    await this.client.user.update({ where: { oid }, data: { language } });
  }

  async promote(oid: string, beforeCommit: () => Promise<void>): Promise<PromoteResult> {
    return withSerializableRetry(() =>
      this.client.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { oid } });
        if (!user) return "not_found" as const;
        if (user.isAdministrator) return "already_administrator" as const;
        await tx.user.update({ where: { oid }, data: { isAdministrator: true } });
        // A failure here rolls the whole transaction back, so no promotion exists without its audit event.
        await beforeCommit();
        return "promoted" as const;
      }, SERIALIZABLE),
    );
  }

  async demote(oid: string): Promise<DemoteResult> {
    return withSerializableRetry(() =>
      this.client.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { oid } });
        if (!user) return "not_found" as const;
        if (!user.isAdministrator) return "not_administrator" as const;
        const administrators = await tx.user.count({ where: { isAdministrator: true } });
        if (administrators <= 1) return "last_administrator" as const;
        await tx.user.update({ where: { oid }, data: { isAdministrator: false } });
        return "demoted" as const;
      }, SERIALIZABLE),
    );
  }
}
