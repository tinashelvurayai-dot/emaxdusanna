import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const sql = readFileSync(new URL('../../supabase/target/000_fresh_schema.sql', import.meta.url), 'utf8');
assert.ok(!sql.includes('sandbox_exec'), 'Cloud-only grants must not reach the target');
assert.ok(!sql.includes('ALTER DEFAULT PRIVILEGES'), 'Do not inherit broad privileges');
assert.ok(!sql.includes("IF lower(NEW.email)"), 'Signup email must not assign admin');
const tables = [...sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?public\.(\w+)/g)].map(m => m[1]);
for (const table of tables) {
  assert.ok(sql.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`), `Missing RLS: ${table}`);
  assert.match(sql, new RegExp(`GRANT [^;]+ ON (?:TABLE )?public\\.${table}[^;]* TO service_role;`), `Missing service grant: ${table}`);
}
console.log(`Static security checks passed for ${tables.length} tables. This is not a database rehearsal.`);