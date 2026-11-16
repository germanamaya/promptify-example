import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { AdministratorAssignedEvent } from "@/lib/audit/types";
import { ConflictError } from "@/lib/errors";
import { AdministratorService } from "@/lib/services/administrator-service";
import { seedFirstAdministrator } from "@/lib/seed/first-administrator";
import { asCurrentUser, openDatabase, seedUser } from "./support/db";

const db = openDatabase();
const { client } = db;

const audit = {
  events: [] as AdministratorAssignedEvent[],
  failWith: null as Error | null,
  async recordAdministratorAssigned(event: AdministratorAssignedEvent) {
    if (this.failWith) throw this.failWith;
    this.events.push(event);
  },
};

const service = new AdministratorService({ users: db.users, audit, now: () => new Date() });
const administratorCount = () => client.user.count({ where: { isAdministrator: true } });
const rounds = 15;

beforeEach(async () => {
  await db.reset();
  audit.events = [];
  audit.failWith = null;
});
afterAll(() => db.close());

describe("users: upsert", () => {
  it("creates a non-Administrator on first sight and keeps one row", async () => {
    const oid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

    const user = await db.users.upsert({ oid, displayName: "Ada" });

    expect(user).toEqual({ oid, displayName: "Ada", isAdministrator: false, language: "en" });
    expect(await client.user.count()).toBe(1);
  });

  it("updates the name but never the Administrator flag", async () => {
    const existing = await seedUser(client, { displayName: "Old", isAdministrator: true });

    const user = await db.users.upsert({ oid: existing.oid, displayName: "New" });

    expect(user).toEqual({ oid: existing.oid, displayName: "New", isAdministrator: true, language: "en" });
  });

  it("preserves a User's language preference when refreshing their name", async () => {
    const existing = await seedUser(client, { displayName: "Old" });
    await db.users.setLanguagePreference(existing.oid, "de");

    const user = await db.users.upsert({ oid: existing.oid, displayName: "New" });

    expect(user).toMatchObject({ displayName: "New", language: "de" });
  });

  it("updates the language preference for only the selected User", async () => {
    const selected = await seedUser(client);
    const other = await seedUser(client);

    await db.users.setLanguagePreference(selected.oid, "pt-PT");

    expect(await client.user.findUniqueOrThrow({ where: { oid: selected.oid } }))
      .toMatchObject({ language: "pt-PT" });
    expect(await client.user.findUniqueOrThrow({ where: { oid: other.oid } }))
      .toMatchObject({ language: "en" });
  });

  it("survives simultaneous first requests of the same User", async () => {
    for (let round = 0; round < rounds; round++) {
      await db.reset();
      const oid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

      const results = await Promise.allSettled(
        Array.from({ length: 8 }, (_, i) => db.users.upsert({ oid, displayName: `Name ${i}` })),
      );

      expect(results.filter((r) => r.status === "rejected")).toEqual([]);
      expect(await client.user.count()).toBe(1);
    }
  });
});

describe("users: promote", () => {
  it("promotes an existing User and reports unknown ones", async () => {
    const user = await seedUser(client);

    expect(await db.users.promote(user.oid, async () => {})).toBe("promoted");
    expect(await db.users.promote(user.oid, async () => {})).toBe("already_administrator");
    expect(await db.users.promote("9f2504e0-4f89-41d3-9a0c-0305e82c3309", async () => {})).toBe("not_found");
    expect(await client.user.count()).toBe(1);
  });

  it("rolls the promotion back when the audit step fails", async () => {
    const user = await seedUser(client);

    await expect(
      db.users.promote(user.oid, async () => {
        throw new Error("telemetry down");
      }),
    ).rejects.toThrow("telemetry down");

    expect((await client.user.findUniqueOrThrow({ where: { oid: user.oid } })).isAdministrator).toBe(false);
  });

  it("rolls back through the service when the audit event is not delivered", async () => {
    const actor = await seedUser(client, { isAdministrator: true });
    const target = await seedUser(client);
    audit.failWith = new Error("telemetry down");

    await expect(service.promote(asCurrentUser(actor), target.oid)).rejects.toThrow("telemetry down");

    expect((await client.user.findUniqueOrThrow({ where: { oid: target.oid } })).isAdministrator).toBe(false);
    expect(audit.events).toEqual([]);
  });

  it("audits actor, target and time when the promotion commits", async () => {
    const actor = await seedUser(client, { isAdministrator: true });
    const target = await seedUser(client);
    const at = new Date("2026-11-07T10:00:00Z");
    const timed = new AdministratorService({ users: db.users, audit, now: () => at });

    await timed.promote(asCurrentUser(actor), target.oid);

    expect(audit.events).toEqual([
      { actorOid: actor.oid, action: "administrator.assigned", targetId: target.oid, timestamp: at },
    ]);
    expect((await client.user.findUniqueOrThrow({ where: { oid: target.oid } })).isAdministrator).toBe(true);
  });

  it("promotes once and audits once when the same promotion races", async () => {
    for (let round = 0; round < rounds; round++) {
      await db.reset();
      audit.events = [];
      const actor = await seedUser(client, { isAdministrator: true });
      const target = await seedUser(client);

      const results = await Promise.allSettled(
        Array.from({ length: 4 }, () => service.promote(asCurrentUser(actor), target.oid)),
      );

      expect((await client.user.findUniqueOrThrow({ where: { oid: target.oid } })).isAdministrator).toBe(true);
      expect(results.filter((r) => r.status === "rejected"), `round ${round}`).toEqual([]);
      expect(audit.events, `round ${round}`).toHaveLength(1);
    }
  }, 60_000);

  it("never creates a User when promoting an unknown oid", async () => {
    const actor = await seedUser(client, { isAdministrator: true });

    await expect(service.promote(asCurrentUser(actor), "9f2504e0-4f89-41d3-9a0c-0305e82c3309")).rejects.toThrow();

    expect(await client.user.count()).toBe(1);
  });
});

describe("users: demote", () => {
  it("demotes while another Administrator remains and refuses the last one", async () => {
    const first = await seedUser(client, { isAdministrator: true });
    const second = await seedUser(client, { isAdministrator: true });

    expect(await db.users.demote(first.oid)).toBe("demoted");
    expect(await db.users.demote(second.oid)).toBe("last_administrator");
    expect(await administratorCount()).toBe(1);
  });

  it("answers the service with Conflict for the last Administrator", async () => {
    const only = await seedUser(client, { isAdministrator: true });

    await expect(service.demote(asCurrentUser(only), only.oid)).rejects.toBeInstanceOf(ConflictError);
    expect(await administratorCount()).toBe(1);
  });

  it("lets exactly one of two Administrators demoting each other win", async () => {
    for (let round = 0; round < rounds; round++) {
      await db.reset();
      const first = await seedUser(client, { isAdministrator: true });
      const second = await seedUser(client, { isAdministrator: true });

      const results = await Promise.allSettled([
        service.demote(asCurrentUser(first), second.oid),
        service.demote(asCurrentUser(second), first.oid),
      ]);

      expectExactlyOneDemotion(results, round);
    }
  });

  it("lets exactly one of two Administrators demoting themselves win", async () => {
    for (let round = 0; round < rounds; round++) {
      await db.reset();
      const first = await seedUser(client, { isAdministrator: true });
      const second = await seedUser(client, { isAdministrator: true });

      const results = await Promise.allSettled([
        service.demote(asCurrentUser(first), first.oid),
        service.demote(asCurrentUser(second), second.oid),
      ]);

      expectExactlyOneDemotion(results, round);
    }
  });

  it("leaves one Administrator when many demotions race", async () => {
    const users = await Promise.all(Array.from({ length: 4 }, () => seedUser(client, { isAdministrator: true })));

    const results = await Promise.allSettled(users.map((u) => service.demote(asCurrentUser(users[0]), u.oid)));

    expect(await administratorCount()).toBe(1);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    for (const result of results) {
      if (result.status === "rejected") expect(result.reason).toBeInstanceOf(ConflictError);
    }
  });
});

function expectExactlyOneDemotion(results: PromiseSettledResult<void>[], round: number) {
  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  expect(fulfilled, `round ${round}`).toHaveLength(1);
  expect(rejected, `round ${round}`).toHaveLength(1);
  expect(rejected[0].reason, `round ${round}`).toBeInstanceOf(ConflictError);
}

describe("seed", () => {
  it("creates the first Administrator once and audits it", async () => {
    const oid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

    await seedFirstAdministrator({ users: db.users, audit, oid, now: () => new Date() });
    await seedFirstAdministrator({ users: db.users, audit, oid, now: () => new Date() });

    expect(await client.user.count()).toBe(1);
    expect((await client.user.findUniqueOrThrow({ where: { oid } })).isAdministrator).toBe(true);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({ actorOid: "seed", targetId: oid });
  });
});
