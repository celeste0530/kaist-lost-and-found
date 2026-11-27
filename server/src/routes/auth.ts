import bcrypt from "bcryptjs";
import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { config } from "../config";
import { pool } from "../db";
import { AUTH_COOKIE, requireAuth, signToken, toAuthUser } from "../middleware/auth";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// FR-01: log in with email + password.
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email address and password." });
    return;
  }
  const { email, password } = parsed.data;

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT user_id, email, password_hash, display_name, role, center_id, deactivated_at FROM staff_user WHERE email = ?",
    [email],
  );
  const row = rows[0];
  const passwordOk = row ? await bcrypt.compare(password, row.password_hash) : false;
  if (!row || !passwordOk) {
    // Same message for unknown email and wrong password.
    res.status(401).json({ error: "Incorrect email or password." });
    return;
  }
  // FR-10: checked only after the password, so only the account owner learns that it is deactivated.
  if (row.deactivated_at !== null) {
    res.status(403).json({ error: "This account has been deactivated." });
    return;
  }

  res.cookie(AUTH_COOKIE, signToken(row.user_id), {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    maxAge: 8 * 60 * 60 * 1000,
  });
  res.json(toAuthUser(row)); // never includes password_hash
});

// FR-01: log out.
router.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE);
  res.status(204).end();
});

// Current logged-in staff user (used by the client on page load).
router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

export default router;
