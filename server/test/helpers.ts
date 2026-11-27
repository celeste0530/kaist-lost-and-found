// Shared setup for the API tests (run with `npm test`).
//
// Each test file gets a fresh database: a separate schema `lostfound_test` in the same MySQL server as
// development, rebuilt from db/schema.sql + db/seed.sql. The development database is never touched.
// Uploaded images go to a temporary folder instead of server/uploads.
//
// The environment variables below must be set before src/config.ts is loaded, so test files import this
// module first and load the app with a dynamic import (see startApi).
import fs from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import mysql from "mysql2/promise";

// Any MySQL 8 server works, not only the Docker one. The defaults match docker-compose.yml;
// override them with environment variables for another server (see README "테스트").
const TEST_DB = process.env.TEST_DB_NAME ?? "lostfound_test";
const DB_HOST = process.env.DB_HOST ?? "localhost";
const DB_PORT = Number(process.env.DB_PORT ?? 3306);
// An account that may create / drop databases and grant privileges (MYSQL_ROOT_PASSWORD in docker-compose.yml).
const ADMIN_USER = process.env.TEST_DB_ADMIN_USER ?? "root";
const ADMIN_PASSWORD = process.env.TEST_DB_ADMIN_PASSWORD ?? process.env.TEST_DB_ROOT_PASSWORD ?? "rootpassword";
// The account the server itself uses (DB_USER in .env), and the host part of that MySQL account.
const APP_USER = process.env.DB_USER ?? "lostfound";
const APP_USER_HOST = process.env.TEST_DB_GRANT_HOST ?? "%";

export const UPLOAD_DIR = path.join(os.tmpdir(), "lostfound-test-uploads");

process.env.DB_NAME = TEST_DB;
process.env.UPLOAD_DIR = UPLOAD_DIR;

const DB_DIR = path.resolve(__dirname, "../../db");

/** Seed accounts (db/seed.sql). All use the same password. */
export const SEED = {
  password: "password1234",
  admin: "admin@lostfound.test", // user 1, no center
  staff1: "staff1@lostfound.test", // user 2, center 1
  staff2: "staff2@lostfound.test", // user 3, center 2
} as const;

/** Drops and recreates the test database from db/schema.sql and db/seed.sql, and empties the upload folder. */
export async function resetDatabase(): Promise<void> {
  const root = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: ADMIN_USER,
    password: ADMIN_PASSWORD,
    multipleStatements: true,
  });
  try {
    await root.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await root.query(`CREATE DATABASE \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    // Let the server's own account use the test database (not needed when both are the same account).
    if (APP_USER !== ADMIN_USER) {
      await root.query(`GRANT ALL PRIVILEGES ON \`${TEST_DB}\`.* TO ?@?`, [APP_USER, APP_USER_HOST]);
    }
    await root.query(`USE \`${TEST_DB}\``);
    await root.query(fs.readFileSync(path.join(DB_DIR, "schema.sql"), "utf8"));
    await root.query(fs.readFileSync(path.join(DB_DIR, "seed.sql"), "utf8"));
  } finally {
    await root.end();
  }
  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/** Runs a query on the test database directly (to check what the API stored). */
export async function dbQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: ADMIN_USER,
    password: ADMIN_PASSWORD,
    database: TEST_DB,
    dateStrings: true,
  });
  try {
    const [rows] = await conn.query(sql, params);
    return rows as T[];
  } finally {
    await conn.end();
  }
}

export interface Api {
  baseUrl: string;
  /** A client with no login cookie. */
  client(): Client;
  /** A client logged in with a seed account (or any email/password). */
  login(email: string, password?: string): Promise<Client>;
  /** Stops the HTTP server and starts it again on a new port (same database). */
  restart(): Promise<void>;
  close(): Promise<void>;
}

/** Resets the test database and starts the API on a free port. */
export async function startApi(): Promise<Api> {
  await resetDatabase();
  const { app } = await import("../src/app");
  const { pool } = await import("../src/db");

  let server: Server;
  const listen = () =>
    new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
  const stop = () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  await listen();

  const api: Api = {
    get baseUrl() {
      return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    },
    client: () => new Client(() => api.baseUrl),
    async login(email, password = SEED.password) {
      const c = api.client();
      const res = await c.post("/api/auth/login", { email, password });
      if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
      return c;
    },
    async restart() {
      await stop();
      await listen();
    },
    async close() {
      await stop();
      await pool.end();
    },
  };
  return api;
}

export interface Res<T = any> {
  status: number;
  body: T;
}

/** Minimal HTTP client that keeps the login cookie like a browser does. */
export class Client {
  private cookie = "";

  constructor(private readonly baseUrl: () => string) {}

  get<T = any>(p: string) {
    return this.request<T>("GET", p);
  }
  post<T = any>(p: string, body?: unknown) {
    return this.request<T>("POST", p, body);
  }
  put<T = any>(p: string, body?: unknown) {
    return this.request<T>("PUT", p, body);
  }
  delete<T = any>(p: string) {
    return this.request<T>("DELETE", p);
  }

  /** body: a plain object is sent as JSON, a FormData as multipart/form-data, a string as raw JSON text. */
  async request<T = any>(method: string, p: string, body?: unknown): Promise<Res<T>> {
    const headers: Record<string, string> = {};
    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
      payload = body;
    } else if (typeof body === "string") {
      headers["Content-Type"] = "application/json";
      payload = body;
    } else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    if (this.cookie) headers.Cookie = this.cookie;

    const res = await fetch(this.baseUrl() + p, { method, headers, body: payload });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const [name, value] = pair.split("=");
      if (name === "token") this.cookie = value ? `token=${value}` : "";
    }
    const text = await res.text();
    let parsed: unknown = text;
    if ((res.headers.get("content-type") ?? "").includes("application/json")) parsed = JSON.parse(text);
    return { status: res.status, body: parsed as T };
  }
}

/** Files currently in the test upload folder. */
export function uploadedFiles(): string[] {
  return fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : [];
}

/** A fake image for upload tests (the server checks the MIME type, not the content). */
export function imageBlob(type = "image/png", bytes = 64): Blob {
  return new Blob([new Uint8Array(bytes)], { type });
}

/** Today in Korea, plus `days`, as YYYY-MM-DD. */
export function koreaDate(days = 0): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);
}

/** A valid item registration / edit body. */
export function itemBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Test umbrella",
    category: "Umbrella",
    foundDate: koreaDate(-1),
    foundLat: 36.3738,
    foundLng: 127.3608,
    description: "Created by an automated test",
    ...overrides,
  };
}

/** The same body as multipart form fields. */
export function itemForm(overrides: Record<string, unknown> = {}, image?: Blob, imageName = "photo.png"): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(itemBody(overrides))) form.append(k, String(v));
  if (image) form.append("image", image, imageName);
  return form;
}
