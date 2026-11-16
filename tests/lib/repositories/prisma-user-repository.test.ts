import { describe, expect, it, vi } from "vitest";
import { ConflictError } from "@/lib/errors";
import type { PrismaClient } from "@/lib/repositories/prisma/client";
import { PrismaUserRepository } from "@/lib/repositories/prisma/user-repository";

const data = { oid: "3f2504e0-4f89-41d3-9a0c-0305e82c3301", displayName: "Ada" };
const stored = { ...data, isAdministrator: false, language: "en" };
const prismaError = (code: string) => Object.assign(new Error("db details"), { code });

function repositoryWith(upsert: ReturnType<typeof vi.fn>) {
  return new PrismaUserRepository({ user: { upsert } } as unknown as PrismaClient);
}

describe("PrismaUserRepository.upsert", () => {
  it("creates new Users as non-Administrators and only updates the name", async () => {
    const upsert = vi.fn().mockResolvedValue(stored);

    await repositoryWith(upsert).upsert(data);

    expect(upsert).toHaveBeenCalledWith({
      where: { oid: data.oid },
      create: { oid: data.oid, displayName: "Ada", isAdministrator: false, language: "en" },
      update: { displayName: "Ada" },
    });
  });

  it("updates only the selected User's language preference", async () => {
    const update = vi.fn().mockResolvedValue({ ...stored, language: "it" });
    const repository = new PrismaUserRepository({ user: { update } } as unknown as PrismaClient);

    await repository.setLanguagePreference(data.oid, "it");

    expect(update).toHaveBeenCalledWith({
      where: { oid: data.oid },
      data: { language: "it" },
    });
  });

  describe("PrismaUserRepository.list", () => {
    it("returns Users in display-name order", async () => {
      const findMany = vi.fn().mockResolvedValue([stored]);
      const repository = new PrismaUserRepository({ user: { findMany } } as unknown as PrismaClient);

      await expect(repository.list()).resolves.toEqual([stored]);
      expect(findMany).toHaveBeenCalledWith({ orderBy: { displayName: "asc" } });
    });
  });

  it("retries once when two first requests race on the unique oid", async () => {
    const upsert = vi.fn().mockRejectedValueOnce(prismaError("P2002")).mockResolvedValueOnce(stored);

    await expect(repositoryWith(upsert).upsert(data)).resolves.toEqual(stored);
    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it("gives up after three attempts with Conflict", async () => {
    const upsert = vi.fn().mockRejectedValue(prismaError("P2002"));

    await expect(repositoryWith(upsert).upsert(data)).rejects.toBeInstanceOf(ConflictError);
    expect(upsert).toHaveBeenCalledTimes(3);
  });

  it("does not retry other errors", async () => {
    const upsert = vi.fn().mockRejectedValue(prismaError("P1001"));

    const error = await repositoryWith(upsert).upsert(data).catch((e: unknown) => e);

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({ code: "P1001" });
  });
});
