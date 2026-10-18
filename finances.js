/* =====================================================
   NovaSoft - module Finances (caisses, opérations, justificatifs)
   S'appuie sur core.js : db, $, esc, fmtDate, fcfa, iso, msg, clearMsg, me
   ===================================================== */

const MODES = { especes: 'Espèces', virement: 'Virement', cheque: 'Chèque', mobile_money: 'Mobile Money', carte: 'Carte', autre: 'Autre' };
const TYPES_CAISSE = { especes: 'Espèces', banque: 'Banque', mobile_money: 'Mobile Money' };
const MODE_PAR_TYPE = { especes: 'especes', banque: 'virement', mobile_money: 'mobile_money' };

let ops = [];      // opérations chargées
let caisses = [];  // caisses avec leur solde

const MODELE_FINANCES = `
  <section class="carte">
    <div class="flex items-center justify-between gap-3">
      <h2 class="font-bold text-lg">Tableau de bord</h2>
      <input id="f-mois" type="month" class="champ !w-auto !py-1.5">
    </div>
    <div class="grid grid-cols-1 gap-3 mt-4">
      <div class="rounded-xl bg-emerald-50 p-4">
        <p class="text-sm text-emerald-700">Recettes du mois</p>
        <p id="k-rec" class="text-2xl font-extrabold text-lumina-dark mt-1">0 FCFA</p>
      </div>
      <div class="rounded-xl bg-rose-50 p-4">
        <p class="text-sm text-rose-700">Dépenses du mois</p>
        <p id="k-dep" class="text-2xl font-extrabold text-rose-600 mt-1">0 FCFA</p>
      </div>
      <div class="rounded-xl bg-blue-50 p-4">
        <p class="text-sm text-blue-800">Solde du mois</p>
        <p id="k-solde" class="text-2xl font-extrabold text-ocean mt-1">0 FCFA</p>
      </div>
    </div>
    <p class="text-sm text-slate-500 mt-4">Trésorerie totale : <span id="k-total" class="font-semibold text-slate-700">0 FCFA</span></p>
  </section>

  <section class="carte">
    <h2 class="font-bold text-lg">Caisses et comptes</h2>
    <div id="liste-caisses" class="mt-3 divide-y divide-slate-100"></div>
    <details class="mt-4">
      <summary class="text-sm font-semibold text-ocean cursor-pointer">Ajouter une caisse ou un compte</summary>
      <form id="form-caisse" class="mt-3 space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="etiq" for="cs-nom">Nom</label>
            <input id="cs-nom" required class="champ">
          </div>
          <div>
            <label class="etiq" for="cs-type">Type</label>
            <select id="cs-type" class="champ">
              <option value="especes">Espèces</option>
              <option value="banque">Banque</option>
              <option value="mobile_money">Mobile Money</option>
            </select>
          </div>
        </div>
        <div>
          <label class="etiq" for="cs-solde">Solde initial (FCFA)</label>
          <input id="cs-solde" type="number" inputmode="numeric" min="0" step="1" value="0" class="champ">
        </div>
        <button class="btn w-full" type="submit">Ajouter</button>
        <p id="msg-caisse" class="text-sm hidden"></p>
      </form>
    </details>
  </section>

  <section class="carte">
    <h2 class="font-bold text-lg">Enregistrer une opération</h2>
    <form id="form-fin" class="mt-4 space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="etiq" for="f-type">Type</label>
          <select id="f-type" class="champ">
            <option value="recette">Recette</option>
            <option value="depense">Dépense</option>
          </select>
        </div>
        <div>
          <label class="etiq" for="f-date">Date</label>
          <input id="f-date" type="date" required class="champ">
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="etiq" for="f-caisse">Caisse</label>
          <select id="f-caisse" required class="champ"></select>
        </div>
        <div>
          <label class="etiq" for="f-mode">Règlement</label>
          <select id="f-mode" class="champ">
            <option value="especes">Espèces</option>
            <option value="virement">Virement</option>
            <option value="cheque">Chèque</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="carte">Carte</option>
            <option value="autre">Autre</option>
          </select>
        </div>
      </div>
      <div>
        <label class="etiq" for="f-montant">Montant (FCFA)</label>
        <input id="f-montant" type="number" inputmode="numeric" min="1" step="1" required class="champ">
      </div>
      <div>
        <label class="etiq" for="f-cat">Catégorie</label>
        <input id="f-cat" list="liste-cat" required class="champ" autocomplete="off">
        <datalist id="liste-cat">
          <option value="Ventes"></option>
          <option value="Prestations"></option>
          <option value="Salaires"></option>
          <option value="Loyer"></option>
          <option value="Fournitures"></option>
          <option value="Transport"></option>
          <option value="Communication"></option>
          <option value="Impôts et taxes"></option>
          <option value="Autre"></option>
        </datalist>
      </div>
      <div>
        <label class="etiq" for="f-desc">Description (facultatif)</label>
        <input id="f-desc" class="champ">
      </div>
      <div>
        <label class="etiq" for="f-fichier">Justificatif (photo ou PDF, facultatif)</label>
        <input id="f-fichier" type="file" accept="image/*,application/pdf" class="champ">
      </div>
      <button id="btn-fin" class="btn w-full" type="submit">Enregistrer l'opération</button>
      <p id="msg-fin" class="text-sm hidden"></p>
    </form>
  </section>

  <section class="carte">
    <h2 class="font-bold text-lg">Opérations du mois</h2>
    <div id="liste-fin" class="mt-3 divide-y divide-slate-100"></div>
    <p id="msg-liste-fin" class="text-sm hidden mt-3"></p>
  </section>
`;

/* ---------- Mise en place du module (appelée une fois au chargement de la page) ---------- */
function initFinances() {
  $('onglet-fin').innerHTML = MODELE_FINANCES;
  $('f-mois').value = iso(new Date()).slice(0, 7);
  $('f-date').value = iso(new Date());

  $('f-mois').addEventListener('change', rendreOperations);
  $('f-caisse').addEventListener('change', () => {
    const c = caisses.find((x) => x.id === $('f-caisse').value);
    if (c && MODE_PAR_TYPE[c.type]) $('f-mode').value = MODE_PAR_TYPE[c.type];
  });
  $('form-caisse').addEventListener('submit', ajouterCaisse);
  $('liste-fin').addEventListener('click', actionsOperation);
  $('form-fin').addEventListener('submit', enregistrerOperation);
}

/* ---------- Chargement ---------- */
async function chargerFinances() {
  await chargerCaisses();
  const { data, error } = await db.from('finances')
    .select('id,date,type,montant,categorie,description,justificatif_url,caisse_id,mode_reglement')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) { msg('msg-liste-fin', 'Impossible de charger les opérations : ' + error.message, false); return; }
  clearMsg('msg-liste-fin');
  ops = data;
  rendreOperations();
}

async function chargerCaisses() {
  const { data, error } = await db.from('v_soldes_caisses')
    .select('id,nom,type,solde_initial,actif,solde,created_at')
    .order('created_at', { ascending: true });
  if (error) { msg('msg-liste-fin', 'Impossible de charger les caisses : ' + error.message, false); return; }
  caisses = data;
  rendreCaisses();
}

/* ---------- Affichage ---------- */
function rendreCaisses() {
  const box = $('liste-caisses');
  if (!caisses.length) {
    box.innerHTML = '<p class="py-3 text-sm text-slate-500">Aucune caisse. Ajoute-en une ci-dessous.</p>';
  } else {
    box.innerHTML = caisses.map((c) => '<div class="py-3 flex items-start justify-between gap-3">'
      + '<div class="min-w-0"><p class="text-sm font-semibold">' + esc(c.nom) + '</p>'
      + '<p class="text-xs text-slate-500">' + esc(TYPES_CAISSE[c.type] || c.type) + '</p></div>'
      + '<p class="shrink-0 text-sm font-bold ' + (Number(c.solde) < 0 ? 'text-rose-600' : 'text-slate-800') + '">' + fcfa(c.solde) + '</p></div>').join('');
  }
  $('k-total').textContent = fcfa(caisses.reduce((s, c) => s + Number(c.solde), 0));

  const choix = $('f-caisse');
  const precedent = choix.value;
  choix.innerHTML = caisses.filter((c) => c.actif)
    .map((c) => '<option value="' + esc(c.id) + '">' + esc(c.nom) + '</option>').join('');
  if (precedent && caisses.some((c) => c.id === precedent)) choix.value = precedent;
  const courante = caisses.find((c) => c.id === choix.value);
  if (courante && !precedent && MODE_PAR_TYPE[courante.type]) $('f-mode').value = MODE_PAR_TYPE[courante.type];
}

function rendreOperations() {
  const mois = $('f-mois').value;
  const duMois = ops.filter((o) => o.date.startsWith(mois));
  const somme = (liste, type) => liste.filter((o) => o.type === type).reduce((s, o) => s + Number(o.montant), 0);
  const rec = somme(duMois, 'recette');
  const dep = somme(duMois, 'depense');
  $('k-rec').textContent = fcfa(rec);
  $('k-dep').textContent = fcfa(dep);
  $('k-solde').textContent = fcfa(rec - dep);

  const box = $('liste-fin');
  if (!duMois.length) { box.innerHTML = '<p class="py-3 text-sm text-slate-500">Aucune opération ce mois-ci.</p>'; return; }
  box.innerHTML = duMois.map((o) => {
    const entree = o.type === 'recette';
    const caisse = caisses.find((c) => c.id === o.caisse_id);
    const details = [fmtDate(o.date)];
    if (caisse) details.push(esc(caisse.nom));
    if (o.mode_reglement) details.push(esc(MODES[o.mode_reglement] || o.mode_reglement));
    if (o.description) details.push(esc(o.description));
    return '<div class="py-3 flex items-start justify-between gap-3">'
      + '<div class="min-w-0"><p class="text-sm font-semibold">' + esc(o.categorie) + '</p>'
      + '<p class="text-xs text-slate-500">' + details.join(' · ') + '</p>'
      + '<div class="mt-1 flex gap-3 text-xs font-semibold">'
      + (o.justificatif_url ? '<button class="text-ocean" data-act="justif" data-path="' + esc(o.justificatif_url) + '">Voir le justificatif</button>' : '')
      + '<button class="text-rose-600" data-act="suppr" data-id="' + esc(o.id) + '">Supprimer</button>'
      + '</div></div>'
      + '<p class="shrink-0 text-sm font-bold ' + (entree ? 'text-lumina-dark' : 'text-rose-600') + '">' + (entree ? '+ ' : '− ') + fcfa(o.montant) + '</p></div>';
  }).join('');
}

/* ---------- Actions ---------- */
async function ajouterCaisse(e) {
  e.preventDefault();
  clearMsg('msg-caisse');
  const { error } = await db.from('caisses').insert({
    nom: $('cs-nom').value.trim(),
    type: $('cs-type').value,
    solde_initial: Math.max(0, Math.round(Number($('cs-solde').value) || 0))
  });
  if (error) {
    const doublon = error.message.includes('duplicate');
    msg('msg-caisse', doublon ? 'Une caisse porte déjà ce nom.' : 'Ajout impossible : ' + error.message, false);
    return;
  }
  msg('msg-caisse', 'Caisse ajoutée.', true);
  $('form-caisse').reset();
  await chargerCaisses();
}

async function actionsOperation(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  clearMsg('msg-liste-fin');
  if (btn.dataset.act === 'justif') {
    const fenetre = window.open('', '_blank');
    const { data, error } = await db.storage.from('justificatifs').createSignedUrl(btn.dataset.path, 120);
    if (error || !data) {
      if (fenetre) fenetre.close();
      msg('msg-liste-fin', 'Justificatif introuvable : ' + (error ? error.message : ''), false);
      return;
    }
    if (fenetre) fenetre.location = data.signedUrl; else window.location.href = data.signedUrl;
  } else if (btn.dataset.act === 'suppr') {
    if (!window.confirm('Supprimer cette opération ? Cette action est définitive.')) return;
    const op = ops.find((o) => o.id === btn.dataset.id);
    const { error } = await db.from('finances').delete().eq('id', btn.dataset.id);
    if (error) { msg('msg-liste-fin', 'Suppression impossible : ' + error.message, false); return; }
    if (op && op.justificatif_url) await db.storage.from('justificatifs').remove([op.justificatif_url]);
    await chargerFinances();
  }
}

async function enregistrerOperation(e) {
  e.preventDefault();
  clearMsg('msg-fin');
  const montant = Math.round(Number($('f-montant').value));
  if (!(montant > 0)) { msg('msg-fin', 'Saisis un montant supérieur à zéro.', false); return; }
  if (!$('f-caisse').value) { msg('msg-fin', 'Choisis une caisse. Ajoute-en une si la liste est vide.', false); return; }
  const btn = $('btn-fin');
  btn.disabled = true;
  try {
    let chemin = null;
    const fichier = $('f-fichier').files[0];
    if (fichier) {
      if (fichier.size > 10 * 1024 * 1024) { msg('msg-fin', 'Le justificatif dépasse 10 Mo.', false); return; }
      chemin = me.id + '/' + Date.now() + '-' + fichier.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const up = await db.storage.from('justificatifs').upload(chemin, fichier, { contentType: fichier.type || undefined });
      if (up.error) { msg('msg-fin', 'Envoi du justificatif impossible : ' + up.error.message, false); return; }
    }
    const { error } = await db.from('finances').insert({
      type: $('f-type').value,
      date: $('f-date').value,
      montant: montant,
      categorie: $('f-cat').value.trim(),
      description: $('f-desc').value.trim() || null,
      justificatif_url: chemin,
      caisse_id: $('f-caisse').value,
      mode_reglement: $('f-mode').value
    });
    if (error) {
      if (chemin) await db.storage.from('justificatifs').remove([chemin]);
      msg('msg-fin', 'Enregistrement impossible : ' + error.message, false);
      return;
    }
    msg('msg-fin', 'Opération enregistrée.', true);
    const caisseChoisie = $('f-caisse').value;
    $('form-fin').reset();
    $('f-date').value = iso(new Date());
    await chargerFinances();
    $('f-caisse').value = caisseChoisie;
  } finally {
    btn.disabled = false;
  }
}
