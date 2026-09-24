// Règles de calcul des notes. MODIFIE CE FICHIER pour adapter la formule à ton établissement.
const INTERRO_MAX = 6; // 6 interrogations maximum par matière et par trimestre
const DEVOIR_MAX = 2; // 2 devoirs par matière et par trimestre

const round2 = (n) => (n === null || n === undefined ? null : Math.round(n * 100) / 100);
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

// Moyenne d'une matière = (moyenne des interros + devoir 1 + devoir 2) / 3
// Si des composantes manquent, on fait la moyenne de celles qui existent.
function subjectAverage(interros, devoirs) {
  const parts = [];
  const mi = mean(interros);
  if (mi !== null) parts.push(mi);
  devoirs.forEach((d) => parts.push(d));
  return parts.length ? mean(parts) : null;
}

// Couleurs de l'établissement : vert dès 14, bleu dès 10, rouge en dessous
function gradeColor(v) {
  if (v === null || v === undefined) return 'none';
  if (v >= 14) return 'green';
  if (v >= 10) return 'blue';
  return 'red';
}

const APPRECIATIONS = [
  [16, 'Excellent', 'Excellent'],
  [14, 'Très bien', 'Very good'],
  [12, 'Bien', 'Good'],
  [10, 'Passable', 'Fair'],
  [8, 'Insuffisant', 'Insufficient'],
  [0, 'Faible', 'Poor'],
];
function appreciation(avg, lang = 'fr') {
  if (avg === null || avg === undefined) return '';
  const row = APPRECIATIONS.find((r) => avg >= r[0]) || APPRECIATIONS[APPRECIATIONS.length - 1];
  return lang === 'en' ? row[2] : row[1];
}

module.exports = { INTERRO_MAX, DEVOIR_MAX, round2, mean, subjectAverage, gradeColor, appreciation };
