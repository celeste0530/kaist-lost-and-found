import "dotenv/config";

const isProd = process.env.NODE_ENV === "production";
const jwtSecret = process.env.JWT_SECRET ?? "dev-only-secret";

if (isProd && (jwtSecret === "dev-only-secret" || jwtSecret === "change-me")) {
  throw new Error("JWT_SECRET must be set to a strong random value in production.");
}

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  jwtSecret,
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "lostfound",
    password: process.env.DB_PASSWORD ?? "lostfound",
    database: process.env.DB_NAME ?? "lostfound",
  },
};
