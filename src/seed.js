// Données de DÉMONSTRATION (2 établissements). Usage : npm run seed
// Ne jamais utiliser en production : tous les comptes ont le même mot de passe.
const bcrypt = require('bcryptjs');
const config = require('./config');
const db = require('./db');
const { createSchool } = require('./services/schools');

const PASSWORD = 'Demo1234!';

let seedState = 12345;
const rnd = () => { seedState = (seedState * 1664525 + 1013904223) % 4294967296; return seedState / 4294967296; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const FIRST = ['Koffi', 'Adjoa', 'Fadila', 'Rodrigue', 'Sènami', 'Mariam', 'Yannick', 'Chancelvie', 'Kévin', 'Ornella', 'Gildas', 'Prisca', 'Orphée', 'Judicaël', 'Estelle', 'Dieudonné'];
const LAST = ['Adjovi', 'Dossou', 'Houngbadji', 'Tossou', 'Agbodjan', 'Sagbo', 'Gnancadja', 'Akakpo', 'Zinsou', 'Hounkpatin', 'Assogba', 'Hessou'];

async function seedSchool({ code, name, city }, hash) {
  if (db.prepare('SELECT 1 FROM schools WHERE code = ?').get(code)) {
    console.log(`  - ${code} existe déjà, ignoré`);
    return;
  }
  const { school_id: S } = await createSchool({
    code, name, city, academic_year: '2026-2027',
    admin: { username: 'admin', password: PASSWORD, email: `admin@${code}.demo`, first_name: 'Direction', last_name: name },
  });
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE school_id = ?').run(hash, S);

  const run = db.transaction(() => {
    const insert = (sql, ...p) => Number(db.prepare(sql).run(...p).lastInsertRowid);
    const levels = ['6ème', '5ème', '4ème', '3ème'].map((n, i) => insert('INSERT INTO levels (school_id, name, position) VALUES (?,?,?)', S, n, i + 1));
    const subj = {};
    [['Français', 3], ['Mathématiques', 3], ['Anglais', 2], ['SVT', 2], ['Histoire-Géographie', 2], ['EPS', 1]].forEach(([n]) => {
      subj[n] = insert('INSERT INTO subjects (school_id, name) VALUES (?,?)', S, n);
    });
    const coefs = { 'Français': 3, 'Mathématiques': 3, 'Anglais': 2, 'SVT': 2, 'Histoire-Géographie': 2, 'EPS': 1 };
    levels.forEach((l) => Object.entries(coefs).forEach(([n, c]) =>
      insert('INSERT INTO coefficients (school_id, level_id, subject_id, coef) VALUES (?,?,?,?)', S, l, subj[n], c)));

    const classes = [
      insert('INSERT INTO classes (school_id, level_id, name) VALUES (?,?,?)', S, levels[0], '6ème A'),
      insert('INSERT INTO classes (school_id, level_id, name) VALUES (?,?,?)', S, levels[1], '5ème A'),
    ];

    const user = (username, role, first, last) =>
      insert(`INSERT INTO users (school_id, username, email, password_hash, role, first_name, last_name) VALUES (?,?,?,?,?,?,?)`,
        S, username, `${username}@${code}.demo`, hash, role, first, last);

    const teachers = {
      francais: user('prof.francais', 'teacher', 'Aimé', 'Gbaguidi'),
      maths: user('prof.maths', 'teacher', 'Clarisse', 'Adande'),
      anglais: user('prof.anglais', 'teacher', 'Théophile', 'Kpanou'),
    };
    const tMap = { 'Français': 'francais', 'Mathématiques': 'maths', 'Anglais': 'anglais' };
    Object.entries(tMap).forEach(([sn, key]) => classes.forEach((c) =>
      insert('INSERT INTO teaching_assignments (school_id, teacher_id, class_id, subject_id) VALUES (?,?,?,?)', S, teachers[key], c, subj[sn])));
    // SVT / Histoire-Géo / EPS : professeur polyvalent
    const poly = user('prof.divers', 'teacher', 'Sylvain', 'Ahouansou');
    ['SVT', 'Histoire-Géographie', 'EPS'].forEach((sn) => classes.forEach((c) =>
      insert('INSERT INTO teaching_assignments (school_id, teacher_id, class_id, subject_id) VALUES (?,?,?,?)', S, poly, c, subj[sn])));

    const students = [];
    let n = 1;
    classes.forEach((c) => {
      for (let i = 0; i < 6; i++, n++) {
        const uid = user(`eleve${n}`, 'student', FIRST[(n * 3) % FIRST.length], LAST[(n * 5) % LAST.length]);
        const sid = insert('INSERT INTO students (school_id, user_id, class_id, matricule) VALUES (?,?,?,?)', S, uid, c, `M${String(2026000 + n)}`);
        students.push({ sid, cid: c, level: rnd() * 6 + 8 });
      }
    });
    for (let p = 0; p < 4; p++) {
      const pid = user(`parent${p + 1}`, 'parent', FIRST[(p * 7 + 2) % FIRST.length], LAST[(p * 3) % LAST.length]);
      [students[p * 2], students[p * 2 + 1]].forEach((st) => insert('INSERT INTO parent_students (parent_id, student_id) VALUES (?,?)', pid, st.sid));
    }

    const term1 = db.prepare("SELECT id FROM terms WHERE school_id = ? AND position = 1").get(S).id;
    students.forEach((st) => Object.values(subj).forEach((sid) => {
      const base = st.level + (rnd() - 0.5) * 4;
      const clamp = (v) => Math.max(2, Math.min(20, Math.round(v * 4) / 4));
      const nInt = 3 + Math.floor(rnd() * 3);
      for (let i = 1; i <= nInt; i++) insert("INSERT INTO grades (school_id, student_id, subject_id, term_id, type, idx, value) VALUES (?,?,?,?, 'interro', ?, ?)", S, st.sid, sid, term1, i, clamp(base + (rnd() - 0.5) * 5));
      for (let d = 1; d <= 2; d++) insert("INSERT INTO grades (school_id, student_id, subject_id, term_id, type, idx, value) VALUES (?,?,?,?, 'devoir', ?, ?)", S, st.sid, sid, term1, d, clamp(base + (rnd() - 0.5) * 4));
    }));

    // Quelques présences / absences
    const days = [1, 2, 3].map((d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10));
    let firstAbsence = null;
    students.forEach((st, i) => days.forEach((day, k) => {
      const status = (i + k) % 7 === 0 ? 'absent' : (i + k) % 11 === 0 ? 'late' : 'present';
      const id = insert('INSERT INTO attendance (school_id, student_id, class_id, subject_id, date, status, recorded_by) VALUES (?,?,?,?,?,?,?)', S, st.sid, st.cid, subj['Mathématiques'], day, status, teachers.maths);
      if (status === 'absent' && !firstAbsence) firstAbsence = { id, sid: st.sid };
    }));
    if (firstAbsence) insert("INSERT INTO justifications (school_id, attendance_id, student_id, reason) VALUES (?,?,?,?)", S, firstAbsence.id, firstAbsence.sid, 'Rendez-vous médical (justificatif à fournir).');

    // Cahier de texte
    classes.forEach((c) => {
      [['Mathématiques', 'Les nombres décimaux', 'done'], ['Mathématiques', 'Les fractions', 'in_progress'], ['Mathématiques', 'Proportionnalité', 'todo'], ['Français', 'Le récit', 'done'], ['Français', 'La description', 'in_progress']]
        .forEach(([sn, title, status], i) => insert('INSERT INTO chapters (school_id, class_id, subject_id, teacher_id, title, position, status) VALUES (?,?,?,?,?,?,?)', S, c, subj[sn], teachers[sn === 'Français' ? 'francais' : 'maths'], title, i, status));
      insert('INSERT INTO lessons (school_id, class_id, subject_id, teacher_id, date, content, homework) VALUES (?,?,?,?,?,?,?)', S, c, subj['Mathématiques'], teachers.maths, days[0], 'Addition et soustraction de fractions de même dénominateur.', 'Exercices 3 et 4 page 52.');
    });
    // Site vitrine : présentation + publications
    db.prepare('UPDATE schools SET description = ?, address = ?, phone = ?, contact_email = ?, hours = ? WHERE id = ?')
      .run(`Bienvenue au ${name}. Un établissement engagé pour la réussite de chaque élève, dans un cadre sûr et bienveillant.`, `${city}, Bénin`, '+229 01 00 00 00 00', `contact@${code}.demo`, 'Lun–Ven 7h30 – 17h30', S);
    const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
    const adminId = db.prepare("SELECT id FROM users WHERE school_id = ? AND role = 'admin'").get(S).id;
    const ann = (title, body, category, audience, eventDate, pinned) =>
      insert('INSERT INTO announcements (school_id, title, body, category, audience, event_date, pinned, author_id) VALUES (?,?,?,?,?,?,?,?)', S, title, body, category, audience, eventDate, pinned, adminId);
    ann('Rentrée scolaire 2026-2027', 'Les cours reprennent lundi à 7h30. Les élèves doivent se présenter en uniforme complet.\nBonne rentrée à tous !', 'news', 'public', null, 1);
    ann('Réunion parents-professeurs', "Nous invitons tous les parents à la réunion de début d'année afin de rencontrer l'équipe pédagogique.\nLieu : cour centrale. Merci de votre présence.", 'event', 'public', inDays(12), 0);
    ann('Journée culturelle', "Présentations, danses et expositions préparées par les élèves. Entrée libre.", 'event', 'public', inDays(30), 0);
    ann('Frais de scolarité : 2e tranche', "Rappel : la 2e tranche est à régler avant la fin du mois auprès de l'intendance.", 'info', 'members', null, 0);
    insert("INSERT INTO discipline (school_id, student_id, class_id, recorded_by, kind, description, date) VALUES (?,?,?,?,?,?,?)", S, students[0].sid, students[0].cid, teachers.maths, 'positive', 'Participation remarquable en classe.', days[0]);
    insert("INSERT INTO discipline (school_id, student_id, class_id, recorded_by, kind, description, date) VALUES (?,?,?,?,?,?,?)", S, students[3].sid, students[3].cid, teachers.francais, 'negative', 'Bavardages répétés pendant le cours.', days[1]);
  });
  run();
  console.log(`  + ${name}  (code: ${code})`);
}

async function main() {
  if (config.isProd) {
    console.error('Le seed est interdit en production.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(PASSWORD, 10);
  console.log('Création des données de démonstration…');
  if (!db.prepare("SELECT 1 FROM users WHERE role = 'superadmin'").get()) {
    db.prepare("INSERT INTO users (school_id, username, password_hash, role, first_name, last_name) VALUES (NULL, ?, ?, 'superadmin', 'Propriétaire', 'Plateforme')").run(config.superadmin.username, hash);
    console.log(`  + super-admin : ${config.superadmin.username}`);
  }
  await seedSchool({ code: 'jean-piaget-1', name: 'Collège Jean Piaget 1', city: 'Abomey-Calavi' }, hash);
  await seedSchool({ code: 'lycee-demo', name: 'Lycée Démo Excellence', city: 'Cotonou' }, hash);
  console.log(`\nTerminé. Mot de passe de TOUS les comptes de démo : ${PASSWORD}`);
  console.log('Établissements : jean-piaget-1  |  lycee-demo');
  console.log('Identifiants : admin, prof.maths, prof.francais, eleve1, parent1 …\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
