# État de la migration Supabase/PostgreSQL et Vercel

**Dernière mise à jour : 25 septembre 2026**

## Conclusion

La migration est **préparée mais pas activée**. La version locale Node/Express/SQLite reste le chemin d'exécution par défaut et conserve ses tests de bout en bout. Le dépôt dispose maintenant d'un schéma PostgreSQL versionné, de contraintes multi-tenant renforcées, d'un client PostgreSQL asynchrone, d'un importateur SQLite transactionnel et d'un squelette Vercel qui refuse explicitement SQLite.

Il serait dangereux de déclarer l'application prête pour Vercel aujourd'hui. Les routes Express reposent encore sur une API SQLite synchrone. L'inventaire actuel compte **159 appels `prepare`**, **15 appels transactionnels**, **13 lectures de `lastInsertRowid`** et **27 occurrences de constructions SQL spécifiques à SQLite** dans le code d'exécution. PostgreSQL et `node-postgres` sont asynchrones : remplacer seulement le pilote casserait les transactions, les retours d'identifiants et la propagation des erreurs.

## Ce qui est utilisable maintenant

### Schéma PostgreSQL et sécurité

La migration initiale `supabase/migrations/20260925003000_initial_schema.sql` crée les 21 tables métier et active Row Level Security (RLS). La migration additive `20260925010000_schema_hardening.sql` ajoute les invariants qui manquaient au modèle initial : unicité explicite des comptes plateforme, unicité correcte des coefficients avec une série nullable, limitation à deux devoirs, cohérence rôle/établissement et contrôles de références inter-établissements au niveau PostgreSQL.

Les écritures restent volontairement **serveur-only**. Le backend Express utilisera une chaîne PostgreSQL secrète et un rôle serveur ; aucun accès direct aux tables privées depuis le navigateur n'est prévu dans cette phase. Les politiques RLS par rôle ne doivent être ouvertes qu'après une migration séparée vers Supabase Auth ou un mécanisme de JWT compatible.

### Client PostgreSQL

`src/persistence/postgres.js` fournit une API asynchrone minimale : `query`, `many`, `maybeOne`, `one`, `execute`, `transaction`, `healthcheck` et `close`. La fabrique limite par défaut chaque pool à une connexion et impose une URL `postgres://` ou `postgresql://`. Le futur adaptateur serveur devra créer cette instance une seule fois au niveau module. Aucun secret n'est journalisé.

Sur Vercel, `DATABASE_URL` doit provenir du **pooler transactionnel Supabase** avec TLS (`sslmode=require`). Supabase recommande ce mode pour les fonctions serverless, avec un petit pool applicatif créé une seule fois par instance.[1] Vercel recommande également de réutiliser le pool au niveau global plutôt que d'en ouvrir un par requête.[2]

### Import SQLite vers PostgreSQL

`scripts/migrate-sqlite-to-postgres.js` ouvre SQLite en lecture seule et contrôle les 21 tables côté PostgreSQL. Sans `--execute`, il affiche uniquement les comptages. Avec `--execute`, il refuse une cible non vide, prend un verrou transactionnel, importe dans l'ordre des clés étrangères, convertit les entiers SQLite en booléens PostgreSQL, recale les séquences et vérifie les comptages. Ce script requiert Node.js 22 ou une version ultérieure, car il ouvre la source avec `node:sqlite`.

```bash
# Prévisualisation : aucune écriture
DATABASE_URL='postgresql://…?sslmode=require' npm run db:migrate:postgres -- --source ./data/portail.db

# Import réel, uniquement après sauvegarde et dans une cible vide
DATABASE_URL='postgresql://…?sslmode=require' npm run db:migrate:postgres -- --source ./data/portail.db --execute
```

Le script ne supprime jamais les données cibles et ne fusionne pas deux jeux de données. La chaîne utilisée doit appartenir à un rôle serveur autorisé à écrire malgré RLS ; une clé publique `anon` ne convient pas. Le script ne remplace pas une répétition générale sur une copie restaurable.

### Garde-fou Vercel

`api/index.js` et `vercel.json` fournissent la structure de déploiement. Le point d'entrée Vercel exige `DB_PROVIDER=postgres`, tandis que `src/db.js` refuse ce mode tant que les routes n'ont pas été converties. Cette double barrière est intentionnelle : une fonction Vercel n'offre pas le système de fichiers persistant dont SQLite et `uploads/` ont besoin.[3]

## Blocages avant mise en production

### Conversion asynchrone des routes

Les 16 modules qui importent directement `src/db.js` doivent être convertis par périmètre fonctionnel. Chaque handler devra attendre les requêtes PostgreSQL. Les écritures atomiques devront recevoir l'objet transactionnel et ne jamais réutiliser le pool global au milieu d'une transaction.

Les changements de dialecte à traiter comprennent notamment :

- `?` vers les paramètres PostgreSQL `$1`, `$2`, etc. ;
- `INSERT OR IGNORE` vers `INSERT ... ON CONFLICT DO NOTHING` ;
- `IFNULL` vers `COALESCE` ;
- `datetime('now')` et `date('now')` vers `now()` et `current_date` ;
- `lastInsertRowid` vers `INSERT ... RETURNING id` ;
- les entiers `0/1` vers les booléens `false/true`.

L'ordre conseillé est : authentification et middleware, routes publiques, plateforme et création d'école, administration, enseignant, vues élève/parent, rapports et enfin santé/sauvegarde. Chaque tranche doit conserver les tests d'isolation inter-établissements.

### Fichiers téléversés

Les archives, justificatifs et images d'actualités sont encore écrits dans `uploads/` avec `multer.diskStorage`, puis servis avec `sendFile` ou `download`. Cela ne peut pas fournir une persistance fiable sur Vercel. Les fichiers doivent être déplacés vers des buckets **privés** Supabase Storage, avec un préfixe par établissement et une autorisation vérifiée côté serveur. Supabase Storage offre le stockage objet et un contrôle d'accès fin via RLS.[4]

La migration doit conserver la validation actuelle par signature magique avant l'envoi. Elle doit aussi traiter les fichiers orphelins en cas d'échec SQL, et supprimer l'objet seulement après une suppression métier validée. Une commande séparée devra transférer le contenu historique de `uploads/<school_id>/` et vérifier tailles et sommes de contrôle.

### Sauvegarde et restauration

`scripts/backup.js` utilise `VACUUM INTO` et copie le dossier `uploads/`. Il reste valable pour SQLite mais pas pour Supabase. En production, il faut définir une stratégie PostgreSQL avec les sauvegardes Supabase et, selon le niveau de risque, des exports `pg_dump` réguliers. Les buckets Storage doivent avoir leur propre procédure de restauration testée. Le script actuel ne doit pas être exécuté avec PostgreSQL.

### Tests PostgreSQL réels

Les tests automatisés vérifient la couche de persistance avec un faux pool et inspectent statiquement le SQL. Pendant cette passe, les deux migrations ont aussi été exécutées deux fois sur une base PostgreSQL 16 jetable. Les contraintes de rôle, de nombre de devoirs et d'isolation inter-établissements ont été exercées. L'importateur a transféré une base de démonstration complète, puis a vérifié les comptages, notamment 2 écoles, 43 utilisateurs, 864 notes et 72 présences. Une seconde tentative d'import a bien été refusée parce que la cible n'était plus vide.

Cette validation ponctuelle ne remplace pas un test d'intégration reproductible dans l'intégration continue. La prochaine phase doit automatiser PostgreSQL éphémère, puis relancer les scénarios HTTP contre le backend PostgreSQL une fois les routes converties.

## Séquence de bascule recommandée

1. Créer un projet Supabase non productif. Appliquer les deux migrations dans l'ordre et lancer les futurs tests d'intégration.
2. Convertir les modules Express vers des services asynchrones injectant la base. Ne pas activer `DB_PROVIDER=postgres` avant que tous les chemins HTTP et le bootstrap aient été migrés.
3. Remplacer le disque local par Supabase Storage et transférer une copie des fichiers historiques.
4. Répéter l'import SQLite vers une cible vide, comparer les 21 comptages et effectuer les tests métier et d'isolation.
5. Effectuer un essai Vercel en environnement Preview avec `DB_PROVIDER=postgres`, `DATABASE_URL`, `JWT_SECRET`, `APP_URL` et les secrets Storage configurés dans Vercel, jamais dans Git.
6. Planifier une fenêtre d'arrêt des écritures, sauvegarder SQLite et `uploads/`, faire l'import final, vérifier les comptages et les fichiers, puis basculer le domaine.
7. Conserver la sauvegarde SQLite en lecture seule pendant la période de retour arrière. Ne jamais autoriser des écritures simultanées dans SQLite et PostgreSQL sans mécanisme explicite de réplication.

## Commandes de contrôle locales

```bash
npm install
npm test
npm run test:postgres

git diff --check
git status --short
```

`npm test` continue d'utiliser une base SQLite temporaire et couvre le comportement historique. Aucun test ne requiert un secret Supabase.

## Variables et secrets

`.env.example` contient seulement des placeholders. Les valeurs réelles de `DATABASE_URL`, `JWT_SECRET`, SMTP et des futures clés Storage doivent être configurées dans les environnements de déploiement. Elles ne doivent jamais être commitées, affichées dans les logs ou préfixées par une convention qui les expose au navigateur.

## References

[1]: https://supabase.com/docs/guides/database/connecting-to-postgres "Supabase Docs — Connect to your database"

[2]: https://vercel.com/kb/guide/connection-pooling-with-functions "Vercel — Connection Pooling with Vercel Functions"

[3]: https://vercel.com/kb/guide/why-does-my-serverless-function-work-locally-but-not-when-deployed "Vercel — Why does my Serverless Function work locally but not when deployed?"

[4]: https://supabase.com/docs/guides/storage "Supabase Docs — Storage"
