import bcrypt from "bcryptjs";
import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { z } from "zod";
import { pool } from "../db";
import { requireAdmin } from "../middleware/auth";
import { parseBody, parseId } from "../utils";
const router = Router();
const STAFF_SELECT = `
  SELECT user_id AS id, email, display_name AS displayName, role, center_id AS centerId
  FROM staff_user`;

// FR-10: a staff account needs an email, a password, a display name and exactly one center.
const staffCreateInput = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  displayName: z.string().trim().min(1).max(100),
  centerId: z.number().int().positive(),
});

// FR-10: an administrator can rename a staff member, move them to another active center,
// or reset their password. The email (login ID) cannot be changed here.
const staffUpdateInput = z.object({
  displayName: z.string().trim().min(1).max(100),
  centerId: z.number().int().positive(),
  password: z.string().min(8).max(72).optional(),
});

// FR-10: administrators manage staff accounts.
//   - Create staff (hash the password with bcryptjs) and assign exactly one active center (required for role 'Staff').
//   - Only administrators may change a staff member's center; this must NOT change existing items' center_id.
router.get("/", requireAdmin, async (_req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(`${STAFF_SELECT} ORDER BY role, display_name`);
  res.json(rows);
});

router.post("/", requireAdmin, async (req, res) => {
  const s = parseBody(staffCreateInput, req.body, res);
  if (s === null) return;

  const passwordHash = await bcrypt.hash(s.password, 12);

  let result: ResultSetHeader;
  try {
    // The SELECT returns a row only for an active center, so an unknown or deleted center inserts nothing.
    [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO staff_user (email, password_hash, display_name, role, center_id)
       SELECT ?, ?, ?, 'Staff', center_id FROM center WHERE center_id = ? AND deleted_at IS NULL`,
      [s.email, passwordHash, s.displayName, s.centerId],
    );
  } catch (err) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "email: This email is already in use." });
      return;
    }
    throw err;
  }

  if (result.affectedRows === 0) {
    res.status(400).json({ error: "centerId: Center not found or deleted." });
    return;
  }

  const [rows] = await pool.query<RowDataPacket[]>(`${STAFF_SELECT} WHERE user_id = ?`, [result.insertId]);
  res.status(201).json(rows[0]);
});

router.put("/:id", requireAdmin, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(404).json({ error: "Staff account not found." });
    return;
  }

  const s = parseBody(staffUpdateInput, req.body, res);
  if (s === null) return;

  // null keeps the current password (see COALESCE below).
  const passwordHash = s.password === undefined ? null : await bcrypt.hash(s.password, 12);

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE staff_user
     SET display_name = ?, center_id = ?, password_hash = COALESCE(?, password_hash)
     WHERE user_id = ? AND role = 'Staff'
       AND EXISTS (SELECT 1 FROM center WHERE center_id = ? AND deleted_at IS NULL)`,
    [s.displayName, s.centerId, passwordHash, id, s.centerId],
  );

  if (result.affectedRows === 0) {
    // Nothing was updated: either there is no such Staff account, or the center is not active.
    const [rows] = await pool.query<RowDataPacket[]>(`${STAFF_SELECT} WHERE user_id = ? AND role = 'Staff'`, [id]);
    if (rows[0]) {
      res.status(400).json({ error: "centerId: Center not found or deleted." });
    } else {
      res.status(404).json({ error: "Staff account not found." });
    }
    return;
  }

  const [rows] = await pool.query<RowDataPacket[]>(`${STAFF_SELECT} WHERE user_id = ?`, [id]);
  res.json(rows[0]);
});

export default router;
