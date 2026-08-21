// sitesecurite-articles.js — correspondance "code d'article ERP" -> page de sitesecurite.com
//
// Le règlement de sécurité ERP est publié sur sitesecurite.com par pages regroupant plusieurs
// articles consécutifs : /contenu/_erp/<répertoire>/<préfixe><début>a<fin>.php (ex: GN 4 se
// trouve sur erpgn/gn04a10.php, qui couvre GN 4 à 10). Ce découpage n'est pas déductible du
// seul numéro d'article — d'où cette table. Le paramètre ?id=<CODE> (ex: ?id=GN4) fait ensuite
// défiler la page jusqu'à l'article visé.
//
// TABLE GÉNÉRÉE le 2026-08-21 depuis https://sitesecurite.com/sitemap.xml, en retenant les URL
// /contenu/_erp/<dir>/<préfixe><NN>[a<MM>].php des 38 familles d'articles du règlement, puis
// vérifiée par reconstruction : les 352 URL reconstruites depuis cette table correspondent
// exactement aux 352 pages du sitemap. À régénérer si le site réorganise ses pages — une table
// périmée produit une 404, jamais un renvoi vers le mauvais article, les bornes étant portées
// par le nom de fichier lui-même.
//
// Format : FAMILLE: 'répertoire bornes,bornes,...' où une borne vaut "début-fin" (page groupée)
// ou "n" (page d'un seul article).

const SITESECURITE_BASE = 'https://sitesecurite.com/contenu/_erp/';

const SITESECURITE_ARTICLES = {
  GN: 'erpgn 1-3,4-10,11-12,13,14,15',
  GE: 'erp 1,2-5,6-10',
  CO: 'erp 1-5,6-10,11-15,16-18,19-22,23-26,27-29,30-33,34-42,43-48,49-56,57-60,61',
  AM: 'erp 1,2-8,9-10,11-14,15-18,19-20',
  DF: 'erp 1-10',
  CH: 'erp 1-4,5-12,13-17,18-22,23-25,26-27,28,29-40,41-43,44-56,57-58',
  GZ: 'erp 1-3,4-9,10-11,12-19,20-25,26,27-30',
  EL: 'erp 1-4,5-11,12-17,18-19,20-23',
  EC: 'erp 1-5,6,7-15',
  AS: 'erp 1-3,4-5,6-7,8-11',
  GC: 'erp 1,2-8,9-11,12-14,15-17,18,19-20,21-22',
  MS: 'erp 1-3,4,5-7,8-13,14-17,18-21,22-24,25-30,31-34,35-37,38-40,41-44,45-52,53-55,56-58,59-60,61-67,68-69,70-71,72-75',
  J: 'erpj 1-4,5-16,17-21,22-24,25,26,27-28,29,30,31,32-33,34-40',
  L: 'erpl 1-5,6-9,10-11,12,13,14-17,18-19,20-25,26-29,30,31,32-34,35,36-38,39-44,45-48,49-58,59-71,72-75,76-79,80,81,82,83,84,85',
  M: 'erpm 1-2,3-7,8-14,15-17,18-19,20-22,23-24,25-33,34-37,38-43,44,45-58',
  N: 'erpn 1-2,3-5,6-8,9,10,11,12-13,14-15,16-20',
  O: 'erpo 1-2,3-5,6-9,10,11,12,13,14-15,16,17-21,22-24',
  P: 'erpp 1-3,4-6,7-11,12-13,14,15,16,17-19,20-24',
  R: 'erpr 1-5,6-12,13-17,18,19,20-23,24-25,26-27,28-29,30-33',
  S: 'erps 1-2,3-8,9-10,11,12,13-14,15-19',
  T: 'erpt 1-9,10-17,18-20,21-24,25-26,27,28-31,32-36,37-38,39-46,47-52',
  U: 'erpu 1-4,5-7,8-15,16-22,23-25,26,27,28-29,30,31-32,33-35,36-40,41-48,49-50,51-64',
  V: 'erpv 1-2,3-4,5,6,7-8,9-10,11-13',
  W: 'erpw 1-2,3-7,8,9,10,11-16',
  X: 'erpx 1-3,4-10,11-14,15-18,19,20,21,22-23,24-27',
  Y: 'erpy 1-2,3-8,9,10-12,13-14,15,16,17,18-22',
  PE: 'erppe 1-4,5-12,13,14,15-19,20-23,24,25,26-27,28-37',
  PO: 'erppo 1-7,8-13',
  PU: 'erppu 1-6',
  PX: 'erppx 1',
  PA: 'erppa 1-2,3-6,7-8,9,10-11,12-14',
  CTS: 'erpcts 1-6,7-9,10-11,12-14,15,16-20,21-24,25,26-29,30-36,37,38-39,40,41,42-45,46,47-48,49-50,51,52,53-57,58-61,62-63,64-67,68,69,70,71,72-75,76-81',
  SG: 'erpsg 1-4,5,6-10,11-13,14-17,18,19-21,22-25',
  OA: 'erpoa 1-4,5-10,11-14,15,16,17,18-19,20-21,22,23-29',
  REF: 'erpref 1-7,8-9,10-13,14,15,16-20,21-25,26-27,28-29,30,31-32,33-35,36-37,38-39,40-44',
  PS: 'erpps 1-4,5-15,16-17,18-24,25-30,31,32-33,34,35-43',
  GA: 'erpga 1-5,6-10,11-13,14-22,23-26,27,28-29,30,31,32-34,35,36,37,38-44,45-48,49',
  EF: 'erpef 1-3,4-14,15-17,18',
};

// "GN4" -> "https://sitesecurite.com/contenu/_erp/erpgn/gn04a10.php?id=GN4"
// Renvoie null si le code n'est pas un article ERP connu : l'appelant n'affiche alors aucun
// lien, plutot que d'en proposer un qui tomberait sur une 404.
function sitesecuriteUrlForCode(refCode) {
  const m = /^([A-Z]+)(\d+)$/.exec(String(refCode || '').trim().toUpperCase());
  if (!m) return null;

  const [, family, rawNumber] = m;
  const entry = SITESECURITE_ARTICLES[family];
  if (!entry) return null;

  const number = parseInt(rawNumber, 10);
  const [dir, rangesPart] = entry.split(' ');

  for (const range of rangesPart.split(',')) {
    const [start, end] = range.includes('-')
      ? range.split('-').map(Number)
      : [Number(range), Number(range)];
    if (number < start || number > end) continue;

    const pad = (n) => String(n).padStart(2, '0');
    const file = family.toLowerCase() + pad(start) + (end !== start ? 'a' + pad(end) : '');
    return `${SITESECURITE_BASE}${dir}/${file}.php?id=${family}${number}`;
  }
  return null;
}
