import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";
import { CATEGORIES, ITEM_STATUSES } from "../constants";
import { pool } from "../db";
import { requireAuth } from "../middleware/auth";
import { removeUpload, uploadImage } from "../middleware/upload";
import { notImplemented, parseBody, parseId } from "../utils";

const router = Router();

// Coordinates: found_location is a POINT with X = longitude, Y = latitude.
const ITEM_SELECT = `
  SELECT i.item_id AS id, i.name, i.category, i.found_date AS foundDate,
         ST_Y(i.found_location) AS foundLat, ST_X(i.found_location) AS foundLng,
         i.description, i.image AS imageUrl, i.status, i.registration_date AS registrationDate,
         c.center_id AS centerId, c.name AS centerName
  FROM item i
  JOIN center c ON c.center_id = i.center_id`;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// "2026-02-30" matches the YYYY-MM-DD pattern but is not a real day.
function isRealDate(value: string): boolean {
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// FR-03 "the found date cannot be in the future": "today" is the date on campus (Korea),
// independent of the server's or the database's time zone.
function todayInKorea(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

// Form fields arrive as strings in multipart/form-data. Convert "36.37" to 36.37,
// but keep "" as a string so an empty field is rejected instead of silently becoming 0.
const coordinate = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v),
    z.number().min(min).max(max),
  );

// FR-03: fields entered by staff. The storage center and status are set by the server.
const itemCreateInput = z.object({
  name: z.string().trim().min(1).max(255),
  category: z.enum(CATEGORIES),
  foundDate: date
    .refine(isRealDate, "Invalid date")
    .refine((d) => d <= todayInKorea(), "Found date cannot be in the future"),
  foundLat: coordinate(-90, 90),
  foundLng: coordinate(-180, 180),
  description: z.string().trim().min(1),
});

// FR-04: the same fields as registration (all required, so nothing is cleared by omission).
// Image: send a new file to replace it, removeImage=true to delete it, or neither to keep it.
const itemUpdateInput = itemCreateInput.extend({
  removeImage: z.preprocess((v) => v === true || v === "true", z.boolean()),
});

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  foundDateFrom: date.optional(),
  foundDateTo: date.optional(),
  centerId: z.coerce.number().int().positive().optional(),
  // Found-location filter (SRS does not say how): bounding box "minLng,minLat,maxLng,maxLat".
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/)
    .optional(),
  // Only honoured for logged-in staff; public users always get Available items.
  status: z.enum(ITEM_STATUSES).optional(),
});

// FR-05 / FR-07: search, filter and list items (the map uses the same endpoint).
router.get("/", async (req, res) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid search parameters." });
    return;
  }
  const { q, category, foundDateFrom, foundDateTo, centerId, bbox, status } = parsed.data;

  const where: string[] = ["i.status = ?"];
  const params: (string | number)[] = [req.user && status ? status : "Available"];

  if (q) {
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`; // escape LIKE wildcards
    where.push("(i.name LIKE ? OR i.description LIKE ?)");
    params.push(like, like);
  }
  if (category) {
    where.push("i.category = ?");
    params.push(category);
  }
  if (foundDateFrom) {
    where.push("i.found_date >= ?");
    params.push(foundDateFrom);
  }
  if (foundDateTo) {
    where.push("i.found_date <= ?");
    params.push(foundDateTo);
  }
  if (centerId) {
    where.push("i.center_id = ?");
    params.push(centerId);
  }
  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox.split(",").map(Number);
    where.push("ST_X(i.found_location) BETWEEN ? AND ? AND ST_Y(i.found_location) BETWEEN ? AND ?");
    params.push(minLng, maxLng, minLat, maxLat);
  }

  // FR-05: results ordered by registration date (newest first). No pagination: SRS targets ~1,000 records.
  const [rows] = await pool.query<RowDataPacket[]>(
    `${ITEM_SELECT} WHERE ${where.join(" AND ")} ORDER BY i.registration_date DESC, i.item_id DESC`,
    params,
  );
  res.json(rows);
});

// FR-06: item details.
router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const [rows] = id
    ? await pool.query<RowDataPacket[]>(`${ITEM_SELECT} WHERE i.item_id = ?`, [id])
    : [[] as RowDataPacket[]];
  const item = rows[0];
  // Public users only see Available items; staff can open any status.
  if (!item || (item.status !== "Available" && !req.user)) {
    res.status(404).json({ error: "Item not found." });
    return;
  }
  res.json(item);
});

// FR-03: a staff member registers a found item at their own center, with one optional JPG/PNG image.
// Administrators have no assigned center and cannot register items. Storage center and status are set by the server.
router.post("/", requireAuth, uploadImage, async (req, res) => {
  // uploadImage has already saved the image (if one was sent). Delete it again unless the item
  // is saved, so a rejected request leaves no orphan file behind (SRS 3.4.1).
  const file = req.file;
  let saved = false;
  try {
    const user = req.user!; // requireAuth has already rejected requests without a logged-in user
    if (user.centerId === null) {
      res.status(403).json({ error: "Only staff assigned to a center can register items." });
      return;
    }

    const it = parseBody(itemCreateInput, req.body, res);
    if (it === null) return;

    // FR-02: a deleted center no longer takes new items, so insert only while the center is active.
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO item (center_id, registered_by, name, category, found_date, found_location, description, image, status)
       SELECT center_id, ?, ?, ?, ?, POINT(?, ?), ?, ?, 'Available'
       FROM center WHERE center_id = ? AND deleted_at IS NULL`,
      [
        user.id, it.name, it.category, it.foundDate, it.foundLng, it.foundLat, it.description,
        file?.filename ?? null, user.centerId,
      ],
    );
    if (result.affectedRows === 0) {
      res.status(409).json({ error: "Your assigned center has been deleted. Ask an administrator to reassign you." });
      return;
    }
    saved = true;

    const [rows] = await pool.query<RowDataPacket[]>(`${ITEM_SELECT} WHERE i.item_id = ?`, [result.insertId]);
    res.status(201).json(rows[0]);
  } finally {
    if (file && !saved) await removeUpload(file.filename);
  }
});

// FR-04 / FR-10: edit an Available item. Staff can edit items stored at their own center;
// administrators can edit items at any center. Returned, Removed and Disposed items cannot be edited.
// The storage center and the status are not changed here.
router.put("/:id", requireAuth, uploadImage, async (req, res) => {
  const file = req.file;
  let saved = false;
  try {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(404).json({ error: "Item not found." });
      return;
    }
    const it = parseBody(itemUpdateInput, req.body, res);
    if (it === null) return;
    const user = req.user!; // requireAuth has already rejected requests without a logged-in user

    let oldImage: string | null = null;
    const conn = await pool.getConnection();
    let committed = false;
    try {
      await conn.beginTransaction();
      // FOR UPDATE locks the row until commit, so the checks below still hold when the UPDATE runs
      // (nobody can mark the item Returned or move it in between).
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT center_id, status, image FROM item WHERE item_id = ? FOR UPDATE",
        [id],
      );
      const item = rows[0];
      if (!item) {
        res.status(404).json({ error: "Item not found." });
        return;
      }
      if (user.role !== "Administrator" && item.center_id !== user.centerId) {
        res.status(403).json({ error: "You can only edit items stored at your center." });
        return;
      }
      if (item.status !== "Available") {
        res.status(409).json({ error: "Only Available items can be edited." });
        return;
      }

      const newImage: string | null = file ? file.filename : it.removeImage ? null : item.image;
      await conn.query(
        `UPDATE item
         SET name = ?, category = ?, found_date = ?, found_location = POINT(?, ?), description = ?, image = ?
         WHERE item_id = ?`,
        [it.name, it.category, it.foundDate, it.foundLng, it.foundLat, it.description, newImage, id],
      );
      await conn.commit();
      committed = true;
      saved = true;
      if (item.image && item.image !== newImage) oldImage = item.image;
    } finally {
      if (!committed) await conn.rollback();
      conn.release();
    }

    if (oldImage) await removeUpload(oldImage); // replaced or removed: the old file is no longer used

    const [rows] = await pool.query<RowDataPacket[]>(`${ITEM_SELECT} WHERE i.item_id = ?`, [id]);
    res.json(rows[0]);
  } finally {
    if (file && !saved) await removeUpload(file.filename);
  }
});

// --- Not implemented yet -------------------------------------------------------------------
// FR-08: mark Returned. Set return_date = NOW(), returned_by = req.user.id. Update atomically (3.4.1).
router.post("/:id/return", requireAuth, notImplemented("FR-08"));
// FR-09: mark Removed (invalid / duplicate record) or Disposed (no longer stored).
router.post("/:id/remove", requireAuth, notImplemented("FR-09"));
router.post("/:id/dispose", requireAuth, notImplemented("FR-09"));

export default router;
