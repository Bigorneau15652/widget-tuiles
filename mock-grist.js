/*
 * Simulateur minimal de l'API Grist, chargé uniquement par index.html?demo=1.
 * Il reproduit les deux seules fonctions que le widget utilise réellement,
 * grist.ready et les options de widget, afin d'éprouver le mode Grist sans
 * document réel. Ce fichier n'est jamais chargé dans Grist.
 */
(function () {
  "use strict";

  const CLE = `widget-tuiles.demo-options`;

  // Configuration d'exemple servie au premier lancement, pour que la
  // démonstration montre un menu rempli plutôt qu'une page vide.
  const EXEMPLE = {
    version: 1,
    taille: `moyenne`,
    verrouille: false,
    zones: [
      {
        id: `demo1`, titre: `Suivi des fluides`, couleur: `bleu`, tuiles: [
          { id: `d11`, nom: `Électricité`, detail: `Relevés mensuels par bâtiment`, picto: `⚡`, url: `https://example.org/electricite`, cible: `auto` },
          { id: `d12`, nom: `Eau`, detail: `Index des compteurs`, picto: `💧`, url: `https://example.org/eau`, cible: `auto` },
          { id: `d13`, nom: `Gaz`, detail: `Suivi des chaufferies`, picto: `🔥`, url: `https://example.org/gaz`, cible: `auto` },
        ],
      },
      {
        id: `demo2`, titre: `Patrimoine`, couleur: `vert`, tuiles: [
          { id: `d21`, nom: `Bâtiments`, detail: `Surfaces et usages`, picto: `🏢`, url: `https://example.org/batiments`, cible: `auto` },
          { id: `d22`, nom: `Plans de sites`, detail: `Plans de situation`, picto: `🗺️`, url: `https://example.org/plans`, cible: `auto` },
        ],
      },
      {
        id: `demo3`, titre: `Outils externes`, couleur: `violet`, tuiles: [
          { id: `d31`, nom: `Supervision GTB`, detail: `Ouvre un nouvel onglet`, picto: `🖥️`, url: `https://example.org/gtb`, cible: `onglet` },
          { id: `d32`, nom: `Documentation`, detail: `Guides et procédures`, picto: `📚`, url: `https://example.org/docs`, cible: `onglet` },
        ],
      },
    ],
  };

  function lire() {
    try {
      const brut = window.localStorage.getItem(CLE);
      if (!brut) { return { config: EXEMPLE }; }
      return JSON.parse(brut);
    } catch (e) {
      return { config: EXEMPLE };
    }
  }

  function ecrire(options) {
    try {
      window.localStorage.setItem(CLE, JSON.stringify(options));
    } catch (e) {
      /* le simulateur ne bloque pas sur un stockage indisponible */
    }
  }

  let rappelOptions = null;

  window.grist = {
    ready: function () { /* rien à faire hors de Grist */ },
    onRecords: function () { /* le widget n'utilise aucune donnée */ },
    onOptions: function (rappel) {
      rappelOptions = rappel;
      setTimeout(function () { rappel(lire()); }, 0);
    },
    setOption: function (cle, valeur) {
      const options = lire();
      options[cle] = valeur;
      ecrire(options);
    },
    getOption: function (cle) {
      return Promise.resolve(lire()[cle]);
    },
    setOptions: function (options) {
      ecrire(options || {});
      if (rappelOptions) { rappelOptions(lire()); }
    },
  };
})();
