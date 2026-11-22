import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import multer from "multer";
import path from "node:path";
import { config } from "./config";
import { attachUser } from "./middleware/auth";
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
    res.status(400).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
};
app.use(errorHandler);
