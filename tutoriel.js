// tutoriel.js — navigation du tutoriel, animation de la frappe et partage.
// Ouvert par background.js à l'installation initiale (jamais à une mise à jour),
// ou depuis le lien « Tutoriel » du popup. Les visuels sont des maquettes HTML avec les vraies
// icônes de l'extension : à mettre à jour avec elles quand une icône ou un comportement change.

const etapes = [...document.querySelectorAll('.etape')];
const pointsEl = document.getElementById('points');
const precedentEl = document.getElementById('precedent');
const suivantEl = document.getElementById('suivant');
const compteurEl = document.getElementById('compteur');
let courante = 0;

etapes.forEach((etape, i) => {
  const point = document.createElement('button');
  point.type = 'button';
  point.className = 'point';
  point.title = etape.dataset.titre;
  point.setAttribute('aria-label', `Étape ${i + 1} : ${etape.dataset.titre}`);
  point.addEventListener('click', () => afficher(i));
  pointsEl.appendChild(point);
});

function afficher(i) {
  courante = Math.max(0, Math.min(etapes.length - 1, i));
  etapes.forEach((etape, j) => {
    etape.classList.toggle('active', j === courante);
    etape.classList.toggle('avant', j < courante);
  });
  [...pointsEl.children].forEach((p, j) => p.classList.toggle('actif', j === courante));
  precedentEl.disabled = courante === 0;
  const derniere = courante === etapes.length - 1;
  suivantEl.hidden = derniere;
  compteurEl.textContent = `${courante + 1} / ${etapes.length}`;
  if (etapes[courante].querySelector('#demo-frappe')) lancerDemoFrappe();
}

precedentEl.addEventListener('click', () => afficher(courante - 1));
suivantEl.addEventListener('click', () => afficher(courante + 1));
document.addEventListener('keydown', (e) => {
  if (e.target.closest('button, a') && (e.key === 'Enter' || e.key === ' ')) return;
  if (e.key === 'ArrowRight') afficher(courante + 1);
  if (e.key === 'ArrowLeft') afficher(courante - 1);
});

// Fermer l'onglet : window.close() est refusé sur un onglet que l'utilisateur a pu ouvrir
// lui-même ; chrome.tabs.remove sur son propre onglet ne demande aucune permission.
function fermer() {
  chrome.tabs.getCurrent((tab) => {
    if (tab) chrome.tabs.remove(tab.id);
    else window.close();
  });
}
document.getElementById('passer').addEventListener('click', fermer);
document.getElementById('terminer').addEventListener('click', fermer);

// ---------- Démonstration de la frappe ----------
// Tape le déclencheur lettre par lettre, marque la pause, puis le remplace par le texte, en
// boucle tant que l'étape est affichée.
const DEMO_DECLENCHEUR = '/GN4';
const DEMO_TEXTE = 'Les dispositions prévues pour l\'adaptation des règles de sécurité ont été vérifiées ' +
  'sur place et sont conformes au dossier.';
let demoMinuteur = null;

function lancerDemoFrappe() {
  const zone = document.querySelector('#demo-frappe');
  const texte = zone.querySelector('.demo-texte');
  clearTimeout(demoMinuteur);
  let n = 0;
  zone.classList.remove('remplace');
  texte.textContent = 'Visite du 12/03 : ';

  const etape = zone.closest('.etape');
  const encoreVisible = () => etape.classList.contains('active');

  const taper = () => {
    if (!encoreVisible()) return;
    if (n < DEMO_DECLENCHEUR.length) {
      texte.innerHTML = 'Visite du 12/03 : <mark>' + DEMO_DECLENCHEUR.slice(0, ++n) + '</mark>';
      demoMinuteur = setTimeout(taper, 260);
    } else {
      demoMinuteur = setTimeout(() => {
        if (!encoreVisible()) return;
        zone.classList.add('remplace');
        texte.textContent = 'Visite du 12/03 : ' + DEMO_TEXTE;
        demoMinuteur = setTimeout(lancerDemoFrappe, 3200);
      }, 700);
    }
  };
  demoMinuteur = setTimeout(taper, 600);
}

// Étape des icônes Aviso : survoler une ligne de la légende, ou une icône de la maquette, met en
// évidence les deux à la fois.
document.querySelectorAll('[data-ico]').forEach(el => {
  const paire = () => document.querySelectorAll(`[data-ico="${el.dataset.ico}"]`);
  el.addEventListener('mouseenter', () => paire().forEach(x => x.classList.add('actif')));
  el.addEventListener('mouseleave', () => paire().forEach(x => x.classList.remove('actif')));
});

brancherPartage(
  document.getElementById('share-copy'),
  document.getElementById('share-mail'),
  document.getElementById('share-status')
);

afficher(0);

// Statistiques d'utilisation : seule la nature de l'usage part (voir STATS_CLES, background.js).
function compterUsage(cle) {
  chrome.runtime.sendMessage({ type: 'STAT', cle }, () => void chrome.runtime.lastError);
}
compterUsage('tutoriel');
