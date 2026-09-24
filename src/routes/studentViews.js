// Vues communes ÉLÈVE / PARENT : les deux espaces affichent la même information sur un élève.
// Le routeur reçoit une fonction "resolve" qui donne l'id de l'élève AUTORISÉ pour l'utilisateur connecté.
const express = require('express');
const db = require('../db');
const { bad, notFound, intOrNull } = require('../services/util');
const { buildReport, evolution } = require('../services/reports');
const { streamBulletin } = require('../services/pdf');

function studentViews(resolve) {
  const r = express.Router({ mergeParams: true });
  r.use((req, res, next) => {
    const sid = resolve(req);
    if (!sid) return res.status(404).json({ error: 'Élève introuvable' });
    req.studentId = sid;
    next();
  });

  const S = (req) => req.user.school_id;
  const visibleTerms = (req) =>
    db.prepare("SELECT id, name, status FROM terms WHERE school_id = ? AND status != 'upcoming' ORDER BY position").all(S(req));
  function pickTerm(req, terms) {
    const wanted = intOrNull(req.query.term_id);
    return terms.find((t) => t.id === wanted) || terms.find((t) => t.status === 'open') || terms[terms.length - 1] || null;
  }
  const lang = (req) => (req.query.lang === 'en' ? 'en' : 'fr');

  r.get('/dashboard', (req, res) => {
    const terms = visibleTerms(req);
    const term = pickTerm(req, terms);
    const info = db
      .prepare(
        `SELECT s.id, s.matricule, u.first_name, u.last_name, c.name AS class_name
         FROM students s JOIN users u ON u.id = s.user_id JOIN classes c ON c.id = s.class_id WHERE s.id = ? AND s.school_id = ?`
      )
      .get(req.studentId, S(req));
    if (!term) return res.json({ student: info, terms, term: null, report: null, evolution: [] });
    res.json({
      student: info,
      terms,
      term,
      report: buildReport(S(req), req.studentId, term.id, lang(req)),
      evolution: evolution(S(req), req.studentId),
      bulletin_min_avg: req.user.role === 'parent' ? req.school.parent_bulletin_min_avg : null,
    });
  });

  r.get('/bulletin.pdf', (req, res) => {
    const term = pickTerm(req, visibleTerms(req));
    if (!term) throw bad('Aucune période disponible');
    const report = buildReport(S(req), req.studentId, term.id, lang(req));
    if (!report) throw notFound();
    if (req.user.role === 'parent') {
      const min = req.school.parent_bulletin_min_avg;
      if (report.general === null || report.general < min) {
        const e = new Error(`Le bulletin est réservé aux élèves ayant au moins ${min}/20 de moyenne`);
        e.status = 403;
        throw e;
      }
    }
    streamBulletin(res, { school: req.school, report, lang: lang(req) });
  });

  r.get('/attendance', (req, res) => {
    const items = db
      .prepare(
        `SELECT a.id, a.date, a.status, a.justified, sub.name AS subject_name,
          (SELECT j.id FROM justifications j WHERE j.attendance_id = a.id ORDER BY j.id DESC LIMIT 1) AS justification_id,
          (SELECT j.status FROM justifications j WHERE j.attendance_id = a.id ORDER BY j.id DESC LIMIT 1) AS justification_status
         FROM attendance a JOIN subjects sub ON sub.id = a.subject_id
         WHERE a.school_id = ? AND a.student_id = ? AND a.status != 'present' ORDER BY a.date DESC, a.id DESC LIMIT 200`
      )
      .all(S(req), req.studentId);
    const total = db.prepare('SELECT COUNT(*) c FROM attendance WHERE school_id = ? AND student_id = ?').get(S(req), req.studentId).c;
    res.json({ items, total_recorded: total });
  });

  r.get('/programme', (req, res) => {
    const st = db.prepare('SELECT class_id FROM students WHERE id = ? AND school_id = ?').get(req.studentId, S(req));
    const chapters = db
      .prepare(
        `SELECT ch.id, ch.title, ch.status, sub.name AS subject_name FROM chapters ch JOIN subjects sub ON sub.id = ch.subject_id
         WHERE ch.school_id = ? AND ch.class_id = ? ORDER BY sub.name, ch.position, ch.id`
      )
      .all(S(req), st.class_id);
    const lessons = db
      .prepare(
        `SELECT l.id, l.date, l.content, l.homework, sub.name AS subject_name FROM lessons l JOIN subjects sub ON sub.id = l.subject_id
         WHERE l.school_id = ? AND l.class_id = ? ORDER BY l.date DESC, l.id DESC LIMIT 40`
      )
      .all(S(req), st.class_id);
    res.json({ chapters, lessons });
  });

  r.get('/archives', (req, res) => {
    const st = db.prepare('SELECT class_id FROM students WHERE id = ? AND school_id = ?').get(req.studentId, S(req));
    const params = [S(req), st.class_id];
    let where = 'a.school_id = ? AND a.class_id = ?';
    const sub = intOrNull(req.query.subject_id);
    if (sub !== null) { where += ' AND a.subject_id = ?'; params.push(sub); }
    const items = db
      .prepare(
        `SELECT a.id, a.title, a.original_name, a.size, a.created_at, sub.id AS subject_id, sub.name AS subject_name
         FROM archives a JOIN subjects sub ON sub.id = a.subject_id WHERE ${where} ORDER BY a.created_at DESC`
      )
      .all(...params);
    const subjects = db
      .prepare('SELECT DISTINCT sub.id, sub.name FROM archives a JOIN subjects sub ON sub.id = a.subject_id WHERE a.school_id = ? AND a.class_id = ? ORDER BY sub.name')
      .all(S(req), st.class_id);
    res.json({ items, subjects });
  });

  return r;
}

module.exports = studentViews;
