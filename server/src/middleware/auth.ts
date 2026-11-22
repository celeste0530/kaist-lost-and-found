import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { RowDataPacket } from "mysql2";
import { config } from "../config";
import type { Role } from "../constants";
import { pool } from "../db";

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  centerId: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const AUTH_COOKIE = "token";

export function toAuthUser(row: RowDataPacket): AuthUser {
  return {
    id: row.user_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    centerId: row.center_id,
  };
}

export function signToken(userId: number): string {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: "8h" });
}

/**
 * Attaches req.user when a valid login cookie is present; never rejects the request.
 * The user is re-read from the database on every request so that role / center changes
 * made by an administrator (FR-10) take effect immediately (SRS 3.4.3).
 */
export const attachUser: RequestHandler = async (req, _res, next) => {
  const token: string | undefined = req.cookies?.[AUTH_COOKIE];
  let userId: number | undefined;
  if (token) {
    try {
      userId = (jwt.verify(token, config.jwtSecret) as { userId: number }).userId;
    } catch {
      // Invalid or expired token: treat as a public user.
    }
  }
  if (userId !== undefined) {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT user_id, email, display_name, role, center_id FROM staff_user WHERE user_id = ?",
      [userId],
    );
    if (rows[0]) req.user = toAuthUser(rows[0]);
  }
  next();
};

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: "Login required." });
    return;
  }
  next();
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ error: "Login required." });
    return;
  }
  if (req.user.role !== "Administrator") {
    res.status(403).json({ error: "Administrator access required." });
    return;
  }
  next();
};
