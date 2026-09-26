'use strict';

const config = require('../config');
const { createPostgresDatabase } = require('./postgres');

let database;

function getPostgresDatabase() {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL est obligatoire pour utiliser Supabase/PostgreSQL');
  }
  if (!database) {
    database = createPostgresDatabase({ env: process.env });
  }
  return database;
}

async function closePostgresDatabase() {
  if (database) {
    await database.close();
    database = undefined;
  }
}

module.exports = { getPostgresDatabase, closePostgresDatabase };
