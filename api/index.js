'use strict';

// Point d'entrée Vercel. Il est volontairement bloqué tant que les routes utilisent
// l'API SQLite synchrone : déployer cette version avec SQLite ferait perdre les données.
const config = require('../src/config');

if (config.databaseProvider !== 'postgres') {
  throw new Error('Vercel exige DB_PROVIDER=postgres. La persistance SQLite locale n’est pas supportée en production serverless.');
}

module.exports = require('../server');
