// Startup check: the ENUMs in db/schema.sql must match src/constants.ts.
import type { RowDataPacket } from "mysql2";
import { CATEGORIES, ITEM_STATUSES, ROLES } from "./constants";
import { pool } from "./db";

const EXPECTED_ENUMS: { table: string; column: string; values: readonly string[] }[] = [
  { table: "item", column: "category", values: CATEGORIES },
  { table: "item", column: "status", values: ITEM_STATUSES },
  { table: "item_status_history", column: "from_status", values: ITEM_STATUSES },
  { table: "item_status_history", column: "to_status", values: ITEM_STATUSES },
  { table: "staff_user", column: "role", values: ROLES },
];

/** "enum('A','B''s')" -> ["A", "B's"] */
function parseEnumValues(columnType: string): string[] {
  return [...columnType.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"));
}

/** Returns the mismatches; empty when the DB and constants.ts agree. */
export async function findEnumMismatches(): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, COLUMN_TYPE AS columnType
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()`,
  );

  const problems: string[] = [];
  for (const { table, column, values } of EXPECTED_ENUMS) {
    const row = rows.find((r) => r.tableName === table && r.columnName === column);
    if (!row) {
      problems.push(`${table}.${column}: column not found in the database`);
      continue;
    }
    const actual = parseEnumValues(String(row.columnType));
    if (actual.join("|") !== values.join("|")) {
      problems.push(`${table}.${column}: DB has [${actual.join(", ")}], constants.ts has [${values.join(", ")}]`);
    }
  }
  return problems;
}
