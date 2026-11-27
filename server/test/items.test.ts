// FR-03 to FR-09: item registration, search, details, editing and status changes.
//
// Seed items used here (db/seed.sql):
//   center 1 (staff1): 1-4 Available, 5-6 Returned, 7 Disposed
//   center 2 (staff2): 8-12 Available, 13 Returned, 14 Removed
//   center 3 (staff3): 15-18 Available
//   center 4 (staff4): 21-24 Available
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { type Api, SEED, dbQuery, imageBlob, itemBody, itemForm, startApi, uploadedFiles } from "./helpers";

const STAFF3 = "staff3@lostfound.test"; // user 4, center 3

describe("items", () => {
  let api: Api;
  before(async () => {
    api = await startApi();
  });
  after(async () => {
    await api.close();
  });

  describe("FR-03 register", () => {
    it("registers at the staff member's own center as Available, ignoring a centerId in the request", async () => {
      const staff = await api.login(SEED.staff1);
      const res = await staff.post("/api/items", itemBody({ centerId: 2 }));
      assert.equal(res.status, 201);
      assert.equal(res.body.centerId, 1);
      assert.equal(res.body.status, "Available");
      assert.equal(res.body.imageUrl, null);
      const history = await dbQuery("SELECT from_status, to_status, changed_by FROM item_status_history WHERE item_id = ?", [
        res.body.id,
      ]);
      assert.deepEqual(history, [{ from_status: null, to_status: "Available", changed_by: 2 }]);
    });

    it("is for staff assigned to a center: administrators 403, no login 401", async () => {
      const admin = await api.login(SEED.admin);
      const res = await admin.post("/api/items", itemBody());
      assert.equal(res.status, 403);
      assert.equal((await api.client().post("/api/items", itemBody())).status, 401);
    });

    it("rejects an impossible date, an unknown category and an empty coordinate (400)", async () => {
      const staff = await api.login(SEED.staff1);
      const date = await staff.post("/api/items", itemBody({ foundDate: "2026-02-30" }));
      assert.equal(date.status, 400);
      assert.equal(date.body.error, "foundDate: Invalid date");
      assert.equal((await staff.post("/api/items", itemBody({ category: "Phone" }))).status, 400);
      const lat = await staff.post("/api/items", itemForm({ foundLat: "" }));
      assert.equal(lat.status, 400);
      assert.match(lat.body.error, /^foundLat: /, "an empty form field must not become 0");
    });

    it("stores an uploaded image and serves it under /uploads", async () => {
      const staff = await api.login(SEED.staff1);
      const res = await staff.post("/api/items", itemForm({ foundLat: "36.3738" }, imageBlob()));
      assert.equal(res.status, 201);
      assert.equal(res.body.foundLat, 36.3738, "multipart coordinates are converted to numbers");
      assert.ok(uploadedFiles().includes(res.body.imageUrl));
      assert.equal((await api.client().get(`/uploads/${res.body.imageUrl}`)).status, 200);
    });

    it("rejects a non-image file and a file over 10 MB without keeping them", async () => {
      const staff = await api.login(SEED.staff1);
      const before = uploadedFiles().length;
      const text = await staff.post("/api/items", itemForm({}, imageBlob("text/plain"), "note.txt"));
      assert.equal(text.status, 400);
      assert.equal(text.body.error, "image: Only JPG or PNG images are allowed.");
      const big = await staff.post("/api/items", itemForm({}, imageBlob("image/jpeg", 11 * 1024 * 1024), "big.jpg"));
      assert.equal(big.status, 400);
      assert.equal(big.body.error, "image: Image must be 10 MB or smaller.");
      assert.equal(uploadedFiles().length, before);
    });

    it("deletes the uploaded image when the registration is rejected", async () => {
      const staff = await api.login(SEED.staff1);
      const admin = await api.login(SEED.admin);
      const before = uploadedFiles().length;
      assert.equal((await staff.post("/api/items", itemForm({ name: "" }, imageBlob()))).status, 400);
      assert.equal((await admin.post("/api/items", itemForm({}, imageBlob()))).status, 403);
      assert.equal(uploadedFiles().length, before);
    });

    it("rejects a staff member whose assigned center has been deleted (409)", async () => {
      const admin = await api.login(SEED.admin);
      const center = await admin.post("/api/centers", { name: "Closing desk", lat: 36.37, lng: 127.36, operatingHours: "9-18" });
      const staff = await admin.post("/api/staff", {
        email: "closing@lostfound.test",
        password: "closing123",
        displayName: "Closing",
        centerId: center.body.id,
      });
      assert.equal(staff.status, 201);
      assert.equal((await admin.delete(`/api/centers/${center.body.id}`)).status, 204);
      const c = await api.login("closing@lostfound.test", "closing123");
      assert.equal((await c.post("/api/items", itemBody())).status, 409);
    });
  });

  describe("FR-05 search and FR-06 details", () => {
    it("lists Available items only, newest first", async () => {
      const res = await api.client().get("/api/items");
      assert.equal(res.status, 200);
      assert.ok(res.body.every((i: { status: string }) => i.status === "Available"));
      const dates = res.body.map((i: { registrationDate: string }) => i.registrationDate);
      assert.deepEqual(dates, [...dates].sort().reverse());
    });

    it("filters by category and found date range", async () => {
      const cat = await api.client().get("/api/items?category=Umbrella");
      assert.ok(cat.body.length > 0);
      assert.ok(cat.body.every((i: { category: string }) => i.category === "Umbrella"));
      const range = await api.client().get("/api/items?foundDateFrom=2026-11-15&foundDateTo=2026-11-17");
      assert.ok(range.body.length > 0);
      assert.ok(range.body.every((i: { foundDate: string }) => i.foundDate >= "2026-11-15" && i.foundDate <= "2026-11-17"));
    });

    it("treats % and _ in the keyword as plain characters", async () => {
      assert.deepEqual((await api.client().get("/api/items?q=%25")).body, []);
      assert.deepEqual((await api.client().get("/api/items?q=_")).body, []);
    });

    it("ignores the status filter for public users but applies it for staff", async () => {
      const pub = await api.client().get("/api/items?status=Returned");
      assert.ok(pub.body.every((i: { status: string }) => i.status === "Available"));
      const staff = await api.login(SEED.staff1);
      const res = await staff.get("/api/items?status=Returned");
      assert.ok(res.body.length > 0);
      assert.ok(res.body.every((i: { status: string }) => i.status === "Returned"));
    });

    it("rejects invalid search parameters with 400, including impossible dates", async () => {
      for (const q of ["category=Phone", "foundDateFrom=2026-02-30", "bbox=1,2,3", "centerId=abc"]) {
        assert.equal((await api.client().get(`/api/items?${q}`)).status, 400, q);
      }
    });

    it("shows details of Available items to everyone and other statuses to staff only", async () => {
      assert.equal((await api.client().get("/api/items/1")).status, 200);
      assert.equal((await api.client().get("/api/items/5")).status, 404, "Returned item, public");
      const staff = await api.login(SEED.staff1);
      const res = await staff.get("/api/items/5");
      assert.equal(res.status, 200);
      assert.equal(res.body.status, "Returned");
      assert.equal((await api.client().get("/api/items/abc")).status, 404);
    });
  });

  describe("FR-04 edit", () => {
    it("edits an item at the staff member's own center without changing its center or status", async () => {
      const staff = await api.login(SEED.staff1);
      const res = await staff.put("/api/items/1", itemBody({ name: "Edited phone", category: "Electronics" }));
      assert.equal(res.status, 200);
      assert.equal(res.body.name, "Edited phone");
      assert.equal(res.body.centerId, 1);
      assert.equal(res.body.status, "Available");
    });

    it("rejects items that are not Available (409), even for administrators, and unknown items (404)", async () => {
      const staff = await api.login(SEED.staff1);
      const admin = await api.login(SEED.admin);
      assert.equal((await staff.put("/api/items/5", itemBody())).status, 409);
      assert.equal((await admin.put("/api/items/14", itemBody())).status, 409);
      assert.equal((await admin.put("/api/items/999", itemBody())).status, 404);
    });

    it("replaces, keeps and removes the image, deleting files that are no longer used", async () => {
      const staff = await api.login(SEED.staff1);
      const created = await staff.post("/api/items", itemForm({}, imageBlob()));
      const first = created.body.imageUrl as string;

      const replaced = await staff.put(`/api/items/${created.body.id}`, itemForm({}, imageBlob()));
      assert.equal(replaced.status, 200);
      const second = replaced.body.imageUrl as string;
      assert.notEqual(second, first);
      assert.ok(!uploadedFiles().includes(first), "the old file is deleted");
      assert.ok(uploadedFiles().includes(second));

      const kept = await staff.put(`/api/items/${created.body.id}`, itemForm());
      assert.equal(kept.body.imageUrl, second);

      const removed = await staff.put(`/api/items/${created.body.id}`, itemForm({ removeImage: "true" }));
      assert.equal(removed.body.imageUrl, null);
      assert.ok(!uploadedFiles().includes(second));
    });

    it("does not keep a new image when the edit is rejected", async () => {
      const staff2 = await api.login(SEED.staff2);
      const before = uploadedFiles().length;
      assert.equal((await staff2.put("/api/items/1", itemForm({}, imageBlob()))).status, 403);
      assert.equal(uploadedFiles().length, before);
    });
  });

  describe("FR-08 / FR-09 status changes", () => {
    it("marks Returned and records the return date, the staff user and a history row", async () => {
      const staff = await api.login(STAFF3);
      const res = await staff.post("/api/items/15/return");
      assert.equal(res.status, 200);
      assert.equal(res.body.status, "Returned");
      const [item] = await dbQuery<{ return_date: string | null; returned_by: number | null }>(
        "SELECT return_date, returned_by FROM item WHERE item_id = 15",
      );
      assert.ok(item.return_date);
      assert.equal(item.returned_by, 4);
      const history = await dbQuery(
        "SELECT from_status, to_status, changed_by FROM item_status_history WHERE item_id = 15 ORDER BY history_id",
      );
      assert.deepEqual(history.at(-1), { from_status: "Available", to_status: "Returned", changed_by: 4 });
    });

    it("only changes Available items (3.5.3)", async () => {
      const staff = await api.login(STAFF3);
      const again = await staff.post("/api/items/15/return");
      assert.equal(again.status, 409);
      assert.equal(again.body.error, "Only Available items can be marked Returned.");
      assert.equal((await staff.post("/api/items/15/dispose")).status, 409);
    });

    it("marks Removed and Disposed, keeping the record and writing history", async () => {
      const staff = await api.login(STAFF3);
      assert.equal((await staff.post("/api/items/17/remove")).body.status, "Removed");
      assert.equal((await staff.post("/api/items/18/dispose")).body.status, "Disposed");
      const rows = await dbQuery<{ item_id: number; status: string; returned_by: number | null }>(
        "SELECT item_id, status, returned_by FROM item WHERE item_id IN (17, 18) ORDER BY item_id",
      );
      assert.deepEqual(rows, [
        { item_id: 17, status: "Removed", returned_by: null },
        { item_id: 18, status: "Disposed", returned_by: null },
      ]);
      const history = await dbQuery<{ item_id: number; to_status: string }>(
        "SELECT item_id, to_status FROM item_status_history WHERE item_id IN (17, 18) AND from_status = 'Available'",
      );
      assert.equal(history.length, 2);
    });

    it("lets staff change only their own center's items, administrators any center", async () => {
      const staff1 = await api.login(SEED.staff1);
      assert.equal((await staff1.post("/api/items/21/return")).status, 403);
      const admin = await api.login(SEED.admin);
      assert.equal((await admin.post("/api/items/22/return")).status, 200);
      assert.equal((await admin.post("/api/items/999/return")).status, 404);
      assert.equal((await api.client().post("/api/items/23/return")).status, 401);
    });

    it("lets only one of two simultaneous requests change the same item", async () => {
      const staff = await api.login(STAFF3);
      const results = await Promise.all([staff.post("/api/items/16/return"), staff.post("/api/items/16/return")]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      const history = await dbQuery("SELECT * FROM item_status_history WHERE item_id = 16 AND to_status = 'Returned'");
      assert.equal(history.length, 1);
    });
  });
});
