// Génération du bulletin PDF (PDFKit — aucune dépendance système).
const PDFDocument = require('pdfkit');

const NAVY = '#0b1a3a';
const GOLD = '#b8891a';
const GREY = '#5b6478';
const LIGHT = '#eef2f9';

const L = {
  fr: {
    title: 'BULLETIN DE NOTES', student: 'Élève', matricule: 'Matricule', cls: 'Classe', term: 'Période',
    subject: 'Matière', coef: 'Coef', mi: 'Moy. int.', d1: 'Dev. 1', d2: 'Dev. 2', avg: 'Moyenne', pts: 'Moy. x Coef', cavg: 'Moy. classe',
    general: 'Moyenne générale', rank: 'Rang', of: 'sur', classAvg: 'Moyenne de la classe', best: 'Meilleure moyenne', worst: 'Plus faible moyenne',
    appreciation: 'Appréciation', none: 'Aucune note enregistrée pour cette période.', generated: 'Document généré le',
  },
  en: {
    title: 'REPORT CARD', student: 'Student', matricule: 'ID', cls: 'Class', term: 'Term',
    subject: 'Subject', coef: 'Coef', mi: 'Quiz avg', d1: 'Test 1', d2: 'Test 2', avg: 'Average', pts: 'Avg x Coef', cavg: 'Class avg',
    general: 'Overall average', rank: 'Rank', of: 'of', classAvg: 'Class average', best: 'Highest average', worst: 'Lowest average',
    appreciation: 'Remarks', none: 'No grades recorded for this term.', generated: 'Generated on',
  },
};

const fmt = (v) => (v === null || v === undefined ? '-' : String(v).replace('.', ','));

function streamBulletin(res, { school, report, lang = 'fr' }) {
  const t = L[lang] || L.fr;
  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `${t.title} - ${report.student.last_name}` } });
  const safeName = `${report.student.last_name}_${report.student.first_name}_${report.term.name}`.replace(/[^\w.-]+/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="bulletin_${safeName}.pdf"`);
  doc.pipe(res);

  const W = doc.page.width - 80;
  // En-tête
  doc.rect(40, 40, W, 70).fill(NAVY);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(18).text(school.name.toUpperCase(), 55, 55, { width: W - 30 });
  doc.fillColor('#f5c542').fontSize(11).text(`${t.title}  |  ${report.term.name}`, 55, 82, { width: W - 30 });
  if (school.academic_year || school.city) {
    doc.fillColor('#cbd5e8').font('Helvetica').fontSize(9)
      .text([school.city, school.academic_year].filter(Boolean).join('  |  '), 55, 97, { width: W - 30 });
  }

  // Identité
  let y = 130;
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(12).text(`${report.student.last_name.toUpperCase()} ${report.student.first_name}`, 40, y);
  doc.fillColor(GREY).font('Helvetica').fontSize(10)
    .text(`${t.cls} : ${report.class.name}${report.student.matricule ? `    ${t.matricule} : ${report.student.matricule}` : ''}`, 40, y + 18);
  y += 48;

  const cols = [
    { k: 'subject', w: 150, a: 'left' }, { k: 'coef', w: 35, a: 'center' }, { k: 'mi', w: 55, a: 'center' },
    { k: 'd1', w: 45, a: 'center' }, { k: 'd2', w: 45, a: 'center' }, { k: 'avg', w: 55, a: 'center' },
    { k: 'pts', w: 65, a: 'center' }, { k: 'cavg', w: 65, a: 'center' },
  ];
  const drawRow = (vals, opts = {}) => {
    const h = 20;
    if (opts.bg) doc.rect(40, y, W, h).fill(opts.bg);
    let x = 40;
    cols.forEach((c, i) => {
      doc.fillColor(opts.color || '#1c2333').font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
        .text(String(vals[i]), x + 5, y + 6, { width: c.w - 10, align: c.a, lineBreak: false });
      x += c.w;
    });
    y += h;
  };

  drawRow(cols.map((c) => t[c.k]), { bg: NAVY, color: '#ffffff', bold: true });
  if (!report.subjects.length) {
    doc.fillColor(GREY).font('Helvetica-Oblique').fontSize(10).text(t.none, 45, y + 10);
    y += 40;
  }
  report.subjects.forEach((s, i) => {
    if (y > 730) { doc.addPage(); y = 50; }
    drawRow(
      [s.name, fmt(s.coef), fmt(s.mi), fmt(s.devoirs[0]), fmt(s.devoirs[1]), fmt(s.avg), fmt(s.points), fmt(s.class_avg)],
      { bg: i % 2 ? '#ffffff' : LIGHT, bold: false }
    );
  });

  // Synthèse
  y += 18;
  if (y > 650) { doc.addPage(); y = 50; }
  doc.roundedRect(40, y, W, 100, 6).fill(LIGHT);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11).text(t.general, 55, y + 14);
  doc.fillColor(report.general !== null && report.general >= 10 ? '#0f7a4a' : '#b3261e').fontSize(26)
    .text(report.general === null ? '-' : `${fmt(report.general)} / 20`, 55, y + 34);
  doc.fillColor(NAVY).fontSize(10).font('Helvetica-Bold')
    .text(`${t.rank} : `, 260, y + 16, { continued: true }).font('Helvetica')
    .text(report.rank ? `${report.rank} ${t.of} ${report.class_size}` : '-');
  doc.font('Helvetica-Bold').text(`${t.classAvg} : `, 260, y + 34, { continued: true }).font('Helvetica').text(fmt(report.class_avg));
  doc.font('Helvetica-Bold').text(`${t.best} : `, 260, y + 52, { continued: true }).font('Helvetica').text(fmt(report.class_max));
  doc.font('Helvetica-Bold').text(`${t.worst} : `, 260, y + 70, { continued: true }).font('Helvetica').text(fmt(report.class_min));
  if (report.appreciation) {
    doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(11).text(`${t.appreciation} : ${report.appreciation}`, 55, y + 76, { width: 190 });
  }

  doc.fillColor(GREY).font('Helvetica').fontSize(8)
    .text(`${t.generated} ${new Date().toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR')}`, 40, doc.page.height - 60, { width: W, align: 'center' });
  doc.end();
}

module.exports = { streamBulletin };
