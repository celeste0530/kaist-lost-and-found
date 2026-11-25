// FR-01 login / logout, and request-level error handling.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { type Api, SEED, startApi } from "./helpers";

describe("FR-01 authentication", () => {
  let api: Api;
  before(async () => {
    api = await startApi();
  });
  after(async () => {
    await api.close();
  });

  it("logs in and never returns the password hash", async () => {
    const c = api.client();
    const res = await c.post("/api/auth/login", { email: SEED.staff1, password: SEED.password });
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ["centerId", "displayName", "email", "id", "role"]);
    assert.equal(res.body.role, "Staff");
    assert.equal(res.body.centerId, 1);
    assert.equal((await c.get("/api/auth/me")).status, 200);
  });

  it("accepts the email in any letter case", async () => {
    const res = await api.client().post("/api/auth/login", { email: SEED.admin.toUpperCase(), password: SEED.password });
    assert.equal(res.status, 200);
  });

  it("uses the same message for a wrong password and an unknown email", async () => {
    const wrong = await api.client().post("/api/auth/login", { email: SEED.staff1, password: "wrong-password" });
    const unknown = await api.client().post("/api/auth/login", { email: "nobody@lostfound.test", password: "whatever1" });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.error, unknown.body.error);
  });

  it("rejects an invalid email format with 400", async () => {
    const res = await api.client().post("/api/auth/login", { email: "not-an-email", password: "x" });
    assert.equal(res.status, 400);
  });

  it("returns 401 for /me without a login", async () => {
    assert.equal((await api.client().get("/api/auth/me")).status, 401);
  });

  it("logs out (204) and the session no longer works", async () => {
    const c = await api.login(SEED.staff1);
    assert.equal((await c.post("/api/auth/logout")).status, 204);
    assert.equal((await c.get("/api/auth/me")).status, 401);
  });

  it("answers a malformed JSON body with 400, not 500", async () => {
    const res = await api.client().post("/api/auth/login", "{bad json");
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "Request body is not valid JSON.");
  });

  it("answers a JSON body over 100 KB with 413", async () => {
    const res = await api.client().post("/api/auth/login", { email: "a".repeat(120_000), password: "x" });
    assert.equal(res.status, 413);
  });

  it("answers an unknown API path with a JSON 404", async () => {
    const res = await api.client().get("/api/does-not-exist");
    assert.equal(res.status, 404);
    assert.equal(res.body.error, "Not found.");
  });

  it("reports the health check", async () => {
    const res = await api.client().get("/api/health");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });
  });

  it("finds no ENUM mismatch between the schema and constants.ts", async () => {
    const { findEnumMismatches } = await import("../src/checkSchema");
    assert.deepEqual(await findEnumMismatches(), []);
  });
});
