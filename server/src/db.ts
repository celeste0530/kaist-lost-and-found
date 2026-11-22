import mysql from "mysql2/promise";
import { config } from "./config";

// dateStrings: DATE / DATETIME columns are returned as plain strings (no timezone conversion surprises).
export const pool = mysql.createPool({
  ...config.db,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
});
