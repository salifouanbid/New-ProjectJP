'use strict';
const { processPending } = require('../src/services/notifications');
processPending(Number(process.env.NOTIFICATION_BATCH_SIZE || 20))
  .then((result) => { console.log(`Notifications traitées : ${result.processed} | WhatsApp configuré : ${result.whatsappConfigured ? 'oui' : 'non'}`); })
  .catch((error) => { console.error('Traitement notifications impossible :', error); process.exitCode = 1; });
