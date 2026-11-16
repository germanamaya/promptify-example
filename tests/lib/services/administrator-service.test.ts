import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { AdministratorAssignedEvent, AuditLog } from "@/lib/audit/types";
import { AdministratorService } from "@/lib/services/administrator-service";
import type { CurrentUser } from "@/lib/services/types";
import { createFakeRepositories } from "../../fakes/repositories";

const admin: CurrentUser = { oid: "a0000000-0000-4000-8000-000000000001", name: "Admin", isAdministrator: true, language: "en" };
const second: CurrentUser = { oid: "b0000000-0000-4000-8000-000000000002", name: "Second", isAdministrator: true, language: "en" };
const user: CurrentUser = { oid: "c0000000-0000-4000-8000-000000000003", name: "User", isAdministrator: false, language: "en" };
const missingOid = "d0000000-0000-4000-8000-000000000004";
const now = new Date("2026-11-07T10:00:00Z");

class FakeAuditLog implements AuditLog {
  events: AdministratorAssignedEvent[] = [];
  failWith: Error | null = null;

  async recordAdministratorAssigned(event: AdministratorAssignedEvent) {
    if (this.failWith) throw this.failWith;
    this.events.push(event);
  }
}

describe("AdministratorService", () => {
  let repos: ReturnType<typeof createFakeRepositories>;
  let audit: FakeAuditLog;
  let service: AdministratorService;

  beforeEach(() => {
    repos = createFakeRepositories();
    [admin, user].forEach((u) => repos.db.seedUser(u));
    audit = new FakeAuditLog();
    service = new AdministratorService({ users: repos.users, audit, now: () => now });
  });

  describe("promote", () => {
    it("promotes an existing User and audits actor, target and time", async () => {
      await service.promote(admin, user.oid);

      expect(repos.db.users.get(user.oid)?.isAdministrator).toBe(true);
      expect(audit.events).toEqual([
        { actorOid: admin.oid, action: "administrator.assigned", targetId: user.oid, timestamp: now },
      ]);
    });

    it("forbids a plain User and audits nothing", async () => {
      await expect(service.promote(user, user.oid)).rejects.toBeInstanceOf(ForbiddenError);

      expect(repos.db.users.get(user.oid)?.isAdministrator).toBe(false);
      expect(audit.events).toEqual([]);
    });

    it("throws NotFound for an unknown User and never creates one", async () => {
      await expect(service.promote(admin, missingOid)).rejects.toBeInstanceOf(NotFoundError);

      expect(repos.db.users.has(missingOid)).toBe(false);
      expect(audit.events).toEqual([]);
    });

    it("does not audit when the User is already an Administrator", async () => {
      await service.promote(admin, admin.oid);

      expect(audit.events).toEqual([]);
    });

    it("rolls the promotion back when the audit event cannot be sent", async () => {
      audit.failWith = new Error("telemetry down");

      await expect(service.promote(admin, user.oid)).rejects.toThrow("telemetry down");

      expect(repos.db.users.get(user.oid)?.isAdministrator).toBe(false);
    });
  });

  describe("demote", () => {
    beforeEach(() => {
      repos.db.seedUser(second);
    });

    it("demotes an Administrator while another remains", async () => {
      await service.demote(admin, second.oid);

      expect(repos.db.users.get(second.oid)?.isAdministrator).toBe(false);
    });

    it("lets an Administrator demote themselves while another remains", async () => {
      await service.demote(admin, admin.oid);

      expect(repos.db.users.get(admin.oid)?.isAdministrator).toBe(false);
    });

    it("refuses to demote the last Administrator with Conflict", async () => {
      await service.demote(admin, second.oid);

      await expect(service.demote(admin, admin.oid)).rejects.toBeInstanceOf(ConflictError);
      expect(repos.db.users.get(admin.oid)?.isAdministrator).toBe(true);
    });

    it("forbids a plain User", async () => {
      await expect(service.demote(user, admin.oid)).rejects.toBeInstanceOf(ForbiddenError);
      expect(repos.db.users.get(admin.oid)?.isAdministrator).toBe(true);
    });

    it("throws NotFound for an unknown User", async () => {
      await expect(service.demote(admin, missingOid)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("is a no-op for a User who is not an Administrator", async () => {
      await expect(service.demote(admin, user.oid)).resolves.toBeUndefined();
    });
  });
});
