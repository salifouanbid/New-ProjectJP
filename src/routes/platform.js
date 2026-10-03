'use strict';
const express = require('express');
const db = require('../db');
const config = require('../config');
const { ah, bad, notFound, str, tempPassword, hashPassword } = require('../services/util');
const { createSchool } = require('../services/schools');
const router = express.Router();
const pg = () => config.databaseProvider === 'postgres';

router.get('/schools', ah(async (req, res) => {
  if (pg()) {
    const rows = await db.many(`SELECT s.id,s.code,s.name,s.city,s.active,s.created_at,
      (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id AND u.role='student') AS students,
      (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id AND u.role='teacher') AS teachers,
      (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id AND u.role='parent') AS parents
      FROM schools s ORDER BY s.name LIMIT 500`);
    return res.json({ schools: rows });
  }
  const rows = db.prepare(`SELECT s.id,s.code,s.name,s.city,s.active,s.created_at,
    (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id AND u.role='student') AS students,
    (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id AND u.role='teacher') AS teachers,
    (SELECT COUNT(*) FROM users u WHERE u.school_id=s.id AND u.role='parent') AS parents
    FROM schools s ORDER BY s.name`).all();
  res.json({ schools: rows });
}));

router.post('/schools', ah(async (req, res) => {
  res.status(201).json(await createSchool({ code:req.body?.code,name:req.body?.name,city:req.body?.city,academic_year:req.body?.academic_year,admin:{ username:req.body?.admin_username,password:req.body?.admin_password,email:req.body?.admin_email,first_name:req.body?.admin_first_name,last_name:req.body?.admin_last_name } }));
}));

router.patch('/schools/:id', ah(async (req, res) => {
  const id = Number(req.params.id); if (!Number.isInteger(id)) throw bad('Établissement invalide');
  if (pg()) {
    const s = await db.maybeOne('SELECT * FROM schools WHERE id=$1',[id]); if (!s) throw notFound();
    const b=req.body||{}, name=b.name!==undefined?str(b.name,120):s.name; if(!name)throw bad('Nom obligatoire');
    await db.execute('UPDATE schools SET name=$1,city=$2,active=$3 WHERE id=$4',[name,b.city!==undefined?str(b.city,80):s.city,b.active!==undefined?!!b.active:s.active,id]); return res.json({ok:true});
  }
  const s=db.prepare('SELECT * FROM schools WHERE id=?').get(id); if(!s)throw notFound(); const b=req.body||{},name=b.name!==undefined?str(b.name,120):s.name;if(!name)throw bad('Nom obligatoire');db.prepare('UPDATE schools SET name=?,city=?,active=? WHERE id=?').run(name,b.city!==undefined?str(b.city,80):s.city,b.active!==undefined?(b.active?1:0):s.active,id);res.json({ok:true});
}));

router.post('/schools/:id/reset-admin', ah(async (req, res) => {
  const id=Number(req.params.id); if(!Number.isInteger(id))throw bad('Établissement invalide'); const pwd=tempPassword(), hash=await hashPassword(pwd);
  if(pg()){const admin=await db.maybeOne("SELECT * FROM users WHERE school_id=$1 AND role='admin' ORDER BY id LIMIT 1",[id]);if(!admin)throw notFound('Aucun administrateur');await db.execute('UPDATE users SET password_hash=$1,must_change_password=true,active=true WHERE id=$2',[hash,admin.id]);return res.json({username:admin.username,temp_password:pwd});}
  const admin=db.prepare("SELECT * FROM users WHERE school_id=? AND role='admin' ORDER BY id LIMIT 1").get(id);if(!admin)throw notFound('Aucun administrateur');db.prepare('UPDATE users SET password_hash=?,must_change_password=1,active=1 WHERE id=?').run(hash,admin.id);res.json({username:admin.username,temp_password:pwd});
}));
module.exports=router;
