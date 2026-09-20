const express = require('express');
const db = require('../db');
const { ah, bad, notFound, str, tempPassword, hashPassword } = require('../services/util');
const { createSchool } = require('../services/schools');

const router = express.Router();

router.get('/schools', (req, res) => {
  const rows = db
    .prepare(
      `SELECT s.id, s.code, s.name, s.city, s.active, s.created_at,
        (SELECT COUNT(*) FROM users u WHERE u.school_id = s.id AND u.role = 'student') AS students,
        (SELECT COUNT(*) FROM users u WHERE u.school_id = s.id AND u.role = 'teacher') AS teachers,
        (SELECT COUNT(*) FROM users u WHERE u.school_id = s.id AND u.role = 'parent') AS parents
       FROM schools s ORDER BY s.name`
    )
    .all();
  res.json({ schools: rows });
});

router.post('/schools', ah(async (req, res) => {
  const b = req.body || {};
  const out = await createSchool({
    code: b.code, name: b.name, city: b.city, academic_year: b.academic_year,
    admin: { username: b.admin_username, password: b.admin_password, email: b.admin_email, first_name: b.admin_first_name, last_name: b.admin_last_name },
  });
  res.status(201).json(out);
}));

router.patch('/schools/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM schools WHERE id = ?').get(req.params.id);
  if (!s) throw notFound();
  const b = req.body || {};
  const name = b.name !== undefined ? str(b.name, 120) : s.name;
  if (!name) throw bad('Nom obligatoire');
  const city = b.city !== undefined ? str(b.city, 80) : s.city;
  const active = b.active !== undefined ? (b.active ? 1 : 0) : s.active;
  db.prepare('UPDATE schools SET name = ?, city = ?, active = ? WHERE id = ?').run(name, city, active, s.id);
  res.json({ ok: true });
});

// Réinitialise le mot de passe du premier administrateur de l'établissement.
router.post('/schools/:id/reset-admin', ah(async (req, res) => {
  const admin = db.prepare("SELECT * FROM users WHERE school_id = ? AND role = 'admin' ORDER BY id LIMIT 1").get(req.params.id);
  if (!admin) throw notFound('Aucun administrateur');
  const pwd = tempPassword();
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, active = 1 WHERE id = ?').run(await hashPassword(pwd), admin.id);
  res.json({ username: admin.username, temp_password: pwd });
}));

module.exports = router;
