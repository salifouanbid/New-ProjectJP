# 🎓 Portail Scolaire — un seul logiciel pour plusieurs établissements

Application web (Node.js + Express + SQLite) pour gérer **notes, moyennes, absences, bulletins PDF, cahier de texte et archives d'épreuves**.

**Un seul logiciel, plusieurs collèges/lycées** : chaque établissement a son code (ex. `jean-piaget-1`), sa **page publique** (`/e/jean-piaget-1`), son lien de **connexion** (`/e/jean-piaget-1/connexion`) et ses données **totalement séparées** des autres. Plus besoin de copier le logiciel pour chaque école.

- 4 espaces par établissement : **Administrateur**, **Professeur**, **Élève**, **Parent**
- 1 espace **Plateforme** (propriétaire du logiciel) pour créer/suspendre les établissements
- 1 **site vitrine intégré** par établissement : présentation, contact, **actualités et événements** publiés par la direction (publics, ou réservés aux parents/élèves/professeurs connectés)
- Interface **français / anglais**, design glassmorphism (bleu nuit / cyan / or), responsive (téléphone OK)

---

## 1. Ce qu'il faut installer

| Outil | Obligatoire ? | Détail |
|---|---|---|
| **Node.js** (LTS 20 ou 22, ou plus récent) | ✅ oui | https://nodejs.org — `npm` est installé avec |
| Base de données | ❌ non | SQLite est un simple fichier (`data/portail.db`), rien à installer |
| Express, etc. | ❌ non | Tout est installé automatiquement par `npm install` |

Vérifier : `node -v` (≥ 18) et `npm -v`.

## 2. Lancer en local (5 minutes)

```bash
cd portail-scolaire
npm install            # installe les dépendances (1 fois)
copy .env.example .env # Windows   (Mac/Linux : cp .env.example .env)
npm run seed           # (facultatif) crée 2 établissements de démonstration
npm start              # démarre le serveur
```

Ouvrir **http://localhost:3000**

Au **premier démarrage**, un compte propriétaire est créé et son mot de passe s'affiche dans la console (à garder !). Vous pouvez aussi le fixer dans `.env` (`SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD`) avant de démarrer.

### Comptes de démonstration (après `npm run seed`)

Mot de passe de **tous** : `Demo1234!`

| Établissement (code) | Rôle | Identifiant |
|---|---|---|
| `jean-piaget-1` ou `lycee-demo` | Administrateur | `admin` |
| idem | Professeurs | `prof.maths`, `prof.francais`, `prof.anglais`, `prof.divers` |
| idem | Élèves | `eleve1` … `eleve12` |
| idem | Parents | `parent1` … `parent4` |
| *(aucun code — page `/platform.html`)* | Propriétaire plateforme | `superadmin` |

> ⚠️ Le seed est réservé au développement. Ne l'utilisez jamais en production.

## 3. Mettre un nouvel établissement en service

1. Connectez-vous sur **/platform.html** (propriétaire) → **Nouvel établissement** : nom, ville, **code** (ex. `college-xyz`) et compte du directeur. Un mot de passe provisoire est affiché une seule fois.
2. Donnez au directeur le lien `https://votre-site/e/college-xyz` : c'est la **page publique** de l'établissement, avec un bouton « Se connecter » (connexion directe : `/e/college-xyz/connexion`). Le code fonctionne aussi sur la page d'accueil.
3. Le directeur se connecte (il change son mot de passe), puis dans son espace :
   1. **Structure** → « Charger un référentiel de départ » (ou créez niveaux, séries, matières) → **Classes**
   2. **Coefficients** → coefficient de chaque matière par niveau (et par série si besoin)
   3. **Utilisateurs** → créer professeurs, élèves, parents ; **Classes** (attributions) pour chaque professeur ; **Enfants** pour rattacher les élèves à leurs parents
   4. **Périodes** → Trimestre 1 est déjà ouvert. Les professeurs peuvent saisir.
   5. **Paramètres** → présentation, adresse, téléphone, email et horaires affichés sur la page publique
   6. **Actualités** → publier une information ou un événement (voir ci-dessous)
4. Chaque compte créé reçoit un mot de passe provisoire (généré ou choisi) à changer à la 1re connexion.

### Actualités & événements (site vitrine)
Menu **Actualités** de l'administrateur → **Nouvelle publication** :
- **Type** : Actualité, Événement ou Info pratique ; **date de l'événement** facultative (les événements à venir sont listés à part) ; option **📌 Épingler** en haut.
- **Images** (facultatives) : jusqu'à **6 par publication**, en JPG, PNG ou WebP. Les photos de téléphone sont **réduites automatiquement** (1600 px, ~150–300 Ko chacune) avant l'envoi ; le serveur accepte 5 Mo maximum par image et vérifie le vrai contenu du fichier (le SVG est refusé). Elles s'affichent en **galerie** ; un clic ouvre la photo en grand, avec flèches ← → pour parcourir. À la modification, on peut **retirer** certaines images et en **ajouter** d'autres. Les images d'une publication « Membres » ne sont visibles que par les personnes connectées de l'établissement ; les fichiers retirés ou supprimés sont effacés du disque.
- **Visible par** : *Tout le monde* (apparaît sur la page publique `/e/<code>`, sans connexion) ou *Membres connectés uniquement* (parents, élèves, professeurs : onglet « Actualités » de leur espace). Utilisez « Membres » pour les infos internes (frais de scolarité, rappels aux parents…).
- Le texte est affiché tel quel (les retours à la ligne sont conservés ; le HTML n'est pas interprété, donc sans risque).

## 4. Règles métier (adaptables)

- **Notes** : jusqu'à **6 interrogations** + **2 devoirs** par matière et par trimestre, sur 20.
- **Moyenne de matière** = (moyenne des interrogations + devoir 1 + devoir 2) / 3 *(composantes absentes ignorées)*.
- **Moyenne générale** = Σ(moyenne × coefficient) / Σ coefficients. **Rang** calculé dans la classe.
- **Couleurs** : vert ≥ 14, bleu ≥ 10, rouge < 10.
- **Bulletin PDF** : élève = toujours ; parent = seulement si moyenne générale ≥ seuil (10 par défaut, réglable dans *Paramètres*).
- **Clôture d'une période** : notes gelées (lecture seule) + ouverture automatique de la suivante.
- 👉 Pour changer la formule, les seuils ou les appréciations : **`src/services/grades.js`** (un seul fichier).

## 5. Sécurité intégrée

- Mots de passe hachés (bcrypt) ; jamais stockés en clair ; mot de passe provisoire à changer obligatoirement.
- Session par cookie `HttpOnly` + `SameSite` ; protection CSRF par en-tête ; en-têtes de sécurité (Helmet, CSP stricte).
- **Isolation des établissements** : chaque requête est filtrée par l'établissement de l'utilisateur connecté et **chaque identifiant reçu est revérifié** côté serveur. Le test `npm test` tente d'accéder aux données d'un autre établissement (modifier, supprimer, télécharger…) et vérifie le refus.
- Chaque professeur n'accède qu'à ses classes/matières ; chaque parent qu'à ses enfants ; un élève ne peut ouvrir ni l'espace professeur ni l'admin, même en tapant l'adresse.
- Compte ou établissement désactivé = accès coupé immédiatement.
- Limitation des tentatives de connexion ; réponses neutres pour « mot de passe oublié » ; jeton de réinitialisation à usage unique (1 h).
- Fichiers téléversés : type vérifié **sur le contenu**, taille limitée, stockés hors du dossier public, téléchargement contrôlé.
- Sauvegardes transactionnelles : un appel de 50 élèves ou une saisie de notes est enregistré **en entier ou pas du tout**. Côté navigateur, si le réseau coupe, la saisie est gardée et renvoyée automatiquement au retour de la connexion.

## 6. Mise en ligne (production)

### Configuration
Dans `.env` :
```
NODE_ENV=production
JWT_SECRET=<longue chaîne aléatoire>     # node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
APP_URL=https://portail.exemple.bj
SUPERADMIN_USERNAME=...   SUPERADMIN_PASSWORD=...
SMTP_HOST=... SMTP_PORT=587 SMTP_USER=... SMTP_PASS=... SMTP_FROM="Portail <no-reply@exemple.bj>"
```
En production les cookies sont `Secure` : le site **doit** être servi en **HTTPS**.

### Sur un serveur (VPS Ubuntu, ex. ≈ 10 000 FCFA/mois)
```bash
# 1. Node.js LTS + outils
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs nginx
sudo npm install -g pm2

# 2. Déployer
git clone <votre-depot> portail && cd portail      # ou envoyez le dossier par scp
npm install --omit=dev
cp .env.example .env && nano .env                  # remplir comme ci-dessus

# 3. Lancer en continu (redémarre tout seul)
pm2 start server.js --name portail
pm2 save && pm2 startup
```
**Nginx** (`/etc/nginx/sites-available/portail`) :
```nginx
server {
  server_name portail.exemple.bj;
  client_max_body_size 12m;
  location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; proxy_set_header X-Forwarded-Proto $scheme; }
}
```
Puis `sudo ln -s /etc/nginx/sites-available/portail /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx` et le HTTPS gratuit : `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d portail.exemple.bj`.

**Nom de domaine (.bj)** : chez le registraire, créez un enregistrement **A** `portail` → adresse IP du serveur.

### ⚠️ Hébergeurs « cloud » gratuits
Le logiciel stocke la base (`data/`) et les fichiers (`uploads/`) **sur le disque**. Sur un hébergeur dont le disque est temporaire (certains plans gratuits), tout serait perdu à chaque redémarrage : choisissez un **VPS** ou activez un **disque persistant** monté sur `data/` et `uploads/`.

### Sauvegardes (indispensable : ce sont de vraies notes d'élèves)
```bash
npm run backup        # crée backups/AAAA-MM-JJ_HHhMMmSSs/ (base + fichiers), garde les 14 dernières
```
La sauvegarde est cohérente **même pendant que le site tourne**. Automatisez-la chaque nuit :
- **Linux** : `crontab -e` puis `0 2 * * * cd /chemin/portail && /usr/bin/npm run backup >> backup.log 2>&1`
- **Windows** : Planificateur de tâches → tâche quotidienne qui exécute `npm run backup` dans le dossier du projet.

⚠️ Une sauvegarde qui reste **sur le même serveur** ne protège pas d'une panne du serveur : copiez régulièrement le dossier `backups/` ailleurs (autre machine, disque externe, stockage cloud).

**Restaurer** : arrêter le site (`pm2 stop portail`), remplacer `data/portail.db` par `backups/<date>/portail.db` et le contenu de `uploads/` par `backups/<date>/uploads/`, puis redémarrer (`pm2 start portail`). Faites un **essai de restauration** avant d'en avoir besoin.

### Supervision
`https://portail.exemple.bj/healthz` répond `{"ok":true}` si le site et la base fonctionnent : branchez-le sur un service gratuit de surveillance (ex. UptimeRobot) pour être prévenu par email si le site tombe.

### ✅ Checklist avant d'ouvrir à de vrais utilisateurs
1. `JWT_SECRET` long et aléatoire dans `.env`, `NODE_ENV=production`, site en **HTTPS**.
2. **Ne pas lancer `npm run seed`** sur le serveur de production (comptes de démo à mot de passe connu). Si c'est fait par erreur : supprimer la base et recommencer.
3. Changer le mot de passe propriétaire (il est déjà obligatoire à la première connexion s'il a été généré).
4. Sauvegarde nocturne **automatique** + copie hors du serveur + **un essai de restauration** réussi.
5. Surveillance `/healthz` active.
6. Démarrage automatique après un redémarrage du serveur (`pm2 save && pm2 startup`).
7. Essai « grandeur nature » avec 1 classe et quelques enseignants avant d'ouvrir à toute l'école.
8. Vérifier avec la direction les règles de **protection des données** applicables (données d'élèves mineurs) et les informer clairement de ce qui est stocké.
9. Si un proxy est placé devant Nginx (ex. Cloudflare), régler `TRUST_PROXY=2` (sinon la limite de tentatives de connexion se base sur la mauvaise adresse IP).

## 7. Dépannage

| Problème | Solution |
|---|---|
| `npm install` affiche une erreur sur **better-sqlite3** | Sans gravité : c'est une dépendance *optionnelle*. Avec **Node ≥ 22**, le logiciel utilise automatiquement SQLite intégré à Node. Sinon, installez Node 22 LTS. |
| « Port already in use » | Changez `PORT` dans `.env` |
| Impossible de se connecter en production | Le site n'est pas en HTTPS (cookies `Secure`), ou `JWT_SECRET` a changé (reconnectez-vous) |
| Pas d'email « mot de passe oublié » | Sans SMTP configuré, le lien s'affiche dans la console du serveur. L'admin peut aussi générer un mot de passe provisoire (bouton 🔑). |
| Mot de passe propriétaire perdu | Supprimez la ligne du `superadmin` dans la base, redémarrez : un nouveau compte est créé (ou définissez `SUPERADMIN_PASSWORD`). |

## 8. Structure du projet

```
server.js                 démarrage, sécurité, routes
src/
  config.js  db.js        configuration + schéma SQLite (pilote auto)
  bootstrap.js            création du compte propriétaire
scripts/backup.js         sauvegarde complète (base + fichiers)
  seed.js                 données de démonstration
  middleware/auth.js      session, rôles, CSRF
  routes/                 auth, platform, admin, teacher, student, parent, files, news, public
  services/               grades.js (formules), reports.js (moyennes/rangs), pdf.js (bulletin),
                          mailer.js, upload.js, schools.js, util.js
public/                   interface (HTML/CSS/JS sans étape de build) — index (accueil), school (vitrine), login, app…
  js/roles/               admin.js, teacher.js, student.js, parent.js, shared.js
test/smoke.js             test de bout en bout (133 vérifications, dont l'isolation entre établissements)
data/  uploads/           base de données et fichiers (créés automatiquement, à sauvegarder)
```

Commandes : `npm start` · `npm run dev` (redémarrage auto) · `npm run seed` · `npm run backup` · `npm test`

## 9. Limites connues / pistes d'évolution

- Import CSV d'élèves/notes non inclus (création manuelle ou via l'API).
- 6 images maximum par publication, pas de réorganisation de l'ordre des images, pas de pièces jointes (PDF…) et pas de notification email/SMS : les parents voient les publications en se connectant.
- Pas d'authentification par OTP/SMS ; la réinitialisation se fait par lien email ou par l'administrateur.
- La page d'accueil utilise une scène 3D en CSS (pas de Three.js).
- Un seul serveur/fichier SQLite : parfait pour des dizaines d'établissements ; au-delà, prévoir une migration vers PostgreSQL.
