const express = require('express');
const db = require('../db');
const config = require('../config');
const { str, intOrNull, ah } = require('../services/util');
const { feedAsync, sendImage } = require('./news');

const router = express.Router();

async function findSchool(code) {
  const normalized = str(code, 40).toLowerCase();
  const s = config.databaseProvider === 'postgres'
    ? await db.maybeOne('SELECT * FROM schools WHERE code = $1 AND active = true', [normalized])
    : db.prepare('SELECT * FROM schools WHERE code = ?').get(normalized);
  return s && (s.active === true || Number(s.active) === 1) ? s : null;
}

router.get('/school/:code', ah(async (req, res) => {
  const s = await findSchool(req.params.code);
  if (!s) return res.status(404).json({ error: 'Établissement introuvable' });
  res.json({ code: s.code, name: s.name, city: s.city, academic_year: s.academic_year, description: s.description, address: s.address, phone: s.phone, email: s.contact_email, hours: s.hours });
}));

router.get('/school/:code/news', ah(async (req, res) => {
  const s = await findSchool(req.params.code);
  if (!s) return res.status(404).json({ error: 'Établissement introuvable' });
  res.json(await feedAsync(s.id, false));
}));

router.get('/school/:code/news/:id/image/:imageId', ah(async (req, res) => {
  const s = await findSchool(req.params.code);
  if (!s) return res.status(404).json({ error: 'Établissement introuvable' });
  const row = config.databaseProvider === 'postgres'
    ? await db.maybeOne("SELECT ai.file_name FROM announcement_images ai JOIN announcements a ON a.id = ai.announcement_id WHERE ai.id = $1 AND a.id = $2 AND a.school_id = $3 AND ai.school_id = $3 AND a.audience = 'public'", [intOrNull(req.params.imageId), intOrNull(req.params.id), s.id])
    : db.prepare("SELECT ai.file_name FROM announcement_images ai JOIN announcements a ON a.id = ai.announcement_id WHERE ai.id = ? AND a.id = ? AND a.school_id = ? AND ai.school_id = ? AND a.audience = 'public'").get(intOrNull(req.params.imageId), intOrNull(req.params.id), s.id, s.id);
  sendImage(res, s.id, row, true);
}));

module.exports = router;
