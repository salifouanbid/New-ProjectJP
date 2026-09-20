import { api, T, applyI18n, $ } from './common.js';

applyI18n();
document.addEventListener('langchange', () => applyI18n());

$('#code-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = $('#code').value.trim().toLowerCase();
  $('#msg').textContent = '';
  try {
    const s = await api('/public/school/' + encodeURIComponent(code), { noRedirect: true });
    location.href = '/e/' + encodeURIComponent(s.code);
  } catch (err) {
    $('#msg').textContent = err.status === 404 ? T("Code introuvable. Vérifiez auprès de votre établissement.", 'Code not found. Please check with your school.') : err.message;
  }
});

api('/auth/me', { noRedirect: true }).then((r) => {
  if (r.user) {
    $('#continue').classList.remove('hidden');
    $('#continue-link').href = r.user.role === 'superadmin' ? '/platform.html' : '/app.html';
  }
}).catch(() => {});
