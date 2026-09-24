import { api, T, applyI18n, $ } from './common.js';

applyI18n();
document.addEventListener('langchange', () => applyI18n());

const fromPath = /^\/e\/([^/]+)/.exec(location.pathname);
const code = (fromPath ? decodeURIComponent(fromPath[1]) : new URLSearchParams(location.search).get('school') || '').toLowerCase();

async function init() {
  if (code) {
    try {
      const s = await api('/public/school/' + encodeURIComponent(code), { noRedirect: true });
      $('#school-name').textContent = s.name + (s.city ? ' — ' + s.city : '');
      $('#school-line').classList.remove('hidden');
      document.title = s.name + ' — ' + T('Connexion', 'Sign in');
      $('#code').value = s.code;
      $('#code-field').classList.add('hidden');
      $('#forgot').href = '/reset.html?school=' + encodeURIComponent(s.code);
      $('#back').href = '/e/' + encodeURIComponent(s.code);
      $('#back').dataset.fr = "← Page de l'établissement";
      $('#back').dataset.en = '← School page';
      applyI18n();
    } catch (e) {
      $('#err').textContent = T("Établissement introuvable. Saisissez le code fourni par votre établissement.", 'School not found. Enter the code given by your school.');
    }
  }
}
init();

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#err').textContent = '';
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  try {
    const r = await api('/auth/login', {
      method: 'POST',
      noRedirect: true,
      body: { school_code: $('#code').value.trim().toLowerCase(), username: $('#username').value.trim(), password: $('#password').value },
    });
    location.href = r.user.role === 'superadmin' ? '/platform.html' : '/app.html';
  } catch (err) {
    $('#err').textContent = err.message;
    btn.disabled = false;
  }
});
