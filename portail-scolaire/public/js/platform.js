// Espace propriétaire de la plateforme : créer et gérer les établissements (collèges, lycées…).
import { api, T, h, setHtml, bind, applyI18n, openModal, confirmDialog, formValues, toast, errToast, showSecret, badge, fmtDate, $ } from './common.js';

const root = $('#root');
applyI18n();

function loginView() {
  $('#logout').classList.add('hidden');
  setHtml(root, h`<div class="card auth-card" style="margin:2rem auto"><h1 class="center">${T('Espace plateforme', 'Platform area')}</h1>
    <p class="muted center">${T('Réservé au propriétaire du logiciel.', 'Reserved for the software owner.')}</p>
    <form id="f"><div class="field"><label>${T('Identifiant', 'Username')}</label><input name="username" autocomplete="username" required></div>
    <div class="field"><label>${T('Mot de passe', 'Password')}</label><input name="password" type="password" autocomplete="current-password" required></div>
    <div class="error-msg" id="e"></div><button class="btn btn-primary btn-block">${T('Se connecter', 'Sign in')}</button></form></div>`);
  $('#f').onsubmit = async (ev) => {
    ev.preventDefault();
    try {
      await api('/auth/login', { method: 'POST', noRedirect: true, body: { school_code: '', ...formValues(ev.target) } });
      start();
    } catch (err) { $('#e').textContent = err.message; }
  };
}

function forcePassword() {
  openModal({
    title: T('Choisissez un nouveau mot de passe', 'Choose a new password'), closable: false,
    body: h`<div class="notice">${T('Pour votre sécurité, remplacez le mot de passe provisoire.', 'For your security, replace the temporary password.')}</div>
      <div class="field"><label>${T('Mot de passe actuel', 'Current password')}</label><input name="cur" type="password"></div>
      <div class="field"><label>${T('Nouveau mot de passe (8 caractères minimum)', 'New password (min. 8 characters)')}</label><input name="nw" type="password"></div><div class="error-msg"></div>`,
    actions: [{ label: T('Enregistrer', 'Save'), cls: 'btn-primary', run: async (m) => {
      const v = formValues(m.el);
      await api('/auth/change-password', { method: 'POST', body: { current_password: v.cur, new_password: v.nw } });
      m.close(); start();
    } }],
  });
}

async function schoolsView() {
  $('#logout').classList.remove('hidden');
  const d = await api('/platform/schools');
  setHtml(root, h`<div class="page-head"><h1>${T('Établissements', 'Schools')} <span class="muted small">(${d.schools.length})</span></h1><button class="btn btn-primary" data-act="new">＋ ${T('Nouvel établissement', 'New school')}</button></div>
    <div class="notice info">${T("Chaque établissement dispose de son propre espace isolé. Ses utilisateurs se connectent avec le code de l'établissement, leur identifiant et leur mot de passe.", 'Each school has its own isolated space. Its users sign in with the school code, their username and password.')}</div>
    <div class="card"><div class="table-wrap"><table><thead><tr><th>${T('Établissement', 'School')}</th><th>Code</th><th class="num">${T('Élèves', 'Students')}</th><th class="num">${T('Profs', 'Teachers')}</th><th class="num">${T('Parents', 'Parents')}</th><th>${T('Statut', 'Status')}</th><th></th></tr></thead><tbody>
    ${d.schools.map((s) => h`<tr><td><b>${s.name}</b><div class="muted small">${s.city || ''} · ${fmtDate(s.created_at)}</div></td><td><a href="/e/${s.code}" target="_blank">${s.code}</a></td><td class="num">${s.students}</td><td class="num">${s.teachers}</td><td class="num">${s.parents}</td>
      <td>${s.active ? badge('green', T('Actif', 'Active')) : badge('red', T('Suspendu', 'Suspended'))}</td>
      <td><div class="actions"><button class="btn btn-sm" data-act="reset" data-id="${s.id}" data-name="${s.name}">🔑 ${T('Admin', 'Admin')}</button><button class="btn btn-sm ${s.active ? 'btn-danger' : 'btn-primary'}" data-act="toggle" data-id="${s.id}" data-active="${s.active}" data-name="${s.name}">${s.active ? T('Suspendre', 'Suspend') : T('Réactiver', 'Reactivate')}</button></div></td></tr>`)}</tbody></table></div>
    ${d.schools.length ? '' : h`<div class="empty">${T('Aucun établissement.', 'No schools yet.')}</div>`}</div>`);
  bind(root, {
    new: () => openModal({
      title: T('Nouvel établissement', 'New school'), wide: true,
      body: h`<div class="row"><div class="field"><label>${T("Nom de l'établissement", 'School name')}</label><input name="name" placeholder="Collège Jean Piaget 1"></div><div class="field"><label>${T('Ville', 'City')}</label><input name="city"></div></div>
        <div class="row"><div class="field"><label>${T("Code de connexion (minuscules, chiffres, tirets)", 'Login code (lowercase, digits, dashes)')}</label><input name="code" placeholder="jean-piaget-1" autocapitalize="none"></div><div class="field"><label>${T('Année scolaire', 'School year')}</label><input name="academic_year" placeholder="2026-2027"></div></div>
        <h3 class="mt">${T('Compte du directeur / administrateur', 'Head / administrator account')}</h3>
        <div class="row"><div class="field"><label>${T('Prénom', 'First name')}</label><input name="admin_first_name"></div><div class="field"><label>${T('Nom', 'Last name')}</label><input name="admin_last_name"></div></div>
        <div class="row"><div class="field"><label>${T('Identifiant', 'Username')}</label><input name="admin_username" placeholder="directeur" autocapitalize="none"></div><div class="field"><label>Email</label><input name="admin_email" type="email"></div></div>
        <div class="field"><label>${T('Mot de passe (vide = généré)', 'Password (empty = generated)')}</label><input name="admin_password" autocomplete="off"></div><div class="error-msg"></div>`,
      actions: [{ label: T('Annuler', 'Cancel'), run: (m) => m.close() }, { label: T('Créer', 'Create'), cls: 'btn-primary', run: async (m) => {
        const r = await api('/platform/schools', { method: 'POST', body: formValues(m.el) });
        m.close();
        if (r.temp_password) showSecret({ title: T('Établissement créé', 'School created'), username: r.admin_username, password: r.temp_password });
        else toast(T('Établissement créé', 'School created'), 'ok');
        schoolsView();
      } }],
    }),
    toggle: async (el) => {
      const on = el.dataset.active === '1';
      if (!(await confirmDialog(on ? T(`Suspendre « ${el.dataset.name} » ? Ses utilisateurs ne pourront plus se connecter.`, `Suspend “${el.dataset.name}”? Its users will no longer be able to sign in.`) : T(`Réactiver « ${el.dataset.name} » ?`, `Reactivate “${el.dataset.name}”?`), { danger: on }))) return;
      try { await api(`/platform/schools/${el.dataset.id}`, { method: 'PATCH', body: { active: !on } }); schoolsView(); } catch (e) { errToast(e); }
    },
    reset: async (el) => {
      if (!(await confirmDialog(T(`Générer un nouveau mot de passe pour l'administrateur de « ${el.dataset.name} » ?`, `Generate a new password for the administrator of “${el.dataset.name}”?`)))) return;
      try { const r = await api(`/platform/schools/${el.dataset.id}/reset-admin`, { method: 'POST' }); showSecret({ title: T('Nouveau mot de passe', 'New password'), username: r.username, password: r.temp_password }); } catch (e) { errToast(e); }
    },
  });
}

async function start() {
  let me;
  try { me = await api('/auth/me', { noRedirect: true }); } catch (e) { return loginView(); }
  if (me.user.role !== 'superadmin') return loginView();
  $('#logout').classList.remove('hidden');
  if (me.user.must_change_password) return forcePassword();
  schoolsView().catch(errToast);
}

$('#logout').onclick = async () => { await api('/auth/logout', { method: 'POST', noRedirect: true }).catch(() => {}); location.href = '/'; };
document.addEventListener('langchange', () => { applyI18n(); start(); });
start();
