// Calcul des moyennes, rangs et bulletins — toujours filtré par établissement (school_id).
const db = require('../db');
const { round2, mean, subjectAverage, gradeColor, appreciation } = require('./grades');

// Coefficient par matière pour un niveau (+ série). Une règle par série l'emporte sur la règle du niveau.
function coefMapFor(schoolId, levelId, seriesId) {
  const rows = db
    .prepare(
      `SELECT subject_id, series_id, coef FROM coefficients
       WHERE school_id = ? AND level_id = ? AND (series_id IS NULL OR series_id = ?)`
    )
    .all(schoolId, levelId, seriesId === null || seriesId === undefined ? -1 : seriesId);
  const map = new Map();
  rows.filter((r) => r.series_id === null).forEach((r) => map.set(r.subject_id, r.coef));
  rows.filter((r) => r.series_id !== null).forEach((r) => map.set(r.subject_id, r.coef));
  return map;
}

// Calcule toutes les moyennes d'une classe pour un trimestre.
function computeClass(schoolId, classId, termId) {
  const cls = db.prepare('SELECT * FROM classes WHERE id = ? AND school_id = ?').get(classId, schoolId);
  if (!cls) return null;
  const coefMap = coefMapFor(schoolId, cls.level_id, cls.series_id);

  const students = db
    .prepare(
      `SELECT s.id, s.matricule, u.first_name, u.last_name
       FROM students s JOIN users u ON u.id = s.user_id
       WHERE s.school_id = ? AND s.class_id = ? AND u.active = 1
       ORDER BY u.last_name, u.first_name`
    )
    .all(schoolId, classId);

  const grades = db
    .prepare(
      `SELECT g.student_id, g.subject_id, g.type, g.idx, g.value
       FROM grades g JOIN students s ON s.id = g.student_id
       WHERE g.school_id = ? AND g.term_id = ? AND s.class_id = ?
       ORDER BY g.idx`
    )
    .all(schoolId, termId, classId);

  const bySt = new Map(); // student -> subject -> {interros:[], devoirs:[]}
  for (const g of grades) {
    if (!bySt.has(g.student_id)) bySt.set(g.student_id, new Map());
    const subs = bySt.get(g.student_id);
    if (!subs.has(g.subject_id)) subs.set(g.subject_id, { interros: [], devoirs: [], i: [], d: [] });
    const cell = subs.get(g.subject_id);
    if (g.type === 'interro') { cell.interros.push(g.value); cell.i[g.idx - 1] = g.value; }
    else { cell.devoirs.push(g.value); cell.d[g.idx - 1] = g.value; }
  }

  const result = new Map();
  const subjectAvgs = new Map(); // subject -> [avg of each student]
  for (const st of students) {
    const subs = bySt.get(st.id) || new Map();
    const perSubject = new Map();
    let pts = 0;
    let coefSum = 0;
    for (const [sid, cell] of subs) {
      const avg = subjectAverage(cell.interros, cell.devoirs);
      if (avg === null) continue;
      const coef = coefMap.has(sid) ? coefMap.get(sid) : 1;
      perSubject.set(sid, { ...cell, avg, coef });
      pts += avg * coef;
      coefSum += coef;
      if (!subjectAvgs.has(sid)) subjectAvgs.set(sid, []);
      subjectAvgs.get(sid).push(avg);
    }
    result.set(st.id, { student: st, subjects: perSubject, general: coefSum ? pts / coefSum : null, coefSum });
  }

  // Rangs (ex æquo = même rang)
  const generals = [...result.values()].map((r) => r.general).filter((g) => g !== null);
  for (const r of result.values()) {
    r.rank = r.general === null ? null : 1 + generals.filter((g) => g > r.general + 1e-9).length;
  }
  const classAvg = mean(generals);
  return {
    cls,
    coefMap,
    students,
    results: result,
    ranked: generals.length,
    classAvg,
    classMin: generals.length ? Math.min(...generals) : null,
    classMax: generals.length ? Math.max(...generals) : null,
    subjectClassAvg: new Map([...subjectAvgs].map(([sid, arr]) => [sid, mean(arr)])),
  };
}

// Rapport détaillé pour un élève (bulletin / tableau de bord)
function buildReport(schoolId, studentId, termId, lang = 'fr') {
  const st = db
    .prepare(
      `SELECT s.id, s.class_id, s.matricule, u.first_name, u.last_name
       FROM students s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.school_id = ?`
    )
    .get(studentId, schoolId);
  if (!st) return null;
  const term = db.prepare('SELECT * FROM terms WHERE id = ? AND school_id = ?').get(termId, schoolId);
  if (!term) return null;

  const data = computeClass(schoolId, st.class_id, termId);
  const mine = data.results.get(st.id);
  const subjectNames = new Map(
    db.prepare('SELECT id, name FROM subjects WHERE school_id = ?').all(schoolId).map((s) => [s.id, s.name])
  );

  const subjects = [...(mine ? mine.subjects : new Map())].map(([sid, c]) => ({
    subject_id: sid,
    name: subjectNames.get(sid) || '?',
    coef: c.coef,
    interros: c.i.map((v) => (v === undefined ? null : v)),
    devoirs: c.d.map((v) => (v === undefined ? null : v)),
    mi: round2(mean(c.interros)),
    avg: round2(c.avg),
    points: round2(c.avg * c.coef),
    class_avg: round2(data.subjectClassAvg.get(sid) ?? null),
    color: gradeColor(c.avg),
  }));
  subjects.sort((a, b) => a.name.localeCompare(b.name));

  const general = mine && mine.general !== null ? round2(mine.general) : null;
  return {
    student: { id: st.id, first_name: st.first_name, last_name: st.last_name, matricule: st.matricule },
    class: { id: data.cls.id, name: data.cls.name },
    term: { id: term.id, name: term.name, status: term.status },
    subjects,
    total_coef: mine ? mine.coefSum : 0,
    general,
    color: gradeColor(general),
    rank: mine ? mine.rank : null,
    class_size: data.students.length,
    ranked: data.ranked,
    class_avg: round2(data.classAvg),
    class_min: round2(data.classMin),
    class_max: round2(data.classMax),
    appreciation: appreciation(general, lang),
  };
}

// Moyenne générale de l'élève à chaque trimestre commencé (courbe d'évolution)
function evolution(schoolId, studentId) {
  const st = db.prepare('SELECT class_id FROM students WHERE id = ? AND school_id = ?').get(studentId, schoolId);
  if (!st) return [];
  const terms = db
    .prepare("SELECT id, name FROM terms WHERE school_id = ? AND status != 'upcoming' ORDER BY position")
    .all(schoolId);
  return terms.map((t) => {
    const data = computeClass(schoolId, st.class_id, t.id);
    const r = data && data.results.get(studentId);
    return { term_id: t.id, name: t.name, general: r && r.general !== null ? round2(r.general) : null };
  });
}

module.exports = { computeClass, buildReport, evolution, coefMapFor };
