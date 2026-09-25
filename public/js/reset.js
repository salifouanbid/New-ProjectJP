import { api, T, applyI18n, $ } from './common.js';

applyI18n();
document.addEventListener('langchange', () => applyI18n());

const params = new URLSearchParams(location.search);
const token = params.get('token');
const done = (title, text) => {
  $('#forgot-form').classList.add('hidden');
  $('#reset-form').classList.add('hidden');
  $('#done').classList.remove('hidden');
  $('#done-title').textContent = title;
  $('#done-text').textContent = text;
};

if (token) $('#reset-form').classList.remove('hidden');
else { $('#forgot-form').classList.remove('hidden'); $('#code').value = params.get('school') || ''; }

$('#forgot-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/auth/forgot', { method: 'POST', noRedirect: true, body: { school_code: $('#code').value.trim().toLowerCase(), identifier: $('#ident').value.trim() } });
    done(T('Demande envoyée', 'Request sent'), T("Si un compte correspond et possède un email, un lien de réinitialisation vient d'être envoyé.", 'If a matching account has an email, a reset link has just been sent.'));
  } catch (err) { $('#err1').textContent = err.message; }
});

$('#reset-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if ($('#pw1').value !== $('#pw2').value) { $('#err2').textContent = T('Les mots de passe ne correspondent pas', 'Passwords do not match'); return; }
  try {
    await api('/auth/reset', { method: 'POST', noRedirect: true, body: { token, password: $('#pw1').value } });
    done(T('Mot de passe modifié', 'Password updated'), T('Vous pouvez maintenant vous connecter.', 'You can now sign in.'));
  } catch (err) { $('#err2').textContent = err.message; }
});
