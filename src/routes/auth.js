const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const config = require('../config');
const { ah, bad, str, checkPassword, hashPassword } = require('../services/util');
const { sendMail } = require('../services/mailer');
const mw = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
});
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Trop de demandes. Réessayez plus tard.' } });

const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

function findSchool(code) {
  return db.maybeOne('SELECT * FROM schools WHERE code = $1', [str(code, 40).toLowerCase()]);
}

router.post('/login', loginLimiter, ah(async (req, res) => {
  const { school_code, username, password } = req.body || {};
  const uname = str(username, 60).toLowerCase();
  if (!uname || typeof password !== 'string' || !password) throw bad('Identifiant et mot de passe requis');

  let user;
  let school = null;
  if (str(school_code)) {
    school = await findSchool(school_code);
    if (school) user = await db.maybeOne('SELECT * FROM users WHERE school_id = $1 AND username = $2', [school.id, uname]);
  } else {
    user = await db.maybeOne("SELECT * FROM users WHERE school_id IS NULL AND role = 'superadmin' AND username = $1", [uname]);
  }
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: 'Identifiants incorrects' });
  if (!user.active) return res.status(403).json({ error: 'Ce compte est désactivé. Contactez la direction.' });
  if (school && !school.active) return res.status(403).json({ error: "Cet établissement est désactivé" });

  mw.issueToken(res, user.id);
  res.json({ user: mw.publicUser(user, school) });
}));

router.post('/logout', (req, res) => { mw.clearToken(res); res.json({ ok: true }); });

router.get('/me', mw.authenticateAllowPasswordChange, (req, res) => {
  res.json({ user: mw.publicUser(req.user, req.school) });
});

router.post('/change-password', mw.authenticateAllowPasswordChange, ah(async (req, res) => {
  const { current_password, new_password } = req.body || {};
  checkPassword(new_password);
  const ok = await bcrypt.compare(String(current_password || ''), req.user.password_hash);
  if (!ok) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
  if (current_password === new_password) throw bad("Le nouveau mot de passe doit être différent de l'ancien");
  await db.execute('UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2', [await hashPassword(new_password), req.user.id]);
  res.json({ ok: true });
}));

// Demande de réinitialisation : la réponse est toujours identique (ne révèle pas si le compte existe).
router.post('/forgot', forgotLimiter, ah(async (req, res) => {
  const { school_code, identifier } = req.body || {};
  const ident = str(identifier, 120).toLowerCase();
  const school = await findSchool(school_code);
  if (school && school.active && ident) {
    const user = await db.maybeOne(
      'SELECT * FROM users WHERE school_id = $1 AND active = true AND (username = $2 OR email = $2)',
      [school.id, ident]
    );
    if (user && user.email) {
      const token = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      await db.withTransaction(async (tx) => {
        await tx.execute('DELETE FROM password_resets WHERE user_id = $1', [user.id]);
        await tx.execute(
          'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
          [user.id, hash, new Date(Date.now() + 60 * 60 * 1000)]
        );
      });
      const link = `${config.appUrl}/reset.html?token=${token}`;
      await sendMail({
        to: user.email,
        subject: `${school.name} — Réinitialisation du mot de passe`,
        text: `Bonjour ${user.first_name},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
      }).catch((e) => console.error('Envoi email impossible :', e.message));
    }
  }
  res.json({ ok: true });
}));

router.post('/reset', forgotLimiter, ah(async (req, res) => {
  const { token, password } = req.body || {};
  checkPassword(password);
  const hash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
  const pwd = await hashPassword(password);
  const changed = await db.withTransaction(async (tx) => {
    // Le verrou empêche deux requêtes concurrentes d'utiliser le même lien.
    const row = await tx.maybeOne(
      'SELECT * FROM password_resets WHERE token_hash = $1 AND used_at IS NULL FOR UPDATE',
      [hash]
    );
    if (!row || new Date(row.expires_at) < new Date()) return false;
    await tx.execute('UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2', [pwd, row.user_id]);
    await tx.execute('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE id = $1', [row.id]);
    return true;
  });
  if (!changed) throw bad('Lien invalide ou expiré');
  res.json({ ok: true });
}));

module.exports = router;
