// Actualités / événements d'un établissement.
// feed(schoolId, includeMembers) : publiques seulement, ou publiques + réservées aux membres connectés.
const express = require('express');
const fs = require('fs');
const db = require('../db');
const { intOrNull } = require('../services/util');
const { filePath } = require('../services/upload');

const MAX_IMAGES = 6;

// Ajoute à chaque publication la liste des identifiants de ses images (galerie), dans l'ordre.
function attachImages(rows) {
  if (!rows.length) return rows;
  const ids = rows.map((r) => r.id);
  const imgs = db
    .prepare(`SELECT id, announcement_id FROM announcement_images WHERE announcement_id IN (${ids.map(() => '?').join(',')}) ORDER BY position, id`)
    .all(...ids);
  rows.forEach((r) => { r.images = imgs.filter((i) => i.announcement_id === r.id).map((i) => i.id); });
  return rows;
}

function feed(schoolId, includeMembers) {
  const audience = includeMembers ? "('public','members')" : "('public')";
  const news = attachImages(
    db
      .prepare(
        `SELECT id, title, body, category, audience, event_date, pinned, created_at
         FROM announcements WHERE school_id = ? AND audience IN ${audience}
         ORDER BY pinned DESC, created_at DESC, id DESC LIMIT 40`
      )
      .all(schoolId)
  );
  const events = db
    .prepare(
      `SELECT id, title, event_date FROM announcements
       WHERE school_id = ? AND audience IN ${audience} AND event_date IS NOT NULL AND event_date >= date('now')
       ORDER BY event_date ASC LIMIT 10`
    )
    .all(schoolId);
  return { news, events };
}

// Envoie une image (le fichier n'est jamais dans un dossier public : accès contrôlé).
// Une image ne change jamais de contenu (son id est unique) : on peut la garder en cache longtemps.
function sendImage(res, schoolId, row, isPublic) {
  if (!row || !row.file_name) return res.status(404).json({ error: 'Image introuvable' });
  const p = filePath(schoolId, row.file_name);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'Image introuvable' });
  res.set('Cache-Control', `${isPublic ? 'public' : 'private'}, max-age=86400`);
  res.sendFile(p);
}

const router = express.Router();

// Pour les personnes connectées (admin, professeurs, élèves, parents) de l'établissement.
router.get('/', (req, res) => {
  if (!req.user.school_id) return res.status(403).json({ error: 'Accès refusé' });
  res.json(feed(req.user.school_id, true));
});

router.get('/:id/image/:imageId', (req, res) => {
  if (!req.user.school_id) return res.status(403).json({ error: 'Accès refusé' });
  const row = db
    .prepare('SELECT file_name FROM announcement_images WHERE id = ? AND announcement_id = ? AND school_id = ?')
    .get(intOrNull(req.params.imageId), intOrNull(req.params.id), req.user.school_id);
  sendImage(res, req.user.school_id, row, false);
});

module.exports = router;
module.exports.feed = feed;
module.exports.sendImage = sendImage;
module.exports.attachImages = attachImages;
module.exports.MAX_IMAGES = MAX_IMAGES;
