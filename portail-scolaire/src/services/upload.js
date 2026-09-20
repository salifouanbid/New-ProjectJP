const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config');
const { HttpError } = require('./util');

const MAGIC = {
  '.pdf': (b) => b.slice(0, 4).toString() === '%PDF',
  '.png': (b) => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  '.jpg': (b) => b[0] === 0xff && b[1] === 0xd8,
  '.jpeg': (b) => b[0] === 0xff && b[1] === 0xd8,
  '.webp': (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP',
};

function schoolDir(schoolId) {
  const dir = path.join(config.uploadDir, String(schoolId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// allowed: ['.pdf'] ou ['.pdf', '.png', '.jpg', '.jpeg']
function makeUploader(allowed, maxMb, maxFiles = 1) {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, schoolDir(req.user.school_id)),
      filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(file.originalname).toLowerCase()),
    }),
    limits: { fileSize: maxMb * 1024 * 1024, files: maxFiles },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowed.includes(ext)) return cb(new HttpError(400, `Format non autorisé (${allowed.join(', ')})`));
      cb(null, true);
    },
  });
}

// Vérifie le contenu réel du fichier (pas seulement l'extension) ; supprime le fichier s'il est invalide.
function verifyFile(file) {
  const ext = path.extname(file.filename).toLowerCase();
  const fd = fs.openSync(file.path, 'r');
  const buf = Buffer.alloc(12);
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);
  if (!MAGIC[ext] || !MAGIC[ext](buf)) {
    fs.unlink(file.path, () => {});
    throw new HttpError(400, "Le contenu du fichier ne correspond pas à son format");
  }
}

function removeFile(schoolId, fileName) {
  if (!fileName) return;
  fs.unlink(path.join(config.uploadDir, String(schoolId), path.basename(fileName)), () => {});
}

function filePath(schoolId, fileName) {
  return path.join(config.uploadDir, String(schoolId), path.basename(fileName));
}

module.exports = { makeUploader, verifyFile, removeFile, filePath };
