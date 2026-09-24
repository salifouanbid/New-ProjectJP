// Ouverture de la base SQLite + création du schéma.
// Pilote : better-sqlite3 si disponible, sinon module intégré node:sqlite (Node >= 22.5).
const fs = require('fs');
const path = require('path');
const config = require('./config');

if (config.databaseProvider !== 'sqlite') {
  throw new Error(
    'Le serveur Express utilise encore des requêtes SQLite synchrones. ' +
      'DB_PROVIDER=postgres est réservé à la prochaine phase de migration ; voir MIGRATION_STATUS.md.'
  );
}

function openDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const want = config.dbDriver;
  const nodeMajor = Number(process.versions.node.split('.')[0]);

  // Le module natif peut être installé sans binaire réellement compatible avec une
  // version Node non-LTS. En mode auto, node:sqlite est plus sûr à partir de Node 22.
  if (want === 'better-sqlite3' || (want === 'auto' && nodeMajor < 22)) {
    try {
      const Database = require('better-sqlite3');
      const db = new Database(file);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      db.driver = 'better-sqlite3';
      return db;
    } catch (e) {
      if (want === 'better-sqlite3') throw e;
    }
  }

  // Repli : SQLite intégré à Node (aucune compilation nécessaire)
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (e) {
    throw new Error(
      "Impossible d'ouvrir SQLite : better-sqlite3 n'est pas installé et node:sqlite n'existe pas dans cette version de Node. " +
        'Installe Node 22 LTS ou plus récent (https://nodejs.org).'
    );
  }
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return {
    driver: 'node:sqlite',
    prepare: (sql) => raw.prepare(sql),
    exec: (sql) => raw.exec(sql),
    close: () => raw.close(),
    transaction(fn) {
      return (...args) => {
        raw.exec('BEGIN');
        try {
          const result = fn(...args);
          raw.exec('COMMIT');
          return result;
        } catch (err) {
          try { raw.exec('ROLLBACK'); } catch (_) { /* ignore */ }
          throw err;
        }
      };
    },
  };
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  academic_year TEXT NOT NULL DEFAULT '',
  parent_bulletin_min_avg REAL NOT NULL DEFAULT 10,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  description TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  hours TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('superadmin','admin','teacher','student','parent')),
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_school_username ON users(IFNULL(school_id, 0), username);
CREATE INDEX IF NOT EXISTS ix_users_school_role ON users(school_id, role);

CREATE TABLE IF NOT EXISTS levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  level_id INTEGER NOT NULL REFERENCES levels(id),
  series_id INTEGER REFERENCES series(id),
  name TEXT NOT NULL,
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS coefficients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  level_id INTEGER NOT NULL REFERENCES levels(id) ON DELETE CASCADE,
  series_id INTEGER REFERENCES series(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  coef REAL NOT NULL CHECK (coef > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_coef ON coefficients(school_id, level_id, IFNULL(series_id, 0), subject_id);

CREATE TABLE IF NOT EXISTS terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','open','closed')),
  closed_at TEXT,
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  matricule TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_students_class ON students(school_id, class_id);

CREATE TABLE IF NOT EXISTS parent_students (
  parent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (parent_id, student_id)
);

CREATE TABLE IF NOT EXISTS teaching_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  UNIQUE (teacher_id, class_id, subject_id)
);

CREATE TABLE IF NOT EXISTS grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id),
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  term_id INTEGER NOT NULL REFERENCES terms(id),
  type TEXT NOT NULL CHECK (type IN ('interro','devoir')),
  idx INTEGER NOT NULL CHECK (idx BETWEEN 1 AND 6),
  value REAL NOT NULL CHECK (value >= 0 AND value <= 20),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, subject_id, term_id, type, idx)
);
CREATE INDEX IF NOT EXISTS ix_grades_term ON grades(school_id, term_id);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late')),
  justified INTEGER NOT NULL DEFAULT 0,
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (student_id, subject_id, date)
);
CREATE INDEX IF NOT EXISTS ix_att_school_date ON attendance(school_id, date);

CREATE TABLE IF NOT EXISTS justifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  attendance_id INTEGER NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  file_name TEXT,
  original_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  homework TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS archives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS discipline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('positive','negative')),
  description TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'news' CHECK (category IN ('news','event','info')),
  audience TEXT NOT NULL DEFAULT 'members' CHECK (audience IN ('public','members')),
  event_date TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  image_name TEXT,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_ann_school ON announcements(school_id, audience, created_at);

CREATE TABLE IF NOT EXISTS announcement_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_annimg_ann ON announcement_images(announcement_id, position);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
`;

const db = openDb(config.dbPath);
db.exec(SCHEMA);

// Migration : ajoute les colonnes « vitrine » aux bases créées avec une ancienne version.
const schoolCols = db.prepare('PRAGMA table_info(schools)').all().map((c) => c.name);
[['description', ''], ['address', ''], ['phone', ''], ['contact_email', ''], ['hours', '']].forEach(([name]) => {
  if (!schoolCols.includes(name)) db.exec(`ALTER TABLE schools ADD COLUMN ${name} TEXT NOT NULL DEFAULT ''`);
});
const annCols = db.prepare('PRAGMA table_info(announcements)').all().map((c) => c.name);
if (!annCols.includes('image_name')) db.exec('ALTER TABLE announcements ADD COLUMN image_name TEXT');
// Migration : l'ancienne image unique d'une publication devient la 1re image de sa galerie.
db.exec(`INSERT INTO announcement_images (school_id, announcement_id, file_name, position)
         SELECT school_id, id, image_name, 0 FROM announcements WHERE image_name IS NOT NULL;
         UPDATE announcements SET image_name = NULL WHERE image_name IS NOT NULL;`);

module.exports = db;
