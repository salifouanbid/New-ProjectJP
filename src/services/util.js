const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (msg) => new HttpError(400, msg);
const notFound = (msg = 'Introuvable') => new HttpError(404, msg);

const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const intOrNull = (v) => { const n = parseInt(v, 10); return Number.isInteger(n) ? n : null; };

function normUsername(v) {
  const u = str(v, 40).toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(u)) throw bad("Identifiant invalide (3 à 40 caractères : lettres, chiffres, . _ -)");
  return u;
}
function normEmail(v) {
  const e = str(v, 120).toLowerCase();
  if (!e) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw bad('Adresse email invalide');
  return e;
}
function checkPassword(p) {
  if (typeof p !== 'string' || p.length < 8) throw bad('Le mot de passe doit contenir au moins 8 caractères');
  if (p.length > 100) throw bad('Mot de passe trop long');
  return p;
}
function tempPassword() {
  // 10 caractères lisibles (sans 0/O/1/l/I)
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(10);
  for (let i = 0; i < 10; i++) out += chars[bytes[i] % chars.length];
  return out;
}
const hashPassword = (p) => bcrypt.hash(p, 10);
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const today = () => new Date().toISOString().slice(0, 10);

module.exports = { ah, HttpError, bad, notFound, str, intOrNull, normUsername, normEmail, checkPassword, tempPassword, hashPassword, isDate, today };
