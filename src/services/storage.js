'use strict';

const fs = require('fs/promises');
const path = require('path');

function storageConfig(env = process.env) {
  const url = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  return url && key ? { url, key, bucket: env.SUPABASE_STORAGE_BUCKET || 'portal-files' } : null;
}

function objectPath(schoolId, fileName) {
  return `${String(schoolId)}/${path.basename(fileName)}`;
}

async function storageRequest(method, object, body, contentType) {
  const cfg = storageConfig();
  if (!cfg) return false;
  const headers = { authorization: `Bearer ${cfg.key}`, apikey: cfg.key };
  if (body) headers['content-type'] = contentType || 'application/octet-stream';
  const response = await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/${object}`, {
    method,
    headers,
    body,
  });
  if (!response.ok && !(method === 'DELETE' && response.status === 404)) {
    const text = await response.text();
    throw new Error(`Supabase Storage ${method} failed (${response.status}): ${text.slice(0, 300)}`);
  }
  return true;
}

async function persistFile(schoolId, file) {
  const cfg = storageConfig();
  if (!cfg || !file?.path) return false;
  const body = await fs.readFile(file.path);
  await storageRequest('POST', objectPath(schoolId, file.filename), body, file.mimetype);
  return true;
}

async function removeStoredFile(schoolId, fileName) {
  return storageRequest('DELETE', objectPath(schoolId, fileName), null);
}

function storageEnabled() { return Boolean(storageConfig()); }

module.exports = { storageConfig, storageEnabled, persistFile, removeStoredFile, objectPath };
