const bcrypt = require('bcryptjs');
const db = require('./db');
const config = require('./config');
const { tempPassword } = require('./services/util');

// Crée le compte "propriétaire de la plateforme" au premier démarrage s'il n'existe pas.
async function ensureSuperadmin() {
  const exists = db.prepare("SELECT 1 FROM users WHERE role = 'superadmin'").get();
  if (exists) return;
  const generated = !config.superadmin.password;
  const password = config.superadmin.password || tempPassword();
  const hash = await bcrypt.hash(password, 10);
  db.prepare(
    `INSERT INTO users (school_id, username, password_hash, role, first_name, last_name, must_change_password)
     VALUES (NULL, ?, ?, 'superadmin', 'Propriétaire', 'Plateforme', ?)`
  ).run(config.superadmin.username, hash, generated ? 1 : 0);
  console.log('\n==============================================================');
  console.log(' Compte propriétaire de la plateforme créé (gestion des collèges)');
  console.log(`   Adresse    : ${config.appUrl}/platform.html`);
  console.log(`   Identifiant: ${config.superadmin.username}`);
  console.log(`   Mot de passe: ${password}${generated ? '   (à changer à la première connexion)' : ''}`);
  console.log('==============================================================\n');
}

module.exports = { ensureSuperadmin };
