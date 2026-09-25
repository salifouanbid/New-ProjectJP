import { api, T, h, setHtml, $ } from '../common.js';
import * as S from './shared.js';

// Le parent choisit l'enfant ; chaque vue s'affiche pour l'enfant sélectionné.
async function withChild(root, render) {
  const { items } = await api('/parent/children');
  if (!items.length) {
    setHtml(root, h`<div class="card empty">${T("Aucun enfant n'est rattaché à votre compte. Contactez la direction de l'établissement.", 'No child is linked to your account. Please contact the school administration.')}</div>`);
    return;
  }
  let cur = parseInt(sessionStorage.getItem('child'), 10);
  if (!items.some((i) => i.id === cur)) cur = items[0].id;
  setHtml(root, h`${items.length > 1 ? h`<div class="card mb"><div class="row"><div class="field"><label>${T('Enfant', 'Child')}</label>
      <select id="child">${items.map((c) => h`<option value="${c.id}" ${c.id === cur ? 'selected' : ''}>${c.first_name} ${c.last_name} — ${c.class_name}</option>`)}</select></div></div></div>` : ''}<div id="child-view"></div>`);
  const inner = $('#child-view', root);
  const show = () => render(inner, `/parent/children/${cur}`).catch((e) => setHtml(inner, h`<div class="notice">${e.message}</div>`));
  const sel = $('#child', root);
  if (sel) sel.onchange = (e) => { cur = parseInt(e.target.value, 10); sessionStorage.setItem('child', cur); show(); };
  await show();
}

export default {
  nav: [
    { key: 'dashboard', icon: '📊', fr: 'Tableau de bord', en: 'Dashboard' },
    { key: 'grades', icon: '📝', fr: 'Notes', en: 'Grades' },
    { key: 'attendance', icon: '🗓️', fr: 'Assiduité', en: 'Attendance' },
    { key: 'programme', icon: '📚', fr: 'Programme', en: 'Curriculum' },
    { key: 'news', icon: '📣', fr: 'Actualités', en: 'News' },
  ],
  views: {
    dashboard: (root) => withChild(root, (r, base) => S.dashboardView(r, base)),
    grades: (root) => withChild(root, (r, base) => S.gradesView(r, base)),
    attendance: (root) => withChild(root, (r, base) => S.attendanceView(r, base, { canJustify: true })),
    programme: (root) => withChild(root, (r, base) => S.programmeView(r, base)),
    news: (root) => S.newsView(root),
  },
};
