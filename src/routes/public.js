const express = require('express');
const db = require('../db');
const { str } = require('../services/util');
const { feed, sendImage } = require('./news');
const { intOrNull } = require('../services/util');

const router = express.Router();

function findSchool(code) {
  const s = db.prepare('SELECT * FROM schools WHERE code = ?').get(str(code, 40).toLowerCase());
  return s && s.active ? s : null;
}

// Page de connexion et site vitrine : informations publiques de l'établissement.
router.get('/school/:code', (req, res) => {
  const s = findSchool(req.params.code);
  if (!s) return res.status(404).json({ error: 'Établissement introuvable' });
  res.json({
    code: s.code, name: s.name, city: s.city, academic_year: s.academic_year,
    description: s.description, address: s.address, phone: s.phone, email: s.contact_email, hours: s.hours,
  });
});

// Actualités PUBLIQUES seulement (visibles sans connexion).
router.get('/school/:code/news', (req, res) => {
  const s = findSchool(req.params.code);
  if (!s) return res.status(404).json({ error: 'Établissement introuvable' });
  res.json(feed(s.id, false));
});

// Image d'une publication PUBLIQUE uniquement (les images « membres » exigent une connexion).
router.get('/school/:code/news/:id/image/:imageId', (req, res) => {
  const s = findSchool(req.params.code);
  if (!s) return res.status(404).json({ error: 'Établissement introuvable' });
  const row = db
    .prepare(
      `SELECT ai.file_name FROM announcement_images ai JOIN announcements a ON a.id = ai.announcement_id
       WHERE ai.id = ? AND a.id = ? AND a.school_id = ? AND ai.school_id = ? AND a.audience = 'public'`
    )
    .get(intOrNull(req.params.imageId), intOrNull(req.params.id), s.id, s.id);
  sendImage(res, s.id, row, true);
});

module.exports = router;
