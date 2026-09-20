// Site vitrine public d'un établissement : présentation, actualités, événements, contact.
import { api, T, h, setHtml, applyI18n, newsCard, eventsList, $ } from './common.js';

const m = /^\/e\/([^/]+)/.exec(location.pathname);
const code = m ? decodeURIComponent(m[1]).toLowerCase() : '';
let school = null;

async function draw() {
  applyI18n();
  $('#login-btn').href = `/e/${encodeURIComponent(code)}/connexion`;
  if (!school) {
    setHtml($('#hero'), h`<h1>${T('Établissement introuvable', 'School not found')}</h1><p class="muted">${T('Vérifiez le lien ou le code fourni par votre établissement.', 'Check the link or the code given by your school.')}</p><a class="btn btn-primary" href="/">${T("Retour à l'accueil", 'Back to home')}</a>`);
    $('#login-btn').classList.add('hidden');
    return;
  }
  const feed = await api(`/public/school/${encodeURIComponent(code)}/news`, { noRedirect: true }).catch(() => ({ news: [], events: [] }));
  $('#hname').textContent = school.name;
  $('#hcity').textContent = [school.city, school.academic_year].filter(Boolean).join(' · ');
  $('#logo').textContent = school.name.slice(0, 2).toUpperCase();
  document.title = school.name;
  setHtml($('#hero'), h`<h1><span>${school.name}</span></h1>
    ${school.description ? h`<p class="lead muted prewrap">${school.description}</p>` : ''}
    <div class="actions" style="justify-content:center"><a class="btn btn-primary" href="/e/${encodeURIComponent(code)}/connexion">${T('Se connecter (parents, élèves, professeurs)', 'Sign in (parents, students, teachers)')}</a></div>`);
  setHtml($('#news'), h`<h2>${T('Actualités', 'News')}</h2>${feed.news.length ? feed.news.map((a) => newsCard(a, { img: (x, id) => `/api/public/school/${encodeURIComponent(code)}/news/${x.id}/image/${id}` })) : h`<div class="card empty">${T("Aucune actualité pour le moment. Revenez bientôt !", 'No news yet. Check back soon!')}</div>`}`);
  const hasContact = school.address || school.phone || school.email || school.hours;
  setHtml($('#side'), h`<div class="card"><h2>📅 ${T('Prochains événements', 'Upcoming events')}</h2>${eventsList(feed.events)}</div>
    ${hasContact ? h`<div class="card"><h2>${T('Nous contacter', 'Contact us')}</h2>
      ${school.address ? h`<div class="list-item">📍 ${school.address}</div>` : ''}
      ${school.phone ? h`<div class="list-item">📞 ${school.phone}</div>` : ''}
      ${school.email ? h`<div class="list-item">✉️ ${school.email}</div>` : ''}
      ${school.hours ? h`<div class="list-item">🕗 ${school.hours}</div>` : ''}</div>` : ''}`);
}

(async () => {
  try { school = await api(`/public/school/${encodeURIComponent(code)}`, { noRedirect: true }); } catch (e) { school = null; }
  await draw();
})();
document.addEventListener('langchange', () => draw());
