import * as S from './shared.js';
import { api, T, h, setHtml, bind, qs, fmt, fmtDate, todayStr, colorOf, badge, fileSize, openModal, confirmDialog, toast, errToast, saveWithQueue, pendingCount, flushQueue, $, $$, formValues } from '../common.js';

let ctx = null;
async function getCtx() { ctx = await api('/teacher/context'); return ctx; }
const head = (title, extra = '') => h`<div class="page-head"><h1>${title}</h1><div>${extra}</div></div>`;
const noAssign = () => h`${head('')}<div class="card empty">${T("Aucune classe ne vous est encore attribuée. Demandez à la direction de vous attribuer vos classes et matières.", 'No class has been assigned to you yet. Ask the administration to assign your classes and subjects.')}</div>`;

// Choix "classe — matière" mémorisé entre les pages
function asgOptions() {
  const cur = sessionStorage.getItem('asg');
  return ctx.assignments.map((a, i) => {
    const v = `${a.class_id}:${a.subject_id}`;
    return h`<option value="${v}" ${(cur ? cur === v : i === 0) ? 'selected' : ''}>${a.class_name} — ${a.subject_name}</option>`;
  });
}
function currentAsg(root) {
  const v = $('#asg', root).value;
  sessionStorage.setItem('asg', v);
  const [c, s] = v.split(':').map(Number);
  return { class_id: c, subject_id: s };
}
const asgSelect = () => h`<div class="field"><label>${T('Classe — matière', 'Class — subject')}</label><select id="asg">${asgOptions()}</select></div>`;

/* ---------- Accueil ---------- */
async function home(root, { user, go }) {
  await getCtx();
  const term = ctx.terms.find((t) => t.status === 'open');
  setHtml(root, h`${head(h`${T('Bonjour', 'Hello')} ${user.first_name} 👋`)}
    ${term ? h`<div class="notice info">${T('Période en cours :', 'Current term:')} <b>${term.name}</b></div>` : h`<div class="notice">${T("Aucune période n'est ouverte : la saisie des notes est suspendue.", 'No term is open: grade entry is suspended.')}</div>`}
    ${ctx.assignments.length ? h`<div class="grid">${ctx.assignments.map((a) => h`<div class="card"><h3>${a.class_name}</h3><div class="gold">${a.subject_name}</div><div class="muted small mt">${a.students} ${T('élèves', 'students')}</div>
      <div class="actions mt"><button class="btn btn-sm btn-primary" data-act="open" data-v="${a.class_id}:${a.subject_id}" data-to="grades">${T('Notes', 'Grades')}</button>
      <button class="btn btn-sm" data-act="open" data-v="${a.class_id}:${a.subject_id}" data-to="attendance">${T('Appel', 'Roll call')}</button></div></div>`)}</div>` : noAssign()}`);
  bind(root, { open: (el) => { sessionStorage.setItem('asg', el.dataset.v); go(el.dataset.to); } });
}

/* ---------- Saisie des notes ---------- */
const avgOf = (interros, devoirs) => {
  const parts = [];
  if (interros.length) parts.push(interros.reduce((a, b) => a + b, 0) / interros.length);
  devoirs.forEach((d) => parts.push(d));
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
};
const parseGrade = (s) => {
  const t = String(s).trim().replace(',', '.');
  if (t === '') return { value: null, ok: true };
  const n = Number(t);
  return { value: n, ok: Number.isFinite(n) && n >= 0 && n <= 20 };
};

async function grades(root) {
  await getCtx();
  if (!ctx.assignments.length) return setHtml(root, noAssign());
  const openTerm = ctx.terms.find((t) => t.status === 'open') || ctx.terms[ctx.terms.length - 1];
  setHtml(root, h`${head(T('Saisie des notes', 'Grade entry'))}
    <div class="card mb"><div class="row">${asgSelect()}<div class="field"><label>${T('Période', 'Term')}</label><select id="term">${ctx.terms.map((t) => h`<option value="${t.id}" ${openTerm && t.id === openTerm.id ? 'selected' : ''}>${t.name}${t.status === 'closed' ? ' 🔒' : ''}</option>`)}</select></div></div></div>
    <div id="sheet"></div>`);
  const sheet = $('#sheet', root);
  let dirty = new Map();
  let data = null;
  const load = async () => {
    dirty = new Map();
    const a = currentAsg(root);
    data = await api('/teacher/grades' + qs({ ...a, term_id: $('#term', root).value }));
    const nI = data.interro_max, nD = data.devoir_max;
    setHtml(sheet, h`${data.locked ? h`<div class="notice">🔒 ${T('Cette période est clôturée : les notes sont gelées (lecture seule).', 'This term is closed: grades are frozen (read-only).')}</div>` : ''}
      <div class="card"><div class="table-wrap gtable"><table><thead><tr><th>${T('Élève', 'Student')}</th>${Array.from({ length: nI }, (_, i) => h`<th class="num">I${i + 1}</th>`)}${Array.from({ length: nD }, (_, i) => h`<th class="num">D${i + 1}</th>`)}<th class="num">${T('Moy.', 'Avg')}</th></tr></thead>
      <tbody>${data.students.map((s) => h`<tr data-sid="${s.id}"><td><b>${s.last_name}</b> ${s.first_name}</td>
        ${s.interro.map((v, i) => h`<td class="num"><input inputmode="decimal" data-input="cell" data-sid="${s.id}" data-type="interro" data-idx="${i + 1}" value="${v ?? ''}" ${data.locked ? 'disabled' : ''}></td>`)}
        ${s.devoir.map((v, i) => h`<td class="num"><input inputmode="decimal" data-input="cell" data-sid="${s.id}" data-type="devoir" data-idx="${i + 1}" value="${v ?? ''}" ${data.locked ? 'disabled' : ''}></td>`)}
        <td class="avg" data-avg="${s.id}"></td></tr>`)}</tbody></table></div>
      ${data.students.length ? '' : h`<div class="empty">${T('Aucun élève dans cette classe.', 'No students in this class.')}</div>`}
      <p class="muted small mt">${T(`Jusqu'à ${nI} interrogations et ${nD} devoirs par matière. Notes sur 20 (virgule ou point). Moyenne = (moy. interros + D1 + D2) / 3.`, `Up to ${nI} quizzes and ${nD} tests per subject. Grades out of 20. Average = (quiz avg + T1 + T2) / 3.`)}</p></div>
      ${data.locked ? '' : h`<div class="savebar"><div class="card"><span id="dirty" class="muted small"></span><button class="btn btn-primary" data-act="save">💾 ${T('Enregistrer', 'Save')}</button></div></div>`}`);
    data.students.forEach((s) => refreshAvg(s.id));
  };
  const rowValues = (sid) => {
    const inputs = $$(`input[data-sid="${sid}"]`, sheet);
    const i = [], d = [];
    inputs.forEach((el) => { const p = parseGrade(el.value); if (p.ok && p.value !== null) (el.dataset.type === 'interro' ? i : d).push(p.value); });
    return { i, d };
  };
  const refreshAvg = (sid) => {
    const { i, d } = rowValues(sid);
    const a = avgOf(i, d);
    const cell = $(`[data-avg="${sid}"]`, sheet);
    cell.textContent = a === null ? '–' : fmt(a);
    cell.className = 'avg txt-' + colorOf(a);
  };
  const updateDirty = () => { const el = $('#dirty', sheet); if (el) el.textContent = dirty.size ? T(`${dirty.size} modification(s) non enregistrée(s)`, `${dirty.size} unsaved change(s)`) : ''; };
  const initial = (el) => { const s = data.students.find((x) => x.id === Number(el.dataset.sid)); const arr = el.dataset.type === 'interro' ? s.interro : s.devoir; return arr[Number(el.dataset.idx) - 1]; };

  sheet.oninput = (e) => {
    const el = e.target.closest('[data-input="cell"]');
    if (!el) return;
    const p = parseGrade(el.value);
    el.classList.toggle('inv', !p.ok);
    const key = `${el.dataset.sid}:${el.dataset.type}:${el.dataset.idx}`;
    if (p.ok && p.value === (initial(el) ?? null)) dirty.delete(key); else dirty.set(key, el);
    refreshAvg(el.dataset.sid);
    updateDirty();
  };
  sheet.onclick = async (e) => {
    if (!e.target.closest('[data-act="save"]')) return;
    if ($$('input.inv', sheet).length) return toast(T('Corrigez les notes en rouge (entre 0 et 20).', 'Fix the red grades (between 0 and 20).'), 'error');
    if (!dirty.size) return toast(T('Aucune modification à enregistrer.', 'Nothing to save.'));
    const a = currentAsg(root);
    const entries = [...dirty.values()].map((el) => ({ student_id: Number(el.dataset.sid), type: el.dataset.type, idx: Number(el.dataset.idx), value: parseGrade(el.value).value }));
    try {
      const r = await saveWithQueue(`grades:${a.class_id}:${a.subject_id}:${$('#term', root).value}`, '/teacher/grades', { ...a, term_id: Number($('#term', root).value), entries });
      if (r.queued) toast(T('Pas de connexion : vos notes sont gardées et seront envoyées automatiquement.', 'No connection: your grades are kept and will be sent automatically.'));
      else toast(T('Notes enregistrées ✔', 'Grades saved ✔'), 'ok');
      // la nouvelle référence devient l'état enregistré
      data.students.forEach((s) => { $$(`input[data-sid="${s.id}"]`, sheet).forEach((el) => { const arr = el.dataset.type === 'interro' ? s.interro : s.devoir; arr[Number(el.dataset.idx) - 1] = parseGrade(el.value).value; }); });
      dirty.clear(); updateDirty();
    } catch (err) { errToast(err); }
  };
  $('#asg', root).onchange = () => load().catch(errToast);
  $('#term', root).onchange = () => load().catch(errToast);
  await load();
}

/* ---------- Cahier d'appel ---------- */
async function attendance(root) {
  await getCtx();
  if (!ctx.assignments.length) return setHtml(root, noAssign());
  setHtml(root, h`${head(T("Cahier d'appel", 'Roll call'))}
    <div class="card mb"><div class="row">${asgSelect()}<div class="field"><label>Date</label><input type="date" id="date" value="${todayStr()}" max="${todayStr()}"></div></div></div><div id="sheet"></div>`);
  const sheet = $('#sheet', root);
  let students = [];
  const draw = () => {
    setHtml(sheet, h`<div class="card"><div class="actions mb"><button class="btn btn-sm" data-act="allp">✔ ${T('Tous présents', 'All present')}</button></div>
      <div class="table-wrap"><table><thead><tr><th>${T('Élève', 'Student')}</th><th>${T('Présence', 'Attendance')}</th><th></th></tr></thead><tbody>
      ${students.map((s) => h`<tr><td><b>${s.last_name}</b> ${s.first_name}</td><td><div class="seg">
        ${['present', 'absent', 'late'].map((st) => h`<button data-act="set" data-sid="${s.id}" data-st="${st}" class="${s.status === st ? 'on-' + st : ''}">${{ present: T('Présent', 'Present'), absent: T('Absent', 'Absent'), late: T('Retard', 'Late') }[st]}</button>`)}</div></td>
        <td>${s.justified ? badge('green', T('Justifiée', 'Justified')) : ''}</td></tr>`)}</tbody></table></div>
      ${students.length ? '' : h`<div class="empty">${T('Aucun élève.', 'No students.')}</div>`}</div>
      <div class="savebar"><div class="card"><span class="muted small" id="pending"></span><button class="btn btn-primary" data-act="save">💾 ${T("Enregistrer l'appel", 'Save roll call')}</button></div></div>`);
    const p = pendingCount();
    if (p) $('#pending', sheet).textContent = T(`${p} envoi(s) en attente de réseau`, `${p} save(s) waiting for network`);
  };
  const load = async () => {
    const a = currentAsg(root);
    students = (await api('/teacher/attendance' + qs({ ...a, date: $('#date', root).value }))).students;
    draw();
  };
  bind(sheet, {
    set: (el) => { const s = students.find((x) => x.id === Number(el.dataset.sid)); s.status = s.status === el.dataset.st ? null : el.dataset.st; draw(); },
    allp: () => { students.forEach((s) => { s.status = 'present'; }); draw(); },
    save: async () => {
      const a = currentAsg(root);
      const date = $('#date', root).value;
      try {
        const r = await saveWithQueue(`att:${a.class_id}:${a.subject_id}:${date}`, '/teacher/attendance', { ...a, date, entries: students.map((s) => ({ student_id: s.id, status: s.status })) });
        toast(r.queued ? T("Pas de connexion : l'appel est gardé et sera envoyé automatiquement.", 'No connection: the roll call is kept and will be sent automatically.') : T('Appel enregistré ✔', 'Roll call saved ✔'), r.queued ? 'info' : 'ok');
        draw();
      } catch (e) { errToast(e); }
    },
  });
  $('#asg', root).onchange = () => load().catch(errToast);
  $('#date', root).onchange = () => load().catch(errToast);
  await load();
}

/* ---------- Cahier de texte ---------- */
const NEXT = { todo: 'in_progress', in_progress: 'done', done: 'todo' };
const ST = { todo: ['gray', () => T('À faire', 'To do')], in_progress: ['gold', () => T('En cours', 'In progress')], done: ['green', () => T('Terminé', 'Done')] };
async function textbook(root) {
  await getCtx();
  if (!ctx.assignments.length) return setHtml(root, noAssign());
  setHtml(root, h`${head(T('Cahier de texte', 'Class log'))}<div class="card mb"><div class="row">${asgSelect()}</div></div><div id="body"></div>`);
  const body = $('#body', root);
  const draw = async () => {
    const a = currentAsg(root);
    const [ch, ls] = await Promise.all([api('/teacher/chapters' + qs(a)), api('/teacher/lessons' + qs(a))]);
    const done = ch.items.filter((c) => c.status === 'done').length;
    setHtml(body, h`<div class="grid-2">
      <div class="card"><h2>${T('Avancement des chapitres', 'Chapter progress')} <span class="muted small">${done}/${ch.items.length}</span></h2>
        <div class="progress mb"><i style="width:${ch.items.length ? Math.round((done / ch.items.length) * 100) : 0}%"></i></div>
        ${ch.items.map((c) => h`<div class="chap"><span class="t">${c.title}</span><button class="btn btn-sm" data-act="cycle" data-id="${c.id}" data-st="${c.status}">${ST[c.status][1]()} ↻</button><button class="btn btn-sm btn-danger" data-act="delch" data-id="${c.id}" aria-label="delete">✕</button></div>`)}
        <div class="row mt"><div class="field"><input id="newch" maxlength="160" placeholder="${T('Nouveau chapitre…', 'New chapter…')}"></div><button class="btn btn-primary btn-sm" data-act="addch">＋</button></div></div>
      <div class="card"><h2>${T('Séances', 'Lessons')}</h2>
        <div class="field"><label>Date</label><input type="date" id="ldate" value="${todayStr()}"></div>
        <div class="field"><label>${T('Contenu de la séance', 'Lesson content')}</label><textarea id="lcontent" maxlength="2000"></textarea></div>
        <div class="field"><label>${T('Travail à faire (facultatif)', 'Homework (optional)')}</label><input id="lhw" maxlength="1000"></div>
        <button class="btn btn-primary btn-sm" data-act="addl">${T('Ajouter la séance', 'Add lesson')}</button>
        <div class="mt">${ls.items.map((l) => h`<div class="list-item"><div class="row" style="justify-content:space-between;align-items:center"><span class="muted small">${fmtDate(l.date)}</span><button class="btn btn-sm btn-danger" data-act="dell" data-id="${l.id}">✕</button></div><div>${l.content}</div>${l.homework ? h`<div class="small gold">📝 ${l.homework}</div>` : ''}</div>`)}</div></div></div>`);
  };
  const wrap = (fn) => async (el) => { try { await fn(el); await draw(); } catch (e) { errToast(e); } };
  bind(body, {
    addch: wrap(async () => { const t = $('#newch', body).value.trim(); if (!t) return; await api('/teacher/chapters', { method: 'POST', body: { ...currentAsg(root), title: t } }); }),
    cycle: wrap(async (el) => api(`/teacher/chapters/${el.dataset.id}`, { method: 'PUT', body: { status: NEXT[el.dataset.st] } })),
    delch: wrap(async (el) => { if (await confirmDialog(T('Supprimer ce chapitre ?', 'Delete this chapter?'), { danger: true })) await api(`/teacher/chapters/${el.dataset.id}`, { method: 'DELETE' }); }),
    addl: wrap(async () => { await api('/teacher/lessons', { method: 'POST', body: { ...currentAsg(root), date: $('#ldate', body).value, content: $('#lcontent', body).value, homework: $('#lhw', body).value } }); toast(T('Séance ajoutée', 'Lesson added'), 'ok'); }),
    dell: wrap(async (el) => { if (await confirmDialog(T('Supprimer cette séance ?', 'Delete this lesson?'), { danger: true })) await api(`/teacher/lessons/${el.dataset.id}`, { method: 'DELETE' }); }),
  });
  $('#asg', root).onchange = () => draw().catch(errToast);
  await draw();
}

/* ---------- Archives ---------- */
async function archives(root) {
  await getCtx();
  if (!ctx.assignments.length) return setHtml(root, noAssign());
  setHtml(root, h`${head(T("Archives d'épreuves", 'Exam archives'))}<div class="card mb"><div class="row">${asgSelect()}</div></div><div id="body"></div>`);
  const body = $('#body', root);
  const draw = async () => {
    const d = await api('/teacher/archives' + qs(currentAsg(root)));
    setHtml(body, h`<div class="grid-2"><div class="card"><h2>${T('Déposer une épreuve (PDF)', 'Upload a paper (PDF)')}</h2>
      <div class="field"><label>${T('Titre', 'Title')}</label><input id="atitle" maxlength="160" placeholder="${T('Ex : Devoir 1 — 2025', 'e.g. Test 1 — 2025')}"></div>
      <div class="field"><label>${T('Fichier PDF (10 Mo max)', 'PDF file (10 MB max)')}</label><input type="file" id="afile" accept=".pdf,application/pdf"></div>
      <button class="btn btn-primary" data-act="up">⬆ ${T('Mettre en ligne', 'Upload')}</button></div>
      <div class="card"><h2>${T('Épreuves en ligne', 'Uploaded papers')}</h2>${d.items.length ? d.items.map((a) => h`<div class="list-item row" style="justify-content:space-between;align-items:center"><div><b>${a.title}</b><div class="muted small">${fmtDate(a.created_at)} · ${fileSize(a.size)}</div></div>
        <div class="actions"><a class="btn btn-sm" href="/api/files/archives/${a.id}">⬇</a><button class="btn btn-sm btn-danger" data-act="del" data-id="${a.id}">✕</button></div></div>`) : h`<div class="empty">${T('Aucune épreuve.', 'No papers.')}</div>`}</div></div>`);
  };
  bind(body, {
    up: async () => {
      const f = $('#afile', body).files[0];
      if (!f) return toast(T('Choisissez un fichier PDF.', 'Choose a PDF file.'), 'error');
      const fd = new FormData();
      const a = currentAsg(root);
      fd.append('class_id', a.class_id); fd.append('subject_id', a.subject_id); fd.append('title', $('#atitle', body).value); fd.append('file', f);
      try { await api('/teacher/archives', { method: 'POST', form: fd }); toast(T('Épreuve mise en ligne ✔', 'Paper uploaded ✔'), 'ok'); await draw(); } catch (e) { errToast(e); }
    },
    del: async (el) => { if (await confirmDialog(T('Supprimer ce fichier ?', 'Delete this file?'), { danger: true })) { try { await api(`/teacher/archives/${el.dataset.id}`, { method: 'DELETE' }); await draw(); } catch (e) { errToast(e); } } },
  });
  $('#asg', root).onchange = () => draw().catch(errToast);
  await draw();
}

/* ---------- Discipline ---------- */
async function discipline(root) {
  await getCtx();
  if (!ctx.assignments.length) return setHtml(root, noAssign());
  const classes = [...new Map(ctx.assignments.map((a) => [a.class_id, a.class_name]))];
  setHtml(root, h`${head(T('Signalements disciplinaires', 'Discipline reports'))}
    <div class="card mb"><div class="field" style="max-width:320px"><label>${T('Classe', 'Class')}</label><select id="cls">${classes.map(([id, n]) => h`<option value="${id}">${n}</option>`)}</select></div></div><div id="body"></div>`);
  const body = $('#body', root);
  let kind = 'negative';
  const draw = async () => {
    const cid = $('#cls', root).value;
    const [st, hist] = await Promise.all([api(`/teacher/classes/${cid}/students`), api('/teacher/discipline' + qs({ class_id: cid }))]);
    setHtml(body, h`<div class="grid-2"><div class="card"><h2>${T('Nouveau signalement', 'New report')}</h2>
      <div class="field"><label>${T('Élève', 'Student')}</label><select id="dstu">${st.items.map((s) => h`<option value="${s.id}">${s.last_name} ${s.first_name}</option>`)}</select></div>
      <div class="field"><div class="seg"><button data-act="kind" data-k="positive" class="${kind === 'positive' ? 'on-present' : ''}">👍 ${T('Positif', 'Positive')}</button><button data-act="kind" data-k="negative" class="${kind === 'negative' ? 'on-absent' : ''}">⚠ ${T('Négatif', 'Negative')}</button></div></div>
      <div class="field"><label>${T('Description', 'Description')}</label><textarea id="ddesc" maxlength="500"></textarea></div>
      <button class="btn btn-primary" data-act="add">${T('Enregistrer', 'Save')}</button></div>
      <div class="card"><h2>${T('Historique de la classe', 'Class history')}</h2>${hist.items.length ? hist.items.map((d) => h`<div class="list-item">${badge(d.kind === 'positive' ? 'green' : 'red', d.kind === 'positive' ? T('Positif', 'Positive') : T('Négatif', 'Negative'))} <b>${d.student_name}</b> <span class="muted small">· ${fmtDate(d.date)}${d.teacher_name ? ' · ' + d.teacher_name : ''}</span><div>${d.description}</div></div>`) : h`<div class="empty">${T('Rien à signaler.', 'Nothing to report.')}</div>`}</div></div>`);
  };
  bind(body, {
    kind: (el) => { const d = $('#ddesc', body)?.value; kind = el.dataset.k; draw().then(() => { $('#ddesc', body).value = d || ''; }); },
    add: async () => {
      try {
        await api('/teacher/discipline', { method: 'POST', body: { student_id: Number($('#dstu', body).value), kind, description: $('#ddesc', body).value } });
        toast(T('Signalement enregistré', 'Report saved'), 'ok'); await draw();
      } catch (e) { errToast(e); }
    },
  });
  $('#cls', root).onchange = () => draw().catch(errToast);
  await draw();
}

export default {
  nav: [
    { key: 'home', icon: '🏠', fr: 'Accueil', en: 'Home' },
    { key: 'grades', icon: '📝', fr: 'Saisie des notes', en: 'Grade entry' },
    { key: 'attendance', icon: '✅', fr: "Cahier d'appel", en: 'Roll call' },
    { key: 'textbook', icon: '📖', fr: 'Cahier de texte', en: 'Class log' },
    { key: 'archives', icon: '🗂️', fr: 'Archives', en: 'Archives' },
    { key: 'discipline', icon: '⚠️', fr: 'Discipline', en: 'Discipline' },
    { key: 'news', icon: '📣', fr: 'Actualités', en: 'News' },
  ],
  views: { home, grades, attendance, textbook, archives, discipline, news: (root) => S.newsView(root) },
};
