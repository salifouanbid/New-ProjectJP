const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');

const COOKIE = 'token';
const MAX_AGE_MS = 8 * 60 * 60 * 1000;

function issueToken(res, userId) {
  const token = jwt.sign({ uid: userId }, config.jwtSecret, { expiresIn: Math.floor(MAX_AGE_MS / 1000) });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

function clearToken(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

// Charge l'utilisateur depuis la base à CHAQUE requête (compte désactivé = accès coupé immédiatement).
function load(req, res, allowPasswordChange) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) { res.status(401).json({ error: 'Non connecté', code: 'AUTH' }); return false; }
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (e) {
    res.status(401).json({ error: 'Session expirée', code: 'AUTH' });
    return false;
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
  if (!user || !user.active) { res.status(401).json({ error: 'Compte inactif', code: 'AUTH' }); return false; }
  let school = null;
  if (user.school_id) {
    school = db.prepare('SELECT * FROM schools WHERE id = ?').get(user.school_id);
    if (!school || !school.active) {
      res.status(403).json({ error: "Cet établissement est désactivé", code: 'SCHOOL_DISABLED' });
      return false;
    }
  }
  if (user.must_change_password && !allowPasswordChange) {
    res.status(403).json({ error: 'Vous devez changer votre mot de passe', code: 'MUST_CHANGE_PASSWORD' });
    return false;
  }
  req.user = user;
  req.school = school;
  return true;
}

const authenticate = (req, res, next) => { if (load(req, res, false)) next(); };
const authenticateAllowPasswordChange = (req, res, next) => { if (load(req, res, true)) next(); };

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Accès refusé' });
  next();
};

// Protection CSRF simple : les requêtes qui modifient des données doivent porter cet en-tête
// (un site tiers ne peut pas l'ajouter sans autorisation CORS, que nous n'accordons pas).
function csrfHeader(req, res, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.get('x-requested-with') !== 'portail') {
    return res.status(403).json({ error: 'Requête refusée' });
  }
  next();
}

function publicUser(user, school) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    must_change_password: !!user.must_change_password,
    school: school ? { id: school.id, code: school.code, name: school.name, city: school.city, academic_year: school.academic_year } : null,
  };
}

module.exports = { issueToken, clearToken, authenticate, authenticateAllowPasswordChange, requireRole, csrfHeader, publicUser };
