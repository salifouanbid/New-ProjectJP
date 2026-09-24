// Test de bout en bout : lance un serveur temporaire (base jetable) et vérifie les scénarios clés,
// y compris l'ISOLATION entre établissements. Usage : npm test
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'portail-test-'));
const env = { ...process.env, PORT: String(PORT), DB_PROVIDER: 'sqlite', DB_DRIVER: 'node', DB_PATH: path.join(tmp, 't.db'), UPLOAD_DIR: path.join(tmp, 'up'), NODE_ENV: 'development', APP_URL: BASE, SMTP_HOST: '' };
const PWD = 'Demo1234!';
const countUploads = () => { const up = path.join(tmp, 'up'); if (!fs.existsSync(up)) return 0; return fs.readdirSync(up).reduce((n, d) => n + fs.readdirSync(path.join(up, d)).length, 0); };

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.log(`  FAIL ${name}${extra !== undefined ? '  -> ' + JSON.stringify(extra) : ''}`); }
}

class Client {
  constructor() { this.cookie = ''; }
  async req(method, url, body, opts = {}) {
    const headers = { 'X-Requested-With': 'portail' };
    if (this.cookie) headers.Cookie = this.cookie;
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    if (opts.noCsrf) delete headers['X-Requested-With'];
    const res = await fetch(BASE + url, { method, headers, body: payload });
    const sc = res.headers.get('set-cookie');
    if (sc && sc.startsWith('token=')) this.cookie = sc.split(';')[0];
    const ct = res.headers.get('content-type') || '';
    let data;
    if (ct.includes('json')) data = await res.json();
    else data = Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, ct };
  }
  get(u) { return this.req('GET', u); }
  post(u, b) { return this.req('POST', u, b === undefined ? {} : b); }
  put(u, b) { return this.req('PUT', u, b); }
  del(u) { return this.req('DELETE', u); }
  async login(school, username, password = PWD) {
    return this.req('POST', '/api/auth/login', { school_code: school, username, password });
  }
}

async function main() {
  console.log('Préparation : base temporaire + données de démonstration');
  const seed = spawnSync('node', ['src/seed.js'], { env, encoding: 'utf8' });
  if (seed.status !== 0) { console.error(seed.stdout, seed.stderr); process.exit(1); }

  let serverLog = '';
  const server = spawn('node', ['server.js'], { env });
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/api/public/school/jean-piaget-1'); break; } catch (e) { await new Promise((r) => setTimeout(r, 200)); }
  }

  try {
    console.log('\n[Connexion & sécurité]');
    const anon = new Client();
    check('API protégée sans connexion', (await anon.get('/api/admin/dashboard')).status === 401);
    check('CSRF : POST sans en-tête refusé', (await anon.req('POST', '/api/auth/login', { school_code: 'jean-piaget-1', username: 'admin', password: PWD }, { noCsrf: true })).status === 403);
    check('Mauvais mot de passe -> 401', (await anon.login('jean-piaget-1', 'admin', 'faux-mot-de-passe')).status === 401);
    check('Mauvais code établissement -> 401', (await anon.login('inconnu', 'admin')).status === 401);
    check('Page de connexion par code : établissement connu', (await anon.get('/api/public/school/jean-piaget-1')).data.name === 'Collège Jean Piaget 1');
    check('Page de connexion par code : établissement inconnu -> 404', (await anon.get('/api/public/school/nope')).status === 404);
    check('Page vitrine /e/<code> servie', (await fetch(BASE + '/e/jean-piaget-1')).status === 200);
    check('Page de connexion /e/<code>/connexion servie', (await fetch(BASE + '/e/jean-piaget-1/connexion')).status === 200);

    console.log('\n[Plateforme : création d\'un nouvel établissement]');
    const sup = new Client();
    check('Super-admin se connecte (sans code)', (await sup.login('', 'superadmin')).status === 200);
    const created = await sup.post('/api/platform/schools', { code: 'ecole-test', name: 'École Test', city: 'Porto-Novo', admin_username: 'dir.test', admin_email: 'dir@test.bj' });
    check('Création établissement', created.status === 201 && created.data.temp_password, created.data);
    check('Code déjà pris -> 409', (await sup.post('/api/platform/schools', { code: 'ecole-test', name: 'Autre', admin_username: 'x.admin' })).status === 409);
    check('Code invalide refusé', (await sup.post('/api/platform/schools', { code: 'Ecole Test!', name: 'Bad', admin_username: 'x.admin' })).status === 400);
    const a3 = new Client();
    check('Admin du nouvel établissement peut se connecter', (await a3.login('ecole-test', 'dir.test', created.data.temp_password)).status === 200);
    check('Changement de mot de passe obligatoire', (await a3.get('/api/admin/dashboard')).data.code === 'MUST_CHANGE_PASSWORD');
    check('Changement de mot de passe OK', (await a3.post('/api/auth/change-password', { current_password: created.data.temp_password, new_password: 'NouveauMdp2026' })).status === 200);
    check('Ensuite accès normal', (await a3.get('/api/admin/dashboard')).status === 200);
    check('Un admin ne peut pas utiliser la plateforme', (await a3.get('/api/platform/schools')).status === 403);

    console.log('\n[Administrateur — établissement A = jean-piaget-1]');
    const admin = new Client();
    await admin.login('jean-piaget-1', 'admin');
    const dash = await admin.get('/api/admin/dashboard');
    check('Tableau de bord : 12 élèves', dash.data.students === 12, dash.data);
    const classesA = (await admin.get('/api/admin/classes')).data.items;
    const adminB = new Client();
    await adminB.login('lycee-demo', 'admin');
    const classesB = (await adminB.get('/api/admin/classes')).data.items;
    check('Chaque établissement voit ses propres classes', classesA.length === 2 && classesB.length === 2 && classesA[0].id !== classesB[0].id);
    const newStu = await admin.post('/api/admin/users', { role: 'student', username: 'nouvel.eleve', first_name: 'Nouvel', last_name: 'Élève', class_id: classesA[0].id, matricule: 'X1' });
    check('Création élève (mot de passe provisoire généré)', newStu.status === 201 && newStu.data.temp_password, newStu.data);
    check('Identifiant en double -> 409', (await admin.post('/api/admin/users', { role: 'student', username: 'nouvel.eleve', first_name: 'A', last_name: 'B', class_id: classesA[0].id })).status === 409);
    check('ISOLATION : élève dans une classe d\'un autre établissement refusé', (await admin.post('/api/admin/users', { role: 'student', username: 'intrus', first_name: 'A', last_name: 'B', class_id: classesB[0].id })).status === 400);
    const studentsB = (await adminB.get('/api/admin/users?role=student')).data.items;
    check('ISOLATION : modifier un utilisateur d\'un autre établissement -> 404', (await admin.put(`/api/admin/users/${studentsB[0].id}`, { first_name: 'Hack', last_name: 'Hack', class_id: classesA[0].id })).status === 404);
    check('ISOLATION : supprimer un utilisateur d\'un autre établissement -> 404', (await admin.del(`/api/admin/users/${studentsB[0].id}`)).status === 404);
    check('ISOLATION : désactiver un utilisateur d\'un autre établissement -> 404', (await admin.post(`/api/admin/users/${studentsB[0].id}/toggle`)).status === 404);
    check('ISOLATION : classe d\'un autre établissement modifiable -> refusé', (await admin.put(`/api/admin/classes/${classesB[0].id}`, { name: 'Hack', level_id: classesA[0].level_id })).status === 400);
    check('Suppression classe avec élèves -> 409', (await admin.del(`/api/admin/classes/${classesA[0].id}`)).status === 409);
    check('Liste des élèves de A ne contient pas ceux de B', (await admin.get('/api/admin/users?role=student')).data.items.every((s) => !studentsB.some((b) => b.id === s.id)));

    console.log('\n[Professeur]');
    const prof = new Client();
    await prof.login('jean-piaget-1', 'prof.maths');
    const ctx = (await prof.get('/api/teacher/context')).data;
    check('Le professeur ne voit que ses attributions (2 classes)', ctx.assignments.length === 2, ctx.assignments);
    const term1 = ctx.terms.find((t) => t.status === 'open');
    const a0 = ctx.assignments[0];
    const g = (await prof.get(`/api/teacher/grades?class_id=${a0.class_id}&subject_id=${a0.subject_id}&term_id=${term1.id}`)).data;
    check('Grille de notes chargée (6 élèves)', g.students.length === 6 && !g.locked);
    const s0 = g.students[0].id;
    const save = await prof.put('/api/teacher/grades', { class_id: a0.class_id, subject_id: a0.subject_id, term_id: term1.id, entries: [{ student_id: s0, type: 'interro', idx: 1, value: 17.5 }, { student_id: s0, type: 'devoir', idx: 2, value: 15 }] });
    check('Saisie de notes', save.status === 200, save.data);
    check('Note > 20 refusée', (await prof.put('/api/teacher/grades', { class_id: a0.class_id, subject_id: a0.subject_id, term_id: term1.id, entries: [{ student_id: s0, type: 'interro', idx: 2, value: 25 }] })).status === 400);
    const atomic = await prof.put('/api/teacher/grades', { class_id: a0.class_id, subject_id: a0.subject_id, term_id: term1.id, entries: [{ student_id: s0, type: 'interro', idx: 3, value: 11 }, { student_id: s0, type: 'interro', idx: 4, value: 99 }] });
    const g2 = (await prof.get(`/api/teacher/grades?class_id=${a0.class_id}&subject_id=${a0.subject_id}&term_id=${term1.id}`)).data;
    check('Sauvegarde transactionnelle : rien d\'enregistré si une note est invalide', atomic.status === 400 && g2.students[0].interro[2] !== 11, { status: atomic.status, err: atomic.data, v: g2.students[0].interro, same: g2.students[0].id === s0 });
    check('Interrogation n°7 refusée', (await prof.put('/api/teacher/grades', { class_id: a0.class_id, subject_id: a0.subject_id, term_id: term1.id, entries: [{ student_id: s0, type: 'interro', idx: 7, value: 10 }] })).status === 400);
    check('Devoir n°3 refusé (2 devoirs max)', (await prof.put('/api/teacher/grades', { class_id: a0.class_id, subject_id: a0.subject_id, term_id: term1.id, entries: [{ student_id: s0, type: 'devoir', idx: 3, value: 10 }] })).status === 400);
    const frSubject = (await admin.get('/api/admin/subjects')).data.items.find((s) => s.name === 'Français');
    check('Matière non attribuée -> 403', (await prof.get(`/api/teacher/grades?class_id=${a0.class_id}&subject_id=${frSubject.id}&term_id=${term1.id}`)).status === 403);
    const studentB = studentsB[0];
    check('ISOLATION : élève d\'un autre établissement dans une saisie -> 400', (await prof.put('/api/teacher/grades', { class_id: a0.class_id, subject_id: a0.subject_id, term_id: term1.id, entries: [{ student_id: studentB.student_id, type: 'interro', idx: 1, value: 10 }] })).status === 400);

    const today = new Date().toISOString().slice(0, 10);
    const att = await prof.put('/api/teacher/attendance', { class_id: a0.class_id, subject_id: a0.subject_id, date: today, entries: g.students.map((s, i) => ({ student_id: s.id, status: i === 0 ? 'absent' : 'present' })) });
    check('Appel enregistré', att.status === 200, att.data);
    check('Date future refusée', (await prof.put('/api/teacher/attendance', { class_id: a0.class_id, subject_id: a0.subject_id, date: '2099-01-01', entries: [] })).status === 400);
    check('Appel relu', (await prof.get(`/api/teacher/attendance?class_id=${a0.class_id}&subject_id=${a0.subject_id}&date=${today}`)).data.students.find((s) => s.id === s0).status === 'absent');

    const ch = await prof.post('/api/teacher/chapters', { class_id: a0.class_id, subject_id: a0.subject_id, title: 'Les angles' });
    check('Chapitre créé', ch.status === 201);
    check('Avancement du chapitre', (await prof.put(`/api/teacher/chapters/${ch.data.id}`, { status: 'done' })).status === 200);
    check('Séance du cahier de texte', (await prof.post('/api/teacher/lessons', { class_id: a0.class_id, subject_id: a0.subject_id, date: today, content: 'Introduction aux angles', homework: 'Exercice 1' })).status === 201);
    check('Signalement disciplinaire', (await prof.post('/api/teacher/discipline', { student_id: s0, kind: 'negative', description: 'Retard répété' })).status === 201);

    const pdfForm = new FormData();
    pdfForm.append('class_id', a0.class_id); pdfForm.append('subject_id', a0.subject_id); pdfForm.append('title', 'Épreuve 2025');
    pdfForm.append('file', new Blob(['%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'], { type: 'application/pdf' }), 'epreuve.pdf');
    const up = await prof.req('POST', '/api/teacher/archives', pdfForm);
    check('Dépôt d\'une archive PDF', up.status === 201, up.data);
    const fake = new FormData();
    fake.append('class_id', a0.class_id); fake.append('subject_id', a0.subject_id);
    fake.append('file', new Blob(['ceci n\'est pas un pdf'], { type: 'application/pdf' }), 'faux.pdf');
    check('Faux PDF (contenu invalide) refusé', (await prof.req('POST', '/api/teacher/archives', fake)).status === 400);
    const exe = new FormData();
    exe.append('class_id', a0.class_id); exe.append('subject_id', a0.subject_id);
    exe.append('file', new Blob(['MZ'], { type: 'application/octet-stream' }), 'virus.exe');
    check('Fichier .exe refusé', (await prof.req('POST', '/api/teacher/archives', exe)).status === 400);

    console.log('\n[Élève]');
    const stuRows = (await admin.get('/api/admin/users?role=student')).data.items;
    const eleve1 = stuRows.find((s) => s.id && s.student_id === s0);
    const stu = new Client();
    check('Connexion élève', (await stu.login('jean-piaget-1', eleve1.username)).status === 200);
    const sd = (await stu.get('/api/student/dashboard')).data;
    check('Tableau de bord élève', sd.report && sd.report.subjects.length === 6 && sd.report.rank >= 1, sd.report && sd.report.general);
    check('Un élève ne peut pas accéder à l\'espace professeur', (await stu.get('/api/teacher/context')).status === 403);
    check('Un élève ne peut pas accéder à l\'admin', (await stu.get('/api/admin/dashboard')).status === 403);
    const pdf = await stu.get('/api/student/bulletin.pdf');
    check('Bulletin PDF généré', pdf.status === 200 && pdf.ct.includes('pdf') && pdf.data.slice(0, 4).toString() === '%PDF', pdf.status);
    const arch = (await stu.get('/api/student/archives')).data;
    check('Bibliothèque d\'archives', arch.items.length >= 1);
    const dl = await stu.get(`/api/files/archives/${arch.items[0].id}`);
    check('Téléchargement archive par un élève de la classe', dl.status === 200);
    const otherStu = stuRows.find((s) => s.class_id !== eleve1.class_id);
    const stu2 = new Client();
    await stu2.login('jean-piaget-1', otherStu.username);
    check('Élève d\'une AUTRE classe ne peut pas télécharger l\'archive', (await stu2.get(`/api/files/archives/${arch.items[0].id}`)).status === 403);
    const profB = new Client();
    await profB.login('lycee-demo', 'prof.maths');
    check('ISOLATION : prof d\'un autre établissement ne peut pas télécharger', (await profB.get(`/api/files/archives/${arch.items[0].id}`)).status === 404);

    console.log('\n[Parent]');
    const parents = (await admin.get('/api/admin/users?role=parent')).data.items;
    const par = new Client();
    await par.login('jean-piaget-1', parents[0].username);
    const kids = (await par.get('/api/parent/children')).data.items;
    check('Le parent voit ses 2 enfants', kids.length === 2, kids);
    const foreignKid = stuRows.find((s) => !kids.some((k) => k.id === s.student_id));
    check('Le parent ne peut pas voir l\'enfant d\'un autre parent', (await par.get(`/api/parent/children/${foreignKid.student_id}/dashboard`)).status === 404);
    check('ISOLATION : enfant d\'un autre établissement -> 404', (await par.get(`/api/parent/children/${studentB.student_id}/dashboard`)).status === 404);
    let allowed = 0; let denied = 0;
    for (const k of kids) {
      const d = (await par.get(`/api/parent/children/${k.id}/dashboard`)).data;
      const r = await par.get(`/api/parent/children/${k.id}/bulletin.pdf`);
      if (d.report.general >= 10) { if (r.status === 200) allowed++; } else if (r.status === 403) denied++;
    }
    check('Bulletin parent : autorisé seulement si moyenne >= 10', allowed + denied === kids.length, { allowed, denied });
    const kid = kids[0];
    const abs = (await par.get(`/api/parent/children/${kid.id}/attendance`)).data.items;
    let justifOk = true;
    if (abs.length) {
      const target = abs.find((a) => !a.justification_id && !a.justified);
      if (target) {
        const f = new FormData();
        f.append('attendance_id', target.id); f.append('reason', 'Paludisme');
        f.append('file', new Blob(['%PDF-1.4 certificat'], { type: 'application/pdf' }), 'certificat.pdf');
        const jr = await par.req('POST', `/api/parent/children/${kid.id}/justifications`, f);
        justifOk = jr.status === 201;
        check('Envoi d\'un justificatif d\'absence', justifOk, jr.data);
        const list = (await admin.get('/api/admin/justifications?status=pending')).data.items;
        check('L\'admin voit le justificatif en attente', list.length >= 1);
        const mine = list.find((j) => j.reason === 'Paludisme');
        const rev = await admin.post(`/api/admin/justifications/${mine.id}/review`, { decision: 'approved' });
        check('Validation du justificatif', rev.status === 200);
        const abs2 = (await par.get(`/api/parent/children/${kid.id}/attendance`)).data.items.find((a) => a.id === target.id);
        check('L\'absence devient « justifiée »', abs2.justified === 1);
        check('Le fichier justificatif est téléchargeable par l\'admin', (await admin.get(`/api/files/justifications/${mine.id}`)).status === 200);
        check('Justificatif refusé à un parent tiers', (await (async () => { const p2 = new Client(); await p2.login('jean-piaget-1', parents[3].username); return p2.get(`/api/files/justifications/${mine.id}`); })()).status === 403);
      }
    }
    check('Programme (chapitres/séances) visible par le parent', (await par.get(`/api/parent/children/${kid.id}/programme`)).status === 200);

    console.log('\n[Actualités & site vitrine]');
    const pubBefore = (await anon.get('/api/public/school/jean-piaget-1/news')).data;
    check('Vitrine publique : publications publiques visibles sans connexion', pubBefore.news.length === 3 && pubBefore.news.every((n) => n.audience === 'public'), pubBefore.news.length);
    check('Vitrine : prochains événements listés', pubBefore.events.length === 2);
    check('Vitrine : infos de contact publiées', (await anon.get('/api/public/school/jean-piaget-1')).data.address.includes('Abomey-Calavi'));
    check('Actualités réservées aux membres : refusées sans connexion', (await anon.get('/api/news')).status === 401);
    const memberFeed = (await par.get('/api/news')).data;
    check('Parent connecté voit publiques + réservées aux membres', memberFeed.news.length === 4);
    check('Élève connecté voit aussi les actualités', (await stu2.get('/api/news')).data.news.length === 4);
    check('Professeur connecté voit aussi les actualités', (await prof.get('/api/news')).data.news.length === 4);
    check('Propriétaire plateforme : pas de flux d\'établissement', (await sup.get('/api/news')).status === 403);
    check('Un parent ne peut pas publier', (await par.post('/api/admin/announcements', { title: 'X', body: 'Y', category: 'news', audience: 'public' })).status === 403);
    const ann = await admin.post('/api/admin/announcements', { title: 'Sortie pédagogique', body: 'Départ à 8h.\nRetour à 16h.', category: 'event', audience: 'members', event_date: '2099-05-01', pinned: true });
    check('L\'admin publie une actualité', ann.status === 201, ann.data);
    check('Publication « membres » invisible sur la vitrine publique', !(await anon.get('/api/public/school/jean-piaget-1/news')).data.news.some((n) => n.title === 'Sortie pédagogique'));
    check('Publication « membres » visible par les parents', (await par.get('/api/news')).data.news.some((n) => n.title === 'Sortie pédagogique'));
    check('Publication épinglée en tête', (await par.get('/api/news')).data.news[0].title === 'Sortie pédagogique');
    check('Titre vide refusé', (await admin.post('/api/admin/announcements', { title: '', body: 'x', category: 'news', audience: 'public' })).status === 400);
    check('Catégorie invalide refusée', (await admin.post('/api/admin/announcements', { title: 'a', body: 'x', category: 'hack', audience: 'public' })).status === 400);
    check('Date invalide refusée', (await admin.post('/api/admin/announcements', { title: 'a', body: 'x', category: 'event', audience: 'public', event_date: 'demain' })).status === 400);
    check('L\'admin modifie une publication (passage en public)', (await admin.put(`/api/admin/announcements/${ann.data.id}`, { title: 'Sortie pédagogique', body: 'Départ à 8h.', category: 'event', audience: 'public', event_date: '2099-05-01', pinned: false })).status === 200);
    check('Modification visible sur la vitrine', (await anon.get('/api/public/school/jean-piaget-1/news')).data.news.some((n) => n.title === 'Sortie pédagogique'));
    check('ISOLATION : l\'admin d\'un autre établissement ne peut pas modifier la publication', (await adminB.put(`/api/admin/announcements/${ann.data.id}`, { title: 'Hack', body: 'x', category: 'news', audience: 'public' })).status === 400);
    check('ISOLATION : ni la supprimer', (await adminB.del(`/api/admin/announcements/${ann.data.id}`)).status === 400);
    check('ISOLATION : la vitrine d\'un établissement ne montre pas les publications d\'un autre', (await anon.get('/api/public/school/lycee-demo/news')).data.news.every((n) => n.title !== 'Sortie pédagogique'));
    const xss = await admin.post('/api/admin/announcements', { title: '<script>alert(1)</script>', body: '<img src=x onerror=alert(1)>', category: 'news', audience: 'public' });
    check('Contenu HTML accepté comme texte (échappé à l\'affichage)', xss.status === 201);
    check('L\'admin supprime une publication', (await admin.del(`/api/admin/announcements/${xss.data.id}`)).status === 200 && (await admin.del(`/api/admin/announcements/${ann.data.id}`)).status === 200);
    const setts = await admin.put('/api/admin/settings', { name: 'Collège Jean Piaget 1', city: 'Abomey-Calavi', academic_year: '2026-2027', parent_bulletin_min_avg: 10, description: 'Présentation mise à jour', address: 'Rue 12', phone: '+229 01 11 11 11 11', contact_email: 'direction@piaget.bj', hours: '8h-17h' });
    check('Page publique : paramètres modifiables', setts.status === 200 && (await anon.get('/api/public/school/jean-piaget-1')).data.description === 'Présentation mise à jour');
    check('Email de contact invalide refusé', (await admin.put('/api/admin/settings', { name: 'X', parent_bulletin_min_avg: 10, contact_email: 'pas-un-email' })).status === 400);

    console.log('\n[Galerie d\'images des publications]');
    const JPEG = (tag) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]), Buffer.from('JFIF'), Buffer.from(String(tag)), Buffer.alloc(40, 1)]);
    const annForm = (title, audience, files = []) => {
      const f = new FormData();
      f.append('title', title); f.append('body', 'Texte'); f.append('category', 'news'); f.append('audience', audience); f.append('pinned', '0');
      files.forEach((buf, i) => f.append('images', new Blob([buf]), `p${i}.jpg`));
      return f;
    };
    const feedOf = async (c, url, title) => (await c.get(url)).data.news.find((n) => n.title === title);
    const gPub = await admin.req('POST', '/api/admin/announcements', annForm('Galerie publique', 'public', [JPEG('a'), JPEG('b'), JPEG('c')]));
    check('Publication avec 3 images', gPub.status === 201, gPub.data);
    const gMem = await admin.req('POST', '/api/admin/announcements', annForm('Galerie membres', 'members', [JPEG('d'), JPEG('e')]));
    check('Publication « membres » avec 2 images', gMem.status === 201);
    const pubItem = await feedOf(anon, '/api/public/school/jean-piaget-1/news', 'Galerie publique');
    check('Le flux public liste les 3 images de la galerie', pubItem && pubItem.images.length === 3, pubItem);
    let allOk = true;
    for (const id of pubItem.images) { const r = await anon.get(`/api/public/school/jean-piaget-1/news/${gPub.data.id}/image/${id}`); if (r.status !== 200 || !r.ct.includes('image/jpeg')) allOk = false; }
    check('Les 3 images publiques sont visibles SANS connexion', allOk);
    const memItem = await feedOf(par, '/api/news', 'Galerie membres');
    check('Un parent connecté voit la galerie « membres » (2 images)', memItem && memItem.images.length === 2);
    check('Galerie « membres » : images invisibles sur le site public', (await anon.get(`/api/public/school/jean-piaget-1/news/${gMem.data.id}/image/${memItem.images[0]}`)).status === 404);
    check('Galerie « membres » : refusée sans connexion', (await anon.get(`/api/news/${gMem.data.id}/image/${memItem.images[0]}`)).status === 401);
    check('Galerie « membres » : téléchargeable par un parent connecté', (await par.get(`/api/news/${gMem.data.id}/image/${memItem.images[0]}`)).status === 200);
    check('Une image ne s\'ouvre pas via une autre publication', (await par.get(`/api/news/${gPub.data.id}/image/${memItem.images[0]}`)).status === 404);
    check('ISOLATION : parent d\'un autre établissement -> 404', await (async () => { const pb = new Client(); await pb.login('lycee-demo', 'parent1'); return (await pb.get(`/api/news/${gMem.data.id}/image/${memItem.images[0]}`)).status === 404; })());
    check('ISOLATION : autre code de vitrine -> 404', (await anon.get(`/api/public/school/lycee-demo/news/${gPub.data.id}/image/${pubItem.images[0]}`)).status === 404);

    const f0 = countUploads();
    check('Faux JPEG refusé', (await admin.req('POST', '/api/admin/announcements', annForm('Faux', 'public', [Buffer.from('pas une image')]))).status === 400);
    check('Une image invalide parmi des valides : tout est refusé', (await admin.req('POST', '/api/admin/announcements', annForm('Mixte', 'public', [JPEG('x'), JPEG('y'), Buffer.from('faux')]))).status === 400);
    const svg = new FormData(); svg.append('title', 'Svg'); svg.append('body', 'x'); svg.append('category', 'news'); svg.append('audience', 'public');
    svg.append('images', new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>']), 'x.svg');
    check('SVG refusé (risque de script)', (await admin.req('POST', '/api/admin/announcements', svg)).status === 400);
    check('Image trop lourde (> 5 Mo) refusée', (await admin.req('POST', '/api/admin/announcements', annForm('Gros', 'public', [Buffer.concat([JPEG('g'), Buffer.alloc(6 * 1024 * 1024)])]))).status === 400);
    const seven = await admin.req('POST', '/api/admin/announcements', annForm('Sept', 'public', [1, 2, 3, 4, 5, 6, 7].map(JPEG)));
    check('7 images refusées (6 maximum)', seven.status === 400, seven.data);
    check('Aucun fichier orphelin après ces refus', countUploads() === f0, { avant: f0, apres: countUploads() });
    check('Aucune publication fantôme', !(await admin.get('/api/admin/announcements')).data.items.some((n) => ['Faux', 'Mixte', 'Svg', 'Gros', 'Sept'].includes(n.title)));
    const six = await admin.req('POST', '/api/admin/announcements', annForm('Six', 'public', [1, 2, 3, 4, 5, 6].map(JPEG)));
    check('6 images acceptées', six.status === 201);

    const f1 = countUploads();
    const add = annForm('Galerie publique', 'public', [JPEG('f'), JPEG('g')]);
    check('Ajout de 2 images à une galerie existante (3 -> 5)', (await admin.req('PUT', `/api/admin/announcements/${gPub.data.id}`, add)).status === 200 && countUploads() === f1 + 2);
    const over = annForm('Galerie publique', 'public', [JPEG('h'), JPEG('i')]);
    check('Dépassement à la modification (5 + 2 > 6) refusé', (await admin.req('PUT', `/api/admin/announcements/${gPub.data.id}`, over)).status === 400 && countUploads() === f1 + 2);
    const item5 = await feedOf(anon, '/api/public/school/jean-piaget-1/news', 'Galerie publique');
    check('La galerie compte bien 5 images', item5.images.length === 5);
    const rmForm = annForm('Galerie publique', 'public', []);
    rmForm.append('remove_images', JSON.stringify([item5.images[0], item5.images[1]]));
    check('Retrait de 2 images précises', (await admin.req('PUT', `/api/admin/announcements/${gPub.data.id}`, rmForm)).status === 200);
    const item3 = await feedOf(anon, '/api/public/school/jean-piaget-1/news', 'Galerie publique');
    check('Il reste 3 images, les autres sont supprimées du disque', item3.images.length === 3 && !item3.images.includes(item5.images[0]) && countUploads() === f1, { reste: item3.images.length, fichiers: countUploads(), attendu: f1 });
    check('Une image retirée n\'est plus accessible', (await anon.get(`/api/public/school/jean-piaget-1/news/${gPub.data.id}/image/${item5.images[0]}`)).status === 404);
    const rmOther = annForm('Hack', 'public', []);
    rmOther.append('remove_images', JSON.stringify([item3.images[0]]));
    check('ISOLATION : l\'admin d\'un autre établissement ne peut pas modifier la galerie', (await adminB.req('PUT', `/api/admin/announcements/${gPub.data.id}`, rmOther)).status === 400 && (await feedOf(anon, '/api/public/school/jean-piaget-1/news', 'Galerie publique')).images.length === 3);
    check('ISOLATION : ni supprimer la publication', (await adminB.del(`/api/admin/announcements/${gPub.data.id}`)).status === 400);

    const f2 = countUploads();
    const gone = (await admin.del(`/api/admin/announcements/${gPub.data.id}`)).status === 200 && (await admin.del(`/api/admin/announcements/${gMem.data.id}`)).status === 200 && (await admin.del(`/api/admin/announcements/${six.data.id}`)).status === 200;
    check('Suppression des publications', gone);
    check('Tous les fichiers de ces galeries sont supprimés du disque (3 + 2 + 6)', countUploads() === f2 - 11, { avant: f2, apres: countUploads() });

    console.log('\n[Sauvegarde & supervision]');
    check('/healthz répond (base accessible)', (await anon.get('/healthz')).data.ok === true);
    const bdir = path.join(tmp, 'bk');
    const runBackup = () => spawnSync('node', ['scripts/backup.js'], { env: { ...env, BACKUP_DIR: bdir, BACKUP_KEEP: '2' }, encoding: 'utf8' });
    const b1 = runBackup();
    const first = fs.existsSync(bdir) ? fs.readdirSync(bdir) : [];
    check('Sauvegarde créée pendant que le serveur tourne', b1.status === 0 && first.length === 1, b1.stderr);
    const bfile = path.join(bdir, first[0] || 'x', 'portail.db');
    check('La sauvegarde est une vraie base SQLite non vide', fs.existsSync(bfile) && fs.readFileSync(bfile).slice(0, 15).toString() === 'SQLite format 3' && fs.statSync(bfile).size > 20000);
    await new Promise((r) => setTimeout(r, 1100)); runBackup(); await new Promise((r) => setTimeout(r, 1100)); runBackup();
    check('Rotation : seules les 2 dernières sauvegardes sont gardées', fs.readdirSync(bdir).length === 2, fs.readdirSync(bdir));

    console.log('\n[Clôture de trimestre]');
    const closeR = await admin.post(`/api/admin/terms/${term1.id}/close`);
    check('Clôture du trimestre 1 -> ouverture du trimestre 2', closeR.status === 200 && closeR.data.next === 'Trimestre 2', closeR.data);
    const frozen = await prof.put('/api/teacher/grades', { class_id: a0.class_id, subject_id: a0.subject_id, term_id: term1.id, entries: [{ student_id: s0, type: 'interro', idx: 5, value: 12 }] });
    check('Notes gelées après clôture (423)', frozen.status === 423, frozen.data);
    const ctx2 = (await prof.get('/api/teacher/context')).data;
    const term2 = ctx2.terms.find((t) => t.status === 'open');
    check('Nouveau trimestre saisissable', term2 && term2.name === 'Trimestre 2' && (await prof.put('/api/teacher/grades', { class_id: a0.class_id, subject_id: a0.subject_id, term_id: term2.id, entries: [{ student_id: s0, type: 'interro', idx: 1, value: 14 }] })).status === 200);
    const evo = (await stu.get('/api/student/dashboard')).data.evolution;
    check('Courbe d\'évolution sur 2 trimestres', evo.length === 2, evo);

    console.log('\n[Mot de passe oublié]');
    const before = serverLog.length;
    check('Demande de réinitialisation (réponse neutre)', (await anon.post('/api/auth/forgot', { school_code: 'jean-piaget-1', identifier: 'admin' })).status === 200);
    await new Promise((r) => setTimeout(r, 300));
    const m = /reset\.html\?token=([a-f0-9]{64})/.exec(serverLog.slice(before));
    check('Lien de réinitialisation généré (mode console)', !!m);
    if (m) {
      check('Réinitialisation avec le lien', (await anon.post('/api/auth/reset', { token: m[1], password: 'MotDePasseNeuf1' })).status === 200);
      check('Le lien ne fonctionne qu\'une fois', (await anon.post('/api/auth/reset', { token: m[1], password: 'MotDePasseNeuf2' })).status === 400);
      check('Connexion avec le nouveau mot de passe', (await new Client().login('jean-piaget-1', 'admin', 'MotDePasseNeuf1')).status === 200);
    }
    check('Réponse identique pour un compte inexistant', (await anon.post('/api/auth/forgot', { school_code: 'jean-piaget-1', identifier: 'personne' })).status === 200);

    console.log('\n[Désactivation]');
    check('Désactivation d\'un établissement par la plateforme', (await sup.req('PATCH', `/api/platform/schools/${created.data.school_id}`, { active: false })).status === 200);
    check('Ses utilisateurs sont bloqués immédiatement', (await a3.get('/api/admin/dashboard')).status === 403);
    check('Connexion impossible à un établissement désactivé', (await new Client().login('ecole-test', 'dir.test', 'NouveauMdp2026')).status === 403);
    const deact = await admin.post(`/api/admin/users/${eleve1.id}/toggle`);
    check('Compte élève désactivé -> accès coupé immédiatement', deact.status === 200 && (await stu.get('/api/student/dashboard')).status === 401);
  } finally {
    server.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`\nRésultat : ${passed} réussis, ${failed} échoués`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
