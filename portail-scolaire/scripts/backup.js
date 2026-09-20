// Sauvegarde complète : base de données (copie cohérente, même serveur en marche) + fichiers téléversés.
// Usage : npm run backup        (à lancer chaque jour avec cron / le Planificateur de tâches)
// Variables : BACKUP_DIR (défaut ./backups)   BACKUP_KEEP (nombre de sauvegardes gardées, défaut 14)
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const db = require('../src/db');

const root = path.resolve(config.root, process.env.BACKUP_DIR || './backups');
const keep = Math.max(1, parseInt(process.env.BACKUP_KEEP || '14', 10));

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}h${pad(now.getMinutes())}m${pad(now.getSeconds())}`;
const dest = path.join(root, stamp);
fs.mkdirSync(dest, { recursive: true });

// VACUUM INTO produit un fichier SQLite complet et cohérent, sans arrêter le serveur.
const dbFile = path.join(dest, 'portail.db');
db.exec(`VACUUM INTO '${dbFile.replace(/'/g, "''")}'`);

let files = 0;
if (fs.existsSync(config.uploadDir)) {
  fs.cpSync(config.uploadDir, path.join(dest, 'uploads'), { recursive: true });
  const count = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(d, e.name)) : e.name === '.gitkeep' ? 0 : 1), 0);
  files = count(path.join(dest, 'uploads'));
}

// Rotation : on ne garde que les N plus récentes
const all = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();
all.slice(0, Math.max(0, all.length - keep)).forEach((name) => fs.rmSync(path.join(root, name), { recursive: true, force: true }));

const kb = Math.round(fs.statSync(dbFile).size / 1024);
console.log(`Sauvegarde OK : ${dest}\n  base de données : ${kb} Ko · fichiers : ${files} · sauvegardes conservées : ${Math.min(all.length, keep)}/${keep}`);
db.close && db.close();
