'use strict';
const db = require('../db');
const config = require('../config');
const { hashPassword, tempPassword, bad, str, normUsername, normEmail, checkPassword } = require('./util');
const CODE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function createSchool({ code, name, city, academic_year, admin }) {
  code=str(code,30).toLowerCase(); name=str(name,120);
  if(!CODE_RE.test(code)||code.length<3)throw bad('Code établissement invalide (3 à 30 caractères : minuscules, chiffres, tirets)');
  if(!name)throw bad("Le nom de l'établissement est obligatoire");
  const username=normUsername(admin&&admin.username), email=normEmail(admin&&admin.email); let generated=null; let password=admin&&admin.password;
  if(password)checkPassword(password); else {password=tempPassword();generated=password;}
  const hash=await hashPassword(password);
  if(config.databaseProvider==='postgres'){
    const schoolId=await db.transaction(async tx=>{
      const s=await tx.maybeOne('INSERT INTO schools(code,name,city,academic_year) VALUES($1,$2,$3,$4) RETURNING id',[code,name,str(city,80),str(academic_year,20)]);
      await tx.execute(`INSERT INTO terms(school_id,name,position,status) VALUES($1,$2,$3,$4),($1,$5,$6,$7),($1,$8,$9,$10)`,[s.id,'Trimestre 1',1,'open','Trimestre 2',2,'upcoming','Trimestre 3',3,'upcoming']);
      await tx.execute(`INSERT INTO users(school_id,username,email,password_hash,role,first_name,last_name,must_change_password) VALUES($1,$2,$3,$4,'admin',$5,$6,$7)`,[s.id,username,email,hash,str(admin&&admin.first_name,60)||'Administrateur',str(admin&&admin.last_name,60)||name,!!generated]);
      return Number(s.id);
    });
    return {school_id:schoolId,code,admin_username:username,temp_password:generated};
  }
  const schoolId=db.transaction(()=>{const s=db.prepare('INSERT INTO schools(code,name,city,academic_year) VALUES(?,?,?,?)').run(code,name,str(city,80),str(academic_year,20));const id=Number(s.lastInsertRowid);['Trimestre 1','Trimestre 2','Trimestre 3'].forEach((n,i)=>db.prepare('INSERT INTO terms(school_id,name,position,status) VALUES(?,?,?,?)').run(id,n,i+1,i===0?'open':'upcoming'));db.prepare(`INSERT INTO users(school_id,username,email,password_hash,role,first_name,last_name,must_change_password) VALUES(?,?,?,?, 'admin',?,?,?)`).run(id,username,email,hash,str(admin&&admin.first_name,60)||'Administrateur',str(admin&&admin.last_name,60)||name,generated?1:0);return id;})();
  return {school_id:schoolId,code,admin_username:username,temp_password:generated};
}
module.exports={createSchool,CODE_RE};
