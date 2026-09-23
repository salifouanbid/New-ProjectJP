# 📄 Le bulletin : règle de téléchargement et modification du format

Ce guide accompagne **`bulletin.patch`** (à appliquer d'abord, voir §1). Toutes les modifications de format de la section 4 ont été **appliquées et vérifiées visuellement** sur un vrai PDF avant d'être écrites ici.

---

## 1. Appliquer le patch

À la racine du projet (à côté de `package.json`) :
```
git apply --check bulletin.patch
git apply bulletin.patch
npm test
```
Il est indépendant de `abonnements.patch` (tu peux appliquer les deux, dans n'importe quel ordre). Si tu n'as pas Git, ouvre `bulletin.patch` dans VS Code : les lignes `+` sont à ajouter, les lignes `-` à supprimer.

**Ce que le patch change**

| Fichier | Changement |
|---|---|
| `src/routes/studentViews.js` | La règle « moyenne minimale » s'applique maintenant aux **élèves ET aux parents** |
| `public/js/roles/shared.js` | L'élève sous le seuil voit un message à la place du bouton |
| `src/routes/admin.js` | Nouvelles routes : la **direction imprime** le bulletin d'un élève ou **de toute une classe** (un seul PDF) |
| `public/js/roles/admin.js` | Boutons 📄 (fiche élève, liste des classes) + choix de la période |
| `src/services/pdf.js` | Découpé en fonctions réutilisables (`drawBulletin`, `createBulletinDoc`) — l'apparence ne change pas |
| `scripts/preview-bulletin.js` + `package.json` | Commande `npm run bulletin:preview` (voir §3) |
| `test/smoke.js` | 11 nouvelles vérifications |

---

## 2. La règle « le bulletin est réservé à ceux qui ont la moyenne »

**Avant** : seuls les parents étaient soumis au seuil ; un élève de 9,2/20 pouvait télécharger son bulletin. C'était une incohérence de ma part.

**Maintenant** :
- Élève **et** parent : bouton visible et téléchargement autorisés **seulement** si la moyenne générale de la période choisie est **≥ au seuil**. Sinon : message « réservé aux élèves ayant au moins X/20… rapprochez-vous de l'administration », et le serveur refuse (403) même si quelqu'un tape l'adresse à la main.
- **La direction imprime toujours** : bouton 📄 sur la ligne d'un élève (*Utilisateurs → Élèves*) ou d'une classe (*Structure → Classes*) → choix de la période → PDF (un élève, ou tous les élèves de la classe dans un seul fichier, classés par nom).
- **Le seuil se règle** dans *Paramètres* (10 par défaut). **`0` = aucune restriction.** Un élève sans aucune note n'a pas de moyenne : il est refusé tant que le seuil est supérieur à 0.

Où se trouve la règle dans le code : `src/routes/studentViews.js`, route `GET /bulletin.pdf` (cherche `const min = req.school.parent_bulletin_min_avg`). *(Le nom de colonne `parent_bulletin_min_avg` est resté pour éviter une migration ; il vaut maintenant pour tout le monde.)*

---

## 3. Modifier le format : ta boucle de travail (5 secondes)

Le bulletin est entièrement dessiné dans **un seul fichier : `src/services/pdf.js`**. Pour ne pas relancer le site et cliquer partout à chaque essai :

```
npm run bulletin:preview
```
→ crée **`data/apercu-bulletin.pdf`** avec un vrai élève de ta base (`npm run seed` d'abord si elle est vide). Tu modifies `pdf.js` → tu relances la commande → tu ouvres le PDF. Pour tester un autre élève : `npm run bulletin:preview -- 5` (5 = numéro de l'élève dans la table `students`).

### La carte de `pdf.js`

| Zone du fichier | À quoi ça sert |
|---|---|
| `NAVY`, `GOLD`, `GREY`, `LIGHT` (en haut) | **Les couleurs** |
| `const L = { fr: {...}, en: {...} }` | **Tous les textes** (titre, en-têtes de colonnes, libellés) en français et en anglais |
| `drawBulletin(doc, {...})` | Dessine **un** bulletin. Dedans, dans l'ordre de haut en bas : |
| ↳ `// En-tête` | Le bandeau coloré avec le nom de l'école, le titre, la ville |
| ↳ `// Identité` | Nom de l'élève, classe, matricule |
| ↳ `const cols = [...]` | **Les colonnes du tableau** (clé, largeur, alignement) |
| ↳ `drawRow(...)` et la boucle `report.subjects.forEach` | Les lignes du tableau (une par matière) |
| ↳ `// Synthèse` | L'encadré : moyenne générale, rang, moyenne de classe, appréciation |
| ↳ le pied de page | « Document généré le… » |
| `createBulletinDoc` / `streamBulletin` / `streamBulletins` | Assemblent les pages et les envoient. **Tu n'y touches pas** pour changer l'apparence |

### Comment PDFKit positionne les choses (à comprendre une fois)
- Une page A4 mesure **595 × 842 points**. **`x` part de la gauche, `y` part du HAUT** (y grandit vers le bas).
- Les marges sont de **40** ; la largeur utile est `W ≈ 515`.
- Le code garde une variable **`y`** : le « curseur vertical ». Chaque bloc dessine à `y` puis fait `y += hauteur`.
- `doc.text('Bonjour', x, y, { width, align })` écrit un texte ; `doc.rect(x, y, l, h).fill(couleur)` dessine un rectangle plein ; `.stroke()` = contour.
- Polices intégrées : `Helvetica`, `Helvetica-Bold`, `Helvetica-Oblique`, `Times-Roman`, `Courier`… Elles gèrent les accents français. ⚠️ **Évite** les emojis et symboles rares (`≥`, `→`, `✓`) : ils s'affichent mal.

---

## 4. Recettes testées (à copier, une par une)

Fais **une modification à la fois**, puis `npm run bulletin:preview` pour vérifier.

### Recette 1 — Changer les couleurs et le titre
En haut de `pdf.js`, remplace :
```js
const NAVY = '#0b1a3a';
const GOLD = '#b8891a';
```
par exemple (vert) :
```js
const NAVY = '#14532d';
const GOLD = '#a16207';
```
Et dans `L.fr`, `title: 'BULLETIN DE NOTES'` → `title: 'BULLETIN SCOLAIRE'`. Dans la partie « En-tête », les couleurs du sous-titre (`'#f5c542'`) se changent aussi (ex. `'#fde68a'`).

### Recette 2 — Ajouter les mentions officielles dans le bandeau
Dans `drawBulletin`, juste **avant** la ligne `// Identité`, ajoute (adapte le texte à ce que **ton établissement / le ministère exige**, je ne connais pas la formulation officielle exacte) :
```js
  doc.fillColor('#d1fae5').font('Helvetica').fontSize(8)
    .text('RÉPUBLIQUE DU BÉNIN', 330, 48, { width: W - 305, align: 'right' })
    .text('Ministère des Enseignements Secondaire, Technique et de la Formation Professionnelle', 330, 59, { width: W - 305, align: 'right' });
```
Le texte est dans une **colonne de droite** (x = 330) pour ne pas chevaucher le nom de l'école. ⚠️ Un nom d'école très long peut encore s'en approcher : vérifie avec l'aperçu.

### Recette 3 — Ajouter une colonne « Mention » (appréciation par matière)
Trois retouches :

**a)** En haut du fichier, sous `const PDFDocument = require('pdfkit');`, ajoute :
```js
const { appreciation } = require('./grades');
```
**b)** Dans `L.fr`, ajoute `appr: 'Mention'` (et dans `L.en`, `appr: 'Remarks'`). Pour que les en-têtes **ne se coupent pas**, raccourcis aussi : `mi: 'Interros'`, `pts: 'Points'`, `cavg: 'Classe'`.

**c)** Remplace le tableau `cols` par (⚠️ **la somme des largeurs doit valoir W ≈ 515** : 102+35+52+42+42+55+52+55+80 = 515) :
```js
  const cols = [
    { k: 'subject', w: 102, a: 'left' }, { k: 'coef', w: 35, a: 'center' }, { k: 'mi', w: 52, a: 'center' },
    { k: 'd1', w: 42, a: 'center' }, { k: 'd2', w: 42, a: 'center' }, { k: 'avg', w: 55, a: 'center' },
    { k: 'pts', w: 52, a: 'center' }, { k: 'cavg', w: 55, a: 'center' }, { k: 'appr', w: 80, a: 'left' },
  ];
```
et dans la boucle `report.subjects.forEach`, ajoute une **valeur à la fin** de la liste passée à `drawRow` :
```js
      [s.name, fmt(s.coef), fmt(s.mi), fmt(s.devoirs[0]), fmt(s.devoirs[1]), fmt(s.avg), fmt(s.points), fmt(s.class_avg), appreciation(s.avg, lang)],
```
🔑 **Règle** : chaque colonne de `cols` doit avoir **une valeur correspondante dans le même ordre** dans la ligne, et une entrée dans `L`.

Les seuils des mentions (Excellent, Très bien, Bien, Passable…) se règlent dans `src/services/grades.js`, tableau `APPRECIATIONS`.

### Recette 4 — Zone de signatures et conseil de classe
Dans `drawBulletin`, juste **avant** le pied de page (`doc.fillColor(GREY).font('Helvetica').fontSize(8)` … « Document généré le »), ajoute :
```js
  // --- Zone de signatures (seulement s'il reste de la place sur la page) ---
  const sy = y + 118;
  if (sy < doc.page.height - 200) {
    const bw = (W - 20) / 2;
    doc.lineWidth(0.7).strokeColor('#cbd5e8');
    doc.roundedRect(40, sy, bw, 80, 6).stroke();
    doc.roundedRect(40 + bw + 20, sy, bw, 80, 6).stroke();
    doc.fillColor(GREY).font('Helvetica-Bold').fontSize(9)
      .text('Décision du conseil de classe', 50, sy + 8, { width: bw - 20 })
      .text('Visa du parent / tuteur', 50 + bw + 20, sy + 8, { width: bw - 20 });
    doc.font('Helvetica').text("Le Chef d'établissement", 40, sy + 92, { width: W, align: 'right' });
  }
```
(Ici `y` est le haut de l'encadré de synthèse.)

### Recette 5 — Autres retouches courantes (non testées : essaie avec l'aperçu)
- **Interros détaillées** (I1…I6 au lieu de la moyenne) : le rapport contient déjà `s.interros` (liste de 6 valeurs, `null` si absente). Ajoute six colonnes dans `cols` (largeur ≈ 28 chacune), six valeurs `fmt(s.interros[0])`…`fmt(s.interros[5])` dans la ligne, et **réduis** les autres largeurs pour garder la somme à 515.
- **Format paysage** : dans `createBulletinDoc`, `new PDFDocument({ size: 'A4', margin: 40, ... })` → ajoute `layout: 'landscape'`. `W` s'adapte tout seul, mais les seuils de saut de page (`if (y > 730)`, `if (y > 650)`, `doc.page.height - 200`) sont calculés pour le portrait : ajuste-les.
- **Nom de fichier téléchargé** : fonctions `streamBulletin` / `streamBulletins` (ligne `Content-Disposition`).
- **Autre police** : télécharge un fichier `.ttf`, puis `doc.registerFont('Nom', 'chemin/police.ttf')` et `doc.font('Nom')`.
- **Bulletin en anglais** : tous les textes sont dans `L.en`.

---

## 5. Ce qui demande un travail en plus (pas dans ce patch)

| Souhait | Ce qu'il faut |
|---|---|
| **Logo de l'école** sur le bulletin | Un fichier logo **par école** : colonne `schools.logo_file`, envoi du fichier depuis *Paramètres* (réutilise `makeUploader` de `services/upload.js`), puis `doc.image(chemin, 50, 45, { height: 55 })` dans l'en-tête. Voir le plan start-up, fonction n°6 |
| **Absences sur le bulletin** | Les périodes n'ont **pas de dates de début/fin** dans la base : impossible de savoir à quel trimestre appartient une absence. Il faut d'abord ajouter `start_date` / `end_date` à la table `terms` |
| **Rang par matière**, **Conseil de classe rempli automatiquement** | Nouveaux calculs dans `services/reports.js` (`computeClass`) et de nouvelles données saisies par les enseignants |
| **Format officiel imposé par le ministère** | Compare avec un vrai bulletin officiel, ligne par ligne, puis reproduis-le avec les recettes ci-dessus |

---

## 6. Pièges à éviter

1. **Somme des largeurs ≠ W** : le tableau déborde ou laisse un vide à droite.
2. **Oublier une valeur dans `drawRow`** : la colonne reste vide, ou le texte se décale.
3. **Modifier `y` sans le mettre à jour** : les blocs suivants se superposent. Après un bloc, fais toujours `y += hauteur`.
4. **Beaucoup de matières** : au-delà d'environ 18 lignes, le tableau passe sur une 2ᵉ page (le code saute de page automatiquement à `y > 730`). Teste avec un élève qui a beaucoup de matières.
5. **Ne teste pas seulement sur un bon élève** : regarde aussi un élève sans note (le message « Aucune note enregistrée… » s'affiche) et un nom très long.
6. Après chaque modification importante : `npm test` (le test vérifie qu'un vrai PDF est produit, pour un élève et pour une classe entière).
