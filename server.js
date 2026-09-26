const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./src/config');
const db = require('./src/db');
const { getPostgresDatabase } = require('./src/persistence/runtime');
const mw = require('./src/middleware/auth');
const { ensureSuperadmin } = require('./src/bootstrap');

const app = express();
app.disable('x-powered-by');
if (config.trustProxy) app.set('trust proxy', config.trustProxy); // derrière Nginx / hébergeur (HTTPS)

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })
);
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

/* ---------- Supervision (pour un service de surveillance type UptimeRobot) ---------- */
app.get('/healthz', async (req, res) => {
  try {
    if (config.databaseUrl) {
      await getPostgresDatabase().healthcheck();
      return res.json({ ok: true, database: 'postgres' });
    }
    db.prepare('SELECT 1').get();
    return res.json({ ok: true, database: db.driver });
  } catch (e) {
    console.error('Healthcheck échoué :', e.message);
    return res.status(500).json({ ok: false });
  }
});

/* ---------- API ---------- */
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false, message: { error: 'Trop de requêtes' } }));
app.use('/api', mw.csrfHeader);

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/public', require('./src/routes/public'));
app.use('/api/platform', mw.authenticate, mw.requireRole('superadmin'), require('./src/routes/platform'));
app.use('/api/admin', mw.authenticate, mw.requireRole('admin'), require('./src/routes/admin'));
app.use('/api/teacher', mw.authenticate, mw.requireRole('teacher'), require('./src/routes/teacher'));
app.use('/api/student', mw.authenticate, mw.requireRole('student'), require('./src/routes/student'));
app.use('/api/parent', mw.authenticate, mw.requireRole('parent'), require('./src/routes/parent'));
app.use('/api/files', mw.authenticate, require('./src/routes/files'));
app.use('/api/news', mw.authenticate, require('./src/routes/news'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Route introuvable' }));

/* ---------- Pages ---------- */
const publicDir = path.join(__dirname, 'public');
app.get('/e/:code', (req, res) => res.sendFile(path.join(publicDir, 'school.html'))); // site vitrine public de l'établissement
app.get('/e/:code/connexion', (req, res) => res.sendFile(path.join(publicDir, 'login.html'))); // connexion
app.use(express.static(publicDir, { extensions: ['html'] }));

/* ---------- Erreurs ---------- */
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  let status = err.status || 500;
  let message = err.message;
  const msg = String(err.message || '');
  if (err.type === 'entity.too.large') { status = 413; message = 'Requête trop volumineuse'; }
  else if (err instanceof SyntaxError && err.status === 400) message = 'Données invalides';
  else if (err.name === 'MulterError') { status = 400; message = err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux' : ['LIMIT_UNEXPECTED_FILE', 'LIMIT_FILE_COUNT'].includes(err.code) ? "Trop d'images (6 maximum par publication)" : 'Erreur de téléversement'; }
  else if (/UNIQUE constraint failed/.test(msg)) {
    status = 409;
    message = /users|ux_users/.test(msg) ? 'Cet identifiant est déjà utilisé' : 'Cet élément existe déjà';
  } else if (/FOREIGN KEY constraint failed/.test(msg)) {
    status = 409;
    message = "Suppression impossible : cet élément est encore utilisé (élèves, notes, absences…). Désactivez-le plutôt.";
  } else if (/CHECK constraint failed/.test(msg)) { status = 400; message = 'Valeur invalide'; }
  else if (status >= 500) { console.error(err); message = 'Erreur interne du serveur'; }
  res.status(status).json({ error: message });
});

if (require.main === module) {
  ensureSuperadmin().then(() => {
    app.listen(config.port, () => {
      console.log(`\nPortail Scolaire démarré  →  http://localhost:${config.port}`);
      console.log(`(base de données : ${db.driver})\n`);
    });
  });
}

module.exports = app;
