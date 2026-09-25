'use strict';

// Vercel charge cette fonction pour toutes les routes HTTP.
// Le serveur exporte déjà l'application Express sans lancer app.listen().
module.exports = require('../server');
