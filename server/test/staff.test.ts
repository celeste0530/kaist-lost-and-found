// FR-10 staff account management.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { type Api, SEED, dbQuery, startApi } from "./helpers";

describe("FR-10 staff accounts", () => {
  let api: Api;
  before(async () => {
    api = await startApi();
  });
  after(async () => {
    await api.close();
  });

  it("lists every account for administrators, without password data", async () => {
    const admin = await api.login(SEED.admin);
    const res = await admin.get("/api/staff");
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 5);
    for (const s of res.body) {
      assert.deepEqual(Object.keys(s).sort(), ["centerId", "deactivatedAt", "displayName", "email", "id", "role"]);
    }
  });

  it("is for administrators only", async () => {
    assert.equal((await api.client().get("/api/staff")).status, 401);
    const staff = await api.login(SEED.staff1);
    assert.equal((await staff.get("/api/staff")).status, 403);
    assert.equal((await staff.put("/api/staff/2", { displayName: "Me", centerId: 2 })).status, 403, "staff cannot move themselves");
  });

  describe("create", () => {
    it("creates a Staff account even when role Administrator is sent", async () => {
      const admin = await api.login(SEED.admin);
      const res = await admin.post("/api/staff", {
        email: "new.staff@lostfound.test",
        password: "newpass123",
        displayName: "New staff",
        centerId: 3,
        role: "Administrator",
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.role, "Staff");
      assert.equal(res.body.centerId, 3);
      const [row] = await dbQuery<{ password_hash: string }>("SELECT password_hash FROM staff_user WHERE user_id = ?", [
        res.body.id,
      ]);
      assert.match(row.password_hash, /^\$2[aby]\$12\$/, "the password is stored as a bcrypt hash");
      assert.equal((await api.client().post("/api/auth/login", { email: "new.staff@lostfound.test", password: "newpass123" })).status, 200);
    });

    it("rejects a duplicate email in any letter case (409)", async () => {
      const admin = await api.login(SEED.admin);
      const res = await admin.post("/api/staff", {
        email: SEED.staff1.toUpperCase(),
        password: "newpass123",
        displayName: "Duplicate",
        centerId: 1,
      });
      assert.equal(res.status, 409);
    });

    it("rejects a deleted or unknown center and a short password (400)", async () => {
      const admin = await api.login(SEED.admin);
      const base = { email: "x@lostfound.test", password: "newpass123", displayName: "X" };
      assert.equal((await admin.post("/api/staff", { ...base, centerId: 5 })).status, 400);
      assert.equal((await admin.post("/api/staff", { ...base, centerId: 999 })).status, 400);
      const short = await admin.post("/api/staff", { ...base, password: "short", centerId: 1 });
      assert.equal(short.status, 400);
      assert.match(short.body.error, /^password: /);
    });
  });

  describe("edit", () => {
    it("moves a staff member to another center without moving their items", async () => {
      const admin = await api.login(SEED.admin);
      const before = await dbQuery<{ n: number }>("SELECT COUNT(*) AS n FROM item WHERE registered_by = 5 AND center_id = 4");
      const res = await admin.put("/api/staff/5", { displayName: "Moved staff", centerId: 3 });
      assert.equal(res.status, 200);
      assert.equal(res.body.centerId, 3);
      const after = await dbQuery<{ n: number }>("SELECT COUNT(*) AS n FROM item WHERE registered_by = 5 AND center_id = 4");
      assert.equal(after[0].n, before[0].n);
    });

    it("keeps the password unless a new one is sent", async () => {
      const admin = await api.login(SEED.admin);
      assert.equal((await admin.put("/api/staff/4", { displayName: "Kept", centerId: 3 })).status, 200);
      await api.login("staff3@lostfound.test"); // old password still works

      assert.equal((await admin.put("/api/staff/4", { displayName: "Reset", centerId: 3, password: "brandnew123" })).status, 200);
      const old = await api.client().post("/api/auth/login", { email: "staff3@lostfound.test", password: SEED.password });
      assert.equal(old.status, 401);
      await api.login("staff3@lostfound.test", "brandnew123");
    });

    it("cannot edit an administrator, an unknown account, or assign a deleted center", async () => {
      const admin = await api.login(SEED.admin);
      assert.equal((await admin.put("/api/staff/1", { displayName: "Admin", centerId: 1 })).status, 404);
      assert.equal((await admin.put("/api/staff/999", { displayName: "Ghost", centerId: 1 })).status, 404);
      assert.equal((await admin.put("/api/staff/2", { displayName: "Staff", centerId: 5 })).status, 400);
    });
  });

  describe("deactivate / activate", () => {
    it("blocks login and an existing session, keeps the account's records, and can be undone", async () => {
      const admin = await api.login(SEED.admin);
      const session = await api.login(SEED.staff2);

      const off = await admin.post("/api/staff/3/deactivate");
      assert.equal(off.status, 200);
      assert.ok(off.body.deactivatedAt);

      assert.equal((await session.get("/api/auth/me")).status, 401, "existing session stops working");
      const login = await api.client().post("/api/auth/login", { email: SEED.staff2, password: SEED.password });
      assert.equal(login.status, 403);
      assert.equal(login.body.error, "This account has been deactivated.");
      const wrong = await api.client().post("/api/auth/login", { email: SEED.staff2, password: "wrong-password" });
      assert.equal(wrong.status, 401, "a wrong password does not reveal the account state");

      const [items] = await dbQuery<{ n: number }>("SELECT COUNT(*) AS n FROM item WHERE registered_by = 3");
      assert.ok(items.n > 0, "items registered by the account remain");

      assert.equal((await admin.post("/api/staff/3/deactivate")).status, 409);
      const on = await admin.post("/api/staff/3/activate");
      assert.equal(on.status, 200);
      assert.equal(on.body.deactivatedAt, null);
      assert.equal((await admin.post("/api/staff/3/activate")).status, 409);
      await api.login(SEED.staff2);
    });

    it("cannot deactivate an administrator or an unknown account, and is for administrators only", async () => {
      const admin = await api.login(SEED.admin);
      assert.equal((await admin.post("/api/staff/1/deactivate")).status, 404);
      assert.equal((await admin.post("/api/staff/999/deactivate")).status, 404);
      const staff = await api.login(SEED.staff1);
      assert.equal((await staff.post("/api/staff/3/deactivate")).status, 403);
      assert.equal((await api.client().post("/api/staff/3/deactivate")).status, 401);
    });
  });
});
