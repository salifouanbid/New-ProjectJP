'use strict';

const config = require('../config');
const db = require('../db');
const { sendMail } = require('./mailer');

const whatsapp = {
  enabled: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_BUSINESS_NUMBER),
  token: process.env.WHATSAPP_ACCESS_TOKEN || '',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  businessNumber: process.env.WHATSAPP_BUSINESS_NUMBER || '',
  template: process.env.WHATSAPP_TEMPLATE_ABSENCE || 'school_absence_alert',
};

function isPostgres() { return config.databaseProvider === 'postgres'; }
function cleanPhone(value) { return String(value || '').replace(/[^\d+]/g, '').replace(/^00/, '+'); }
function notificationText(eventType, payload) {
  if (eventType === 'absence') {
    return `Saphir — Absence signalée\nÉlève : ${payload.studentName}\nDate : ${payload.date}\nMatière : ${payload.subjectName || '—'}\nConnectez-vous au portail pour consulter les détails et envoyer un justificatif.`;
  }
  return payload.message || 'Une nouvelle information est disponible dans le portail scolaire.';
}

async function recipientsForStudent(schoolId, studentId) {
  const sql = isPostgres()
    ? `SELECT u.id,u.email,u.phone,COALESCE(np.whatsapp_enabled,false) AS whatsapp_enabled,COALESCE(np.email_enabled,true) AS email_enabled
       FROM parent_students ps JOIN users u ON u.id=ps.parent_id
       LEFT JOIN notification_preferences np ON np.user_id=u.id
       WHERE ps.student_id=$1 AND u.school_id=$2 AND u.active=true`
    : `SELECT u.id,u.email,u.phone,COALESCE(np.whatsapp_enabled,0) AS whatsapp_enabled,COALESCE(np.email_enabled,1) AS email_enabled
       FROM parent_students ps JOIN users u ON u.id=ps.parent_id
       LEFT JOIN notification_preferences np ON np.user_id=u.id
       WHERE ps.student_id=? AND u.school_id=? AND u.active=1`;
  return db.many(sql, [studentId, schoolId]);
}

async function enqueue({ schoolId, recipientUserId, channel, eventType, payload, dedupeKey }) {
  const serialized = JSON.stringify(payload || {});
  if (isPostgres()) {
    await db.execute(`INSERT INTO notification_outbox(school_id,recipient_user_id,channel,event_type,payload,dedupe_key)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(school_id,dedupe_key) DO NOTHING`, [schoolId, recipientUserId, channel, eventType, serialized, dedupeKey]);
  } else {
    db.prepare(`INSERT OR IGNORE INTO notification_outbox(school_id,recipient_user_id,channel,event_type,payload,dedupe_key)
      VALUES(?,?,?,?,?,?)`).run(schoolId, recipientUserId, channel, eventType, serialized, dedupeKey);
  }
}

async function queueAbsence({ schoolId, studentId, studentName, date, subjectName }) {
  const recipients = await recipientsForStudent(schoolId, studentId);
  const payload = { studentName, date, subjectName };
  for (const r of recipients) {
    const base = `${schoolId}:absence:${studentId}:${date}:${subjectName || ''}`;
    const phone = cleanPhone(r.phone);
    if (r.whatsapp_enabled && phone) await enqueue({ schoolId, recipientUserId: r.id, channel: 'whatsapp', eventType: 'absence', payload, dedupeKey: `${base}:whatsapp:${r.id}` });
    if (r.email_enabled && r.email) await enqueue({ schoolId, recipientUserId: r.id, channel: 'email', eventType: 'absence', payload, dedupeKey: `${base}:email:${r.id}` });
  }
}

async function sendWhatsApp(to, payload) {
  if (!whatsapp.enabled) return { skipped: true, reason: 'WHATSAPP_NOT_CONFIGURED' };
  const url = `https://graph.facebook.com/v20.0/${encodeURIComponent(whatsapp.phoneNumberId)}/messages`;
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${whatsapp.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: cleanPhone(to).replace(/^\+/, ''), type: 'text', text: { preview_url: false, body: notificationText(payload.eventType, payload.payload) } }) });
  if (!response.ok) throw new Error(`WhatsApp API ${response.status}`);
  return { sent: true };
}

async function processPending(limit = 20) {
  const rows = isPostgres()
    ? await db.many(`SELECT n.*,u.email,u.phone FROM notification_outbox n JOIN users u ON u.id=n.recipient_user_id WHERE n.status='pending' AND n.attempts<5 AND n.available_at<=NOW() ORDER BY n.id LIMIT $1`, [limit])
    : db.prepare(`SELECT n.*,u.email,u.phone FROM notification_outbox n JOIN users u ON u.id=n.recipient_user_id WHERE n.status='pending' AND n.attempts<5 AND n.available_at<=datetime('now') ORDER BY n.id LIMIT ?`).all(limit);
  for (const row of rows) {
    try {
      const payload = { eventType: row.event_type, payload: JSON.parse(row.payload || '{}') };
      if (row.channel === 'whatsapp') await sendWhatsApp(row.phone, payload);
      else if (row.channel === 'email') await sendMail({ to: row.email, subject: 'Portail scolaire — nouvelle absence', text: notificationText(row.event_type, payload.payload) });
      if (isPostgres()) await db.execute("UPDATE notification_outbox SET status='sent',sent_at=NOW(),attempts=attempts+1,last_error=NULL WHERE id=$1", [row.id]);
      else db.prepare("UPDATE notification_outbox SET status='sent',sent_at=datetime('now'),attempts=attempts+1,last_error=NULL WHERE id=?").run(row.id);
    } catch (error) {
      if (isPostgres()) await db.execute("UPDATE notification_outbox SET attempts=attempts+1,last_error=$1,available_at=NOW()+INTERVAL '10 minutes' WHERE id=$2", [String(error.message).slice(0,500), row.id]);
      else db.prepare("UPDATE notification_outbox SET attempts=attempts+1,last_error=?,available_at=datetime('now','+10 minutes') WHERE id=?").run(String(error.message).slice(0,500), row.id);
    }
  }
  return { processed: rows.length, whatsappConfigured: whatsapp.enabled };
}

async function getPreferences(userId) {
  const row = isPostgres() ? await db.maybeOne('SELECT whatsapp_enabled,email_enabled FROM notification_preferences WHERE user_id=$1',[userId]) : db.prepare('SELECT whatsapp_enabled,email_enabled FROM notification_preferences WHERE user_id=?').get(userId);
  return row || { whatsapp_enabled: false, email_enabled: true };
}
async function setPreferences(userId, values) {
  const wa = Boolean(values.whatsapp_enabled), email = values.email_enabled === undefined ? true : Boolean(values.email_enabled);
  if (isPostgres()) await db.execute(`INSERT INTO notification_preferences(user_id,whatsapp_enabled,email_enabled) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET whatsapp_enabled=EXCLUDED.whatsapp_enabled,email_enabled=EXCLUDED.email_enabled,updated_at=NOW()`,[userId,wa,email]);
  else db.prepare(`INSERT INTO notification_preferences(user_id,whatsapp_enabled,email_enabled) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET whatsapp_enabled=excluded.whatsapp_enabled,email_enabled=excluded.email_enabled,updated_at=datetime('now')`).run(userId,wa?1:0,email?1:0);
  return getPreferences(userId);
}

module.exports = { queueAbsence, processPending, getPreferences, setPreferences, whatsappConfigured: () => whatsapp.enabled };
