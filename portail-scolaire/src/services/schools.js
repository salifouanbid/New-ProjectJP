const db = require('../db');
const { hashPassword, tempPassword, bad, str, normUsername, normEmail, checkPassword } = require('./util');

const CODE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Crée un établissement, ses 3 trimestres et son compte administrateur. Retourne le mot de passe provisoire éventuel.
async function createSchool({ code, name, city, academic_year, admin }) {
  code = str(code, 30).toLowerCase();
  name = str(name, 120);
  if (!CODE_RE.test(code) || code.length < 3) throw bad("Code établissement invalide (3 à 30 caractères : minuscules, chiffres, tirets)");
  if (!name) throw bad("Le nom de l'établissement est obligatoire");
  const username = normUsername(admin && admin.username);
  const email = normEmail(admin && admin.email);
  let generated = null;
  let password = admin && admin.password;
  if (password) checkPassword(password);
  else { password = tempPassword(); generated = password; }
  const hash = await hashPassword(password);

  const run = db.transaction(() => {
    const s = db
      .prepare('INSERT INTO schools (code, name, city, academic_year) VALUES (?,?,?,?)')
      .run(code, name, str(city, 80), str(academic_year, 20));
    const schoolId = Number(s.lastInsertRowid);
    ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'].forEach((n, i) =>
      db.prepare('INSERT INTO terms (school_id, name, position, status) VALUES (?,?,?,?)').run(schoolId, n, i + 1, i === 0 ? 'open' : 'upcoming')
    );
    db.prepare(
      `INSERT INTO users (school_id, username, email, password_hash, role, first_name, last_name, must_change_password)
       VALUES (?,?,?,?, 'admin', ?, ?, ?)`
    ).run(schoolId, username, email, hash, str(admin.first_name, 60) || 'Administrateur', str(admin.last_name, 60) || name, generated ? 1 : 0);
    return schoolId;
  });
  const schoolId = run();
  return { school_id: schoolId, code, admin_username: username, temp_password: generated };
}

module.exports = { createSchool, CODE_RE };
