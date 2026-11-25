// SRS 3.7.2 test cases, one test each, in the order of the SRS.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { type Api, SEED, itemBody, koreaDate, startApi } from "./helpers";

describe("SRS 3.7.2 test cases", () => {
  let api: Api;
  before(async () => {
    api = await startApi();
  });
  after(async () => {
    await api.close();
  });

  const publicIds = async (query = "") => {
    const res = await api.client().get(`/api/items${query}`);
    assert.equal(res.status, 200);
    return (res.body as { id: number }[]).map((i) => i.id);
  };

  it("1. Register an item without an item name: rejected with an error", async () => {
    const staff = await api.login(SEED.staff1);
    const before = (await publicIds()).length;
    const res = await staff.post("/api/items", itemBody({ name: "" }));
    assert.equal(res.status, 400);
    assert.match(res.body.error, /^name: /);
    assert.equal((await publicIds()).length, before, "nothing must be saved");
  });

  it("2. Register an item with a future found date: rejected", async () => {
    const staff = await api.login(SEED.staff1);
    const res = await staff.post("/api/items", itemBody({ foundDate: koreaDate(1) }));
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "foundDate: Found date cannot be in the future");
  });

  it("3. Edit an item with a staff account of a different center: rejected unless administrator", async () => {
    // Item 8 is stored at center 2; staff1 belongs to center 1.
    const staff1 = await api.login(SEED.staff1);
    const denied = await staff1.put("/api/items/8", itemBody({ name: "Edited by another center" }));
    assert.equal(denied.status, 403);

    const admin = await api.login(SEED.admin);
    const allowed = await admin.put("/api/items/8", itemBody({ name: "Edited by administrator" }));
    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.name, "Edited by administrator");
    assert.equal(allowed.body.centerId, 2, "the storage center must not change");
  });

  it("4. Search by a keyword contained in the item description: matching Available items appear", async () => {
    // Item 1's description mentions "고양이"; its name does not.
    const res = await api.client().get(`/api/items?q=${encodeURIComponent("고양이")}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.some((i: { id: number }) => i.id === 1));
    assert.ok(res.body.every((i: { status: string }) => i.status === "Available"));
  });

  it("5. Filter by storage center: only Available items stored at that center appear", async () => {
    const res = await api.client().get("/api/items?centerId=2");
    assert.equal(res.status, 200);
    assert.ok(res.body.length > 0);
    for (const i of res.body) {
      assert.equal(i.centerId, 2);
      assert.equal(i.status, "Available");
    }
  });

  it("6. Mark an Available item as Returned: it disappears from default public search results", async () => {
    const staff = await api.login(SEED.staff1);
    assert.ok((await publicIds()).includes(2));
    const res = await staff.post("/api/items/2/return");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "Returned");
    assert.ok(!(await publicIds()).includes(2));
  });

  it("7. Mark an item as Removed or Disposed: it no longer appears in default public search results", async () => {
    const staff = await api.login(SEED.staff1);
    assert.equal((await staff.post("/api/items/3/remove")).status, 200);
    assert.equal((await staff.post("/api/items/4/dispose")).status, 200);
    const ids = await publicIds();
    assert.ok(!ids.includes(3));
    assert.ok(!ids.includes(4));
  });

  it("8. Restart the server after saving an item: the saved record remains available", async () => {
    // Restarts the HTTP server in this process; the record lives in MySQL, not in server memory.
    const staff = await api.login(SEED.staff1);
    const created = await staff.post("/api/items", itemBody({ name: "Saved before restart" }));
    assert.equal(created.status, 201);
    await api.restart();
    const res = await api.client().get(`/api/items/${created.body.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.name, "Saved before restart");
  });

  it("9. Delete a center that still has Available items: rejected", async () => {
    const admin = await api.login(SEED.admin);
    const res = await admin.delete("/api/centers/1");
    assert.equal(res.status, 409);
    assert.equal((await api.client().get("/api/centers/1")).status, 200, "the center must still exist");
  });

  it("10. Delete a center after it has no Available items: allowed", async () => {
    const admin = await api.login(SEED.admin);
    const center = await admin.post("/api/centers", {
      name: "Temporary desk",
      lat: 36.37,
      lng: 127.36,
      operatingHours: "Weekdays 09:00-18:00",
    });
    assert.equal(center.status, 201);
    const res = await admin.delete(`/api/centers/${center.body.id}`);
    assert.equal(res.status, 204);
    assert.equal((await api.client().get(`/api/centers/${center.body.id}`)).status, 404);
  });
});
