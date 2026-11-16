import { describe, expect, it } from "vitest";
import { resolveUser } from "@/lib/identity/resolve-user";
import { createFakeRepositories } from "../../fakes/repositories";

const oid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("resolveUser", () => {
  it("creates a non-Administrator User on first sight", async () => {
    const { users, db } = createFakeRepositories();

    const user = await resolveUser(users, { oid, name: "Ada" });

    expect(user).toEqual({ oid, name: "Ada", isAdministrator: false, language: "en" });
    expect(db.users.size).toBe(1);
  });

  it("takes the Administrator flag from the database only", async () => {
    const { users, db } = createFakeRepositories();
    db.seedUser({ oid, displayName: "Old", isAdministrator: true });

    const user = await resolveUser(users, { oid, name: "New" });

    expect(user).toEqual({ oid, name: "New", isAdministrator: true, language: "en" });
  });

  it("keeps the language preference stored for the User", async () => {
    const { users, db } = createFakeRepositories();
    db.seedUser({ oid, displayName: "Ada", language: "it" });

    const user = await resolveUser(users, { oid, name: "Ada" });

    expect(user.language).toBe("it");
  });

  it("keeps a single User across repeated requests", async () => {
    const { users, db } = createFakeRepositories();

    await resolveUser(users, { oid, name: "Ada" });
    await resolveUser(users, { oid, name: "Ada" });

    expect(db.users.size).toBe(1);
  });
});
