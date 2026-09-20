import { api, T, h, raw, setHtml, bind, qs, fmtDate, todayStr, badge, openModal, confirmDialog, formValues, toast, errToast, showSecret, newsCard, CATEGORIES, shrinkImage, $, $$ } from '../common.js';

const head = (title, extra = '') => h`<div class="page-head"><h1>${title}</h1><div class="actions">${extra}</div></div>`;
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

function promptDialog(title, label, value = '') {
  return new Promise((resolve) => {
    openModal({
      title,
      body: h`<div class="field"><label>${label}</label><input name="v" maxlength="80" value="${value}"></div><div class="error-msg"></div>`,
      actions: [
        { label: T('Annuler', 'Cancel'), run: (m) => { m.close(); resolve(null); } },
        { label: T('Valider', 'OK'), cls: 'btn-primary', run: (m) => { const v = $('[name=v]', m.el).value.trim(); if (!v) throw new Error(T('Valeur obligatoire', 'Required')); m.close(); resolve(v); } },
      ],
    });
  });
}
const run = async (fn, okMsg) => { try { const r = await fn(); if (okMsg) toast(okMsg, 'ok'); return r; } catch (e) { errToast(e); return undefined; } };

/* ---------- Tableau de bord ---------- */
async function dashboard(root, { go }) {
  const d = await api('/admin/dashboard');
  const stat = (n, label, cls = '') => h`<div class="card stat ${cls}"><div class="num">${n}</div><div class="lbl">${label}</div></div>`;
  setHtml(root, h`${head(T("Vue d'ensemble", 'Overview'))}
    ${d.open_term ? h`<div class="notice info">${T('Période en cours :', 'Current term:')} <b>${d.open_term.name}</b></div>` : h`<div class="notice">${T("Aucune période ouverte. Ouvrez-en une dans « Périodes ».", 'No term is open. Open one in “Terms”.')}</div>`}
    <div class="grid">${stat(d.students, T('Élèves', 'Students'))}${stat(d.teachers, T('Professeurs', 'Teachers'))}${stat(d.parents, T('Parents', 'Parents'))}${stat(d.classes, T('Classes', 'Classes'))}
      ${stat(d.absences_today, T("Absents aujourd'hui", 'Absent today'), 'gold')}
      <div class="card stat gold"><div class="num">${d.pending_justifications}</div><div class="lbl">${T('Justificatifs à valider', 'Justifications to review')}</div>${d.pending_justifications ? h`<button class="btn btn-sm mt" data-act="mon">${T('Voir', 'View')}</button>` : ''}</div></div>`);
  bind(root, { mon: () => go('monitoring') });
}

/* ---------- Utilisateurs ---------- */
const ROLE_TABS = () => [['student', T('Élèves', 'Students')], ['teacher', T('Professeurs', 'Teachers')], ['parent', T('Parents', 'Parents')], ['admin', T('Administrateurs', 'Admins')]];
const ROLE_ONE = () => ({ student: T('un élève', 'a student'), teacher: T('un professeur', 'a teacher'), parent: T('un parent', 'a parent'), admin: T('un administrateur', 'an administrator') });

async function users(root) {
  let role = sessionStorage.getItem('adm_role') || 'student';
  let q = '';
  let classId = '';
  const classes = (await api('/admin/classes')).items;
  const draw = async () => {
    const d = await api('/admin/users' + qs({ role, q, class_id: role === 'student' ? classId : '' }));
    const cols = { student: [T('Classe', 'Class'), T('Matricule', 'ID')], teacher: [T('Attributions', 'Assignments'), ''], parent: [T('Enfants', 'Children'), ''], admin: ['', ''] }[role];
    setHtml(root, h`${head(T('Utilisateurs', 'Users'), h`<button class="btn btn-primary" data-act="new">＋ ${T('Nouveau', 'New')}</button>`)}
      <div class="tabs">${ROLE_TABS().map(([k, l]) => h`<button class="tab ${k === role ? 'active' : ''}" data-act="tab" data-k="${k}">${l}</button>`)}</div>
      <div class="card"><div class="row"><div class="field"><input data-input="search" id="search" placeholder="${T('Rechercher…', 'Search…')}" value="${q}"></div>
        ${role === 'student' ? h`<div class="field"><select data-change="cls"><option value="">${T('Toutes les classes', 'All classes')}</option>${classes.map((c) => h`<option value="${c.id}" ${String(c.id) === String(classId) ? 'selected' : ''}>${c.name}</option>`)}</select></div>` : ''}</div>
      <div class="table-wrap"><table><thead><tr><th>${T('Nom', 'Name')}</th><th>${T('Identifiant', 'Username')}</th><th>${cols[0]}</th><th>${cols[1]}</th><th>${T('Statut', 'Status')}</th><th></th></tr></thead><tbody>
      ${d.items.map((u) => h`<tr><td><b>${u.last_name}</b> ${u.first_name}</td><td>${u.username}</td>
        <td>${role === 'student' ? u.class_name : role === 'teacher' ? u.assignments : role === 'parent' ? (u.children.map((c) => c.name).join(', ') || '—') : ''}</td><td>${role === 'student' ? u.matricule : ''}</td>
        <td>${u.active ? badge('green', T('Actif', 'Active')) : badge('gray', T('Désactivé', 'Disabled'))}${u.must_change_password ? badge('gold', T('1re connexion', 'First login')) : ''}</td>
        <td><div class="actions">
          <button class="btn btn-sm" data-act="edit" data-id="${u.id}">✎</button>
          ${role === 'teacher' ? h`<button class="btn btn-sm" data-act="assign" data-id="${u.id}">${T('Classes', 'Classes')}</button>` : ''}
          ${role === 'parent' ? h`<button class="btn btn-sm" data-act="kids" data-id="${u.id}">${T('Enfants', 'Children')}</button>` : ''}
          <button class="btn btn-sm" data-act="pwd" data-id="${u.id}" title="${T('Nouveau mot de passe', 'New password')}">🔑</button>
          <button class="btn btn-sm" data-act="toggle" data-id="${u.id}">${u.active ? T('Désactiver', 'Disable') : T('Activer', 'Enable')}</button>
          <button class="btn btn-sm btn-danger" data-act="del" data-id="${u.id}">🗑</button></div></td></tr>`)}</tbody></table></div>
      ${d.items.length ? '' : h`<div class="empty">${T('Aucun résultat.', 'No results.')}</div>`}</div>`);
    const s = $('#search', root); if (s && document.activeElement !== s && q) { s.focus(); s.setSelectionRange(q.length, q.length); }
    users.data = d.items;
  };
  const find = (id) => users.data.find((u) => u.id === Number(id));
  let timer;
  bind(root, {
    tab: (el) => { role = el.dataset.k; sessionStorage.setItem('adm_role', role); q = ''; classId = ''; draw().catch(errToast); },
    search: (el) => { q = el.value; clearTimeout(timer); timer = setTimeout(() => draw().catch(errToast), 250); },
    cls: (el) => { classId = el.value; draw().catch(errToast); },
    new: () => userModal(null, role, classes, draw),
    edit: (el) => userModal(find(el.dataset.id), role, classes, draw),
    toggle: async (el) => { await run(() => api(`/admin/users/${el.dataset.id}/toggle`, { method: 'POST' })); draw(); },
    pwd: async (el) => {
      const u = find(el.dataset.id);
      if (!(await confirmDialog(T(`Générer un nouveau mot de passe provisoire pour ${u.first_name} ${u.last_name} ?`, `Generate a new temporary password for ${u.first_name} ${u.last_name}?`)))) return;
      const r = await run(() => api(`/admin/users/${u.id}/reset-password`, { method: 'POST' }));
      if (r) showSecret({ title: T('Nouveau mot de passe', 'New password'), username: r.username, password: r.temp_password });
    },
    del: async (el) => {
      const u = find(el.dataset.id);
      if (!(await confirmDialog(T(`Supprimer définitivement ${u.first_name} ${u.last_name} ? (Si le compte a des notes ou des présences, la suppression sera refusée : désactivez-le plutôt.)`, `Permanently delete ${u.first_name} ${u.last_name}? (If the account has grades or attendance, deletion will be refused: disable it instead.)`), { danger: true }))) return;
      await run(() => api(`/admin/users/${u.id}`, { method: 'DELETE' }), T('Compte supprimé', 'Account deleted')); draw();
    },
    assign: (el) => assignModal(find(el.dataset.id), draw),
    kids: (el) => kidsModal(find(el.dataset.id), draw),
  });
  await draw();
}

function userModal(u, role, classes, done) {
  const isNew = !u;
  openModal({
    title: isNew ? T(`Nouveau compte : ${ROLE_ONE()[role]}`, `New account: ${ROLE_ONE()[role]}`) : T('Modifier le compte', 'Edit account'),
    body: h`<div class="row"><div class="field"><label>${T('Prénom', 'First name')}</label><input name="first_name" value="${u ? u.first_name : ''}"></div><div class="field"><label>${T('Nom', 'Last name')}</label><input name="last_name" value="${u ? u.last_name : ''}"></div></div>
      ${isNew ? h`<div class="field"><label>${T('Identifiant de connexion', 'Login username')}</label><input name="username" placeholder="prenom.nom" autocapitalize="none"></div>` : ''}
      <div class="field"><label>Email ${T('(facultatif — utile pour « mot de passe oublié »)', '(optional — used for “forgot password”)')}</label><input name="email" type="email" value="${u ? u.email || '' : ''}"></div>
      ${role === 'student' ? h`<div class="row"><div class="field"><label>${T('Classe', 'Class')}</label><select name="class_id">${classes.map((c) => h`<option value="${c.id}" ${u && u.class_id === c.id ? 'selected' : ''}>${c.name}</option>`)}</select></div>
        <div class="field"><label>${T('Matricule', 'Student ID')}</label><input name="matricule" value="${u ? u.matricule || '' : ''}"></div></div>` : ''}
      ${isNew ? h`<div class="field"><label>${T('Mot de passe (laisser vide = généré automatiquement)', 'Password (leave empty = auto-generated)')}</label><input name="password" type="text" autocomplete="off"></div>` : ''}
      <div class="error-msg"></div>`,
    onOpen: (m) => {
      if (!isNew) return;
      const u1 = $('[name=username]', m); let touched = false;
      u1.oninput = () => { touched = true; };
      const auto = () => { if (!touched) u1.value = slug(`${$('[name=first_name]', m).value} ${$('[name=last_name]', m).value}`); };
      $('[name=first_name]', m).oninput = auto; $('[name=last_name]', m).oninput = auto;
    },
    actions: [
      { label: T('Annuler', 'Cancel'), run: (m) => m.close() },
      { label: T('Enregistrer', 'Save'), cls: 'btn-primary', run: async (m) => {
        const v = formValues(m.el);
        if (role === 'student' && !classes.length) throw new Error(T("Créez d'abord une classe (menu Structure).", 'Create a class first (Structure menu).'));
        if (isNew) {
          const r = await api('/admin/users', { method: 'POST', body: { ...v, role, class_id: Number(v.class_id) || undefined } });
          m.close();
          if (r.temp_password) showSecret({ title: T('Compte créé', 'Account created'), username: r.username, password: r.temp_password });
          else toast(T('Compte créé', 'Account created'), 'ok');
        } else {
          await api(`/admin/users/${u.id}`, { method: 'PUT', body: { ...v, class_id: Number(v.class_id) || undefined } });
          m.close(); toast(T('Modifications enregistrées', 'Changes saved'), 'ok');
        }
        done();
      } },
    ],
  });
}

async function kidsModal(parent, done) {
  const all = (await api('/admin/users?role=student')).items;
  const sel = new Set(parent.children.map((c) => c.id));
  openModal({
    title: T(`Enfants de ${parent.first_name} ${parent.last_name}`, `Children of ${parent.first_name} ${parent.last_name}`),
    wide: true,
    body: h`<div class="field"><input id="kfilter" placeholder="${T('Filtrer les élèves…', 'Filter students…')}"></div>
      <div id="klist" style="max-height:340px;overflow:auto">${all.map((s) => h`<label class="check" data-n="${(s.first_name + ' ' + s.last_name + ' ' + s.class_name).toLowerCase()}"><input type="checkbox" value="${s.student_id}" ${sel.has(s.student_id) ? 'checked' : ''}> ${s.last_name} ${s.first_name} <span class="muted small">— ${s.class_name}</span></label>`)}</div><div class="error-msg"></div>`,
    onOpen: (m) => {
      $('#kfilter', m).oninput = (e) => { const t = e.target.value.toLowerCase(); $$('#klist label', m).forEach((l) => { l.style.display = l.dataset.n.includes(t) ? '' : 'none'; }); };
    },
    actions: [
      { label: T('Annuler', 'Cancel'), run: (m) => m.close() },
      { label: T('Enregistrer', 'Save'), cls: 'btn-primary', run: async (m) => {
        const ids = $$('#klist input:checked', m.el).map((i) => Number(i.value));
        await api(`/admin/parents/${parent.id}/children`, { method: 'PUT', body: { student_ids: ids } });
        m.close(); toast(T('Rattachement enregistré', 'Links saved'), 'ok'); done();
      } },
    ],
  });
}

async function assignModal(teacher, done) {
  const [classes, subjects, cur] = await Promise.all([api('/admin/classes'), api('/admin/subjects'), api(`/admin/teachers/${teacher.id}/assignments`)]);
  if (!classes.items.length || !subjects.items.length) return toast(T("Créez d'abord des classes et des matières (menu Structure).", 'Create classes and subjects first (Structure menu).'), 'error');
  const rows = cur.items.map((a) => ({ class_id: a.class_id, subject_id: a.subject_id }));
  const draw = (box) => setHtml(box, h`${rows.map((r, i) => h`<div class="row"><div class="field"><select data-i="${i}" data-k="class_id">${classes.items.map((c) => h`<option value="${c.id}" ${c.id === r.class_id ? 'selected' : ''}>${c.name}</option>`)}</select></div>
    <div class="field"><select data-i="${i}" data-k="subject_id">${subjects.items.map((s) => h`<option value="${s.id}" ${s.id === r.subject_id ? 'selected' : ''}>${s.name}</option>`)}</select></div>
    <div class="field" style="flex:0 0 auto"><button class="btn btn-sm btn-danger" data-rm="${i}">✕</button></div></div>`)}
    <button class="btn btn-sm" data-add="1">＋ ${T('Ajouter une classe / matière', 'Add class / subject')}</button>`);
  openModal({
    title: T(`Attributions de ${teacher.first_name} ${teacher.last_name}`, `Assignments of ${teacher.first_name} ${teacher.last_name}`),
    wide: true,
    body: h`<div id="abox"></div><div class="error-msg"></div>`,
    onOpen: (m) => {
      const box = $('#abox', m); draw(box);
      box.onchange = (e) => { const i = e.target.dataset.i; if (i !== undefined) rows[i][e.target.dataset.k] = Number(e.target.value); };
      box.onclick = (e) => {
        if (e.target.dataset.rm !== undefined) { rows.splice(Number(e.target.dataset.rm), 1); draw(box); }
        if (e.target.dataset.add) { rows.push({ class_id: classes.items[0].id, subject_id: subjects.items[0].id }); draw(box); }
      };
    },
    actions: [
      { label: T('Annuler', 'Cancel'), run: (m) => m.close() },
      { label: T('Enregistrer', 'Save'), cls: 'btn-primary', run: async (m) => { await api(`/admin/teachers/${teacher.id}/assignments`, { method: 'PUT', body: { assignments: rows } }); m.close(); toast(T('Attributions enregistrées', 'Assignments saved'), 'ok'); done(); } },
    ],
  });
}

/* ---------- Structure : niveaux, séries, matières, classes ---------- */
async function structure(root) {
  const draw = async () => {
    const [lv, se, su, cl] = await Promise.all(['levels', 'series', 'subjects', 'classes'].map((k) => api('/admin/' + k)));
    const list = (kind, title, items) => h`<div class="card"><div class="row" style="justify-content:space-between;align-items:center"><h2>${title}</h2><button class="btn btn-sm btn-primary" data-act="add" data-kind="${kind}">＋</button></div>
      ${items.length ? items.map((i) => h`<div class="chap"><span class="t">${i.name}</span><button class="btn btn-sm" data-act="ren" data-kind="${kind}" data-id="${i.id}" data-name="${i.name}">✎</button><button class="btn btn-sm btn-danger" data-act="rm" data-kind="${kind}" data-id="${i.id}">🗑</button></div>`) : h`<div class="empty">—</div>`}</div>`;
    setHtml(root, h`${head(T("Structure de l'établissement", 'School structure'), !lv.items.length ? h`<button class="btn btn-gold" data-act="starter">✨ ${T('Charger un référentiel de départ', 'Load starter set')}</button>` : '')}
      <p class="muted">${T('Créez librement vos niveaux, séries, matières et classes : aucun nombre n\'est imposé.', 'Freely create your levels, streams, subjects and classes: no fixed numbers.')}</p>
      <div class="grid">${list('levels', T('Niveaux', 'Levels'), lv.items)}${list('series', T('Séries', 'Streams'), se.items)}${list('subjects', T('Matières', 'Subjects'), su.items)}</div>
      <div class="card mt"><div class="row" style="justify-content:space-between;align-items:center"><h2>${T('Classes', 'Classes')}</h2><button class="btn btn-sm btn-primary" data-act="addclass">＋ ${T('Nouvelle classe', 'New class')}</button></div>
        <div class="table-wrap"><table><thead><tr><th>${T('Classe', 'Class')}</th><th>${T('Niveau', 'Level')}</th><th>${T('Série', 'Stream')}</th><th class="num">${T('Élèves', 'Students')}</th><th></th></tr></thead><tbody>
        ${cl.items.map((c) => h`<tr><td><b>${c.name}</b></td><td>${c.level_name}</td><td>${c.series_name || '—'}</td><td class="num">${c.students}</td><td><div class="actions"><button class="btn btn-sm" data-act="editclass" data-id="${c.id}">✎</button><button class="btn btn-sm btn-danger" data-act="rmclass" data-id="${c.id}">🗑</button></div></td></tr>`)}</tbody></table></div>
        ${cl.items.length ? '' : h`<div class="empty">${T("Aucune classe. Créez d'abord au moins un niveau.", 'No classes yet. Create at least one level first.')}</div>`}</div>`);
    draw.state = { lv: lv.items, se: se.items, cl: cl.items };
  };
  const classModal = (c) => {
    const { lv, se } = draw.state;
    if (!lv.length) return toast(T("Créez d'abord un niveau.", 'Create a level first.'), 'error');
    openModal({
      title: c ? T('Modifier la classe', 'Edit class') : T('Nouvelle classe', 'New class'),
      body: h`<div class="field"><label>${T('Nom (ex : 6ème A)', 'Name (e.g. 6th A)')}</label><input name="name" value="${c ? c.name : ''}" maxlength="60"></div>
        <div class="field"><label>${T('Niveau', 'Level')}</label><select name="level_id">${lv.map((l) => h`<option value="${l.id}" ${c && c.level_id === l.id ? 'selected' : ''}>${l.name}</option>`)}</select></div>
        <div class="field"><label>${T('Série (facultatif)', 'Stream (optional)')}</label><select name="series_id"><option value="">—</option>${se.map((s) => h`<option value="${s.id}" ${c && c.series_id === s.id ? 'selected' : ''}>${s.name}</option>`)}</select></div><div class="error-msg"></div>`,
      actions: [{ label: T('Annuler', 'Cancel'), run: (m) => m.close() }, { label: T('Enregistrer', 'Save'), cls: 'btn-primary', run: async (m) => {
        const v = formValues(m.el);
        const body = { name: v.name, level_id: Number(v.level_id), series_id: v.series_id ? Number(v.series_id) : null };
        await api(c ? `/admin/classes/${c.id}` : '/admin/classes', { method: c ? 'PUT' : 'POST', body });
        m.close(); draw();
      } }],
    });
  };
  const LABEL = () => ({ levels: T('un niveau', 'a level'), series: T('une série', 'a stream'), subjects: T('une matière', 'a subject') });
  bind(root, {
    starter: async () => { await run(() => api('/admin/structure/starter', { method: 'POST' }), T('Référentiel chargé', 'Starter set loaded')); draw(); },
    add: async (el) => { const v = await promptDialog(T(`Ajouter ${LABEL()[el.dataset.kind]}`, `Add ${LABEL()[el.dataset.kind]}`), T('Nom', 'Name')); if (v) { await run(() => api('/admin/' + el.dataset.kind, { method: 'POST', body: { name: v } })); draw(); } },
    ren: async (el) => { const v = await promptDialog(T('Renommer', 'Rename'), T('Nom', 'Name'), el.dataset.name); if (v) { await run(() => api(`/admin/${el.dataset.kind}/${el.dataset.id}`, { method: 'PUT', body: { name: v } })); draw(); } },
    rm: async (el) => { if (await confirmDialog(T('Supprimer cet élément ?', 'Delete this item?'), { danger: true })) { await run(() => api(`/admin/${el.dataset.kind}/${el.dataset.id}`, { method: 'DELETE' })); draw(); } },
    addclass: () => classModal(null),
    editclass: (el) => classModal(draw.state.cl.find((c) => c.id === Number(el.dataset.id))),
    rmclass: async (el) => { if (await confirmDialog(T('Supprimer cette classe ?', 'Delete this class?'), { danger: true })) { await run(() => api(`/admin/classes/${el.dataset.id}`, { method: 'DELETE' })); draw(); } },
  });
  await draw();
}

/* ---------- Coefficients ---------- */
async function coefficients(root) {
  const [lv, se] = await Promise.all([api('/admin/levels'), api('/admin/series')]);
  if (!lv.items.length) return setHtml(root, h`${head(T('Coefficients', 'Coefficients'))}<div class="card empty">${T("Créez d'abord des niveaux et des matières (menu Structure).", 'Create levels and subjects first (Structure menu).')}</div>`);
  setHtml(root, h`${head(T('Coefficients par niveau / série', 'Coefficients by level / stream'))}
    <div class="notice info">${T("Les coefficients s'appliquent automatiquement à TOUTES les classes du niveau. Si vous définissez des coefficients pour une série, ils remplacent ceux du niveau pour les classes de cette série. Laissez vide pour ne pas compter la matière.", 'Coefficients apply automatically to ALL classes of the level. If you set coefficients for a stream, they replace the level ones for that stream. Leave blank to exclude a subject.')}</div>
    <div class="card"><div class="row"><div class="field"><label>${T('Niveau', 'Level')}</label><select id="lvl">${lv.items.map((l) => h`<option value="${l.id}">${l.name}</option>`)}</select></div>
      <div class="field"><label>${T('Série', 'Stream')}</label><select id="ser"><option value="">${T('— Toutes (règle du niveau) —', '— All (level rule) —')}</option>${se.items.map((s) => h`<option value="${s.id}">${s.name}</option>`)}</select></div></div>
    <div id="matrix"></div></div>`);
  const load = async () => {
    const d = await api('/admin/coefficients' + qs({ level_id: $('#lvl', root).value, series_id: $('#ser', root).value }));
    setHtml($('#matrix', root), h`<div class="table-wrap"><table><thead><tr><th>${T('Matière', 'Subject')}</th><th class="num">Coef</th></tr></thead><tbody>
      ${d.items.map((s) => h`<tr><td>${s.name}</td><td class="num"><input style="width:80px;text-align:center" inputmode="decimal" data-sid="${s.subject_id}" value="${s.coef ?? ''}"></td></tr>`)}</tbody></table></div>
      ${d.items.length ? '' : h`<div class="empty">${T("Créez d'abord des matières.", 'Create subjects first.')}</div>`}
      <div class="actions mt"><button class="btn btn-primary" data-act="save">💾 ${T('Enregistrer', 'Save')}</button></div>`);
  };
  bind($('#matrix', root), {
    save: () => run(async () => {
      const items = $$('input[data-sid]', root).map((i) => ({ subject_id: Number(i.dataset.sid), coef: i.value.trim() === '' ? null : Number(i.value.replace(',', '.')) }));
      await api('/admin/coefficients', { method: 'PUT', body: { level_id: Number($('#lvl', root).value), series_id: $('#ser', root).value ? Number($('#ser', root).value) : null, items } });
    }, T('Coefficients enregistrés', 'Coefficients saved')),
  });
  $('#lvl', root).onchange = () => load().catch(errToast);
  $('#ser', root).onchange = () => load().catch(errToast);
  await load();
}

/* ---------- Périodes ---------- */
async function terms(root) {
  const draw = async () => {
    const d = await api('/admin/terms');
    const hasOpen = d.items.some((t) => t.status === 'open');
    const ST = { open: ['green', T('En cours', 'Open')], closed: ['gray', T('Clôturée 🔒', 'Closed 🔒')], upcoming: ['blue', T('À venir', 'Upcoming')] };
    setHtml(root, h`${head(T('Périodes (trimestres)', 'Terms'), h`<button class="btn btn-primary" data-act="add">＋ ${T('Nouvelle période', 'New term')}</button>`)}
      <div class="notice info">${T("La clôture d'une période gèle définitivement ses notes et ouvre automatiquement la période suivante.", "Closing a term permanently freezes its grades and automatically opens the next one.")}</div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>${T('Période', 'Term')}</th><th>${T('Statut', 'Status')}</th><th></th></tr></thead><tbody>
      ${d.items.map((t) => h`<tr><td><b>${t.name}</b></td><td>${badge(ST[t.status][0], ST[t.status][1])}</td><td>
        ${t.status === 'open' ? h`<button class="btn btn-sm btn-danger" data-act="close" data-id="${t.id}" data-name="${t.name}">${T('Clôturer', 'Close')}</button>` : ''}
        ${t.status === 'upcoming' && !hasOpen ? h`<button class="btn btn-sm btn-primary" data-act="open" data-id="${t.id}">${T('Ouvrir', 'Open')}</button>` : ''}</td></tr>`)}</tbody></table></div></div>`);
  };
  bind(root, {
    add: async () => { const v = await promptDialog(T('Nouvelle période', 'New term'), T('Nom (ex : Trimestre 4)', 'Name (e.g. Term 4)')); if (v) { await run(() => api('/admin/terms', { method: 'POST', body: { name: v } })); draw(); } },
    open: async (el) => { await run(() => api(`/admin/terms/${el.dataset.id}/open`, { method: 'POST' })); draw(); },
    close: async (el) => {
      if (!(await confirmDialog(T(`Clôturer « ${el.dataset.name} » ? Les notes seront gelées et la période suivante s'ouvrira. Cette action est définitive.`, `Close “${el.dataset.name}”? Grades will be frozen and the next term will open. This cannot be undone.`), { danger: true, okLabel: T('Clôturer', 'Close') }))) return;
      const r = await run(() => api(`/admin/terms/${el.dataset.id}/close`, { method: 'POST' }));
      if (r) toast(r.next ? T(`Période clôturée. « ${r.next} » est ouverte.`, `Term closed. “${r.next}” is now open.`) : T('Période clôturée.', 'Term closed.'), 'ok');
      draw();
    },
  });
  await draw();
}

/* ---------- Suivi : justificatifs, absences, discipline ---------- */
async function monitoring(root) {
  let tab = 'just';
  let jstatus = 'pending';
  const classes = (await api('/admin/classes')).items;
  let cls = '';
  let kind = '';
  let date = '';
  const draw = async () => {
    let content = '';
    if (tab === 'just') {
      const d = await api('/admin/justifications' + qs({ status: jstatus }));
      content = h`<div class="tabs">${['pending', 'approved', 'rejected'].map((s) => h`<button class="tab ${s === jstatus ? 'active' : ''}" data-act="jst" data-s="${s}">${{ pending: T('En attente', 'Pending'), approved: T('Validés', 'Approved'), rejected: T('Refusés', 'Rejected') }[s]}</button>`)}</div>
        ${d.items.length ? d.items.map((j) => h`<div class="list-item"><div class="row" style="justify-content:space-between;align-items:center"><div><b>${j.student_name}</b> <span class="muted small">— ${j.class_name} · ${j.subject_name} · ${fmtDate(j.date)}</span><div>${j.reason}</div>
          ${j.has_file ? h`<a class="small" href="/api/files/justifications/${j.id}">📎 ${j.original_name}</a>` : ''}</div>
          ${jstatus === 'pending' ? h`<div class="actions"><button class="btn btn-sm btn-primary" data-act="rev" data-id="${j.id}" data-d="approved">✔ ${T('Valider', 'Approve')}</button><button class="btn btn-sm btn-danger" data-act="rev" data-id="${j.id}" data-d="rejected">✕ ${T('Refuser', 'Reject')}</button></div>` : ''}</div></div>`) : h`<div class="empty">${T('Aucun justificatif.', 'No justifications.')}</div>`}`;
    } else if (tab === 'abs') {
      const d = await api('/admin/absences' + qs({ class_id: cls, date }));
      content = h`<div class="row"><div class="field"><select data-change="fcls">${classOpts(classes, cls)}</select></div><div class="field"><input type="date" data-change="fdate" value="${date}"></div></div>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th>${T('Élève', 'Student')}</th><th>${T('Classe', 'Class')}</th><th>${T('Matière', 'Subject')}</th><th>${T('Statut', 'Status')}</th></tr></thead><tbody>
        ${d.items.map((a) => h`<tr><td>${fmtDate(a.date)}</td><td>${a.student_name}</td><td>${a.class_name}</td><td>${a.subject_name}</td><td>${a.status === 'absent' ? badge(a.justified ? 'green' : 'red', a.justified ? T('Absent (justifié)', 'Absent (justified)') : T('Absent', 'Absent')) : badge('gold', T('Retard', 'Late'))}</td></tr>`)}</tbody></table></div>${d.items.length ? '' : h`<div class="empty">—</div>`}`;
    } else {
      const d = await api('/admin/discipline' + qs({ class_id: cls, kind }));
      content = h`<div class="row"><div class="field"><select data-change="fcls">${classOpts(classes, cls)}</select></div><div class="field"><select data-change="fkind"><option value="">${T('Tous types', 'All types')}</option><option value="positive" ${kind === 'positive' ? 'selected' : ''}>${T('Positifs', 'Positive')}</option><option value="negative" ${kind === 'negative' ? 'selected' : ''}>${T('Négatifs', 'Negative')}</option></select></div></div>
        ${d.items.length ? d.items.map((x) => h`<div class="list-item">${badge(x.kind === 'positive' ? 'green' : 'red', x.kind === 'positive' ? T('Positif', 'Positive') : T('Négatif', 'Negative'))} <b>${x.student_name}</b> <span class="muted small">— ${x.class_name} · ${fmtDate(x.date)}${x.teacher_name ? ' · ' + x.teacher_name : ''}</span><div>${x.description}</div></div>`) : h`<div class="empty">—</div>`}`;
    }
    setHtml(root, h`${head(T('Suivi & discipline', 'Monitoring & discipline'))}
      <div class="tabs">${[['just', T('Justificatifs', 'Justifications')], ['abs', T('Absences', 'Absences')], ['disc', T('Discipline', 'Discipline')]].map(([k, l]) => h`<button class="tab ${k === tab ? 'active' : ''}" data-act="tab" data-k="${k}">${l}</button>`)}</div>
      <div class="card">${content}</div>`);
  };
  const classOpts = (list, cur) => h`<option value="">${T('Toutes les classes', 'All classes')}</option>${list.map((c) => h`<option value="${c.id}" ${String(c.id) === String(cur) ? 'selected' : ''}>${c.name}</option>`)}`;
  bind(root, {
    tab: (el) => { tab = el.dataset.k; draw().catch(errToast); },
    jst: (el) => { jstatus = el.dataset.s; draw().catch(errToast); },
    rev: async (el) => { await run(() => api(`/admin/justifications/${el.dataset.id}/review`, { method: 'POST', body: { decision: el.dataset.d } }), T('Décision enregistrée', 'Decision saved')); draw(); },
    fcls: (el) => { cls = el.value; draw().catch(errToast); },
    fkind: (el) => { kind = el.value; draw().catch(errToast); },
    fdate: (el) => { date = el.value; draw().catch(errToast); },
  });
  await draw();
}

/* ---------- Actualités & événements ---------- */
const MAX_IMG = 6;
async function announcements(root) {
  const draw = async () => {
    const d = await api('/admin/announcements');
    announcements.data = d.items;
    setHtml(root, h`${head(T('Actualités & événements', 'News & events'), h`<button class="btn btn-primary" data-act="new">＋ ${T('Nouvelle publication', 'New post')}</button>`)}
      <div class="notice info">${T("Les publications « Public » apparaissent sur la page de votre établissement (visible sans connexion) : ", 'Posts marked “Public” appear on your school page (visible without signing in): ')}<b>${location.origin}/e/${(await api('/admin/settings')).code}</b><br>${T('Les publications « Membres » sont réservées aux parents, élèves et professeurs connectés.', 'Posts marked “Members only” are reserved for signed-in parents, students and teachers.')}</div>
      ${d.items.length ? d.items.map((a) => newsCard(a, { adminActions: true, img: (x, id) => `/api/news/${x.id}/image/${id}` })) : h`<div class="card empty">${T("Aucune publication. Cliquez sur « Nouvelle publication » pour informer les parents d'un événement ou d'une information utile.", 'No posts yet. Click “New post” to inform parents about an event or useful information.')}</div>`}`);
  };
  const modal = (a) => openModal({
    title: a ? T('Modifier la publication', 'Edit post') : T('Nouvelle publication', 'New post'),
    wide: true,
    body: h`<div class="field"><label>${T('Titre', 'Title')}</label><input name="title" maxlength="150" value="${a ? a.title : ''}"></div>
      <div class="row"><div class="field"><label>${T('Type', 'Type')}</label><select name="category">${Object.entries(CATEGORIES()).map(([k, [, l]]) => h`<option value="${k}" ${a && a.category === k ? 'selected' : ''}>${l}</option>`)}</select></div>
        <div class="field"><label>${T('Visible par', 'Visible to')}</label><select name="audience"><option value="public" ${a && a.audience === 'public' ? 'selected' : ''}>${T('Tout le monde (site public)', 'Everyone (public site)')}</option><option value="members" ${!a || a.audience === 'members' ? 'selected' : ''}>${T('Membres connectés uniquement', 'Signed-in members only')}</option></select></div>
        <div class="field"><label>${T("Date de l'événement (facultatif)", 'Event date (optional)')}</label><input type="date" name="event_date" value="${a && a.event_date ? a.event_date : ''}"></div></div>
      <div class="field"><label>${T('Contenu', 'Content')}</label><textarea name="body" maxlength="5000" style="min-height:160px">${a ? a.body : ''}</textarea></div>
      <div class="field"><label>${T(`Images (facultatif — jusqu'à ${MAX_IMG}, JPG, PNG ou WebP ; les photos sont réduites automatiquement)`, `Images (optional — up to ${MAX_IMG}, JPG, PNG or WebP; photos are resized automatically)`)}</label>
        ${a && a.images.length ? h`<div class="thumbs">${a.images.map((id) => h`<label class="thumb"><img alt="" src="/api/news/${a.id}/image/${id}"><span class="check"><input type="checkbox" data-rm="${id}"> ${T('Retirer', 'Remove')}</span></label>`)}</div>` : ''}
        <input type="file" name="images" multiple accept="image/jpeg,image/png,image/webp">
        <div class="thumbs mt" id="newthumbs"></div></div>
      <label class="check"><input type="checkbox" name="pinned" ${a && a.pinned ? 'checked' : ''}> 📌 ${T('Épingler en haut de la liste', 'Pin to the top')}</label><div class="error-msg"></div>`,
    onOpen: (m) => {
      $('[name=images]', m).onchange = (e) => {
        setHtml($('#newthumbs', m), h`${[...e.target.files].map((f) => h`<div class="thumb"><img alt="" src="${URL.createObjectURL(f)}"></div>`)}`);
      };
    },
    actions: [
      { label: T('Annuler', 'Cancel'), run: (m) => m.close() },
      { label: T('Publier', 'Publish'), cls: 'btn-primary', run: async (m) => {
        const v = formValues(m.el);
        const fd = new FormData();
        ['title', 'category', 'audience', 'body'].forEach((k) => fd.append(k, v[k]));
        if (v.event_date) fd.append('event_date', v.event_date);
        fd.append('pinned', v.pinned ? '1' : '0');
        const removeIds = $$('[data-rm]:checked', m.el).map((c) => Number(c.dataset.rm));
        const files = [...$('[name=images]', m.el).files];
        const kept = (a ? a.images.length : 0) - removeIds.length;
        if (kept + files.length > MAX_IMG) throw new Error(T(`${MAX_IMG} images maximum par publication (il y en a déjà ${kept}).`, `${MAX_IMG} images maximum per post (${kept} already kept).`));
        for (const f of files) { const img = await shrinkImage(f); fd.append('images', img.blob, img.name); }
        if (removeIds.length) fd.append('remove_images', JSON.stringify(removeIds));
        await api(a ? `/admin/announcements/${a.id}` : '/admin/announcements', { method: a ? 'PUT' : 'POST', form: fd });
        m.close(); toast(T('Publication enregistrée', 'Post saved'), 'ok'); draw();
      } },
    ],
  });
  bind(root, {
    new: () => modal(null),
    edit: (el) => modal(announcements.data.find((x) => x.id === Number(el.dataset.id))),
    del: async (el) => { if (await confirmDialog(T('Supprimer cette publication ?', 'Delete this post?'), { danger: true })) { await run(() => api(`/admin/announcements/${el.dataset.id}`, { method: 'DELETE' })); draw(); } },
  });
  await draw();
}

/* ---------- Paramètres ---------- */
async function settings(root) {
  const s = await api('/admin/settings');
  setHtml(root, h`${head(T('Paramètres', 'Settings'))}
    <div class="card" style="max-width:640px"><div class="field"><label>${T("Nom de l'établissement", 'School name')}</label><input name="name" value="${s.name}"></div>
      <div class="row"><div class="field"><label>${T('Ville', 'City')}</label><input name="city" value="${s.city}"></div><div class="field"><label>${T('Année scolaire', 'School year')}</label><input name="academic_year" value="${s.academic_year}" placeholder="2026-2027"></div></div>
      <h3 class="mt">${T('Page publique de l\'établissement', 'Public school page')}</h3>
      <div class="field"><label>${T('Présentation (quelques lignes)', 'Presentation (a few lines)')}</label><textarea name="description" maxlength="2000">${s.description}</textarea></div>
      <div class="row"><div class="field"><label>${T('Adresse', 'Address')}</label><input name="address" maxlength="200" value="${s.address}"></div><div class="field"><label>${T('Téléphone', 'Phone')}</label><input name="phone" maxlength="60" value="${s.phone}"></div></div>
      <div class="row"><div class="field"><label>${T('Email de contact', 'Contact email')}</label><input name="contact_email" type="email" value="${s.contact_email}"></div><div class="field"><label>${T('Horaires', 'Opening hours')}</label><input name="hours" maxlength="200" value="${s.hours}" placeholder="Lun–Ven 7h30–17h30"></div></div>
      <h3 class="mt">${T('Bulletins', 'Report cards')}</h3>
      <div class="field"><label>${T('Moyenne minimale pour que les parents téléchargent le bulletin (sur 20)', 'Minimum average for parents to download the report card (out of 20)')}</label><input name="parent_bulletin_min_avg" type="number" min="0" max="20" step="0.5" value="${s.parent_bulletin_min_avg}"></div>
      <div class="notice info">${T("Code de connexion de l'établissement :", 'School login code:')} <b>${s.code}</b><br>${T('Lien direct :', 'Direct link:')} <b>${location.origin}/e/${s.code}</b> (${T('page publique', 'public page')}) · <b>${location.origin}/e/${s.code}/connexion</b> (${T('connexion', 'sign in')})</div>
      <div class="error-msg"></div><button class="btn btn-primary" data-act="save">💾 ${T('Enregistrer', 'Save')}</button></div>`);
  bind(root, { save: () => run(() => api('/admin/settings', { method: 'PUT', body: formValues(root) }), T('Paramètres enregistrés', 'Settings saved')) });
}

export default {
  nav: [
    { key: 'dashboard', icon: '📊', fr: "Vue d'ensemble", en: 'Overview' },
    { key: 'users', icon: '👥', fr: 'Utilisateurs', en: 'Users' },
    { key: 'structure', icon: '🏫', fr: 'Structure', en: 'Structure' },
    { key: 'coefficients', icon: '⚖️', fr: 'Coefficients', en: 'Coefficients' },
    { key: 'terms', icon: '📅', fr: 'Périodes', en: 'Terms' },
    { key: 'monitoring', icon: '🛡️', fr: 'Suivi & discipline', en: 'Monitoring' },
    { key: 'announcements', icon: '📣', fr: 'Actualités', en: 'News' },
    { key: 'settings', icon: '⚙️', fr: 'Paramètres', en: 'Settings' },
  ],
  views: { dashboard, users, structure, coefficients, terms, monitoring, announcements, settings },
};
