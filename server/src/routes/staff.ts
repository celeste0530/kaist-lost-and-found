import { Router } from "express";
import { requireAdmin } from "../middleware/auth";
import { notImplemented } from "../utils";

const router = Router();

// FR-10: administrators manage staff accounts.
//   - Create staff (hash the password with bcryptjs) and assign exactly one active center (required for role 'Staff').
//   - Only administrators may change a staff member's center; this must NOT change existing items' center_id.
router.get("/", requireAdmin, notImplemented("FR-10"));
router.post("/", requireAdmin, notImplemented("FR-10"));
router.put("/:id", requireAdmin, notImplemented("FR-10"));

export default router;
