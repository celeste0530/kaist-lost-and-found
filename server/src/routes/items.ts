import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { CATEGORIES, ITEM_STATUSES } from "../constants";
import { pool } from "../db";
import { requireAuth } from "../middleware/auth";
import { notImplemented, parseId } from "../utils";

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

// --- Not implemented yet -------------------------------------------------------------------
// FR-03: register. Use uploadImage middleware (src/middleware/upload.ts). Validate: name, category,
//        found date (not in the future), found location (lng/lat), description. Storage center =
//        req.user.centerId (not editable). New items start as 'Available'. Administrators: decide which center.
router.post("/", requireAuth, notImplemented("FR-03"));
// FR-04: edit. Only while status = 'Available' and item.center_id = req.user.centerId (or administrator).
router.put("/:id", requireAuth, notImplemented("FR-04"));
// FR-08: mark Returned. Set return_date = NOW(), returned_by = req.user.id. Update atomically (3.4.1).
router.post("/:id/return", requireAuth, notImplemented("FR-08"));
// FR-09: mark Removed (invalid / duplicate record) or Disposed (no longer stored).
router.post("/:id/remove", requireAuth, notImplemented("FR-09"));
router.post("/:id/dispose", requireAuth, notImplemented("FR-09"));

export default router;
