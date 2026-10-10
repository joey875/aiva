// Runs supabase/seed.sql against the database in DATABASE_URL,
// substituting SUPER_ADMIN_EMAIL. Usage: node --env-file=.env.local scripts/seed.mjs
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const email = process.env.SUPER_ADMIN_EMAIL;
const dbUrl = process.env.DATABASE_URL;
if (!email || !/^[^\s@']+@[^\s@']+$/.test(email)) {
  console.error("Set SUPER_ADMIN_EMAIL to a valid email.");
  process.exit(1);
}
if (!dbUrl) {
  console.error("Set DATABASE_URL (Supabase > Project Settings > Database > Connection string).");
  process.exit(1);
}

const sql = readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8").replaceAll(
  "__SUPER_ADMIN_EMAIL__",
  email.toLowerCase(),
);

execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-q"], { input: sql, stdio: ["pipe", "inherit", "inherit"] });
console.log(`Seeded. ${email} becomes super admin on first sign-in.`);
