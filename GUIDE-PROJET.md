# 📘 Guide du projet « Portail Scolaire »
### Comprendre la structure d'un vrai projet Node.js, de A à Z

> Ce guide t'explique **ce projet précis** (celui que tu as sur ton PC) pour que tu apprennes, en même temps, **comment est organisé un projet Node.js sérieux**. Chaque notion est reliée à un fichier réel du projet, que tu peux ouvrir et lire.

---

## 0. Comment utiliser ce guide

1. **Ouvre le dossier `portail-scolaire` dans VS Code** (`Fichier → Ouvrir un dossier`), et garde ce guide à côté (dans VS Code : `Ctrl + Maj + V` affiche ce fichier en aperçu mis en forme).
2. Lis d'abord les sections **1 à 5** (≈ 45 min) : elles donnent la carte du projet.
3. Lis ensuite le code **dans l'ordre recommandé** de la section 16, en relisant la section du guide correspondante.
4. Fais les **exercices** de la section 18. Apprendre = modifier le code et voir ce qui casse.

Légende : 📁 fichier du projet · 🔑 idée clé à retenir · ⚠️ piège classique.

**Ton objectif réaliste** : ne pas tout mémoriser, mais être capable de (1) retrouver *où* se passe chaque chose, (2) comprendre *pourquoi* c'est fait comme ça, (3) modifier ou ajouter une fonctionnalité sans tout casser.

---

## 1. Vue d'ensemble en 5 minutes

### Ce que fait le logiciel
Un portail scolaire **multi-établissements** : un seul logiciel installé une fois, plusieurs collèges/lycées dedans, chacun avec ses données **séparées**. Chaque établissement a 4 types d'utilisateurs :

| Rôle | Ce qu'il fait |
|---|---|
| **Administrateur** (direction) | Crée classes, matières, coefficients, comptes ; clôture les trimestres ; valide les justificatifs ; publie des actualités |
| **Professeur** | Saisit les notes, fait l'appel, remplit le cahier de texte, dépose des épreuves PDF, signale la discipline |
| **Élève** | Consulte notes, moyennes, rang, courbe d'évolution ; télécharge son bulletin PDF |
| **Parent** | Suit ses enfants, justifie les absences, lit les actualités, télécharge le bulletin |

Plus un rôle **superadmin** (toi, propriétaire de la plateforme) qui crée les établissements.

### Les 3 briques (l'architecture)

```
   NAVIGATEUR (le client)                 SERVEUR (ton PC / un VPS)
 ┌──────────────────────────┐          ┌──────────────────────────────────────┐
 │ HTML + CSS + JavaScript  │  HTTP    │  Node.js + Express (server.js)       │
 │ dossier  public/         │ ───────► │   ├─ middlewares (sécurité, cookies) │
 │                          │ ◄─────── │   ├─ routes  (src/routes/*.js)       │
 │ affiche les pages,       │  JSON    │   ├─ services (calculs, PDF, mail)   │
 │ appelle l'API avec fetch │          │   └─ accès base (src/db.js)          │
 └──────────────────────────┘          └───────────────┬──────────────────────┘
                                                       │
                                       ┌───────────────┴───────────────┐
                                       │ data/portail.db  (SQLite)     │
                                       │ uploads/  (photos, PDF)       │
                                       └───────────────────────────────┘
```

🔑 **Le navigateur ne touche jamais la base de données.** Il envoie des requêtes HTTP à une **API** (des adresses comme `/api/teacher/grades`), le serveur vérifie tout (qui es-tu ? as-tu le droit ?), lit/écrit dans la base, puis répond en **JSON**.

### Quelques chiffres
- ≈ **4 800 lignes** de code (JS + HTML + CSS), ≈ **50 fichiers**.
- **21 tables** SQL, **9 groupes de routes** API.
- **133 vérifications automatiques** (`npm test`).
- **Aucune étape de « build »** : le code que tu écris est celui qui s'exécute.

---

## 2. Les bases : Node.js, npm, Express

### 2.1 Node.js, c'est quoi ?
JavaScript à l'origine ne tournait que dans le navigateur. **Node.js** est un programme qui exécute du JavaScript **en dehors** du navigateur, par exemple pour faire un serveur.

🔑 **Non bloquant** : Node fait tourner ton code sur *un seul fil*, mais il ne reste jamais « planté » à attendre une lecture de fichier ou une requête réseau : il lance l'opération et passe à autre chose, puis reprend quand le résultat arrive (via des *promesses* / `async-await`). C'est pour ça qu'un petit serveur Node gère beaucoup de connexions.

⚠️ Conséquence : un calcul très long et synchrone **bloque tout le serveur**. C'est pourquoi le projet utilise `bcrypt.compare` en version *asynchrone* (le hachage est volontairement lent).

### 2.2 npm et `package.json`
**npm** est le gestionnaire de paquets : il télécharge les bibliothèques (les « dépendances ») dont ton projet a besoin.

📁 `package.json` = la **carte d'identité** du projet :

```json
// (Illustration : de vrais fichiers package.json n'acceptent pas les commentaires //)
{
  "name": "portail-scolaire",
  "scripts": {
    "start":  "node server.js",            // npm start
    "dev":    "node --watch server.js",    // npm run dev  (redémarre à chaque modification)
    "seed":   "node src/seed.js",          // npm run seed  (données de démo)
    "backup": "node scripts/backup.js",    // npm run backup
    "test":   "node test/smoke.js"         // npm test
  },
  "engines": { "node": ">=18" },
  "dependencies": {                        // nécessaires pour que le site tourne
    "express": "...", "bcryptjs": "...", "jsonwebtoken": "...", "helmet": "...",
    "cookie-parser": "...", "express-rate-limit": "...", "multer": "...",
    "pdfkit": "...", "nodemailer": "...", "dotenv": "..."
  },
  "optionalDependencies": { "better-sqlite3": "..." }   // facultative !
}
```

À retenir :
- **`scripts`** : des raccourcis. `npm start` exécute `node server.js`.
- **`dependencies`** : ce qui est installé par `npm install`. Le numéro `^4.22.3` signifie « 4.22.3 ou une version compatible plus récente ».
- **`optionalDependencies`** : si l'installation échoue (compilation impossible sur ta machine), npm **continue quand même**. C'est le cas de `better-sqlite3` : le projet a un plan B (voir §6.6).
- 📁 `package-lock.json` : la liste **exacte** des versions installées (y compris les dépendances des dépendances), pour que tout le monde ait exactement les mêmes.
- 📁 `node_modules/` : le dossier (énorme) où npm range les bibliothèques. **On ne le partage jamais** (ni zip, ni GitHub) : `npm install` le recrée. C'est pour ça qu'il est dans `.gitignore`.

### 2.3 Deux systèmes de modules
Un « module » = un fichier qui exporte des choses pour que d'autres fichiers les utilisent.

| | **Côté serveur** (`src/`, `server.js`) | **Côté navigateur** (`public/js/`) |
|---|---|---|
| Syntaxe | CommonJS | ES Modules |
| Importer | `const db = require('./db');` | `import { api } from './common.js';` |
| Exporter | `module.exports = router;` | `export function api() {…}` |

Les deux existent pour des raisons historiques. Sur le serveur du projet on a gardé `require` (le plus courant avec Express). Dans le navigateur, on charge avec `<script type="module" src="…">`, ce qui active `import/export`.

### 2.4 Express : le cœur du serveur
**Express** est une bibliothèque qui simplifie la création d'un serveur web. Trois notions suffisent pour comprendre 90 % du projet :

1. **Route** : « quand quelqu'un demande `GET /healthz`, exécute cette fonction ».
   ```js
   app.get('/healthz', (req, res) => { res.json({ ok: true }); });
   ```
   `req` = la requête reçue (qui, quoi, quelles données), `res` = la réponse à construire.

2. **Middleware** : une fonction qui s'exécute **avant** la route, dans l'ordre, et qui peut modifier `req`, répondre tout de suite, ou passer la main avec `next()`. Exemples ici : lire le JSON, lire les cookies, vérifier qu'on est connecté, limiter le nombre de requêtes.

3. **Router** : un « mini-serveur » qui regroupe des routes liées. Chaque fichier de `src/routes/` en est un, branché sur un préfixe : `/api/teacher` → `teacher.js`.

🔑 **L'ordre compte** : Express lit `server.js` de haut en bas ; la première route qui correspond répond. Un middleware placé après la route ne s'exécute pas pour elle.

### 2.5 Variables d'environnement : `.env`
Certaines valeurs changent selon la machine (port, secret de signature, identifiants email) ou sont **secrètes**. On ne les écrit pas dans le code : on les met dans un fichier **`.env`**, lu par la bibliothèque `dotenv` au démarrage, puis accessible via `process.env.NOM`.

- 📁 `.env.example` : le **modèle** (sans secrets), qui est partagé. Tu le copies en `.env` et tu le remplis.
- 📁 `.env` : ton vrai fichier, **jamais partagé** (il est dans `.gitignore`).
- 📁 `src/config.js` : le seul endroit qui lit `process.env` ; le reste du code importe `config`. Ça évite d'éparpiller `process.env.X` partout.

⚠️ Si tu mets `.env` sur GitHub, tes secrets sont publics. Vérifie toujours avec `git status` avant un `git commit`.

---

## 3. L'arborescence commentée

```
portail-scolaire/
├── package.json            identité du projet + scripts + dépendances
├── package-lock.json       versions exactes installées
├── .env.example            modèle de configuration (à copier en .env)
├── .gitignore              fichiers que Git ignore (node_modules, .env, data, uploads…)
├── README.md               mode d'emploi rapide
├── GUIDE-PROJET.md         ce guide
│
├── server.js               ★ POINT D'ENTRÉE : construit et lance le serveur Express
│
├── src/                    tout le code SERVEUR
│   ├── config.js           lit .env, expose un objet `config`
│   ├── db.js               ouvre la base SQLite, crée les 21 tables, migrations
│   ├── bootstrap.js        crée le compte propriétaire au 1er démarrage
│   ├── seed.js             données de démonstration (2 établissements)
│   ├── middleware/
│   │   └── auth.js         sessions (JWT), contrôle des rôles, protection CSRF
│   ├── routes/             UN FICHIER = UN GROUPE D'ADRESSES DE L'API
│   │   ├── auth.js         connexion, déconnexion, mot de passe oublié
│   │   ├── public.js       infos publiques d'un établissement (vitrine)
│   │   ├── platform.js     espace propriétaire (créer des établissements)
│   │   ├── admin.js        espace direction (le plus gros fichier)
│   │   ├── teacher.js      espace professeur
│   │   ├── student.js      espace élève ┐ 
│   │   ├── parent.js       espace parent ┘ utilisent studentViews.js
│   │   ├── studentViews.js vues communes élève/parent (notes, absences…)
│   │   ├── news.js         actualités + images
│   │   └── files.js        téléchargement sécurisé des fichiers
│   └── services/           LOGIQUE RÉUTILISABLE (pas liée à HTTP)
│       ├── grades.js       formule des moyennes, couleurs, appréciations
│       ├── reports.js      calcul des moyennes/rangs d'une classe, bulletins
│       ├── pdf.js          génération du bulletin PDF
│       ├── mailer.js       envoi d'emails
│       ├── upload.js       téléversement de fichiers (multer) + vérifications
│       ├── schools.js      création d'un établissement complet
│       └── util.js         petits outils (validation, mots de passe, erreurs…)
│
├── public/                 tout le code NAVIGATEUR (servi tel quel)
│   ├── index.html          page d'accueil (saisie du code établissement)
│   ├── school.html         site vitrine public d'un établissement
│   ├── login.html          connexion          reset.html  mot de passe oublié
│   ├── app.html            « coquille » de l'espace connecté
│   ├── platform.html       espace propriétaire
│   ├── css/style.css       tout le design (thème, composants, responsive)
│   └── js/
│       ├── common.js       boîte à outils : api(), gabarits HTML sûrs, modales, graphiques…
│       ├── app.js          démarre l'espace connecté et charge le bon module de rôle
│       ├── landing.js  login.js  reset.js  school.js  platform.js   (un script par page)
│       └── roles/          une « application » par rôle
│           ├── admin.js  teacher.js  student.js  parent.js
│           └── shared.js   vues communes élève/parent
│
├── scripts/backup.js       sauvegarde de la base + des fichiers
├── test/smoke.js           tests automatiques de bout en bout
├── data/                   (créé au lancement) portail.db = la base SQLite
├── uploads/                (créé au lancement) fichiers envoyés, rangés par établissement
└── backups/                (créé par `npm run backup`)
```

🔑 **Le principe de séparation** (à retenir pour tous tes futurs projets) :

| Dossier | Responsabilité | Ne doit PAS contenir |
|---|---|---|
| `routes/` | Recevoir la requête HTTP, vérifier les droits, valider, appeler la base, répondre | De longs calculs métier |
| `services/` | La logique « métier » (formules, PDF…) sans rien savoir de HTTP | `req`, `res` |
| `middleware/` | Ce qui s'applique à *beaucoup* de routes (auth, sécurité) | Logique spécifique à une page |
| `db.js` | Le schéma et la connexion | Des règles métier |
| `public/` | Ce que voit l'utilisateur | Des secrets, des accès base |

Pourquoi c'est utile ? Le calcul des moyennes (`services/reports.js`) sert à la fois au tableau de bord de l'élève, à celui du parent **et** au PDF. Écrit une seule fois, testable, modifiable sans toucher aux routes.

---

## 4. Le démarrage : `server.js` annoté

📁 `server.js` (93 lignes) assemble tout. Lis-le avec ce plan :

```js
const express = require('express');
const helmet = require('helmet');
// ... imports

const app = express();                       // 1. on crée l'application
app.disable('x-powered-by');                 //    on cache « Express » dans les en-têtes
if (config.trustProxy) app.set('trust proxy', config.trustProxy);
     // ↑ derrière Nginx, l'IP réelle du visiteur est dans un en-tête : on autorise Express à s'y fier

app.use(helmet({ contentSecurityPolicy: {...} }));   // 2. en-têtes de sécurité
app.use(express.json({ limit: '200kb' }));           // 3. lit le corps JSON → req.body
app.use(cookieParser());                             // 4. lit les cookies   → req.cookies

app.get('/healthz', ...);                            // 5. route de supervision

app.use('/api', rateLimit({ ... limit: 600 ... }));  // 6. anti-abus : 600 requêtes/min/IP
app.use('/api', mw.csrfHeader);                      // 7. protection CSRF

app.use('/api/auth',    require('./src/routes/auth'));      // 8. les routes de l'API
app.use('/api/public',  require('./src/routes/public'));
app.use('/api/platform', mw.authenticate, mw.requireRole('superadmin'), require('./src/routes/platform'));
app.use('/api/admin',    mw.authenticate, mw.requireRole('admin'),      require('./src/routes/admin'));
app.use('/api/teacher',  mw.authenticate, mw.requireRole('teacher'),    require('./src/routes/teacher'));
app.use('/api/student',  mw.authenticate, mw.requireRole('student'),    require('./src/routes/student'));
app.use('/api/parent',   mw.authenticate, mw.requireRole('parent'),     require('./src/routes/parent'));
app.use('/api/files',    mw.authenticate, require('./src/routes/files'));
app.use('/api/news',     mw.authenticate, require('./src/routes/news'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Route introuvable' }));

app.get('/e/:code', ...school.html);                 // 9. les pages web
app.get('/e/:code/connexion', ...login.html);
app.use(express.static(publicDir, { extensions: ['html'] }));   //    + tout le dossier public/

app.use((err, req, res, next) => { ... });           // 10. gestionnaire d'erreurs (toujours en dernier)

if (require.main === module) { ensureSuperadmin().then(() => app.listen(config.port, ...)); }
module.exports = app;
```

Ce qu'il faut comprendre :

- **Ligne 8, la sécurité par les rôles se lit d'un coup d'œil** : `/api/teacher` n'est atteignable qu'après `authenticate` (« es-tu connecté ? ») puis `requireRole('teacher')` (« es-tu professeur ? »). Un élève qui tape cette adresse reçoit `403`. On protège **un groupe entier** en une ligne, au lieu de répéter le test dans chaque route.
- **Ligne 10, le gestionnaire d'erreurs** a **4 paramètres** `(err, req, res, next)` : c'est comme ça qu'Express le reconnaît. Toute erreur lancée (`throw`) dans une route arrive ici, et on la transforme en réponse JSON propre (§9).
- **`express.static`** sert directement les fichiers de `public/` : `public/login.html` est atteignable via `/login`.
- **`require.main === module`** : vrai seulement si on lance `node server.js` directement. Ça permet à d'autres fichiers de faire `require('./server')` sans démarrer le serveur.

---

## 5. Le voyage d'une requête (exemple complet)

**Scénario** : une professeure clique sur « Enregistrer » dans la saisie des notes. Suis le chemin, fichier par fichier.

**① Dans le navigateur** — 📁 `public/js/roles/teacher.js` : au clic, on appelle `saveWithQueue(...)` (📁 `common.js`), qui appelle `api('/teacher/grades', { method: 'PUT', body })` :

```js
fetch('/api/teacher/grades', {
  method: 'PUT',
  headers: { 'X-Requested-With': 'portail', 'Content-Type': 'application/json' },
  body: JSON.stringify({ class_id, subject_id, term_id, entries: [...] }),
  credentials: 'same-origin'          // → le navigateur joint automatiquement le cookie de session
});
```

**② Le serveur reçoit** — 📁 `server.js`. Express fait traverser la requête, dans l'ordre :

| Étape | Rôle |
|---|---|
| `helmet` | Ajoute les en-têtes de sécurité à la réponse |
| `express.json()` | Transforme le corps JSON en objet `req.body` |
| `cookieParser()` | Met les cookies dans `req.cookies` |
| `rateLimit` (`/api`) | Refuse si trop de requêtes venant de la même IP |
| `csrfHeader` | Refuse un `PUT` sans l'en-tête `X-Requested-With: portail` |
| `authenticate` | Vérifie le cookie (JWT), recharge l'utilisateur depuis la base → `req.user` |
| `requireRole('teacher')` | Refuse (403) si ce n'est pas un professeur |
| **la route** | `PUT /grades` dans 📁 `src/routes/teacher.js` |

**③ La route** — 📁 `src/routes/teacher.js` (extrait réel, simplifié) :

```js
router.put('/grades', (req, res) => {
  const b = req.body || {};
  const { classId, subjectId } = assertAssigned(req, b.class_id, b.subject_id); // ce prof enseigne-t-il ça ? sinon 403
  const term = getTerm(req, b.term_id);
  if (term.status !== 'open') { /* erreur 423 : période clôturée, notes gelées */ }
  const entries = Array.isArray(b.entries) ? b.entries : [];
  const ids = new Set(classStudents(req, classId).map((s) => s.id)); // élèves DE CETTE classe, de CET établissement

  db.transaction(() => {                       // « tout ou rien »
    for (const e of entries) {
      if (!ids.has(sid)) throw bad('Élève inconnu dans cette classe');
      // ... validation : type, numéro, 0 ≤ note ≤ 20
      upsert.run(S(req), sid, subjectId, term.id, e.type, idx, note, req.user.id);
    }
  })();
  res.json({ ok: true, saved: entries.length });
});
```

Regarde bien les **quatre couches de défense** dans cette seule route : *connecté ?* → *bon rôle ?* → *enseigne-t-il cette classe/matière ?* → *chaque élève appartient-il à cette classe ?* Puis validation de chaque note, puis transaction. C'est la même logique partout.

**④ La base** — 📁 `src/db.js` fournit `db`. `upsert` est une requête SQL préparée `INSERT … ON CONFLICT … DO UPDATE` : « insère la note, ou met-la à jour si elle existe déjà ».

**⑤ La réponse** — `res.json({ ok: true })` → le navigateur affiche « Notes enregistrées ✔ ».

**⑥ Et si ça se passe mal ?**
- *Une note vaut 25* → `throw bad(...)` → la transaction s'annule → Express envoie l'erreur au gestionnaire final → réponse `400 {"error": "Les notes doivent être comprises entre 0 et 20"}`.
- *Le réseau coupe* → `fetch` échoue côté navigateur → `saveWithQueue` garde l'envoi dans le `localStorage` et le renvoie quand la connexion revient (événement `online`).

🔑 **Retiens ce schéma mental** : *requête → middlewares → route → (validation → base) → réponse ; en cas d'erreur → gestionnaire d'erreurs.* Presque tout le backend suit ce schéma.

---

## 6. La base de données (SQLite)

### 6.1 Pourquoi SQLite ?
Une base SQLite est **un simple fichier** (`data/portail.db`) : aucun serveur de base de données à installer, à configurer ni à sécuriser. Idéal pour démarrer et pour des dizaines d'établissements. (Quand le projet grandira, on migrera vers PostgreSQL — voir §20.)

### 6.2 Les 21 tables, par famille
📁 `src/db.js` contient tout le schéma dans une grande chaîne `SCHEMA` (des `CREATE TABLE IF NOT EXISTS …`).

| Famille | Tables |
|---|---|
| **Structure** | `schools`, `levels` (niveaux), `series`, `classes`, `subjects` (matières), `coefficients`, `terms` (trimestres) |
| **Personnes** | `users` (tous les comptes), `students` (fiche élève), `parent_students` (qui est parent de qui), `teaching_assignments` (qui enseigne quoi, dans quelle classe) |
| **Vie scolaire** | `grades`, `attendance`, `justifications`, `discipline`, `chapters` + `lessons` (cahier de texte), `archives` |
| **Communication** | `announcements` (actualités), `announcement_images` (galerie) |
| **Sécurité** | `password_resets` |

### 6.3 Concepts SQL rencontrés dans le schéma
Ouvre `db.js` et retrouve chacun :

- **`PRIMARY KEY AUTOINCREMENT`** : identifiant unique numéroté automatiquement.
- **Clé étrangère** `REFERENCES classes(id)` : « cette valeur doit exister dans l'autre table ». Elle interdit, par exemple, de supprimer une classe qui a encore des élèves (la base répond « FOREIGN KEY constraint failed »).
  - `ON DELETE CASCADE` : si on supprime l'établissement, tout ce qui en dépend part avec.
  - `ON DELETE SET NULL` : si on supprime un professeur, ses notes restent, mais « créé par » devient vide.
- **`CHECK (value >= 0 AND value <= 20)`** : la base **refuse** une note hors 0–20, même si le code avait un bug. *Défense en profondeur.*
- **`UNIQUE (student_id, subject_id, term_id, type, idx)`** : impossible d'avoir deux « interrogation n°2 » pour le même élève/matière/trimestre.
- **Index** `CREATE INDEX` : accélère les recherches (comme l'index d'un livre).
- **Index unique sur expression** `ux_users_school_username` : deux personnes de deux écoles peuvent avoir le même identifiant, pas dans la même école.

### 6.4 Requêtes préparées = protection contre l'injection SQL
Regarde comment le projet écrit **toujours** ses requêtes :

```js
db.prepare('SELECT * FROM users WHERE school_id = ? AND username = ?').get(school.id, uname);
```

Les `?` sont remplis **séparément** de la requête. Même si `uname` contient `'; DROP TABLE users; --`, c'est traité comme un simple texte, jamais comme du SQL.

⚠️ **Ne fais JAMAIS** : ``db.prepare(`SELECT * FROM users WHERE username = '${uname}'`)``. C'est l'**injection SQL**, l'une des failles les plus classiques.
*(Quelques endroits du projet insèrent un nom de table ou de colonne dans le texte SQL — `owned()` et `simpleCrud()` dans `admin.js`, `feed()` dans `news.js`. C'est acceptable **uniquement** parce que ces noms sont écrits en dur dans le code : jamais une valeur venant de l'utilisateur. Si un jour tu dois le faire avec une valeur externe, valide-la d'abord contre une liste blanche.)*

### 6.5 Les transactions : « tout ou rien »
Quand plusieurs écritures forment **une seule opération logique** (enregistrer 40 notes, créer un élève = un compte + une fiche), on les met dans une transaction :

```js
db.transaction(() => {
  // plusieurs INSERT / UPDATE
  // si UNE ligne lance une erreur → TOUT est annulé
})();
```

Sans ça, une panne au milieu laisserait des données à moitié écrites. Les tests le vérifient (« rien d'enregistré si une note est invalide »).

### 6.6 Le petit adaptateur de pilote (une astuce à connaître)
Il existe deux façons d'utiliser SQLite en Node :
- `better-sqlite3` : très populaire, mais contient du code **natif** qu'il faut parfois compiler (échoue sur certains PC).
- `node:sqlite` : **intégré à Node** (à partir de Node 22), rien à installer.

📁 `db.js` → `openDb()` essaie `better-sqlite3`, et **sinon** bascule sur `node:sqlite` avec un petit habillage pour que le reste du code ne voie aucune différence. C'est probablement ce qui se passe sur ton PC (Node 24) : tu vois alors `base de données : node:sqlite` au démarrage. 🔑 Isoler une dépendance derrière une petite « façade » permet d'en changer sans réécrire le reste.

### 6.7 Les migrations
Quand tu ajoutes une colonne dans le schéma, les bases **déjà créées** ne l'ont pas. À la fin de `db.js`, un petit bloc vérifie les colonnes existantes (`PRAGMA table_info`) et fait un `ALTER TABLE … ADD COLUMN` si besoin. Il migre aussi les anciennes images uniques vers la table `announcement_images`. Ce mécanisme est **idempotent** : le relancer 10 fois ne change rien après la 1re.

### 6.8 Regarder dans la base
- Installe **DB Browser for SQLite** (gratuit, `sqlitebrowser.org`) et ouvre `data/portail.db` : tu vois les tables et tu peux tester des requêtes.
- Ou une extension VS Code « SQLite Viewer ».
- ⚠️ Ouvre-la en **lecture seule** pendant que le serveur tourne.

---

## 7. Authentification et autorisation

Deux questions distinctes :
- **Authentification** = *qui es-tu ?* (identifiant + mot de passe)
- **Autorisation** = *as-tu le droit de faire ça ?* (rôle, appartenance à l'école, à la classe…)

### 7.1 Les mots de passe : hachage bcrypt
📁 `src/services/util.js` → `hashPassword` ; 📁 `src/routes/auth.js` → connexion.

🔑 On ne stocke **jamais** un mot de passe, seulement son **hachage** : une empreinte à sens unique, ici avec **bcrypt** (volontairement lent pour décourager les attaques par force brute ; le « sel » aléatoire est inclus dans l'empreinte). À la connexion, `bcrypt.compare(motDePasseSaisi, empreinteStockée)`.

Détail malin dans `auth.js` : si l'identifiant n'existe pas, on compare quand même avec un faux hachage (`DUMMY_HASH`). Sinon, la réponse serait plus rapide pour un identifiant inexistant, et un attaquant pourrait **deviner quels comptes existent** en mesurant le temps.

### 7.2 La session : JWT dans un cookie
Après une connexion réussie, le serveur crée un **JWT** (JSON Web Token) : un petit jeton **signé** avec `JWT_SECRET`, qui contient seulement `{ uid: <id utilisateur> }` et une date d'expiration (8 h). Il est envoyé dans un **cookie** :

```js
res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge: ... });
```

| Option | Effet |
|---|---|
| `httpOnly` | Le JavaScript de la page **ne peut pas lire** ce cookie (limite les dégâts d'une faille XSS) |
| `sameSite: 'lax'` | Le navigateur n'envoie pas le cookie sur les requêtes venant d'un *autre* site (limite le CSRF) |
| `secure` | Cookie envoyé **seulement en HTTPS** (activé en production) |

À chaque requête, 📁 `middleware/auth.js` → `load()` : vérifie la signature du JWT, puis **recharge l'utilisateur depuis la base**. Donc si la direction désactive un compte, l'accès est coupé **immédiatement**, sans attendre l'expiration du jeton. 🔑 *Le jeton prouve « qui c'est », mais c'est la base qui dit « a-t-il encore le droit ? ».*

### 7.3 Les rôles
```js
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Accès refusé' });
  next();
};
```
C'est une **fabrique de middleware** : `requireRole('teacher')` *renvoie* un middleware. Un motif très courant en Express.

### 7.4 Mot de passe oublié
Le serveur génère un jeton aléatoire (`crypto.randomBytes(32)`), **stocke seulement son hachage SHA-256**, l'envoie par email sous forme de lien valable 1 h, à usage unique. Si la base fuitait, les jetons stockés seraient inutilisables. La réponse à « mot de passe oublié » est **identique** que le compte existe ou non (pour ne rien révéler).

### 7.5 Limiter les tentatives (rate limiting)
`express-rate-limit` : 20 échecs de connexion par 15 min et par IP (les réussites ne comptent pas), 10 demandes de réinitialisation, 600 requêtes/min sur l'API. ⚠️ Derrière un proxy (Nginx), l'« IP » vue par Express est celle du proxy si on ne règle pas `trust proxy` : tous les visiteurs partageraient le même compteur ! D'où `TRUST_PROXY` dans `.env`.

---

## 8. Multi-établissements (« multi-tenant »)

C'est **la particularité** de ce projet, et la partie où une erreur serait la plus grave (un collège qui verrait les notes d'un autre).

### 8.1 Le choix d'architecture
Trois approches classiques :

| Approche | Avantage | Inconvénient |
|---|---|---|
| Une base **par** établissement | Isolation maximale | Lourd à gérer, migrations × N |
| Un schéma par établissement | Bon compromis | Non supporté par SQLite |
| **Une base partagée + colonne `school_id`** ← *choix du projet* | Simple, une seule migration | **Il faut filtrer partout** |

### 8.2 La règle d'or
> **Chaque requête est filtrée par l'établissement de l'utilisateur connecté, et chaque identifiant reçu du navigateur est revérifié.**

- L'établissement vient de `req.user.school_id` (chargé depuis la base par `authenticate`), **jamais** de ce que le navigateur envoie.
- 📁 `admin.js` : le raccourci `const S = (req) => req.user.school_id;`
- Pour tout identifiant reçu (`class_id`, `student_id`…), on utilise `owned()` / `must()` :

```js
function owned(table, id, schoolId) {
  const n = intOrNull(id);
  if (n === null) return null;
  return db.prepare(`SELECT * FROM ${table} WHERE id = ? AND school_id = ?`).get(n, schoolId) || null;
}
function must(table, id, schoolId, label) {
  const row = owned(table, id, schoolId);
  if (!row) throw bad(`${label} introuvable`);
  return row;
}
```

🔑 Si un administrateur du collège A envoie l'identifiant d'une classe du collège B, `owned()` ne trouve rien (car `school_id` ne correspond pas) → erreur. Le pirate ne peut même pas savoir si cette classe existe.

### 8.3 Le test qui garde la porte
📁 `test/smoke.js` contient de nombreux tests marqués **ISOLATION** : ils se connectent comme admin du collège A et tentent de modifier, supprimer, désactiver, télécharger des éléments du collège B. Tous doivent échouer. **À chaque nouvelle route que tu écris, ajoute un test d'isolation.**

### 8.4 Comment un utilisateur « choisit » son établissement
Par le **code** de l'établissement : `/e/jean-piaget-1/connexion`. À la connexion, le serveur cherche l'utilisateur dans *cet* établissement (`WHERE school_id = ? AND username = ?`). Le superadmin, lui, n'a pas de `school_id` (`NULL`).

---

## 9. Validation, erreurs et codes HTTP

### 9.1 Ne jamais faire confiance au navigateur
Tout ce qui arrive dans `req.body`, `req.query`, `req.params` peut être **falsifié** (n'importe qui peut envoyer une requête à la main avec `curl`). Le HTML `<input max="20">` n'est qu'un confort ; **la vraie validation est côté serveur** :

```js
const v = Number(e.value);
if (!Number.isFinite(v) || v < 0 || v > 20) throw bad('Les notes doivent être comprises entre 0 et 20');
```
Petits outils dans 📁 `services/util.js` : `str()` (texte propre et tronqué), `intOrNull()`, `normUsername()`, `normEmail()`, `checkPassword()`, `isDate()`.

### 9.2 Les erreurs « propres »
```js
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const bad = (msg) => new HttpError(400, msg);
const notFound = (msg = 'Introuvable') => new HttpError(404, msg);
```
Dans une route on écrit simplement `throw bad('…')`. Le gestionnaire final de `server.js` lit `err.status` et répond en JSON. Il **traduit aussi** les erreurs SQL : `UNIQUE constraint failed` → `409 Cet identifiant est déjà utilisé`, `FOREIGN KEY constraint failed` → `409 Suppression impossible…`. Et pour toute erreur inattendue : `500 Erreur interne` (le détail va dans la console, jamais au client).

### 9.3 `ah()` : erreurs dans le code asynchrone
Express 4 attrape automatiquement les erreurs des fonctions **synchrones**, mais pas celles des fonctions `async`. Le petit utilitaire :
```js
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
```
enveloppe une route `async` pour envoyer ses erreurs au gestionnaire (`.catch(next)`). Tu le vois autour des routes qui utilisent `await` (hachage de mot de passe, envoi d'email).

### 9.4 Les codes HTTP utilisés
| Code | Signification | Exemple dans le projet |
|---|---|---|
| `200` / `201` | OK / Créé | Note enregistrée / compte créé |
| `400` | Requête invalide | Note = 25, titre vide |
| `401` | Non connecté | Cookie absent ou expiré |
| `403` | Connecté mais **interdit** | Un élève appelle l'espace prof |
| `404` | Introuvable | Établissement inconnu |
| `409` | Conflit | Identifiant déjà pris, suppression d'une classe non vide |
| `413` | Trop gros | Corps de requête > 200 Ko |
| `423` | Verrouillé | Saisie de notes dans un trimestre clôturé |
| `429` | Trop de requêtes | Trop d'essais de connexion |
| `500` | Erreur serveur | Bug inattendu |

---

## 10. Les fichiers : téléversement et téléchargement

### 10.1 Envoyer un fichier : `multer`
📁 `services/upload.js`. Les formulaires avec fichier utilisent le format `multipart/form-data`, que `express.json()` ne lit pas ; **multer** s'en charge.

Ce qu'on vérifie (défense en profondeur) :
1. **Extension** autorisée (`.pdf` ; `.jpg .jpeg .png .webp` pour les images). Le SVG est **refusé** (il peut contenir du JavaScript).
2. **Taille** maximale (10 Mo pour un PDF, 5 Mo par image).
3. **Contenu réel** (« octets magiques ») : un vrai PDF commence par `%PDF`, un JPEG par `FF D8`, etc. Renommer `virus.exe` en `photo.jpg` ne passe pas.
4. **Nom aléatoire** : le fichier est enregistré sous un nom du type `a3f9…c1.jpg`, pas son nom d'origine (pas de collision, pas d'astuce de chemin comme `../../`).
5. **Rangement par établissement** : `uploads/<id_établissement>/`.

⚠️ Si la publication est refusée *après* l'envoi du fichier, le code **supprime le fichier** (sinon on accumulerait des fichiers orphelins). Les tests le vérifient.

### 10.2 Télécharger : jamais de dossier public
`uploads/` n'est **pas** servi par `express.static`. Chaque téléchargement passe par une route (📁 `routes/files.js`, `routes/news.js`) qui vérifie les droits : l'élève ne télécharge que les archives **de sa classe**, le parent que celles des classes de **ses enfants**, etc. Seules les images d'une publication **publique** sont servies sans connexion.

---

## 11. La logique métier : notes, moyennes, bulletins

### 11.1 Les formules (un seul endroit)
📁 `services/grades.js` (40 lignes) :

```js
// Moyenne d'une matière = (moyenne des interrogations + devoir 1 + devoir 2) / 3
function subjectAverage(interros, devoirs) {
  const parts = [];
  const mi = mean(interros);
  if (mi !== null) parts.push(mi);
  devoirs.forEach((d) => parts.push(d));
  return parts.length ? mean(parts) : null;
}
function gradeColor(v) { /* vert ≥ 14, bleu ≥ 10, rouge sinon */ }
```
🔑 **Une règle métier = un seul fichier.** Si la direction veut une autre formule, tu modifies ce fichier, et le tableau de bord, le bulletin PDF et le rang changent ensemble.

### 11.2 Moyennes, rangs, classes
📁 `services/reports.js` :
- `computeClass(schoolId, classId, termId)` : charge **en une seule requête** toutes les notes de la classe, calcule la moyenne de chaque élève dans chaque matière, applique les **coefficients**, puis la moyenne générale et le **rang** (les ex æquo partagent le même rang).
- `buildReport(schoolId, studentId, termId)` : assemble le « bulletin » d'un élève (matières, moyennes, rang, moyenne de classe, appréciation).
- `evolution(...)` : la moyenne générale à chaque trimestre (la courbe).
- Les coefficients sont définis **par niveau** (et éventuellement par série) : toutes les classes d'un même niveau partagent les mêmes règles ; une règle de série remplace celle du niveau.

⚠️ Pourquoi tout charger d'un coup plutôt qu'une requête par élève ? Une classe de 50 élèves × 10 matières = 500 petites requêtes contre 1 seule. C'est le fameux problème « N+1 » ; l'éviter rend le site rapide.

### 11.3 Le bulletin PDF
📁 `services/pdf.js` utilise **PDFKit** : on « dessine » le document (rectangles, textes positionnés en coordonnées) puis on le **branche directement sur la réponse HTTP** :

```js
res.setHeader('Content-Type', 'application/pdf');
doc.pipe(res);   // le PDF est envoyé au fur et à mesure, sans fichier temporaire
doc.end();
```
Règle de gestion (📁 `studentViews.js`) : l'élève télécharge toujours son bulletin ; le **parent** seulement si la moyenne générale est ≥ au seuil réglé par l'établissement (10 par défaut).

---

## 12. Le frontend sans framework

Pas de React, pas de Vue, pas d'étape de build : du **JavaScript moderne** directement dans le navigateur. C'est volontaire (comprendre les bases avant les frameworks), et ça marche très bien pour cette taille de projet.

### 12.1 Les pages
| Page | Script | Rôle |
|---|---|---|
| `index.html` | `landing.js` | L'utilisateur saisit le code de son établissement |
| `school.html` | `school.js` | Site vitrine public (actualités, contacts) |
| `login.html` | `login.js` | Connexion |
| `reset.html` | `reset.js` | Mot de passe oublié / nouveau mot de passe |
| `app.html` | `app.js` + `roles/*.js` | **L'espace connecté** (admin, prof, élève, parent) |
| `platform.html` | `platform.js` | Espace propriétaire |

### 12.2 Comment `app.html` devient 4 applications
📁 `app.js` : demande `/api/auth/me` (« qui suis-je ? »), lit le `role`, puis **charge dynamiquement** le bon module :

```js
mod = (await import(`./roles/${user.role}.js`)).default;
```
Chaque module de rôle exporte le même « contrat » :
```js
export default {
  nav:   [ { key: 'grades', icon: '📝', fr: 'Saisie des notes', en: 'Grade entry' }, ... ],
  views: { grades: async (root, ctx) => { /* dessine dans root */ }, ... },
};
```
`app.js` construit le menu avec `nav`, et quand on clique, appelle `views[key](root)`. 🔑 **Ajouter une page à un rôle = ajouter une entrée dans `nav` + une fonction dans `views`.**

### 12.3 `common.js`, la boîte à outils
| Outil | À quoi ça sert |
|---|---|
| `api(path, options)` | Enveloppe `fetch` : ajoute l'en-tête CSRF, gère le JSON, transforme les erreurs en `Error` lisibles, redirige si session expirée |
| ``h`...` `` | Gabarit HTML **sûr** (voir 12.4) |
| `bind(root, handlers)` | Gestion des clics par « délégation » (voir 12.5) |
| `T('Français', 'English')` | Traduction FR/EN en ligne (12.6) |
| `openModal`, `toast`, `confirmDialog` | Fenêtres et notifications |
| `barChart`, `lineChart` | Graphiques dessinés en SVG à la main |
| `saveWithQueue` | Sauvegarde qui survit à une coupure réseau |
| `shrinkImage`, `openLightbox`, `newsCard` | Photos réduites avant envoi, visionneuse, carte d'actualité |

### 12.4 Se protéger du XSS : le gabarit `h`
**XSS** = un attaquant réussit à faire exécuter *son* JavaScript dans la page d'un autre (par exemple en écrivant `<script>…</script>` dans le titre d'une actualité). Le remède : **échapper** tout texte venant d'un utilisateur avant de l'insérer dans du HTML.

```js
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export const h = (strings, ...vals) => new Raw(strings.reduce((out, s, i) => out + s + (i < vals.length ? part(vals[i]) : ''), ''));
```
Utilisation :
```js
setHtml(root, h`<h3>${a.title}</h3>`);     // a.title est échappé AUTOMATIQUEMENT
```
Si `a.title` vaut `<b>Fête</b>`, l'écran affiche littéralement `<b>Fête</b>`. Et un `h` placé à l'intérieur d'un autre `h` n'est pas ré-échappé une seconde fois. 🔑 **Sécurité par défaut** : on ne peut pas « oublier » d'échapper. (Nous l'avons vérifié dans un vrai navigateur pendant le développement : un `<script>` saisi dans une publication s'affiche comme du texte et n'est pas exécuté.)

### 12.5 Pas de `onclick="…"` : la délégation d'événements
Tu ne verras **aucun** `onclick=` dans le HTML. À la place :
```html
<button data-act="save" data-id="3">Enregistrer</button>
```
```js
bind(root, { save: (el) => { /* el.dataset.id === "3" */ } });
```
`bind` écoute les clics sur le conteneur et cherche l'ancêtre portant `data-act`. Deux avantages : les boutons créés plus tard fonctionnent sans rien rebrancher, et la **Content Security Policy** (`script-src 'self'` dans `server.js`) interdit les scripts en ligne, ce qui bloque une grande famille d'attaques.

### 12.6 Les deux langues
`T('Enregistrer', 'Save')` renvoie l'un ou l'autre selon la langue choisie (mémorisée dans `localStorage`). Les deux textes sont **côte à côte dans le code**, donc impossible d'oublier une traduction. Changer de langue relance l'affichage de la vue courante. (Pour beaucoup de langues, on passerait à des fichiers de traduction ; pour deux, c'est plus simple et robuste.)

### 12.7 Les graphiques sans bibliothèque
`barChart()` et `lineChart()` fabriquent du **SVG** (`<svg><rect …/><path …/></svg>`) à partir des données. Aucune dépendance, fonctionne hors ligne, et c'est un excellent exercice de maths appliquées (changement d'échelle : `x = gauche + (valeur / max) × largeur`).

---

## 13. Sécurité : récapitulatif

| Menace | Protection dans le projet | Où |
|---|---|---|
| Mots de passe volés | Hachage bcrypt, jamais en clair | `util.js`, `auth.js` |
| Deviner les mots de passe | Rate limiting, mot de passe provisoire à changer | `auth.js`, `server.js` |
| Vol de session | Cookie `HttpOnly` + `Secure` + `SameSite` | `middleware/auth.js` |
| **CSRF** (un site tiers agit en ton nom) | `SameSite`, en-tête obligatoire `X-Requested-With` | `middleware/auth.js` |
| **XSS** (script injecté) | Échappement automatique `h`, CSP stricte, pas de scripts en ligne | `common.js`, `server.js` |
| **Injection SQL** | Requêtes préparées (`?`) partout | tout le code |
| **Accès à un autre établissement** | `school_id` partout + `owned()`/`must()` + tests d'isolation | `routes/*`, `smoke.js` |
| **Accès à une autre classe / un autre enfant** | Vérification d'attribution / de lien à chaque requête | `teacher.js`, `parent.js` |
| Fichiers piégés | Extension + contenu + taille, nom aléatoire, hors dossier public | `upload.js` |
| Compte volé / renvoyé | Utilisateur rechargé depuis la base à chaque requête | `middleware/auth.js` |
| Fuite d'informations | Erreur 500 générique ; réponses neutres (« mot de passe oublié ») | `server.js`, `auth.js` |
| Secrets publiés | `.env` ignoré par Git ; refus de démarrer en production sans `JWT_SECRET` | `.gitignore`, `config.js` |

🔑 **Idée directrice** : plusieurs couches indépendantes (« défense en profondeur »). Si l'une a un défaut, une autre retient l'attaque.

⚠️ **Limites honnêtes** : ce projet n'a pas subi d'audit de sécurité indépendant. Avant de l'exposer avec de vraies données, applique la checklist du README (section 6) et fais relire les parties sensibles par une personne expérimentée.

---

## 14. Les tests automatiques

📁 `test/smoke.js` (`npm test`, 133 vérifications) est un test **de bout en bout** :
1. crée une base **jetable** dans un dossier temporaire et la remplit avec `seed.js` ;
2. **lance le vrai serveur** sur le port 3199 ;
3. joue des scénarios avec `fetch` (comme un navigateur, en gardant le cookie de session) ;
4. affiche `ok` / `FAIL` pour chaque vérification, puis supprime tout.

Le motif est toujours le même :
```js
check('Note > 20 refusée',
  (await prof.put('/api/teacher/grades', { ... value: 25 ... })).status === 400);
```

🔑 **Pourquoi c'est précieux** : quand tu modifies le code, tu relances `npm test` et tu sais en 20 secondes si tu as cassé quelque chose (y compris l'isolation entre établissements). C'est ce qui permet de modifier un projet sans peur.

**Comment ajouter un test** : repère la section la plus proche dans `smoke.js`, copie une ligne `check(...)`, adapte. Une bonne habitude : **écris d'abord le test qui échoue, puis le code qui le fait passer.**

---

## 15. Le déploiement (les concepts)

- **`NODE_ENV=production`** : active les protections (cookie `Secure`, `trust proxy`, seed interdit, `JWT_SECRET` obligatoire).
- **Proxy inverse (Nginx)** : reçoit les visiteurs en HTTPS (port 443) et transmet à Node (port 3000). Node ne gère pas le HTTPS lui-même ici. D'où `trust proxy` : pour que l'IP réelle et le protocole (`https`) soient connus.
- **HTTPS (Let's Encrypt / certbot)** : chiffre les échanges ; **obligatoire** car le cookie de session est `Secure`.
- **pm2** : garde Node en vie, le relance après une panne ou un redémarrage du serveur.
- **Sauvegardes** : `npm run backup` (copie cohérente de la base + fichiers, avec rotation). À automatiser et à copier hors du serveur. Un essai de restauration est indispensable.
- **`/healthz`** : une adresse que UptimeRobot interroge toutes les 5 minutes ; si elle ne répond pas, tu reçois un email.
- **Disque persistant** : la base et `uploads/` sont sur le disque. Un hébergeur à disque temporaire les perdrait à chaque redémarrage (voir nos discussions sur l'hébergement gratuit).

Détails pas à pas dans le README, section 6.

---

## 16. Parcours de lecture du code (dans cet ordre)

| # | Fichier | Ce que tu y apprends | Durée |
|---|---|---|---|
| 1 | `package.json` | Scripts, dépendances | 5 min |
| 2 | `.env.example` + `src/config.js` | Configuration par variables d'environnement | 10 min |
| 3 | `server.js` | Assemblage d'une app Express, middlewares, ordre | 30 min |
| 4 | `src/services/util.js` | Erreurs, validation, `ah()` | 15 min |
| 5 | `src/db.js` | Schéma SQL, contraintes, migrations, adaptateur | 45 min |
| 6 | `src/middleware/auth.js` | JWT, cookies, rôles, CSRF | 30 min |
| 7 | `src/routes/auth.js` | Connexion, bcrypt, rate limit, reset | 30 min |
| 8 | `src/routes/teacher.js` | **Une route complète et bien défendue** (notes) | 45 min |
| 9 | `src/services/grades.js` + `reports.js` | Logique métier, calcul des rangs | 45 min |
| 10 | `src/routes/admin.js` | CRUD, `owned/must`, multi-tenant, uploads | 1 h |
| 11 | `public/js/common.js` | `api()`, `h`, `bind`, modales, SVG | 45 min |
| 12 | `public/js/app.js` puis `roles/teacher.js` | Comment l'interface s'assemble | 1 h |
| 13 | `test/smoke.js` | Tests de bout en bout | 30 min |

Astuce : quand une fonction en appelle une autre, `Ctrl + clic` dessus dans VS Code pour y aller.

---

## 17. Ajouter une fonctionnalité : exemple guidé

**Objectif** : ajouter un **slogan** de l'établissement, saisi par l'admin dans *Paramètres* et affiché sur la page publique. C'est petit, mais ça traverse **toutes les couches** — le meilleur exercice pour comprendre.

**Étape 1 — Base** (`src/db.js`)
Ajoute la colonne au `CREATE TABLE schools` : `motto TEXT NOT NULL DEFAULT '',` — et dans le tableau de migration, ajoute `['motto', '']` à la liste `[['description', ''], ['address', ''], …]` (pour les bases déjà créées).

**Étape 2 — API admin** (`src/routes/admin.js`, section *Paramètres*)
- `GET /settings` : ajoute `motto: s.motto` à l'objet renvoyé.
- `PUT /settings` : ajoute `motto = ?` dans la requête `UPDATE schools SET …` et la valeur `str(b.motto, 120)` au bon endroit dans `.run(...)`.

**Étape 3 — API publique** (`src/routes/public.js`) : ajoute `motto: s.motto` à la réponse de `/school/:code`.

**Étape 4 — Formulaire admin** (`public/js/roles/admin.js`, vue `settings`) : ajoute
`<div class="field"><label>Slogan</label><input name="motto" maxlength="120" value="${s.motto}"></div>`.
(Le bouton Enregistrer envoie déjà tous les champs `name=…` via `formValues`, rien d'autre à faire.)

**Étape 5 — Affichage** (`public/js/school.js`) : dans le bloc `hero`, ajoute la ligne suivante (avant le bouton « Se connecter ») :
```js
${school.motto ? h`<p class="gold">${school.motto}</p>` : ''}
```

**Étape 6 — Test** (`test/smoke.js`) : après la modification des paramètres, vérifie que `(await anon.get('/api/public/school/jean-piaget-1')).data.motto` correspond.

**Étape 7** : `npm test`, puis relance le serveur et vérifie à l'œil.

🔑 **Le réflexe** : pour n'importe quelle fonctionnalité, demande-toi *« quelle couche touche-t-elle ? »* — base → route(s) → interface → test.

---

## 18. Exercices (du plus simple au plus ambitieux)

**Niveau 1 — Observer**
1. Lance le site, ouvre les **outils développeur** (`F12`) → onglet **Réseau** (Network). Connecte-toi et navigue : repère chaque appel `/api/...`, son code de statut, sa réponse JSON.
2. Dans le terminal, ajoute `console.log('note reçue', req.body)` dans la route `PUT /grades`, saisis une note, et regarde la console.
3. Ouvre `data/portail.db` dans DB Browser et retrouve la note que tu viens de saisir dans la table `grades`.

**Niveau 2 — Modifier**
4. Dans `services/grades.js`, change les seuils de couleur (par ex. vert dès 15). Relance et regarde le tableau de bord de l'élève.
5. Change la formule : donne plus de poids aux devoirs (par ex. `(moy. interros + 2×D1 + 2×D2) / 5`). Compare les moyennes avant/après.
6. Ajoute une appréciation « Félicitations » pour ≥ 18 (`APPRECIATIONS`).
7. Fais l'exemple guidé du slogan (§17).

**Niveau 3 — Construire**
8. Ajoute une route `GET /api/admin/stats` qui renvoie le nombre de notes saisies par trimestre (une requête `GROUP BY`). Affiche-le sur le tableau de bord admin.
9. Ajoute un **export CSV** des notes d'une classe pour un trimestre (route dans `teacher.js`, `Content-Type: text/csv`, bouton dans l'interface).
10. Ajoute un champ « date de naissance » aux élèves (base, formulaire, affichage).

**Niveau 4 — Approfondir**
11. Écris 5 nouveaux tests d'isolation pour ta route de l'exercice 8 ou 9.
12. Remplace le pilote SQLite par un adaptateur PostgreSQL derrière la même « façade » (réfléchis d'abord aux différences : requêtes asynchrones, `?` → `$1`).
13. Ajoute un rôle « surveillant général » : quelles tables, quelles routes, quels tests ?

---

## 19. Déboguer : ta trousse à outils

1. **Lire l'erreur en entier** : le terminal indique le fichier et la ligne (`at … routes/teacher.js:82`). C'est le meilleur indice.
2. **`console.log`** : affiche une variable pour voir ce qu'elle contient réellement.
3. **Outils développeur du navigateur (`F12`)** : *Console* (erreurs JavaScript de la page), *Réseau* (chaque requête/réponse), *Application → Cookies* (voir le cookie `token`).
4. **Tester l'API sans interface** avec `curl` ou une extension comme « Thunder Client » (VS Code) :
   ```
   curl -i http://localhost:3000/api/public/school/jean-piaget-1
   ```
5. **Débogueur de VS Code** : `F5` → « Node.js » ; place un **point d'arrêt** (clic à gauche du numéro de ligne) et exécute pas à pas.
6. **`npm run dev`** : redémarre le serveur à chaque sauvegarde de fichier.
7. **Réduire le problème** : commente/désactive des parties jusqu'à isoler celle qui casse ; relance `npm test` pour savoir *quoi* a cassé.
8. **Repartir propre** : arrêter le serveur, supprimer `data/portail.db*`, `npm run seed`, `npm start`.

Erreurs fréquentes :
| Message | Cause probable |
|---|---|
| `Cannot find module 'xxx'` | `npm install` non fait, ou faute dans le chemin du `require` |
| `EADDRINUSE` | Le port est déjà utilisé (un autre `npm start` tourne) |
| `401` partout | Session expirée / cookie absent → reconnecte-toi |
| `403 Requête refusée` | En-tête `X-Requested-With` manquant dans un appel manuel |
| `SQLITE_CONSTRAINT` / `FOREIGN KEY` | La base protège une donnée : lis le message |
| Page blanche + erreur rouge en Console | Erreur JavaScript dans `public/js/…` |

---

## 20. Choix de conception, limites, évolutions

### Pourquoi ces choix ?
| Choix | Raison |
|---|---|
| Express **4** (pas 5) | Version très répandue, documentation abondante ; `ah()` gère l'asynchrone |
| **SQLite** | Zéro administration, parfait pour démarrer et pour peu d'établissements |
| `bcryptjs` (pur JavaScript) | Pas de compilation → installation plus fiable sur Windows |
| `better-sqlite3` **optionnel** + repli `node:sqlite` | L'installation ne doit jamais échouer à cause d'un composant natif |
| **Pas d'ORM** | Tu apprends le SQL directement ; chaque requête est visible et vérifiable |
| Front **sans framework** | Moins de concepts à la fois ; aucun outil de build ; comprendre le navigateur avant React |
| Session par **cookie HttpOnly** (pas `localStorage`) | Le JavaScript de la page ne peut pas voler le jeton |
| Base **partagée** + `school_id` | Une seule migration, une seule sauvegarde |

### Limites actuelles
- Une seule instance de serveur (SQLite est un fichier local) ; le limiteur de requêtes est en mémoire.
- Pas d'import CSV, pas de notifications email/SMS pour les actualités, pas de réorganisation des images.
- Pas d'audit de sécurité externe, pas de tests unitaires fins (seulement de bout en bout).
- Les traductions FR/EN sont écrites en dur dans le code (`T(fr, en)`).

### Si le projet grandit
PostgreSQL · TypeScript · découpage du gros `admin.js` en plusieurs fichiers · tests unitaires des services · journalisation structurée (pino) · file d'attente pour les emails · pagination des listes · authentification à deux facteurs · un vrai framework front (React/Vue) si l'interface devient très interactive.

---

## 21. Glossaire

| Terme | Définition |
|---|---|
| **API** | Ensemble d'adresses (« endpoints ») que le serveur expose pour que le navigateur lui demande des données |
| **Endpoint / route** | Une adresse + une méthode : `PUT /api/teacher/grades` |
| **Middleware** | Fonction exécutée avant la route ; peut modifier la requête, refuser, ou passer à la suite (`next()`) |
| **Router** | Groupe de routes rangé dans un fichier |
| **JSON** | Format texte pour échanger des données : `{"nom": "Koffi", "note": 14}` |
| **HTTP méthodes** | `GET` lire · `POST` créer · `PUT` remplacer/modifier · `PATCH` modifier partiellement · `DELETE` supprimer |
| **Cookie** | Petite donnée que le navigateur renvoie automatiquement au serveur |
| **JWT** | Jeton signé prouvant une identité, sans que le serveur ait à le mémoriser |
| **Hachage** | Empreinte à sens unique d'une donnée (pas du chiffrement : on ne peut pas revenir en arrière) |
| **Sel (salt)** | Aléa ajouté avant hachage pour que deux mêmes mots de passe n'aient pas la même empreinte |
| **CSRF** | Attaque où un site tiers fait envoyer à ton navigateur une requête authentifiée à ton insu |
| **XSS** | Injection de JavaScript malveillant dans une page vue par d'autres |
| **CSP** | En-tête qui dit au navigateur quels scripts/ressources il a le droit de charger |
| **Injection SQL** | Faire exécuter du SQL malveillant via une donnée mal traitée |
| **Requête préparée** | Requête SQL dont les valeurs sont passées séparément (`?`) |
| **Transaction** | Groupe d'opérations exécutées « tout ou rien » |
| **Clé étrangère** | Colonne qui pointe vers une ligne d'une autre table, avec vérification |
| **Index** | Structure qui accélère les recherches |
| **Migration** | Modification du schéma d'une base déjà existante |
| **Upsert** | « Insère, sinon met à jour » (`INSERT … ON CONFLICT DO UPDATE`) |
| **Idempotent** | Qu'on peut répéter sans changer le résultat après la première fois |
| **Multi-tenant** | Un seul logiciel qui sert plusieurs clients (ici, établissements) avec données isolées |
| **Rate limiting** | Limiter le nombre de requêtes par visiteur |
| **Proxy inverse** | Serveur (Nginx) placé devant l'application, qui gère le HTTPS et transmet les requêtes |
| **Variable d'environnement** | Valeur de configuration fournie hors du code (`.env`) |
| **Dépendance** | Bibliothèque externe dont dépend le projet |
| **Idempotence, atomicité** | Propriétés qui rendent un système fiable : rejouable / « tout ou rien » |
| **N+1** | Anti-motif : une requête par élément au lieu d'une seule pour tous |
| **Défense en profondeur** | Superposer plusieurs protections indépendantes |

---

## 22. Pour aller plus loin (ressources)

- **JavaScript moderne** : `javascript.info` (excellent tutoriel gratuit) et `developer.mozilla.org` (MDN, la référence : `fetch`, DOM, promesses…).
- **Node.js** : la documentation officielle `nodejs.org` (rubrique *Learn*), notamment les modules `fs`, `path`, `crypto`.
- **Express** : `expressjs.com` (guides *Routing* et *Using middleware*).
- **SQL** : `sqlbolt.com` (exercices interactifs) et la documentation `sqlite.org` (syntaxe).
- **Sécurité web** : `owasp.org` — *Top 10* et *Cheat Sheet Series* (authentification, sessions, XSS, CSRF).
- **Git/GitHub** : le guide « Git Handbook » de GitHub, et `git status` avant chaque `commit`.

---

### 🎯 En résumé
Un projet Node.js bien organisé sépare **la configuration**, **les routes** (HTTP), **les services** (logique métier), **la base** (données) et **l'interface**. Il **valide tout côté serveur**, **protège chaque accès** (connexion → rôle → appartenance), **teste** ce qui compte, et se **déploie** derrière un proxy en HTTPS avec des **sauvegardes**. Tu as maintenant, dans un seul projet, un exemple concret de chacune de ces idées : ouvre les fichiers, modifie, casse, répare — c'est comme ça qu'on apprend.

*Bon courage, et n'hésite pas à revenir avec tes questions sur n'importe quelle partie.*
