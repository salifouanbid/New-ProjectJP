# 🚀 Plan start-up « suivi scolaire & parental »
### Ce qu'il faut ajouter, retirer, à quel prix vendre — et *où* modifier ton projet actuel

> **Règle du document** : tu ne remplaces rien. Pour chaque idée, je te dis **quel fichier de ton projet modifier** (ou quel nouveau fichier ajouter). Le seul morceau déjà prêt et **testé** est le patch d'abonnements (Annexe A).

---

## 0. En 10 lignes

1. **Restafy n'est pas une start-up de suivi parental** : c'est un logiciel de commandes/caisse pour **restaurants** à Cotonou. Tu peux copier **son modèle économique et sa présentation**, pas son produit.
2. **Le marché scolaire existe déjà** : Novacole (présent au Bénin, « 150+ établissements » selon son site), NYONNUI (un témoignage sur son site la décrit comme la 1re plateforme de gestion de collège au Bénin), EduSahel, KiboERP, SmartSchool, Zaame (gratuit)… Tu n'es pas seul. **Tu ne gagneras pas en ayant plus de fonctions** ; tu gagneras par un **angle précis**.
3. **Ton angle** : *« Le suivi scolaire que les parents utilisent vraiment »* — rapide sur téléphone, alertes WhatsApp/SMS, prix simple en FCFA, mise en route en 1 journée avec import Excel, support en français par WhatsApp.
4. **Ce qui manque pour être vendable** (voir §4) : abonnement/facturation (⚠️ **patch prêt**), notifications aux parents, import Excel/CSV, appli installable (PWA), logo et bulletins personnalisés, page marketing, pages légales.
5. **Ce qui fait l'argent chez les concurrents** : les alertes aux parents **et surtout l'encaissement de la scolarité par Mobile Money** (c'est là que les écoles gagnent du temps et de l'argent).
6. **Ne construis pas** : la comptabilité, la paie, la gestion de stock. Laisse ça aux ERP.
7. **Tarifs proposés** (hypothèses à tester) : Starter **12 900 F/mois**, École **29 900 F/mois**, Établissement+ **54 900 F/mois**, essai gratuit 60 jours, 2 mois offerts en annuel, frais d'installation à part (§6).
8. **Objectif réaliste 90 jours** : 3 écoles pilotes qui **paient** (même un petit montant), pas 30 écoles gratuites.
9. **Avant de coder de nouvelles fonctions** : parle à 10 directeurs (§9). Ce que tu ajoutes doit venir d'eux.
10. **Juridique** : tu stockes des données d'élèves mineurs. Fais valider contrats, CGU et protection des données par un juriste (§8).

---

## 1. Ce que Restafy t'apprend (et ce qu'on ne sait pas)

D'après leur site (chiffres **auto-déclarés**, je n'ai pas pu les vérifier) :

| Ce que fait Restafy | À transposer à ton projet |
|---|---|
| Cible **un métier précis** (maquis, snacks, restaurants de Cotonou) | Cible **un type d'école** précis : *collèges privés* d'Abomey-Calavi / Cotonou / Porto-Novo |
| Prix **en FCFA**, 3 formules : Essai 0 F (30 j, sans carte), **Starter 9 900 F/mois**, **Pro 24 900 F/mois** ; annuel = « 2 mois offerts » | Même structure, prix adaptés à la taille de l'école (§6) |
| **0 % de commission**, abonnement fixe | « Nous ne prélevons **rien** sur la scolarité encaissée » (frais Mobile Money = ceux de l'opérateur) |
| Paiements MTN MoMo / Moov / Celtiis **via un agrégateur (Kkiapay)** | Même principe pour la scolarité : **tu ne détiens jamais l'argent**, l'agrégateur oui |
| Pas d'appli à installer : le client scanne un **QR** | Le parent ouvre un **lien** (ou installe la **PWA**), sans compte compliqué |
| **Onboarding par WhatsApp**, réponse sous 24 h | Onboarding assisté par WhatsApp, import Excel fait **par toi** |
| Calculateur « **Combien vous coûte une commande perdue ?** » (compare la perte mensuelle au prix de l'abonnement) | Calculateur « **Combien vous coûtent les impayés et la saisie manuelle ?** » |
| Pages par segment (`/solutions/maquis`…), FAQ, CGU/CGV/confidentialité/cookies, mentions légales | Pages « Collège privé », « Lycée », « Groupe scolaire » + pages légales |
| Captures **réelles** du produit avec de vrais montants FCFA | Captures de **ton** portail avec de vraies (fausses) données béninoises |

À retenir : Restafy vend un **résultat chiffré** (« 4 min → 47 s », « −37 500 F/semaine évités »), pas une liste de fonctions. Fais pareil : « bulletins en 5 minutes au lieu de 1 semaine », « alerte d'absence aux parents en 1 minute ».

---

## 2. Le terrain de jeu : les concurrents scolaires

Ce que disent **leurs propres sites** (je n'ai pas leurs prix) :

| Acteur | Ce qu'il met en avant |
|---|---|
| **Novacole** | Togo, Bénin, Burkina, Mali, Niger, Côte d'Ivoire ; notes, paiements, bulletins, communication ; Mobile Money ; « 150+ établissements » ; **essai gratuit de 3 mois** ; multi-écoles depuis un compte |
| **NYONNUI** | Un témoignage sur son site la décrit comme *« première plateforme de gestion de collège au Bénin »* ; site vitrine + application de suivi scolaire |
| **EduSahel** | Absences avec **SMS aux parents**, historique, stats d'assiduité ; **saisie hors connexion** via une « Box » locale |
| **KiboERP** | Scolarité **payée en Wave/Orange Money**, **relances automatiques**, alertes SMS d'absence, comptabilité OHADA |
| **SmartSchool** | Abonnement mensuel **par école selon la taille**, mois d'essai gratuit, **installation par leur équipe + import Excel + formation**, opérationnel « en une journée » ; SMS/WhatsApp aux parents |
| **Zaame** | Logiciel de gestion scolaire **gratuit** (pression sur les prix) |
| Blog Kolonell | Une appli scolaire **sur mesure** coûte 1,5 à 6 M FCFA, maintenance 75 000–200 000 F/mois (observé au Sénégal/Côte d'Ivoire) ; l'élément qui rentabilise = **recouvrement de la scolarité par Mobile Money** |
| Guide AppAcademia | Recommande une tarification **par élève et par an**, des formats de bulletins **officiels par pays**, un import CSV/Excel, le bilinguisme |

**Lecture honnête** : sur les *fonctions de base* (notes, bulletins, absences, portail parents), tu es déjà au niveau. Sur **ce qui rapporte** (SMS/WhatsApp, paiement de la scolarité, import Excel, appli mobile), tu es **en retard**.

---

## 3. Où tu peux réellement gagner (positionnement)

Ne te bats pas sur « tout-en-un ». Choisis **un angle** :

> **« Le portail des parents » : les parents savent tout, tout de suite, sans effort.**

Différenciateurs réalistes pour un petit acteur :
1. **Mobile d'abord** (PWA installable, léger pour les téléphones d'entrée de gamme et les connexions lentes).
2. **Alertes utiles** : absence, note importante, bulletin disponible, événement, impayé (pas du spam).
3. **Résumé hebdomadaire par WhatsApp** aux parents (« Cette semaine : 2 absences, moyenne en maths 12,5 → 14 »).
4. **Alertes intelligentes** pour la direction (absences répétées, moyenne en chute) — calculées en SQL, sans IA au départ.
5. **Prix lisible + démarrage en 1 journée** (tu importes leurs listes, tu formes la direction).
6. **Bilingue FR/EN** (déjà fait) et **support humain par WhatsApp**.
7. **Réactivité** : ce qu'un petit acteur local fait mieux qu'un gros (adapter un bulletin au format de l'école en 48 h).

Plus tard, comme option premium : un **tuteur IA** pour les élèves (tu as déjà un projet dans ce sens à réutiliser).

---

## 4. Ajouter / Retirer — avec **où modifier**

### 4.1 À AJOUTER (par priorité)

| # | Fonction | Pourquoi (argent / vente) | Où modifier ton projet |
|---|---|---|---|
| **1** | **Abonnements & facturation** (formules, essai 60 j, expiration, limite d'élèves, paiements enregistrés, revenus) | Sans ça, tu ne peux pas **encaisser** ni couper proprement un impayé | ✅ **Patch prêt** → Annexe A (`db.js`, `schools.js`, `middleware/auth.js`, `routes/admin.js`, `routes/platform.js`, `public/js/platform.js`, `public/js/app.js`, `public/app.html`) |
| **2** | **Téléphone du parent** dans les formulaires | Prérequis de toutes les alertes | `public/js/roles/admin.js` → fonction `userModal()` : ajoute un champ `<input name="phone">`. Le serveur (`routes/admin.js`, POST/PUT `/users`) **enregistre déjà** `phone` ✅ |
| **3** | **Bouton « Prévenir sur WhatsApp »** (version gratuite des alertes) | Valeur immédiate, coût 0 : un lien `https://wa.me/<numéro>?text=<message>` prérempli | `routes/admin.js` : dans `GET /absences`, ajoute une jointure `parent_students` → `users.phone` (colonne `parent_phone`). `public/js/roles/admin.js` → onglet *Absences* de `monitoring()` : ajoute un `<a href="https://wa.me/…">` par ligne |
| **4** | **Import Excel/CSV** (élèves + parents) | La mise en route est **le** frein n°1 (comme le dit SmartSchool : « importe vos listes Excel ») | `services/upload.js` (autoriser `.csv`, vérifier que c'est du texte UTF-8) ; `routes/admin.js` : nouvelle route `POST /users/import` (transaction, rapport d'erreurs par ligne, mots de passe provisoires renvoyés) ; `public/js/roles/admin.js` → vue `users()` : bouton « Importer » ; ajoute des tests dans `test/smoke.js` |
| **5** | **PWA** (appli installable + rapide) | Les parents « installent » le portail sans passer par un store | Nouveaux fichiers : `public/manifest.webmanifest`, `public/sw.js`, `public/icons/` (192 et 512 px). Ajouter `<link rel="manifest">` + `<meta name="theme-color">` dans le `<head>` de chaque page ; enregistrer le service worker dans `public/js/app.js`. ⚠️ Le service worker ne doit **jamais** mettre `/api/` en cache |
| **6** | **Logo + couleurs de l'école** sur le portail et le **bulletin PDF** | Un bulletin « aux couleurs de l'école » se vend tout seul | `db.js` (colonne `schools.logo_file`) ; `routes/admin.js` PUT `/settings` (multipart, réutilise `makeUploader` de `services/upload.js`) ; `routes/public.js` (servir le logo) ; `services/pdf.js` → `streamBulletin` (`doc.image(...)` dans l'en-tête) ; `public/js/school.js` et `app.js` (afficher) |
| **7** | **Page marketing + tarifs + pages légales** | Sans elle, personne ne te trouve ni ne te fait confiance | `public/index.html` (voir §4.2) ; nouvelles pages `public/legal/*.html` ; liens dans le pied de page |
| **8** | **Notifications automatiques** (WhatsApp/SMS) | C'est ce que les concurrents vendent le plus | Nouveau `src/services/notify.js` (file d'envoi + fournisseur interchangeable) ; table `notifications` dans `db.js` ; déclencheurs dans `routes/teacher.js` (PUT `/attendance`, après la transaction : si `absent` → notifier) et `routes/admin.js` (validation d'un justificatif, publication d'une actualité avec case « prévenir les parents ») ; crédits par école (`schools.sms_credits`). ⚠️ Vérifie **prix et disponibilité** des fournisseurs avant de promettre |
| **9** | **Messagerie parents ↔ école** (simple) | Réduit les appels et les papiers | Tables `threads`/`messages` (`db.js`) ; nouvelle route `routes/messages.js` montée dans `server.js` ; une vue `messages` dans chaque module `public/js/roles/*.js` (`nav` + `views`) |
| **10** | **Emploi du temps** | Attendu par les parents et les élèves | Table `timetable_slots` ; éditeur dans `roles/admin.js` ; vues de lecture dans `student.js`, `parent.js`, `teacher.js` |
| **11** | **Scolarité & paiement Mobile Money** | **La** fonction qui rapporte (recouvrement) | Étape A (sans agrégateur) : tables `fee_plans`, `installments`, `payments` ; `routes/finance.js` ; reçu PDF (`services/pdf.js` → `streamReceipt`) ; vue « Impayés ». Étape B : agrégateur (Kkiapay, FedaPay…) avec **webhook** — ⚠️ déclare la route webhook **avant** la ligne `app.use('/api', mw.csrfHeader)` dans `server.js` et **vérifie la signature** |
| **12** | **Alertes intelligentes + résumé hebdo** | Ton angle « parent d'abord » | Nouveau `src/services/insights.js` (absences répétées, chute de moyenne, notes manquantes) ; route `GET /api/admin/insights` ; carte sur le tableau de bord (`roles/admin.js` → `dashboard()`) ; envoi via `notify.js` |
| **13** | **Fonctions par formule** (« feature flags ») | Te permet de **vendre par paliers** | Nouveau `src/services/plans.js` avec `hasFeature(school, 'sms')` ; refus 402 côté routes ; masquer le menu côté interface (envoyer la liste des fonctions dans `publicUser()` de `middleware/auth.js`) |

### 4.2 À RETIRER ou SIMPLIFIER (sans casser le code)

| Élément | Action | Où |
|---|---|---|
| **Cube 3D + orbite** de la page d'accueil | À retirer : c'est joli mais ça ne vend pas | `public/index.html` (bloc `.scene`) et `public/css/style.css` (classes `.scene`, `.cube`, `.orbit`, `@keyframes spin`, `spin2`) |
| **Saisie du « code établissement » comme bouton principal** | À déplacer en petit lien « Accéder à mon établissement » : l'accueil doit s'adresser aux **directeurs** (ta cible payante), pas aux parents déjà clients | `public/index.html`, `public/js/landing.js` (logique conservée) |
| **Lien « Espace plateforme »** en pied de page | À retirer de la page publique (tu connais l'adresse `/platform.html`) | `public/index.html` |
| **Comptabilité / paie / stock** | **Ne pas construire** | — |
| **Inscription libre d'une école** | Ne pas l'ouvrir : garde l'**onboarding assisté** (meilleure qualité, permet des frais d'installation) | (déjà le cas : seule la plateforme crée un établissement) |
| **Comptes de démo** | Jamais en production | (déjà bloqué : `seed.js` refuse en production) |
| Modules « secondaires » (discipline, archives) | Ne pas supprimer : les **réserver à des formules** via les fonctions par formule (#13) | `src/services/plans.js` |

---

## 5. Détail de la page marketing (ce qui doit y figurer)

Structure inspirée de Restafy, adaptée aux écoles — à mettre dans `public/index.html` :

1. **Titre-résultat** : « Vos bulletins en 5 minutes. Vos parents informés en 1 minute. »
2. **Boutons** : « Demander une démo (WhatsApp) » · « Essai gratuit 60 jours — sans carte »
3. **Le problème** : cahiers, Excel, papiers perdus, parents qui appellent.
4. **Le produit** en 4 captures de **ton** portail (notes, bulletin PDF, espace parent, actualités).
5. **Calculateur** : élèves × temps de saisie × coût du temps + impayés → « le logiciel coûte X fois moins ».
6. **Sécurité & données** : « Chaque école est isolée » ; sauvegardes quotidiennes ; hébergement ; qui a accès à quoi.
7. **Tarifs** (§6) avec bascule mensuel/annuel.
8. **FAQ** (5–7 questions) + **pages légales** (mentions, confidentialité, CGU, CGV).
9. **Pied de page** : WhatsApp, email, lien de connexion.

---

## 6. Tarifs proposés (⚠️ hypothèses à tester auprès de vrais directeurs)

**Repères** : Restafy vend 9 900 F et 24 900 F/mois à des restaurants ; les blogs du secteur recommandent un prix **par élève et par an** et non par utilisateur. Un collège de 400 élèves qui encaisse la scolarité manipule des dizaines de millions de FCFA par an : un logiciel à ~30 000 F/mois reste une **petite** ligne de dépense (~0,3–1 % du chiffre d'affaires de l'école, selon ses frais de scolarité). Je n'ai **pas** trouvé les prix publics des concurrents scolaires : c'est la première chose à découvrir (demande des devis en te faisant passer pour un client).

| Formule | Élèves | Prix / mois | Prix / an (2 mois offerts) | Contenu (proposition) |
|---|---|---|---|---|
| **Essai** | jusqu'à 100 | **0 F — 60 jours**, sans carte | — | Fonctions de base, 30 alertes offertes, accompagnement WhatsApp |
| **Starter** | ≤ 150 | **12 900 F** | 129 000 F | Notes, bulletins PDF, absences, cahier de texte, portail parents, page publique/actualités |
| **École** ⭐ | ≤ 400 | **29 900 F** | 299 000 F | + import Excel, alertes WhatsApp/SMS (quota inclus), logo & bulletin personnalisé, messagerie, emploi du temps, alertes intelligentes |
| **Établissement+** | ≤ 800 | **54 900 F** | 549 000 F | + scolarité & relances, plusieurs administrateurs, exports, support prioritaire |
| **Réseau** | > 800 ou plusieurs sites | Sur devis | — | Repère : ~45–60 F par élève et par mois |

*(Ces prix sont exactement ceux codés dans le patch d'abonnements — tu peux les changer dans `PLANS` de `src/routes/platform.js`.)*

**Frais uniques** (à annoncer clairement, comme « ce qui n'est pas inclus » chez Restafy) :
- **Installation + import Excel + formation** : 25 000 F (Starter) · 50 000 F (École) · 100 000 F (Établissement+) — *offerts en paiement annuel*.
- **Bulletin au format officiel spécifique** : 50 000 à 150 000 F selon la complexité.
- **Packs d'alertes** au-delà du quota : prix = coût du fournisseur × 1,5 à 2 (à calculer quand tu auras choisi le fournisseur).

**Règles de prix à garder** : 0 % de commission (comme Restafy) ; paiement annuel encouragé (trésorerie) ; augmentation de palier **automatique** quand l'école dépasse sa limite d'élèves (déjà géré : refus 402 « passez à la formule supérieure »).

**Ce que ça peut rapporter (calcul simple, hors coûts)** :
| Scénario | Répartition | Revenu mensuel | Par an |
|---|---|---|---|
| 10 écoles | 5 Starter + 4 École + 1 Établissement+ | 5×12 900 + 4×29 900 + 54 900 = **239 000 F** | ≈ 2,9 M F |
| 30 écoles | 12 Starter + 14 École + 4 Établissement+ | **793 000 F** | ≈ 9,5 M F |

**Coûts à prévoir** : serveur (quelques milliers de FCFA/mois au départ), nom de domaine, alertes (coût fournisseur), frais de l'agrégateur de paiement (payés par l'école ou les parents, pas par toi), ton temps de support, et la formalisation de l'entreprise.

---

## 7. Feuille de route 90 jours (proposition)

**Semaines 1–2 — Pilote & base commerciale**
- Applique le **patch d'abonnements** (Annexe A) ; ajoute le champ téléphone (#2) et le bouton WhatsApp (#3).
- Fais tourner le portail dans **ton école pilote** avec une seule classe.
- Interviewe **10 directeurs** (§9).

**Mois 1 — Ce qui débloque la vente**
- Import CSV (#4), logo & bulletin personnalisé (#6), PWA (#5).
- Page marketing + pages légales (#7) ; retire cube/orbite/lien plateforme (§4.2).
- Mets en ligne (VPS, HTTPS, sauvegardes automatiques, `/healthz`) : voir le README.

**Mois 2 — La valeur pour les parents**
- Notifications (#8), messagerie (#9), emploi du temps (#10).
- Signe **2–3 écoles pilotes payantes** (même à prix réduit).

**Mois 3 — Ce qui rapporte**
- Scolarité manuelle puis Mobile Money (#11), alertes intelligentes + résumé hebdo (#12), formules avec fonctions (#13).

**Indicateurs à suivre** : écoles actives, élèves actifs, **% de parents qui se connectent** chaque semaine, temps de mise en route d'une école, paiements reçus, raisons des refus.

---

## 8. Légal, données, confiance (⚠️ à faire valider par un professionnel)

- **Données d'élèves mineurs** : notes, absences, discipline, coordonnées des parents. Prévois : contrat avec chaque école (elle est responsable des données, toi tu les traites pour son compte), politique de confidentialité, durée de conservation, procédure de suppression sur demande.
- Au Bénin, la protection des données personnelles est encadrée (Code du numérique, autorité de protection APDP) : **vérifie les obligations exactes** (déclarations, consentement) avec un juriste ou directement auprès de l'autorité.
- **Sécurité** : ton projet a de bonnes bases mais **pas d'audit externe**. Avant de vendre : fais relire les parties sensibles, active les sauvegardes hors serveur, ajoute la double authentification pour les administrateurs, tiens un journal des actions sensibles.
- **Entreprise** : formalise une structure (entreprise individuelle ou société) pour signer des contrats et facturer.
- **Paiements** : ne **détiens jamais** l'argent des scolarités ; passe par un agrégateur agréé. Chaque école garde son propre compte de réception.

---

## 9. Avant de coder : valide (2 semaines, presque gratuit)

Va voir **10 directeurs/économes** de collèges privés avec une démo de ton portail et demande :
1. Comment gérez-vous aujourd'hui les notes, les bulletins, les absences ? Combien de temps ça prend ?
2. Comment prévenez-vous les parents ? Combien d'impayés ? Comment les relancez-vous ?
3. Quel logiciel connaissez-vous/utilisez-vous ? Qu'est-ce qui vous plaît/déplaît ?
4. **À quel prix mensuel trouveriez-vous cet outil trop cher ? Trop bon marché ? Correct ?** (note les 3 chiffres)
5. Seriez-vous prêt à essayer pendant un trimestre ? À qui appartient la décision d'achat ?

**Critère de décision** : si 3 à 5 directeurs disent « je veux essayer maintenant », tu tiens quelque chose. Sinon, ajuste l'offre **avant** de construire les fonctions #8 à #13.

---

## 10. Risques à garder en tête

- **Concurrence installée** (Novacole, NYONNUI…) : ne les attaque pas de front, vise l'angle « parents » et la **simplicité**.
- **Dépendance aux fournisseurs** (SMS/WhatsApp, paiement) : garde des couches interchangeables (`notify.js`, module finance).
- **Charge de support** : chaque école apporte des questions ; automatise l'onboarding (import CSV, vidéos courtes).
- **Ton temps** : tu es aussi étudiant. Limite le périmètre, fais **un pilote à la fois**, écris ce que tu ne feras pas.
- **Fiabilité** : une panne le jour des bulletins tue la confiance → sauvegardes, surveillance, tests.

---

## Annexe A — Appliquer le patch d'abonnements (prêt, testé)

**Ce que ça ajoute** : formules (essai, starter, école, plus, réseau), **essai 60 jours** à la création d'une école, **mode lecture seule** quand l'abonnement expire (les parents continuent à consulter les notes, plus aucune écriture), **limite d'élèves** par formule, **enregistrement des paiements** (prolonge la date de fin), **tableau de bord des revenus** (revenu récurrent estimé), **bandeau** d'alerte dans l'espace de l'école, et **14 nouveaux tests** (147 au total, tous verts). Il fonctionne aussi pour les établissements **déjà créés** : sans date de fin, ils ne sont jamais expirés. ⚠️ Leur limite d'élèves par défaut est **150** : si une école existante en a davantage, règle sa limite avec le bouton **Formule** de `/platform.html`. Le revenu « estimé » compte les écoles actives selon leur formule, **y compris** celles dont l'abonnement vient d'expirer : c'est un repère, pas de la comptabilité.

### Méthode 1 — avec Git (la plus simple)
1. Copie `abonnements.patch` à la racine de ton projet (à côté de `package.json`).
2. Ouvre un terminal dans ce dossier et lance :
   ```
   git apply --check abonnements.patch
   git apply abonnements.patch
   ```
   (La 1re commande vérifie sans rien modifier ; si elle affiche une erreur, arrête-toi et envoie-la-moi.)
3. Relance : `npm test` puis `npm start`.

### Méthode 2 — à la main (sans Git)
Ouvre `abonnements.patch` dans VS Code : c'est un simple fichier texte. Chaque bloc commence par `diff --git a/<fichier>` ; les lignes qui commencent par **`+`** sont à **ajouter**, celles avec **`-`** à **supprimer**, les lignes sans signe sont le contexte pour te repérer. Fichiers concernés (9) :

| Fichier | Changement |
|---|---|
| `src/db.js` | table `platform_payments` + colonnes `plan`, `trial_ends_at`, `paid_until`, `student_limit` (migration des bases existantes) |
| `src/services/schools.js` | une nouvelle école démarre en essai de 60 jours, limite 100 élèves |
| `src/middleware/auth.js` | `isExpired()` ; **402 en lecture seule** si abonnement expiré ; infos d'abonnement envoyées à l'interface |
| `src/routes/admin.js` | refus 402 quand la limite d'élèves de la formule est atteinte |
| `src/routes/platform.js` | routes `PATCH /schools/:id/plan`, `POST /schools/:id/payments`, `GET /revenue` ; constante `PLANS` (**tes prix**) |
| `public/js/platform.js` | cartes de revenus, colonne Formule, boutons 💳 Paiement et Formule |
| `public/js/app.js` + `public/app.html` | bandeau « abonnement expiré / bientôt expiré » |
| `test/smoke.js` | 14 vérifications |

### Utilisation au quotidien
1. Une école te paie (MoMo, espèces, virement) → dans `/platform.html`, bouton **💳** de l'école → montant, mois, moyen, référence, formule → **Enregistrer**. L'abonnement est prolongé automatiquement.
2. Pour changer un prix ou une limite : `PLANS` dans `src/routes/platform.js` (prix servant au calcul du revenu estimé) ; la limite d'élèves se règle par école avec le bouton **Formule**.
3. Un abonnement qui expire ne coupe pas le site : il passe en **lecture seule** (les parents ne sont pas punis), et la direction voit un bandeau rouge.

---

## Annexe B — Sources consultées (à revérifier, ces sites évoluent)
- restafy.shop (page d'accueil : produit, tarifs, FAQ)
- novacole.com · nyonnui.net · edusahel.com/fonctionnalites/gestion-absences · kiboerp.com/erp/ecole · smartschool.sn/logiciel-gestion-ecole · zaame.com · edugest-gn.vercel.app
- kolonell.com (blog : prix d'une application de gestion scolaire 2026) · myappacademia.com (guide d'achat 2026-2027)

*Toutes les affirmations sur ces sociétés proviennent de leurs propres sites. Je n'ai pas vérifié leurs chiffres ni trouvé leurs prix publics.*
