import { api, T, h, setHtml, applyI18n, $, $$ } from './common.js';

/* ==========================================================================
   RÉGLAGES À PERSONNALISER — tout est ici, en un seul endroit.
   ========================================================================== */
// Ton numéro WhatsApp professionnel, SANS le +, ni espaces (indicatif Bénin = 229).
const WHATSAPP_NUMBER = '2290155873800'; // ⚠️ à remplacer par ton vrai numéro avant publication
const WHATSAPP_MESSAGE = T(
  "Bonjour, je m'intéresse au Portail Scolaire pour mon établissement. Pouvez-vous m'en dire plus ?",
  "Hello, I'm interested in the School Portal for my school. Could you tell me more?"
);

// Les tarifs affichés sur la page. Ce sont EXACTEMENT ceux codés côté serveur
// dans src/routes/platform.js (const PLANS). Si tu changes un prix là-bas,
// change-le ICI aussi pour que la page publique reste cohérente.
const PLANS = [
  { key: 'starter', name: 'Starter', limit: 150, monthly: 12900,
    features: [T('Jusqu\u2019à 150 élèves', 'Up to 150 students'), T('Notes, bulletins PDF, absences', 'Grades, PDF report cards, attendance'),
      T('Cahier de texte & portail parents', 'Class log & parents portal'), T('Page publique & actualités', 'Public page & news')] },
  { key: 'school', name: T('École', 'School'), limit: 400, monthly: 29900, featured: true,
    features: [T('Jusqu\u2019à 400 élèves', 'Up to 400 students'), T('Tout Starter, plus :', 'Everything in Starter, plus:'),
      T('Alertes aux parents (WhatsApp)', 'Parent alerts (WhatsApp)'), T('Logo & bulletin personnalisés', 'Custom logo & report card'),
      T('Plusieurs administrateurs', 'Multiple administrators')] },
  { key: 'plus', name: T('Établissement+', 'School+'), limit: 800, monthly: 54900,
    features: [T('Jusqu\u2019à 800 élèves', 'Up to 800 students'), T('Tout École, plus :', 'Everything in School, plus:'),
      T('Suivi de la scolarité', 'Tuition tracking'), T('Support prioritaire', 'Priority support')] },
  { key: 'network', name: T('Réseau', 'Network'), limit: null, monthly: null,
    features: [T('Plusieurs sites / plus de 800 élèves', 'Multiple sites / 800+ students'), T('Accompagnement dédié', 'Dedicated onboarding'), T('Sur devis', 'Custom quote')] },
];

/* ==========================================================================
   Session existante (code établissement) — logique inchangée depuis l'origine.
   ========================================================================== */
applyI18n();
document.addEventListener('langchange', () => { applyI18n(); renderPlans(); });

const codeForm = $('#code-form');
if (codeForm) {
  codeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('#code').value.trim().toLowerCase();
    $('#msg').textContent = '';
    try {
      const s = await api('/public/school/' + encodeURIComponent(code), { noRedirect: true });
      location.href = '/e/' + encodeURIComponent(s.code);
    } catch (err) {
      $('#msg').textContent = err.status === 404
        ? T("Code introuvable. Vérifiez auprès de votre établissement.", 'Code not found. Please check with your school.')
        : err.message;
    }
  });
}

api('/auth/me', { noRedirect: true }).then((r) => {
  if (r.user) {
    $('#continue').classList.remove('hidden');
    $('#continue-link').href = r.user.role === 'superadmin' ? '/platform.html' : '/app.html';
  }
}).catch(() => {});

/* ==========================================================================
   Menu mobile (burger)
   ========================================================================== */
const menuBtn = $('#menu-toggle');
const navMenu = $('#nav-menu');
if (menuBtn && navMenu) {
  menuBtn.addEventListener('click', () => {
    const open = navMenu.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  // Referme le menu après un clic sur un lien (ancre de la page)
  $$('a', navMenu).forEach((a) => a.addEventListener('click', () => navMenu.classList.remove('open')));
}

/* ==========================================================================
   Liens WhatsApp (nav, hero, CTA final, bouton flottant) — un seul endroit à modifier.
   ========================================================================== */
const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
['#wa-nav', '#wa-hero', '#wa-final', '#wa-float'].forEach((sel) => { const el = $(sel); if (el) el.href = waLink; });

/* ==========================================================================
   Calculateur : temps gagné estimé (indicatif, hypothèse affichée à l'écran)
   ========================================================================== */
const MIN_PER_STUDENT_PER_TERM = 4; // ⚠️ hypothèse ; voir la note affichée sous le curseur
const calcInput = $('#calc-students');
if (calcInput) {
  const update = () => {
    const n = parseInt(calcInput.value, 10);
    $('#calc-students-val').textContent = n;
    const hours = Math.round((n * MIN_PER_STUDENT_PER_TERM) / 60);
    $('#calc-hours').textContent = hours;
  };
  calcInput.addEventListener('input', update);
  update();
}

/* ==========================================================================
   Tarifs : rendu à partir de la liste PLANS, avec bascule mensuel / annuel.
   ========================================================================== */
let annual = false;
function priceLine(p) {
  if (p.monthly === null) return h`<div class="price">${T('Sur devis', 'Custom')}</div>`;
  const amount = annual ? p.monthly * 10 : p.monthly; // 2 mois offerts à l'année
  const fcfa = new Intl.NumberFormat('fr-FR').format(amount);
  return h`<div class="price">${fcfa} F<small> / ${annual ? T('an', 'year') : T('mois', 'month')}</small></div>`;
}
function renderPlans() {
  const box = $('#lp-plans');
  if (!box) return;
  setHtml(box, h`${PLANS.map((p) => h`
    <div class="lp-plan card ${p.featured ? 'feat' : ''}">
      ${p.featured ? h`<span class="tag">${T('Populaire', 'Popular')}</span>` : ''}
      <h3>${p.name}</h3>
      ${priceLine(p)}
      <div class="cap">${p.limit ? T(`Jusqu'à ${p.limit} élèves`, `Up to ${p.limit} students`) : ''}</div>
      <ul>${p.features.map((f) => h`<li>${f}</li>`)}</ul>
      <a class="btn ${p.featured ? 'btn-primary' : ''}" href="${waLink}" target="_blank" rel="noopener">${T('Choisir', 'Choose')} ${p.name}</a>
    </div>`)}`);
}
const bMonthly = $('#bill-monthly'), bAnnual = $('#bill-annual');
if (bMonthly && bAnnual) {
  bMonthly.addEventListener('click', () => { annual = false; bMonthly.classList.add('on'); bAnnual.classList.remove('on'); renderPlans(); });
  bAnnual.addEventListener('click', () => { annual = true; bAnnual.classList.add('on'); bMonthly.classList.remove('on'); renderPlans(); });
}
renderPlans();

/* ==========================================================================
   FAQ : accordéon simple (un clic ouvre/ferme, sans rien casser au clavier)
   ========================================================================== */
$$('.lp-faq-item').forEach((item) => {
  const btn = $('.lp-faq-q', item);
  btn.addEventListener('click', () => item.classList.toggle('open'));
});

/* Année du copyright, sans y penser chaque janvier */
const yearEl = $('#year');
if (yearEl) yearEl.textContent = new Date().getFullYear();
