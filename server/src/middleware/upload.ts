import crypto from "node:crypto";
import fs from "node:fs";
import multer from "multer";
import { config } from "../config";
import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from "../constants";

fs.mkdirSync(config.uploadDir, { recursive: true });

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
    else cb(new Error("Only JPG or PNG images are allowed."));
  },
}).single("image");
