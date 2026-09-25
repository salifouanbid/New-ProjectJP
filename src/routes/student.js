const express = require('express');
const db = require('../db');
const studentViews = require('./studentViews');

const router = express.Router();

router.use(studentViews((req) => {
  const st = db.prepare('SELECT id FROM students WHERE user_id = ? AND school_id = ?').get(req.user.id, req.user.school_id);
  return st ? st.id : null;
}));

module.exports = router;
