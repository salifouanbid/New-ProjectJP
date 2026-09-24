'use strict';

// Importe une base SQLite existante dans un schéma PostgreSQL déjà créé.
// Par défaut, le script ne fait qu'un contrôle. L'import exige --execute et refuse
// toute cible non vide afin de ne jamais écraser ou fusionner silencieusement des données.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../src/config');
const { createPostgresDatabase } = require('../src/persistence/postgres');

const TABLES = [
  'schools',
  'users',
  'levels',
  'series',
  'classes',
  'subjects',
  'coefficients',
  'terms',
  'students',
  'parent_students',
  'teaching_assignments',
  'grades',
  'attendance',
  'justifications',
  'chapters',
  'lessons',
  'archives',
  'discipline',
  'announcements',
  'announcement_images',
  'password_resets',
];

const BOOLEAN_COLUMNS = {
  schools: new Set(['active']),
  users: new Set(['active', 'must_change_password']),
  attendance: new Set(['justified']),
  announcements: new Set(['pinned']),
};

function quoteIdent(name) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Identifiant SQL invalide : ${name}`);
  return `"${name}"`;
}

function sourcePath(argv = process.argv.slice(2)) {
  const at = argv.indexOf('--source');
  const selected = at >= 0 ? argv[at + 1] : config.dbPath;
  if (!selected || (at >= 0 && String(selected).startsWith('--'))) {
    throw new Error('Usage : --source /chemin/portail.db');
  }
  return path.resolve(selected);
}

function sqliteTables(db) {
  return new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
}

function sqliteColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all().map((row) => row.name);
}

function normalizeValue(table, column, value) {
  if (value === null || value === undefined) return null;
  if (BOOLEAN_COLUMNS[table] && BOOLEAN_COLUMNS[table].has(column)) return Boolean(value);
  return value;
}

async function inspectTarget(db) {
  const existing = await db.many(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [TABLES]
  );
  const names = new Set(existing.map((row) => row.table_name));
  const missing = TABLES.filter((table) => !names.has(table));
  if (missing.length) {
    throw new Error(`Schéma PostgreSQL incomplet. Tables absentes : ${missing.join(', ')}. Appliquez d'abord les migrations Supabase.`);
  }

  const rows = await db.many(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])
      ORDER BY table_name, ordinal_position`,
    [TABLES]
  );
  const columns = new Map(TABLES.map((table) => [table, new Set()]));
  rows.forEach((row) => columns.get(row.table_name).add(row.column_name));
  return columns;
}

async function targetCounts(db) {
  const counts = {};
  for (const table of TABLES) {
    const row = await db.one(`SELECT COUNT(*)::bigint AS count FROM public.${quoteIdent(table)}`);
    counts[table] = Number(row.count);
  }
  return counts;
}

function sourceCounts(sqlite) {
  const tables = sqliteTables(sqlite);
  const missing = TABLES.filter((table) => !tables.has(table));
  if (missing.length) throw new Error(`Base SQLite incomplète. Tables absentes : ${missing.join(', ')}`);
  return Object.fromEntries(TABLES.map((table) => [table, Number(sqlite.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdent(table)}`).get().count)]));
}

async function resetIdentity(tx, table) {
  if (table === 'parent_students') return;
  await tx.query(
    `SELECT setval(
       pg_get_serial_sequence($1, 'id'),
       GREATEST(COALESCE((SELECT MAX(id) FROM public.${quoteIdent(table)}), 1), 1),
       EXISTS (SELECT 1 FROM public.${quoteIdent(table)})
     )`,
    [`public.${table}`]
  );
}

async function importTable(sqlite, tx, table, targetColumns) {
  const columns = sqliteColumns(sqlite, table);
  const absent = columns.filter((column) => !targetColumns.has(column));
  if (absent.length) throw new Error(`Colonnes PostgreSQL absentes pour ${table} : ${absent.join(', ')}`);

  const rows = sqlite.prepare(`SELECT * FROM ${quoteIdent(table)}`).all();
  if (!rows.length) return 0;
  const names = columns.map(quoteIdent).join(', ');
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  const statement = `INSERT INTO public.${quoteIdent(table)} (${names}) VALUES (${placeholders})`;
  for (const row of rows) {
    const values = columns.map((column) => normalizeValue(table, column, row[column]));
    await tx.query(statement, values);
  }
  await resetIdentity(tx, table);
  return rows.length;
}

function printCounts(label, counts) {
  console.log(`\n${label}`);
  TABLES.forEach((table) => console.log(`  ${table.padEnd(24)} ${counts[table]}`));
}

async function main(argv = process.argv.slice(2)) {
  const execute = argv.includes('--execute');
  const file = sourcePath(argv);
  if (!fs.existsSync(file)) throw new Error(`Base SQLite introuvable : ${file}`);
  if (!fs.statSync(file).isFile()) throw new Error(`La source SQLite n'est pas un fichier : ${file}`);

  const sqlite = new DatabaseSync(file, { readOnly: true });
  const postgres = createPostgresDatabase();
  try {
    const source = sourceCounts(sqlite);
    const targetColumns = await inspectTarget(postgres);
    const before = await targetCounts(postgres);
    printCounts('Source SQLite :', source);
    printCounts('Cible PostgreSQL :', before);

    const occupied = TABLES.filter((table) => before[table] > 0);
    if (!execute) {
      console.log('\nContrôle terminé. Aucune donnée modifiée. Relancez avec --execute pour importer dans une cible entièrement vide.');
      if (occupied.length) console.log(`Import impossible actuellement : tables non vides (${occupied.join(', ')}).`);
      return;
    }
    if (occupied.length) {
      throw new Error(`Import refusé : la cible n'est pas vide (${occupied.join(', ')}). Aucune donnée n'a été modifiée.`);
    }

    const imported = await postgres.transaction(async (tx) => {
      await tx.query("SELECT pg_advisory_xact_lock(hashtext('portail-scolaire-sqlite-import'))");
      const lockedCounts = await targetCounts(tx);
      const nowOccupied = TABLES.filter((table) => lockedCounts[table] > 0);
      if (nowOccupied.length) throw new Error(`Import refusé après verrouillage : tables non vides (${nowOccupied.join(', ')})`);
      const result = {};
      for (const table of TABLES) {
        result[table] = await importTable(sqlite, tx, table, targetColumns.get(table));
      }
      return result;
    });

    const after = await targetCounts(postgres);
    const mismatches = TABLES.filter((table) => source[table] !== after[table]);
    if (mismatches.length) {
      throw new Error(`Import validé mais comptages incohérents : ${mismatches.join(', ')}`);
    }
    printCounts('Lignes importées :', imported);
    console.log('\nImport PostgreSQL terminé et vérifié. La base SQLite source est restée en lecture seule.');
  } finally {
    sqlite.close();
    await postgres.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`\n[ERREUR] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { BOOLEAN_COLUMNS, TABLES, inspectTarget, normalizeValue, sourcePath };
