// Téléchargement sécurisé des fichiers : jamais de dossier public, chaque accès est contrôlé.
const express = require('express');
const fs = require('fs');
const db = require('../db');
const { intOrNull, notFound } = require('../services/util');
const { filePath } = require('../services/upload');

const router = express.Router();

router.get('/archives/:id', (req, res) => {
  const u = req.user;
  const a = db.prepare('SELECT * FROM archives WHERE id = ? AND school_id = ?').get(intOrNull(req.params.id), u.school_id);
  if (!a) throw notFound();
  let allowed = false;
  if (u.role === 'admin') allowed = true;
  else if (u.role === 'teacher') allowed = !!db.prepare('SELECT 1 FROM teaching_assignments WHERE teacher_id = ? AND class_id = ? AND subject_id = ?').get(u.id, a.class_id, a.subject_id);
  else if (u.role === 'student') allowed = !!db.prepare('SELECT 1 FROM students WHERE user_id = ? AND class_id = ?').get(u.id, a.class_id);
  else if (u.role === 'parent')
    allowed = !!db.prepare('SELECT 1 FROM parent_students ps JOIN students s ON s.id = ps.student_id WHERE ps.parent_id = ? AND s.class_id = ?').get(u.id, a.class_id);
  if (!allowed) return res.status(403).json({ error: 'Accès refusé' });
  const p = filePath(u.school_id, a.file_name);
  if (!fs.existsSync(p)) throw notFound('Fichier manquant');
  res.download(p, a.original_name);
});

router.get('/justifications/:id', (req, res) => {
  const u = req.user;
  const j = db.prepare('SELECT * FROM justifications WHERE id = ? AND school_id = ?').get(intOrNull(req.params.id), u.school_id);
  if (!j || !j.file_name) throw notFound();
  let allowed = u.role === 'admin';
  if (u.role === 'parent') allowed = !!db.prepare('SELECT 1 FROM parent_students WHERE parent_id = ? AND student_id = ?').get(u.id, j.student_id);
  if (!allowed) return res.status(403).json({ error: 'Accès refusé' });
  const p = filePath(u.school_id, j.file_name);
  if (!fs.existsSync(p)) throw notFound('Fichier manquant');
  res.download(p, j.original_name || 'justificatif');
});

module.exports = router;
