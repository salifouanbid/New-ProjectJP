const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;
if (config.smtp.host) {
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
}

async function sendMail({ to, subject, text }) {
  if (!transporter) {
    // Mode développement : pas de SMTP configuré, on affiche le message dans la console.
    console.log(`\n[EMAIL SIMULÉ] À: ${to}\nSujet: ${subject}\n${text}\n`);
    return { simulated: true };
  }
  await transporter.sendMail({ from: config.smtp.from, to, subject, text });
  return { simulated: false };
}

module.exports = { sendMail };
