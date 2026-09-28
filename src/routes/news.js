// Actualités / événements d'un établissement.
const express = require('express');
const fs = require('fs');
const db = require('../db');
const config = require('../config');
const { intOrNull, ah } = require('../services/util');
const { filePath } = require('../services/upload');

const MAX_IMAGES = 6;

function attachImages(rows) {
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.id);
  const imgs = db.prepare(`SELECT id, announcement_id FROM announcement_images WHERE announcement_id IN (${ids.map(() => '?').join(',')}) ORDER BY position, id`).all(...ids);
  rows.forEach((r) => { r.images = imgs.filter((i) => i.announcement_id === r.id).map((i) => i.id); });
  return rows;
}

async function attachImagesAsync(rows) {
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.id);
  const imgs = config.databaseProvider === 'postgres'
    ? await db.many(`SELECT id, announcement_id FROM announcement_images WHERE announcement_id = ANY($1::bigint[]) ORDER BY position, id`, [ids])
    : db.prepare(`SELECT id, announcement_id FROM announcement_images WHERE announcement_id IN (${ids.map(() => '?').join(',')}) ORDER BY position, id`).all(...ids);
  rows.forEach((r) => { r.images = imgs.filter((i) => Number(i.announcement_id) === Number(r.id)).map((i) => i.id); });
  return rows;
}

function feed(schoolId, includeMembers) {
  const audience = includeMembers ? "('public','members')" : "('public')";
  const news = attachImages(db.prepare(`SELECT id, title, body, category, audience, event_date, pinned, created_at FROM announcements WHERE school_id = ? AND audience IN ${audience} ORDER BY pinned DESC, created_at DESC, id DESC LIMIT 40`).all(schoolId));
  const events = db.prepare(`SELECT id, title, event_date FROM announcements WHERE school_id = ? AND audience IN ${audience} AND event_date IS NOT NULL AND event_date >= date('now') ORDER BY event_date ASC LIMIT 10`).all(schoolId);
  return { news, events };
}

async function feedAsync(schoolId, includeMembers) {
  const audience = includeMembers ? "('public','members')" : "('public')";
  const news = await db.many(`SELECT id, title, body, category, audience, event_date, pinned, created_at FROM announcements WHERE school_id = $1 AND audience IN ${audience} ORDER BY pinned DESC, created_at DESC, id DESC LIMIT 40`, [schoolId]);
  await attachImagesAsync(news);
  const events = await db.many(`SELECT id, title, event_date FROM announcements WHERE school_id = $1 AND audience IN ${audience} AND event_date IS NOT NULL AND event_date >= CURRENT_DATE ORDER BY event_date ASC LIMIT 10`, [schoolId]);
  return { news, events };
}

function sendImage(res, schoolId, row, isPublic) {
  if (!row || !row.file_name) return res.status(404).json({ error: 'Image introuvable' });
  const p = filePath(schoolId, row.file_name);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Image introuvable' });
  res.set('Cache-Control', `${isPublic ? 'public' : 'private'}, max-age=86400`);
  return res.sendFile(p);
}

const router = express.Router();
router.get('/', ah(async (req, res) => {
  if (!req.user.school_id) return res.status(403).json({ error: 'Accès refusé' });
  res.json(await feedAsync(req.user.school_id, true));
}));
router.get('/:id/image/:imageId', ah(async (req, res) => {
  if (!req.user.school_id) return res.status(403).json({ error: 'Accès refusé' });
  const row = config.databaseProvider === 'postgres'
    ? await db.maybeOne('SELECT file_name FROM announcement_images WHERE id = $1 AND announcement_id = $2 AND school_id = $3', [intOrNull(req.params.imageId), intOrNull(req.params.id), req.user.school_id])
    : db.prepare('SELECT file_name FROM announcement_images WHERE id = ? AND announcement_id = ? AND school_id = ?').get(intOrNull(req.params.imageId), intOrNull(req.params.id), req.user.school_id);
  sendImage(res, req.user.school_id, row, false);
}));

module.exports = router;
module.exports.feed = feed;
module.exports.feedAsync = feedAsync;
module.exports.sendImage = sendImage;
module.exports.attachImages = attachImages;
module.exports.attachImagesAsync = attachImagesAsync;
module.exports.MAX_IMAGES = MAX_IMAGES;
