import type { RequestHandler } from "express";

/** Placeholder for endpoints that the SRS specifies but that are not built yet. */
export const notImplemented =
  (requirement: string): RequestHandler =>
  (_req, res) => {
    res.status(501).json({ error: `Not implemented yet (${requirement}).` });
  };

/** Parses a positive integer route parameter. Returns null when invalid. */
export function parseId(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}
