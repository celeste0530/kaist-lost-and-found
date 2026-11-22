import type { RequestHandler, Response } from "express";
import type { z } from "zod";

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

/**
 * Validates a request body with a zod schema.
 * On failure it sends 400 with the first problem ("<field>: <reason>") and returns null,
 * so the caller only has to `return`.
 */
export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown, res: Response): z.infer<T> | null {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    res.status(400).json({ error: `${issue.path.join(".")}: ${issue.message}` });
    return null;
  }
  return parsed.data;
}
