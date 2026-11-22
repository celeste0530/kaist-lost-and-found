import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../db";
import { requireAdmin } from "../middleware/auth";
import { notImplemented, parseId } from "../utils";

const router = Router();

// Deleted centers (soft delete) are never listed publicly.
const CENTER_SELECT = `
  SELECT center_id AS id, name, ST_Y(location) AS lat, ST_X(location) AS lng,
         phone, email, operating_hours AS operatingHours, closure_information AS closureInformation
  FROM center
  WHERE deleted_at IS NULL`;

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

// --- Not implemented yet -------------------------------------------------------------------
// FR-02 / FR-10: administrators create, edit and delete centers.
//   Delete = set deleted_at, and reject while the center still has items with status 'Available'.
router.post("/", requireAdmin, notImplemented("FR-02"));
router.put("/:id", requireAdmin, notImplemented("FR-02"));
router.delete("/:id", requireAdmin, notImplemented("FR-02"));

export default router;
