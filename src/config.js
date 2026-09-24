const path = require('path');
require('dotenv').config({ quiet: true });

const root = path.join(__dirname, '..');
const isProd = process.env.NODE_ENV === 'production';
const databaseProvider = (process.env.DB_PROVIDER || 'sqlite').toLowerCase();
if (!['sqlite', 'postgres'].includes(databaseProvider)) {
  throw new Error('DB_PROVIDER doit valoir sqlite ou postgres');
}
if (databaseProvider === 'postgres' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL est obligatoire quand DB_PROVIDER=postgres');
}

const config = {
  root,
  isProd,
  port: parseInt(process.env.PORT || '3000', 10),
  // Nombre de proxys devant l'application (Nginx = 1). Cloudflare + Nginx = 2. 0 = aucun (accès direct).
  trustProxy: parseInt(process.env.TRUST_PROXY || (isProd ? '1' : '0'), 10),
  appUrl: (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, ''),
  jwtSecret: process.env.JWT_SECRET || '',
  databaseProvider,
  databaseUrl: process.env.DATABASE_URL || '',
  dbPath: path.resolve(root, process.env.DB_PATH || './data/portail.db'),
  dbDriver: process.env.DB_DRIVER || 'auto',
  uploadDir: path.resolve(root, process.env.UPLOAD_DIR || './uploads'),
  cookieSecure:
    process.env.COOKIE_SECURE !== undefined ? process.env.COOKIE_SECURE === 'true' : isProd,
  superadmin: {
    username: (process.env.SUPERADMIN_USERNAME || 'superadmin').toLowerCase(),
    password: process.env.SUPERADMIN_PASSWORD || '',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Portail Scolaire <no-reply@localhost>',
  },
};

if (!config.jwtSecret) {
  if (isProd) {
    console.error('\n[ERREUR] JWT_SECRET est obligatoire en production (voir .env.example).\n');
    process.exit(1);
  }
  config.jwtSecret = 'dev-only-secret-change-me';
  console.warn('[avertissement] JWT_SECRET absent : secret de développement utilisé (OK en local uniquement).');
}

module.exports = config;
