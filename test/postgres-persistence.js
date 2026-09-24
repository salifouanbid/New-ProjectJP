'use strict';

const assert = require('assert/strict');
const { PostgresDatabase, postgresConfig } = require('../src/persistence/postgres');
const { normalizeValue, sourcePath, TABLES } = require('../scripts/migrate-sqlite-to-postgres');

class FakeClient {
  constructor({ failCommit = false } = {}) {
    this.calls = [];
    this.released = false;
    this.failCommit = failCommit;
  }

  async query(text, params = []) {
    this.calls.push({ text, params });
    if (this.failCommit && text === 'COMMIT') throw new Error('commit failed');
    if (/SELECT 1 AS ok/.test(text)) return { rows: [{ ok: 1 }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  }

  release() { this.released = true; }
}

class FakePool extends FakeClient {
  constructor(client = new FakeClient()) {
    super();
    this.client = client;
    this.ended = false;
  }

  async connect() { return this.client; }
  async end() { this.ended = true; }
}

async function testConfig() {
  assert.throws(() => postgresConfig({}), /DATABASE_URL est obligatoire/);
  assert.throws(() => postgresConfig({ DATABASE_URL: 'https://example.com' }), /protocole postgres/);
  const fakeUrl = new URL('postgresql://localhost/db');
  fakeUrl.username = 'user';
  fakeUrl.password = 'placeholder';
  const config = postgresConfig({ DATABASE_URL: fakeUrl.toString() });
  assert.equal(config.max, 1);
  assert.equal(config.idleTimeoutMillis, 5000);
  assert(!JSON.stringify(config).includes('console'));
  assert.throws(() => postgresConfig({ DATABASE_URL: fakeUrl.toString(), DATABASE_POOL_MAX: '0' }), /entier positif/);
}

async function testQueries() {
  const pool = new FakePool();
  const db = new PostgresDatabase(pool);
  assert.equal(await db.healthcheck(), true);
  assert.equal(pool.calls[0].text, 'SELECT 1 AS ok');
  await db.close();
  assert.equal(pool.ended, true);
}

async function testCommit() {
  const client = new FakeClient();
  const db = new PostgresDatabase(new FakePool(client));
  const value = await db.transaction(async (tx) => {
    await tx.execute('UPDATE schools SET active = $1 WHERE id = $2', [true, 1]);
    return 42;
  });
  assert.equal(value, 42);
  assert.deepEqual(client.calls.map((call) => call.text), ['BEGIN', 'UPDATE schools SET active = $1 WHERE id = $2', 'COMMIT']);
  assert.equal(client.released, true);
}

async function testRollback() {
  const client = new FakeClient();
  const db = new PostgresDatabase(new FakePool(client));
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.query('INSERT INTO schools(code, name) VALUES ($1, $2)', ['x', 'X']);
      throw new Error('boom');
    }),
    /boom/
  );
  assert.deepEqual(client.calls.map((call) => call.text), ['BEGIN', 'INSERT INTO schools(code, name) VALUES ($1, $2)', 'ROLLBACK']);
  assert.equal(client.released, true);
}

async function testImporterHelpers() {
  assert(TABLES.includes('schools') && TABLES.includes('password_resets'));
  assert.equal(normalizeValue('schools', 'active', 1), true);
  assert.equal(normalizeValue('users', 'must_change_password', 0), false);
  assert.equal(normalizeValue('attendance', 'justified', null), null);
  assert.equal(normalizeValue('grades', 'value', 12.5), 12.5);
  assert.equal(sourcePath(['--source', './data/example.db']).endsWith('/data/example.db'), true);
  assert.throws(() => sourcePath(['--source', '--execute']), /Usage/);
}

async function main() {
  await testConfig();
  await testQueries();
  await testCommit();
  await testRollback();
  await testImporterHelpers();
  console.log('PostgreSQL persistence: 5 groupes de tests réussis');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
