'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { TABLES } = require('../scripts/migrate-sqlite-to-postgres');

const root = path.join(__dirname, '..');
const initial = fs.readFileSync(path.join(root, 'supabase/migrations/20260925003000_initial_schema.sql'), 'utf8');
const hardening = fs.readFileSync(path.join(root, 'supabase/migrations/20260925010000_schema_hardening.sql'), 'utf8');

for (const table of TABLES) {
  assert.match(initial, new RegExp(`create table if not exists public\\.${table}\\b`, 'i'), `table absente: ${table}`);
  assert.match(initial, new RegExp(`['\"]${table}['\"]`), `RLS non listée: ${table}`);
}

assert.match(hardening, /ux_users_platform_username/i);
assert.match(hardening, /ux_coef_without_series/i);
assert.match(hardening, /ux_coef_with_series/i);
assert.match(hardening, /idx <= 2/i);
assert.match(hardening, /role <> 'superadmin'/i);
assert.match(hardening, /parent_school_id is distinct from new\.school_id/i);
assert.match(hardening, /parent_school_id is distinct from student_school_id/i);

console.log(`Schéma PostgreSQL: ${TABLES.length} tables et garde-fous critiques vérifiés`);
