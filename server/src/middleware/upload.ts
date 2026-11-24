import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { config } from "../config";
import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from "../constants";

fs.mkdirSync(config.uploadDir, { recursive: true });

/** Rejected file type. A class of its own so the error handler can answer 400 instead of 500. */
export class UploadError extends Error {}

/**
 * Accepts one optional JPG/PNG image (max 10 MB) in the multipart field "image".
 * Use as route middleware for FR-03 / FR-04. The stored file name goes into item.image.
 */
export const uploadImage = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    filename: (_req, file, cb) => {
      const ext = file.mimetype === "image/png" ? ".png" : ".jpg";
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new UploadError("image: Only JPG or PNG images are allowed."));
  },
}).single("image");

/** Deletes an uploaded file, e.g. when the request that uploaded it is rejected (SRS 3.4.1). */
export async function removeUpload(fileName: string): Promise<void> {
  await fs.promises.rm(path.join(config.uploadDir, fileName), { force: true });
}
