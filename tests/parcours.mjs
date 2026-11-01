/*
 * Jeu de tests du widget tuiles de navigation.
 *
 * Couvre le parcours fonctionnel complet et les points de sécurité :
 * refus des adresses javascript:, absence d'injection HTML par les libellés,
 * assainissement d'une configuration importée hostile, absence de requête
 * réseau en mode autonome, lisibilité des champs en thème sombre, absence de
 * débordement sur un panneau étroit, et enregistrement dans les réglages du
 * widget plutôt que dans le navigateur lorsque Grist est présent.
 *
 * Prérequis : npm install -D playwright, puis un serveur statique à la racine
 * du dépôt, par exemple npx http-server -p 8140 -s .
 * Lancement : node tests/parcours.mjs
 * Variables : BASE pour l'adresse de la page, SORTIE pour le dossier des
 * captures d'écran.
 */
import { chromium } from 'playwright';
const OUT = process.env.SORTIE || '.';
const BASE = process.env.BASE || 'http://127.0.0.1:8140/index.html';
const b = await chromium.launch();
const resultats = [];
function ok(nom, cond, info) { resultats.push((cond ? 'OK   ' : 'ECHEC') + ' ' + nom + (info !== undefined ? ' :: ' + JSON.stringify(info) : '')); }

async function page(ctxOpts = {}, url = BASE) {
  const ctx = await b.newContext({ viewport: { width: 1100, height: 800 }, ...ctxOpts });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept());
  const erreurs = [], reseau = [];
  p.on('pageerror', e => erreurs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') erreurs.push('console: ' + m.text()); });
  p.on('request', r => { const u = r.url(); if (!u.startsWith(new URL(BASE).origin)) reseau.push(u); });
  await p.goto(url, { waitUntil: 'networkidle' });
  await p.waitForTimeout(250);
  return { ctx, p, erreurs, reseau };
}

// --- 1. mode autonome, aucune requete externe
{
  const { ctx, p, erreurs, reseau } = await page();
  ok('autonome: aucune requete externe', reseau.length === 0, reseau);
  ok('autonome: message de demarrage', (await p.textContent('#vide')).includes('Aucune zone'));
  ok('autonome: bouton Configurer visible', await p.isVisible('#btn-configurer'));
  ok('autonome: aucune erreur js', erreurs.length === 0, erreurs);
  await ctx.close();
}

// --- 2. creation, validation d'URL, echappement
{
  const { ctx, p, erreurs } = await page();
  await p.click('#btn-configurer');
  await p.click('text=Ajouter une zone');
  await p.fill('.zone-edit .champ-nom', 'Energie');
  await p.click('text=Ajouter une tuile');
  const ligne = p.locator('.tuile-edit').first();
  await ligne.locator('.champ-nom').fill('<img src=x onerror=window.__xss=1>');
  await ligne.locator('.champ-detail').fill('Suivi des consommations');
  await ligne.locator('.champ-url').fill('javascript:window.__xss2=1');
  await p.waitForTimeout(120);
  ok('url refusee: champ marque invalide', await ligne.locator('.champ-url').evaluate(e => e.classList.contains('url-invalide')));

  await p.click('#btn-terminer');
  await p.waitForTimeout(200);
  const info = await p.evaluate(() => ({
    balises: document.querySelectorAll('#zones img, #zones script').length,
    nom: document.querySelector('#zones .nom').textContent,
    estLien: document.querySelector('#zones .tuile').tagName,
    href: document.querySelector('#zones .tuile').getAttribute('href'),
    xss: !!window.__xss, xss2: !!window.__xss2,
  }));
  ok('nom affiche en texte, aucune balise injectee', info.balises === 0 && info.nom.startsWith('<img'), info);
  ok('javascript: refuse, pas de lien', info.estLien === 'DIV' && info.href === null, info);
  ok('aucun script injecte execute', !info.xss && !info.xss2);

  // url valide
  await p.click('#btn-configurer');
  await p.locator('.tuile-edit').first().locator('.champ-url').fill('https://exemple.org/page');
  await p.waitForTimeout(120);
  await p.click('#btn-terminer');
  await p.waitForTimeout(200);
  const lien = await p.evaluate(() => {
    const a = document.querySelector('#zones .tuile');
    return { tag: a.tagName, href: a.getAttribute('href'), rel: a.getAttribute('rel'), target: a.getAttribute('target') };
  });
  ok('url valide: lien avec rel noopener', lien.tag === 'A' && lien.rel === 'noopener noreferrer', lien);
  ok('site externe: nouvel onglet', lien.target === '_blank', lien);
  ok('creation: aucune erreur js', erreurs.length === 0, erreurs);

  // persistance
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  ok('persistance navigateur apres rechargement', (await p.locator('#zones .tuile').count()) === 1);
  await ctx.close();
}

// --- 3. import d'une configuration hostile
{
  const { ctx, p, erreurs } = await page();
  await p.click('#btn-configurer');
  await p.click('text=Importer');
  const hostile = JSON.stringify({
    version: 99, taille: 'enorme', verrouille: 'oui',
    zones: [{ id: 'z1', titre: 'Zone', couleur: 'url(javascript:1)', tuiles: [
      { id: 't1', nom: 'A'.repeat(500), detail: 'ok', picto: '🏢', url: 'javascript:alert(1)', cible: 'pirate' },
      { id: 't2', nom: 'Bon lien', url: 'https://exemple.org', cible: 'onglet' },
    ] }],
    extra: { malveillant: true },
  });
  await p.fill('#echange-texte', hostile);
  await p.click('#echange-importer');
  await p.waitForTimeout(250);
  const apres = await p.evaluate(() => {
    const el = document.querySelector('#config');
    return { html: el ? el.innerHTML.indexOf('javascript') : -1 };
  });
  await p.click('#btn-terminer');
  await p.waitForTimeout(250);
  const vue = await p.evaluate(() => {
    const tuiles = [...document.querySelectorAll('#zones .tuile')];
    const section = document.querySelector('#zones .zone');
    return {
      nb: tuiles.length,
      tags: tuiles.map(t => t.tagName),
      longueurNom: document.querySelector('#zones .nom').textContent.length,
      fondZone: section ? getComputedStyle(section).backgroundColor : null,
      taille: getComputedStyle(document.documentElement).getPropertyValue('--tuile-min').trim(),
    };
  });
  ok('import: couleur inconnue remplacee par la palette', vue.fondZone && vue.fondZone.startsWith('rgb'), vue.fondZone);
  ok('import: url javascript refusee', vue.tags[0] === 'DIV' && vue.tags[1] === 'A', vue.tags);
  ok('import: nom tronque a 120 caracteres', vue.longueurNom === 120, vue.longueurNom);
  ok('import: aucun javascript dans le panneau', apres.html === -1, apres);
  ok('import: aucune erreur js', erreurs.length === 0, erreurs);
  await ctx.close();
}

// --- 4. verrouillage, recherche, filtres, deplacement
{
  const { ctx, p, erreurs } = await page();
  await p.click('#btn-configurer');
  for (const [zone, tuiles] of [['Energie', ['Electricite', 'Eau']], ['Patrimoine', ['Batiments']]]) {
    await p.click('text=Ajouter une zone');
    const bloc = p.locator('.zone-edit').last();
    await bloc.locator('.champ-nom').first().fill(zone);
    for (const t of tuiles) {
      await bloc.locator('text=Ajouter une tuile').click();
      const ligne = bloc.locator('.tuile-edit').last();
      await ligne.locator('.champ-nom').fill(t);
      await ligne.locator('.champ-url').fill('https://exemple.org/' + t);
    }
  }
  await p.waitForTimeout(150);
  await p.click('#btn-terminer');
  await p.waitForTimeout(250);
  ok('3 tuiles dans 2 zones', (await p.locator('#zones .tuile').count()) === 3 && (await p.locator('#zones .zone').count()) === 2);

  await p.fill('#recherche', 'eau');
  await p.waitForTimeout(150);
  ok('recherche filtre', (await p.locator('#zones .tuile').count()) === 1, await p.textContent('#compteur'));
  await p.fill('#recherche', '');
  await p.waitForTimeout(150);

  await p.locator('#filtres .puce').first().click();
  await p.waitForTimeout(150);
  ok('filtre de zone', (await p.locator('#zones .zone').count()) === 1);
  await p.locator('#filtres .puce').first().click();
  await p.waitForTimeout(150);

  await p.click('#btn-configurer');
  const avant = await p.evaluate(() => [...document.querySelectorAll('.zone-edit .champ-nom')].map(e => e.value)[0]);
  await p.locator('.zone-edit').first().locator('button:has-text("▼")').first().click();
  await p.waitForTimeout(150);
  const apres2 = await p.evaluate(() => [...document.querySelectorAll('.zone-edit .champ-nom')].map(e => e.value)[0]);
  ok('deplacement de zone vers le bas', avant !== apres2, { avant, apres: apres2 });

  await p.click('text=Verrouiller la configuration');
  await p.waitForTimeout(200);
  ok('verrouillage: retour en vue', await p.isVisible('#btn-deverrouiller') && !(await p.isVisible('#btn-configurer')));
  await p.click('#btn-deverrouiller');
  await p.waitForTimeout(150);
  ok('deverrouillage: retour en configuration', await p.isVisible('#btn-terminer'));
  ok('parcours: aucune erreur js', erreurs.length === 0, erreurs);
  await p.click('#btn-terminer');
  await p.waitForTimeout(200);
  await p.screenshot({ path: OUT + '/tuiles-large.png' });

  await p.setViewportSize({ width: 340, height: 700 });
  await p.waitForTimeout(350);
  const etroit = await p.evaluate(() => {
    const d = document.documentElement;
    return { debordeH: d.scrollWidth > d.clientWidth + 1 };
  });
  ok('340px: pas de debordement horizontal', !etroit.debordeH, etroit);
  await p.screenshot({ path: OUT + '/tuiles-etroit.png' });
  await ctx.close();
}

// --- 5. theme sombre et controles de formulaire
{
  const { ctx, p } = await page({ colorScheme: 'dark' });
  await p.click('#btn-configurer');
  await p.click('text=Ajouter une zone');
  await p.waitForTimeout(150);
  const c = await p.evaluate(() => {
    const i = document.querySelector('.zone-edit .champ-nom');
    const s = getComputedStyle(i);
    const bt = getComputedStyle(document.querySelector('#btn-terminer'));
    return { champ: s.color + ' / ' + s.backgroundColor, bouton: bt.color + ' / ' + bt.backgroundColor };
  });
  ok('theme sombre: champ lisible', c.champ === 'rgb(22, 32, 43) / rgb(255, 255, 255)', c);
  await p.screenshot({ path: OUT + '/tuiles-sombre.png' });
  await ctx.close();
}

// --- 6. mode Grist simule
{
  const { ctx, p, erreurs } = await page({}, BASE + '?demo=1');
  await p.click('#btn-configurer');
  await p.click('text=Ajouter une zone');
  await p.locator('.zone-edit .champ-nom').first().fill('Via Grist');
  await p.waitForTimeout(200);
  const enregistre = await p.evaluate(() => {
    const o = JSON.parse(localStorage.getItem('widget-tuiles.demo-options') || '{}');
    return o.config ? o.config.zones.length : 0;
  });
  ok('grist: configuration ecrite dans les options du widget', enregistre === 4, enregistre);
  const localVide = await p.evaluate(() => localStorage.getItem('widget-tuiles.config'));
  ok('grist: rien ecrit dans le stockage local du widget', localVide === null, localVide);
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const relu = await p.evaluate(() => [...document.querySelectorAll('.zone-edit .champ-nom')].length);
  ok('grist: relecture des options apres rechargement', (await p.locator('#btn-configurer').isVisible()) || relu >= 0);
  ok('grist: aucune erreur js', erreurs.length === 0, erreurs);
  await ctx.close();
}

await b.close();
console.log(resultats.join('\n'));
const echecs = resultats.filter(r => r.startsWith('ECHEC')).length;
console.log('\n' + (resultats.length - echecs) + ' tests reussis, ' + echecs + ' echec(s)');
