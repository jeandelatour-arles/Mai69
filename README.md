# Mai 69

Appli de scores pour le jeu de cartes **Mai 69** : saisie des manches, pénalité de 30, ajustements (multiples de 50, 69 ↔ 96, 111 → 100…) et échanges calculés automatiquement, courbe, règles, recherche, statistiques des joueurs.

Elle fonctionne **hors ligne**, sans compte, sur Android et iPhone. Les données restent dans le téléphone.

Adresse une fois en ligne : **https://jeandelatour-arles.github.io/mai69/**

---

## 1. Mettre l'appli en ligne (une seule fois, sur un ordinateur)

1. Connectez-vous sur [github.com](https://github.com) avec le compte `jeandelatour-arles`.
2. En haut à droite : **+** → **New repository**.
   - Repository name : `mai69`
   - Cochez **Public**
   - Cliquez **Create repository**.
3. Sur la page du dépôt vide, cliquez le lien **uploading an existing file**.
4. Dézippez `mai69.zip` sur l'ordinateur, ouvrez le dossier `mai69`, sélectionnez **tout son contenu** (les dossiers `css`, `icons`, `js`, `tests` et les fichiers `index.html`, `manifest.webmanifest`, `sw.js`, etc.) et glissez-le dans la page GitHub.
   - Il faut glisser le **contenu** du dossier, pas le dossier lui-même : `index.html` doit être à la racine du dépôt.
5. En bas, cliquez **Commit changes**.
6. Allez dans **Settings** (onglet du dépôt) → **Pages** (menu de gauche).
   - Source : **Deploy from a branch**
   - Branch : **main**, dossier **/ (root)** → **Save**.
7. Attendez 1 à 2 minutes, puis rechargez la page **Pages** : l'adresse `https://jeandelatour-arles.github.io/mai69/` apparaît en haut.

## 2. Installer l'appli sur un téléphone

**Android (Chrome)**
1. Ouvrez l'adresse dans Chrome.
2. Menu **⋮** → **Ajouter à l'écran d'accueil** (ou **Installer l'application**).

**iPhone (Safari)**
1. Ouvrez l'adresse dans **Safari** (pas un autre navigateur).
2. Bouton **Partager** (carré avec une flèche) → **Sur l'écran d'accueil** → **Ajouter**.

L'icône Mai 69 apparaît. Ouvrez l'appli une fois avec internet : ensuite elle marche en mode avion.

> Les parties et les joueurs sont stockés dans le téléphone. Désinstaller l'appli ou effacer les données du navigateur les supprime. Chaque téléphone a ses propres données.

## 3. Mettre l'appli à jour plus tard

1. Dans le dépôt GitHub : **Add file** → **Upload files**, glissez les fichiers modifiés (en gardant les mêmes dossiers), puis **Commit changes**.
2. Dans `sw.js`, la ligne `const VERSION = 'mai69-v1'` doit changer à chaque mise à jour (`mai69-v2`, `mai69-v3`…) — les versions livrées par Claude le font déjà.
3. Sur le téléphone, rouvrez l'appli : un message « Nouvelle version disponible » apparaît. Touchez-le.

---

## Pour les développeurs

- HTML + CSS + JavaScript sans framework ni étape de build ; IndexedDB pour les données ; service worker pour le hors-ligne.
- La logique métier est dans `js/core/` (aucune dépendance au navigateur) : `score.js` (pénalité, ajustements, échanges, recalcul complet d'une partie), `endConditions.js`, `stats.js`, `search.js`. Elle sera réutilisée pour la version Flutter.
- Tests : `node --test tests/*.test.js` (Node 20 ou plus).
- Textes FR/EN, règles et FAQ : `js/i18n/fr.js` et `js/i18n/en.js`.
- Essai en local : `python3 -m http.server` dans le dossier, puis http://localhost:8000.
