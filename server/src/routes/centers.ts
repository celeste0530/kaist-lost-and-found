import { Router } from "express";
import { z } from "zod";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db";
import { requireAdmin } from "../middleware/auth";
import { parseId } from "../utils";

const router = Router();

// Deleted centers (soft delete) are never listed publicly.
const CENTER_SELECT = `
  SELECT center_id AS id, name, ST_Y(location) AS lat, ST_X(location) AS lng,
         phone, email, operating_hours AS operatingHours, closure_information AS closureInformation
  FROM center
  WHERE deleted_at IS NULL`;

// FR-02: a center needs a name, a physical location and operating information.
// Contact information (phone / email) and closure information are optional.
const centerInput = z.object({
  //mandatory informations
  name: z.string().trim().min(1).max(255),                    //should be string, no space at front and back, max 255(by schema.sql)
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),                         //latitude : -90~90 longitude : -180~180
  operatingHours: z.string().trim().min(1).max(255),          //same as 'name' 
  //optional informations
  phone: z.string().trim().max(255).nullish(),
  email: z.string().trim().email().max(255).nullish(),
  closureInformation: z.string().trim().nullish(),
});

// Center List
router.get("/", async (_req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(`${CENTER_SELECT} ORDER BY name`);
  res.json(rows);
});

// Center Details (3.1: name, location, operating hours, closure info, contact info)
router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const [rows] = id
    ? await pool.query<RowDataPacket[]>(`${CENTER_SELECT} AND center_id = ?`, [id])
    : [[] as RowDataPacket[]];
  if (!rows[0]) {
    res.status(404).json({ error: "Center not found." });
    return;
  }
  res.json(rows[0]);
});

// FR-02 / FR-10: administrators create, edit and delete centers.
//   Delete = set deleted_at, and reject while the center still has items with status 'Available'.
router.post("/", requireAdmin, async (req,res) => {
  const parsed = centerInput.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    res.status(400).json({ error: `${issue.path.join(".")}: ${issue.message}` });
    return;
  }
  const c = parsed.data;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO center (name, location, phone, email, operating_hours, closure_information)
     VALUES (?, POINT(?, ?), ?, ?, ?, ?)`,
    [c.name, c.lng, c.lat, c.phone ?? null, c.email ?? null, c.operatingHours, c.closureInformation ?? null],
  );

  const [rows] = await pool.query<RowDataPacket[]>(`${CENTER_SELECT} AND center_id = ?`, [result.insertId]);
  res.status(201).json(rows[0]);
});

router.put("/:id", requireAdmin, async (req,res) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(404).json({ error: "Center not found." });
    return;
  }
  
  const parsed = centerInput.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    res.status(400).json({ error: `${issue.path.join(".")}: ${issue.message}` });
    return;
  }
  const c = parsed.data;

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE center
     SET name = ?, location = POINT(?, ?), phone = ?, email = ?, operating_hours = ?, closure_information = ?
     WHERE center_id = ? AND deleted_at IS NULL`,
    [c.name, c.lng, c.lat, c.phone ?? null, c.email ?? null, c.operatingHours, c.closureInformation ?? null, id],
  );

  if (result.affectedRows === 0) {
    res.status(404).json({ error: "Center not found." });
    return;
  }

  const [rows] = await pool.query<RowDataPacket[]>(`${CENTER_SELECT} AND center_id = ?`, [id]);
  res.json(rows[0]);
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(404).json({ error: "Center not found." });
    return;
  }

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE center SET deleted_at = NOW()
     WHERE center_id = ? AND deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM item
                       WHERE item.center_id = center.center_id AND item.status = 'Available')`,
    [id],
  );

  if (result.affectedRows === 0) {
    // Nothing was deleted: either the center does not exist, or it still has Available items.
    const [rows] = await pool.query<RowDataPacket[]>(`${CENTER_SELECT} AND center_id = ?`, [id]);
    if (rows[0]) {
      res.status(409).json({ error: "This center still has Available items and cannot be deleted." });
    } else {
      res.status(404).json({ error: "Center not found." });
    }
    return;
  }

  res.status(204).end();
});

export default router;
