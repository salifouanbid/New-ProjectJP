// Espace PROFESSEUR : chaque professeur n'accède qu'aux classes/matières qui lui sont attribuées.
const express = require('express');
const db = require('../db');
const { bad, notFound, str, intOrNull, isDate } = require('../services/util');
const { makeUploader, verifyFile, removeFile } = require('../services/upload');
const { INTERRO_MAX, DEVOIR_MAX } = require('../services/grades');

const router = express.Router();
const S = (req) => req.user.school_id;

function assertAssigned(req, classId, subjectId) {
  const c = intOrNull(classId);
  const s = intOrNull(subjectId);
  if (c === null) throw bad('Classe invalide');
  const row = s === null
    ? db.prepare('SELECT 1 FROM teaching_assignments WHERE school_id = ? AND teacher_id = ? AND class_id = ?').get(S(req), req.user.id, c)
    : db.prepare('SELECT 1 FROM teaching_assignments WHERE school_id = ? AND teacher_id = ? AND class_id = ? AND subject_id = ?').get(S(req), req.user.id, c, s);
  if (!row) { const e = new Error("Vous n'enseignez pas cette matière dans cette classe"); e.status = 403; throw e; }
  return { classId: c, subjectId: s };
}
function getTerm(req, id) {
  const t = db.prepare('SELECT * FROM terms WHERE id = ? AND school_id = ?').get(intOrNull(id), S(req));
  if (!t) throw bad('Période introuvable');
  return t;
}
function classStudents(req, classId) {
  return db
    .prepare(
      `SELECT s.id, s.matricule, u.first_name, u.last_name FROM students s JOIN users u ON u.id = s.user_id
       WHERE s.school_id = ? AND s.class_id = ? AND u.active = 1 ORDER BY u.last_name, u.first_name`
    )
    .all(S(req), classId);
}

router.get('/context', (req, res) => {
  const assignments = db
    .prepare(
      `SELECT ta.class_id, ta.subject_id, c.name AS class_name, s.name AS subject_name,
        (SELECT COUNT(*) FROM students st WHERE st.class_id = c.id) AS students
       FROM teaching_assignments ta JOIN classes c ON c.id = ta.class_id JOIN subjects s ON s.id = ta.subject_id
       WHERE ta.school_id = ? AND ta.teacher_id = ? ORDER BY c.name, s.name`
    )
    .all(S(req), req.user.id);
  const terms = db.prepare("SELECT id, name, status FROM terms WHERE school_id = ? AND status != 'upcoming' ORDER BY position").all(S(req));
  res.json({ assignments, terms });
});

/* ---------- Notes ---------- */
router.get('/grades', (req, res) => {
  const { classId, subjectId } = assertAssigned(req, req.query.class_id, req.query.subject_id);
  const term = getTerm(req, req.query.term_id);
  const students = classStudents(req, classId);
  const grades = db
    .prepare(`SELECT g.student_id, g.type, g.idx, g.value FROM grades g JOIN students s ON s.id = g.student_id
              WHERE g.school_id = ? AND g.term_id = ? AND g.subject_id = ? AND s.class_id = ?`)
    .all(S(req), term.id, subjectId, classId);
  const rows = students.map((st) => {
    const interro = Array(INTERRO_MAX).fill(null);
    const devoir = Array(DEVOIR_MAX).fill(null);
    grades.filter((g) => g.student_id === st.id).forEach((g) => {
      if (g.type === 'interro') interro[g.idx - 1] = g.value; else if (g.idx <= DEVOIR_MAX) devoir[g.idx - 1] = g.value;
    });
    return { ...st, interro, devoir };
  });
  res.json({ term, locked: term.status !== 'open', interro_max: INTERRO_MAX, devoir_max: DEVOIR_MAX, students: rows });
});

router.put('/grades', (req, res) => {
  const b = req.body || {};
  const { classId, subjectId } = assertAssigned(req, b.class_id, b.subject_id);
  const term = getTerm(req, b.term_id);
  if (term.status !== 'open') { const e = new Error('Cette période est clôturée : les notes sont gelées'); e.status = 423; throw e; }
  const entries = Array.isArray(b.entries) ? b.entries : [];
  if (entries.length > 2000) throw bad('Trop de notes envoyées');
  const ids = new Set(classStudents(req, classId).map((s) => s.id));
  const upsert = db.prepare(
    `INSERT INTO grades (school_id, student_id, subject_id, term_id, type, idx, value, created_by)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(student_id, subject_id, term_id, type, idx)
     DO UPDATE SET value = excluded.value, created_by = excluded.created_by, updated_at = datetime('now')`
  );
  const del = db.prepare('DELETE FROM grades WHERE student_id = ? AND subject_id = ? AND term_id = ? AND type = ? AND idx = ? AND school_id = ?');
  // Transaction : tout est enregistré, ou rien (jamais de données partielles).
  db.transaction(() => {
    for (const e of entries) {
      const sid = intOrNull(e.student_id);
      if (!ids.has(sid)) throw bad('Élève inconnu dans cette classe');
      if (!['interro', 'devoir'].includes(e.type)) throw bad('Type de note invalide');
      const idx = intOrNull(e.idx);
      const max = e.type === 'interro' ? INTERRO_MAX : DEVOIR_MAX;
      if (idx === null || idx < 1 || idx > max) throw bad(`Numéro de ${e.type === 'interro' ? 'interrogation' : 'devoir'} invalide`);
      if (e.value === null || e.value === '' || e.value === undefined) {
        del.run(sid, subjectId, term.id, e.type, idx, S(req));
        continue;
      }
      const v = Number(e.value);
      if (!Number.isFinite(v) || v < 0 || v > 20) throw bad('Les notes doivent être comprises entre 0 et 20');
      upsert.run(S(req), sid, subjectId, term.id, e.type, idx, Math.round(v * 100) / 100, req.user.id);
    }
  })();
  res.json({ ok: true, saved: entries.length });
});

/* ---------- Cahier d'appel ---------- */
router.get('/attendance', (req, res) => {
  const { classId, subjectId } = assertAssigned(req, req.query.class_id, req.query.subject_id);
  if (subjectId === null) throw bad('Matière invalide');
  if (!isDate(req.query.date)) throw bad('Date invalide');
  const students = classStudents(req, classId);
  const rows = db.prepare('SELECT student_id, status, justified FROM attendance WHERE school_id = ? AND class_id = ? AND subject_id = ? AND date = ?')
    .all(S(req), classId, subjectId, req.query.date);
  res.json({
    students: students.map((st) => {
      const r = rows.find((x) => x.student_id === st.id);
      return { ...st, status: r ? r.status : null, justified: r ? !!r.justified : false };
    }),
  });
});

router.put('/attendance', (req, res) => {
  const b = req.body || {};
  const { classId, subjectId } = assertAssigned(req, b.class_id, b.subject_id);
  if (subjectId === null) throw bad('Matière invalide');
  if (!isDate(b.date)) throw bad('Date invalide');
  if (Date.parse(b.date) > Date.now() + 36 * 3600 * 1000) throw bad('La date ne peut pas être dans le futur');
  const entries = Array.isArray(b.entries) ? b.entries : [];
  const ids = new Set(classStudents(req, classId).map((s) => s.id));
  // Sauvegarde groupée et transactionnelle : l'appel est enregistré en entier ou pas du tout.
  db.transaction(() => {
    for (const e of entries) {
      const sid = intOrNull(e.student_id);
      if (!ids.has(sid)) throw bad('Élève inconnu dans cette classe');
      if (e.status === null || e.status === undefined || e.status === '') {
        db.prepare('DELETE FROM attendance WHERE student_id = ? AND subject_id = ? AND date = ? AND school_id = ?').run(sid, subjectId, b.date, S(req));
        continue;
      }
      if (!['present', 'absent', 'late'].includes(e.status)) throw bad('Statut invalide');
      db.prepare(
        `INSERT INTO attendance (school_id, student_id, class_id, subject_id, date, status, recorded_by)
         VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(student_id, subject_id, date) DO UPDATE SET status = excluded.status, recorded_by = excluded.recorded_by`
      ).run(S(req), sid, classId, subjectId, b.date, e.status, req.user.id);
    }
  })();
  res.json({ ok: true, saved: entries.length });
});

/* ---------- Cahier de texte : chapitres + séances ---------- */
router.get('/chapters', (req, res) => {
  const { classId, subjectId } = assertAssigned(req, req.query.class_id, req.query.subject_id);
  res.json({ items: db.prepare('SELECT id, title, status, updated_at FROM chapters WHERE school_id = ? AND class_id = ? AND subject_id = ? ORDER BY position, id').all(S(req), classId, subjectId) });
});
router.post('/chapters', (req, res) => {
  const { classId, subjectId } = assertAssigned(req, req.body && req.body.class_id, req.body && req.body.subject_id);
  const title = str(req.body.title, 160);
  if (!title) throw bad('Titre obligatoire');
  const pos = db.prepare('SELECT COALESCE(MAX(position),0)+1 p FROM chapters WHERE school_id = ? AND class_id = ? AND subject_id = ?').get(S(req), classId, subjectId).p;
  const r = db.prepare('INSERT INTO chapters (school_id, class_id, subject_id, teacher_id, title, position) VALUES (?,?,?,?,?,?)').run(S(req), classId, subjectId, req.user.id, title, pos);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
function chapterFor(req) {
  const ch = db.prepare('SELECT * FROM chapters WHERE id = ? AND school_id = ?').get(intOrNull(req.params.id), S(req));
  if (!ch) throw notFound();
  assertAssigned(req, ch.class_id, ch.subject_id);
  return ch;
}
router.put('/chapters/:id', (req, res) => {
  const ch = chapterFor(req);
  const status = req.body && req.body.status !== undefined ? req.body.status : ch.status;
  if (!['todo', 'in_progress', 'done'].includes(status)) throw bad('Statut invalide');
  const title = req.body && req.body.title !== undefined ? str(req.body.title, 160) : ch.title;
  if (!title) throw bad('Titre obligatoire');
  db.prepare("UPDATE chapters SET status = ?, title = ?, updated_at = datetime('now') WHERE id = ?").run(status, title, ch.id);
  res.json({ ok: true });
});
router.delete('/chapters/:id', (req, res) => {
  db.prepare('DELETE FROM chapters WHERE id = ?').run(chapterFor(req).id);
  res.json({ ok: true });
});

router.get('/lessons', (req, res) => {
  const { classId, subjectId } = assertAssigned(req, req.query.class_id, req.query.subject_id);
  res.json({ items: db.prepare('SELECT id, date, content, homework FROM lessons WHERE school_id = ? AND class_id = ? AND subject_id = ? ORDER BY date DESC, id DESC LIMIT 100').all(S(req), classId, subjectId) });
});
router.post('/lessons', (req, res) => {
  const b = req.body || {};
  const { classId, subjectId } = assertAssigned(req, b.class_id, b.subject_id);
  if (!isDate(b.date)) throw bad('Date invalide');
  const content = str(b.content, 2000);
  if (!content) throw bad('Le contenu de la séance est obligatoire');
  const r = db.prepare('INSERT INTO lessons (school_id, class_id, subject_id, teacher_id, date, content, homework) VALUES (?,?,?,?,?,?,?)')
    .run(S(req), classId, subjectId, req.user.id, b.date, content, str(b.homework, 1000));
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
router.delete('/lessons/:id', (req, res) => {
  const l = db.prepare('SELECT * FROM lessons WHERE id = ? AND school_id = ?').get(intOrNull(req.params.id), S(req));
  if (!l) throw notFound();
  assertAssigned(req, l.class_id, l.subject_id);
  db.prepare('DELETE FROM lessons WHERE id = ?').run(l.id);
  res.json({ ok: true });
});

/* ---------- Archives (anciennes épreuves PDF) ---------- */
const uploadPdf = makeUploader(['.pdf'], 10);

router.get('/archives', (req, res) => {
  const { classId, subjectId } = assertAssigned(req, req.query.class_id, req.query.subject_id);
  res.json({ items: db.prepare('SELECT id, title, original_name, size, created_at FROM archives WHERE school_id = ? AND class_id = ? AND subject_id = ? ORDER BY created_at DESC').all(S(req), classId, subjectId) });
});
router.post('/archives', uploadPdf.single('file'), (req, res) => {
  const file = req.file;
  try {
    if (!file) throw bad('Fichier PDF obligatoire');
    verifyFile(file);
    const { classId, subjectId } = assertAssigned(req, req.body.class_id, req.body.subject_id);
    const title = str(req.body.title, 160) || file.originalname.replace(/\.pdf$/i, '');
    const r = db.prepare('INSERT INTO archives (school_id, class_id, subject_id, uploaded_by, title, file_name, original_name, size) VALUES (?,?,?,?,?,?,?,?)')
      .run(S(req), classId, subjectId, req.user.id, title, file.filename, str(file.originalname, 200), file.size);
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  } catch (e) {
    if (file) removeFile(S(req), file.filename);
    throw e;
  }
});
router.delete('/archives/:id', (req, res) => {
  const a = db.prepare('SELECT * FROM archives WHERE id = ? AND school_id = ?').get(intOrNull(req.params.id), S(req));
  if (!a) throw notFound();
  assertAssigned(req, a.class_id, a.subject_id);
  db.prepare('DELETE FROM archives WHERE id = ?').run(a.id);
  removeFile(S(req), a.file_name);
  res.json({ ok: true });
});

/* ---------- Signalements disciplinaires ---------- */
router.get('/discipline', (req, res) => {
  const { classId } = assertAssigned(req, req.query.class_id, null);
  const items = db
    .prepare(
      `SELECT d.id, d.kind, d.description, d.date, u.first_name || ' ' || u.last_name AS student_name,
        IFNULL(tu.first_name || ' ' || tu.last_name, '') AS teacher_name
       FROM discipline d JOIN students st ON st.id = d.student_id JOIN users u ON u.id = st.user_id
       LEFT JOIN users tu ON tu.id = d.recorded_by
       WHERE d.school_id = ? AND d.class_id = ? ORDER BY d.date DESC, d.id DESC LIMIT 200`
    )
    .all(S(req), classId);
  res.json({ items });
});
router.post('/discipline', (req, res) => {
  const b = req.body || {};
  const st = db.prepare('SELECT * FROM students WHERE id = ? AND school_id = ?').get(intOrNull(b.student_id), S(req));
  if (!st) throw bad('Élève introuvable');
  assertAssigned(req, st.class_id, null);
  if (!['positive', 'negative'].includes(b.kind)) throw bad('Type invalide');
  const description = str(b.description, 500);
  if (!description) throw bad('Description obligatoire');
  const date = isDate(b.date) ? b.date : new Date().toISOString().slice(0, 10);
  const r = db.prepare('INSERT INTO discipline (school_id, student_id, class_id, recorded_by, kind, description, date) VALUES (?,?,?,?,?,?,?)')
    .run(S(req), st.id, st.class_id, req.user.id, b.kind, description, date);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
router.get('/classes/:classId/students', (req, res) => {
  const { classId } = assertAssigned(req, req.params.classId, null);
  res.json({ items: classStudents(req, classId) });
});

module.exports = router;
