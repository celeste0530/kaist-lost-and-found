import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import multer from "multer";
import path from "node:path";
import { config } from "./config";
import { attachUser } from "./middleware/auth";
import { UploadError } from "./middleware/upload";
import authRouter from "./routes/auth";
import centersRouter from "./routes/centers";
import itemsRouter from "./routes/items";
import staffRouter from "./routes/staff";

export const app = express();

app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

app.use("/uploads", express.static(path.resolve(config.uploadDir)));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.use("/api/auth", authRouter);
app.use("/api/items", itemsRouter);
app.use("/api/centers", centersRouter);
app.use("/api/staff", staffRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found." });
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    // e.g. file over 10 MB. multer has already deleted the partial file.
    const message = err.code === "LIMIT_FILE_SIZE" ? "image: Image must be 10 MB or smaller." : err.message;
    res.status(400).json({ error: message });
    return;
  }
  if (err instanceof UploadError) {
    res.status(400).json({ error: err.message });
    return;
  }
  // Errors from express.json() carry a 4xx status: a body that is not valid JSON (400),
  // a body that is too large (413), and so on. They are the client's mistake, not a server error.
  if (typeof err?.status === "number" && err.status >= 400 && err.status < 500) {
    const message = err.type === "entity.parse.failed" ? "Request body is not valid JSON." : err.message;
    res.status(err.status).json({ error: message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
};
app.use(errorHandler);
