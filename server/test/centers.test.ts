// FR-02 center management (and the public center APIs).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { type Api, SEED, dbQuery, startApi } from "./helpers";

const newCenter = (overrides: Record<string, unknown> = {}) => ({
  name: "Test desk",
  lat: 36.3695,
  lng: 127.362,
  operatingHours: "Weekdays 09:00-18:00",
  phone: "042-350-0000",
  ...overrides,
});

describe("FR-02 centers", () => {
  let api: Api;
  before(async () => {
    api = await startApi();
  });
  after(async () => {
    await api.close();
  });

  describe("public reads", () => {
    it("lists centers without the deleted one", async () => {
      const res = await api.client().get("/api/centers");
      assert.equal(res.status, 200);
      const ids = res.body.map((c: { id: number }) => c.id);
      assert.ok(ids.includes(1));
      assert.ok(!ids.includes(5), "center 5 is soft-deleted in the seed");
    });

    it("hides a deleted center and rejects a bad id with 404", async () => {
      assert.equal((await api.client().get("/api/centers/5")).status, 404);
      assert.equal((await api.client().get("/api/centers/abc")).status, 404);
    });
  });

  describe("create", () => {
    it("creates a center (201) and stores longitude as X, latitude as Y", async () => {
      const admin = await api.login(SEED.admin);
      const res = await admin.post("/api/centers", newCenter());
      assert.equal(res.status, 201);
      assert.equal(res.body.lat, 36.3695);
      assert.equal(res.body.lng, 127.362);
      assert.equal(res.body.email, null, "an omitted optional field is stored as NULL");
      const [row] = await dbQuery<{ x: number; y: number }>(
        "SELECT ST_X(location) AS x, ST_Y(location) AS y FROM center WHERE center_id = ?",
        [res.body.id],
      );
      assert.equal(row.x, 127.362);
      assert.equal(row.y, 36.3695);
    });

    it("rejects invalid input with 400", async () => {
      const admin = await api.login(SEED.admin);
      const blank = await admin.post("/api/centers", newCenter({ name: "   " }));
      assert.equal(blank.status, 400);
      assert.match(blank.body.error, /^name: /);
      const lat = await admin.post("/api/centers", newCenter({ lat: 999 }));
      assert.equal(lat.status, 400);
      assert.match(lat.body.error, /^lat: /);
    });

    it("is for administrators only", async () => {
      assert.equal((await api.client().post("/api/centers", newCenter())).status, 401);
      const staff = await api.login(SEED.staff1);
      assert.equal((await staff.post("/api/centers", newCenter())).status, 403);
    });
  });

  describe("edit", () => {
    it("replaces the whole center: an omitted optional field is cleared", async () => {
      const admin = await api.login(SEED.admin);
      const created = await admin.post("/api/centers", newCenter());
      const res = await admin.put(`/api/centers/${created.body.id}`, newCenter({ name: "Renamed desk", phone: undefined }));
      assert.equal(res.status, 200);
      assert.equal(res.body.name, "Renamed desk");
      assert.equal(res.body.phone, null);
    });

    it("returns 404 for a deleted or unknown center and 400 for a missing required field", async () => {
      const admin = await api.login(SEED.admin);
      assert.equal((await admin.put("/api/centers/5", newCenter())).status, 404);
      assert.equal((await admin.put("/api/centers/999", newCenter())).status, 404);
      const missing = await admin.put("/api/centers/1", { name: "No hours", lat: 36.37, lng: 127.36 });
      assert.equal(missing.status, 400);
      assert.equal(missing.body.error, "operatingHours: Required");
    });
  });

  describe("delete", () => {
    it("is a soft delete: the row and its items stay in the database", async () => {
      const admin = await api.login(SEED.admin);
      const created = await admin.post("/api/centers", newCenter());
      assert.equal((await admin.delete(`/api/centers/${created.body.id}`)).status, 204);
      const [row] = await dbQuery<{ deleted_at: string | null }>("SELECT deleted_at FROM center WHERE center_id = ?", [
        created.body.id,
      ]);
      assert.ok(row.deleted_at, "deleted_at must be set");
      assert.equal((await admin.delete(`/api/centers/${created.body.id}`)).status, 404, "deleting twice is 404");
    });

    it("rejects deleting a center with Available items (409)", async () => {
      const admin = await api.login(SEED.admin);
      assert.equal((await admin.delete("/api/centers/2")).status, 409);
    });
  });
});
