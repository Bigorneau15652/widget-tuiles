# Widget tuiles de navigation

Widget de navigation par tuiles, utilisable dans n'importe quel document Grist
ou comme page web autonome. Les tuiles sont regroupées en zones, chaque zone
ayant son titre et sa couleur. Chaque tuile porte un emoji, un nom, un détail
facultatif et une adresse, qui peut pointer vers une page du document courant,
vers un autre document, ou vers un site web.

Le widget est un fichier HTML autonome, sans étape de construction et sans
aucune dépendance externe.

## Ce qui distingue ce widget

Il ne lit aucune donnée. Toute la configuration vit dans les réglages de
l'instance de widget, pas dans une table. Il n'y a donc rien à préparer dans le
document, et le niveau d'accès peut rester sur « Aucun accès au document ».

Il est portable. Le même fichier fonctionne dans Grist et ouvert directement
dans un navigateur. L'export et l'import en JSON permettent de transporter un
menu d'un document à un autre, ou de le sauvegarder.

## Modèle de sécurité

Ces points sont vérifiables rapidement, et constituent l'essentiel de ce qu'un
audit aura à contrôler.

Aucune dépendance externe. Aucune bibliothèque, aucune police, aucune feuille de
style distante. Le seul script externe possible est `grist-plugin-api.js`, et il
n'est chargé que si la page est affichée dans un cadre. Ouverte directement dans
un navigateur, la page ne déclenche aucune requête réseau.

Politique de sécurité de contenu déclarée dans la page. `connect-src 'none'`
interdit toute requête sortante, donc toute exfiltration, quel que soit le code
exécuté. `form-action 'none'` interdit l'envoi de formulaire. `default-src
'none'` interdit tout chargement de ressource, à l'exception explicite de l'API
Grist.

Accès au document nul. `grist.ready` est appelé avec `requiredAccess: 'none'`.
Le widget est donc incapable, par construction, de lire une table.

Adresses filtrées par liste blanche. Seuls `http`, `https` et `mailto` sont
acceptés, après analyse par l'objet `URL` du navigateur. Une adresse
`javascript:` ou `data:` est refusée, en saisie comme à l'import, et la tuile
correspondante est affichée en grisé sans lien.

Aucune construction de HTML à partir des saisies. Le rendu passe exclusivement
par `createElement` et `textContent`. Il n'y a pas une seule affectation
d'`innerHTML` dans le fichier.

Configuration reconstruite à chaque lecture. Qu'elle vienne des réglages du
widget, du navigateur ou d'un import manuel, la configuration est reconstruite
champ par champ par `normaliserConfig`, avec troncature des textes, filtrage des
caractères de contrôle, et restriction des couleurs à une palette fermée. Rien
d'inattendu n'est conservé ni réinjecté dans la page.

Liens sortants isolés. Tout lien ouvert dans un nouvel onglet porte
`rel="noopener noreferrer"`, ce qui empêche la page cible d'accéder à la page
d'origine et de connaître sa provenance.

## Installation dans Grist

1. Ouvrez la page voulue, puis Ajouter, Ajouter une vue à la table. La table
   choisie n'a aucune importance : le widget ne la lit pas.
2. Choisissez Personnalisée.
3. Dans le panneau de droite, collez l'adresse du widget.
4. Laissez le niveau d'accès sur « Aucun accès au document ».
5. Cliquez sur Configurer dans le widget, créez vos zones et vos tuiles.

Pour récupérer l'adresse d'une page Grist, ouvrez-la et copiez l'adresse
affichée dans la barre du navigateur.

## Usage autonome

Ouvrez le fichier `index.html` dans un navigateur, ou déposez-le sur un
intranet. La configuration est alors enregistrée dans le navigateur, sur ce
poste et pour ce site uniquement. Elle ne suit pas l'utilisateur d'un poste à
l'autre : l'export et l'import servent à la transporter.

## Configuration

Trois tailles de tuiles, appliquées à l'ensemble du menu. La largeur minimale
des tuiles est par ailleurs élargie automatiquement si un nom contient un mot
trop long, de sorte qu'aucun mot ne soit jamais coupé.

Les zones et les tuiles se réorganisent par glisser-déposer, en saisissant la
poignée à gauche de chaque ligne. Une tuile déposée sur une autre zone y est
transférée. Les flèches haut et bas font le même travail, utilisables au clavier
et sans souris.

Le verrouillage masque le bouton Configurer. Il protège d'une fausse
manipulation et se lève d'un clic : ce n'est pas une protection d'accès.

L'ouverture de chaque tuile est automatique par défaut : une adresse du même
hôte que la page qui contient le widget s'ouvre dans l'onglet courant, le reste
dans un nouvel onglet. Le réglage par tuile permet de forcer l'un ou l'autre.

## Format d'échange

L'export produit un objet JSON de cette forme. Toute valeur inattendue est
ignorée à l'import.

```json
{
  "version": 1,
  "taille": "moyenne",
  "verrouille": false,
  "zones": [
    {
      "id": "a1b2",
      "titre": "Suivi des fluides",
      "couleur": "bleu",
      "tuiles": [
        {
          "id": "c3d4",
          "nom": "Électricité",
          "detail": "Relevés mensuels",
          "picto": "⚡",
          "url": "https://exemple.org/page",
          "cible": "auto"
        }
      ]
    }
  ]
}
```

`taille` vaut `petite`, `moyenne` ou `grande`. `couleur` est l'un des
identifiants de la palette : `bleu`, `vert`, `orange`, `rouge`, `violet`,
`turquoise`, `rose`, `ocre`, `indigo`, `gris`. `cible` vaut `auto`, `courant` ou
`onglet`.

## Tests

`tests/parcours.mjs` est un jeu de tests Playwright qui couvre le parcours
fonctionnel et les points de sécurité : refus des adresses `javascript:`,
absence d'injection HTML par les libellés, assainissement d'une configuration
importée hostile, absence de requête réseau en mode autonome, lisibilité des
champs en thème sombre, et absence de débordement sur un panneau de 340 pixels.

```bash
npm install -D playwright
npx http-server -p 8140 -s .
node tests/parcours.mjs
```

## Test rapide sans Grist

Ouvrir `index.html?demo=1` charge `mock-grist.js`, un simulateur local de l'API
Grist servant une configuration d'exemple. Cela permet de voir le rendu et
d'éprouver le mode Grist sans document réel. Ce fichier n'est jamais chargé dans
Grist.

## Limites connues

La configuration enregistrée dans le navigateur est propre au poste et au
navigateur. Un vidage des données de site l'efface.

Dans Grist, la configuration appartient à l'instance de widget. Dupliquer la
page Grist duplique la configuration, mais la recopier vers un autre document
passe par l'export et l'import.

Le glisser-déposer suppose une souris. Les flèches haut et bas couvrent le même
besoin sans souris.
