// Creates the first administrator account (SRS 2.2.1: an administrator must exist after setup).
// Usage: npm run create-admin -- <email> <password> [displayName]
import bcrypt from "bcryptjs";
import { pool } from "../db";

const [email, password, displayName = "Administrator"] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: npm run create-admin -- <email> <password> [displayName]");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

async function main() {
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    "INSERT INTO staff_user (email, password_hash, display_name, role, center_id) VALUES (?, ?, ?, 'Administrator', NULL)",
    [email, hash, displayName],
  );
  console.log(`Administrator created: ${email}`);
}

main()
  .catch((err: Error) => {
    console.error(`Failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
