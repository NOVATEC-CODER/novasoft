/* =====================================================
   NovaSoft - module Finances (caisses, opérations, justificatifs, historique)
   S'appuie sur core.js : db, $, esc, fmtDate, fcfa, iso, msg, clearMsg, show, me
   ===================================================== */

const MODES = { especes: 'Espèces', virement: 'Virement', cheque: 'Chèque', mobile_money: 'Mobile Money', carte: 'Carte', autre: 'Autre' };
const TYPES_CAISSE = { especes: 'Espèces', banque: 'Banque', mobile_money: 'Mobile Money' };
const MODE_PAR_TYPE = { especes: 'especes', banque: 'virement', mobile_money: 'mobile_money' };
const ACTIONS_AUDIT = { INSERT: 'Ajout', UPDATE: 'Modification', DELETE: 'Suppression' };

let ops = [];                     // opérations chargées
let caisses = [];                 // caisses avec leur solde
let operationEnEdition = null;    // opération en cours de modification

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
    <p id="msg-liste-caisses" class="text-sm hidden mt-3"></p>
    <details id="det-caisse" class="mt-4">
      <summary id="titre-caisse" class="text-sm font-semibold text-ocean cursor-pointer">Ajouter une caisse ou un compte</summary>
      <form id="form-caisse" class="mt-3 space-y-4">
        <input type="hidden" id="cs-id">
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
        <label id="ligne-cs-actif" class="hidden items-center gap-2 text-sm text-slate-700">
          <input id="cs-actif" type="checkbox" checked> Caisse active (décoche pour la désactiver sans perdre l'historique)
        </label>
        <div class="flex gap-2">
          <button id="btn-caisse" class="btn flex-1" type="submit">Ajouter</button>
          <button id="btn-caisse-annuler" class="btn-clair hidden" type="button">Annuler</button>
        </div>
        <p id="msg-caisse" class="text-sm hidden"></p>
      </form>
    </details>
  </section>

  <section class="carte">
    <details id="det-op">
    <summary id="titre-op" class="font-bold text-lg cursor-pointer">Enregistrer une opération</summary>
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
        <p id="aide-justif" class="hidden text-xs text-slate-500 mt-1">Laisse vide pour conserver le justificatif actuel. Un nouveau fichier le remplacera.</p>
      </div>
      <div class="flex gap-2">
        <button id="btn-fin" class="btn flex-1" type="submit">Enregistrer l'opération</button>
        <button id="btn-op-annuler" class="btn-clair hidden" type="button">Annuler</button>
      </div>
    </form>
    </details>
    <p id="msg-fin" class="text-sm hidden mt-3"></p>
  </section>

  <section class="carte">
    <h2 class="font-bold text-lg">Opérations du mois</h2>
    <div id="liste-fin" class="mt-3 divide-y divide-slate-100"></div>
    <p id="msg-liste-fin" class="text-sm hidden mt-3"></p>
  </section>
  <details id="sec-audit-fin" class="carte hidden">
    <summary class="font-bold text-lg cursor-pointer">Historique des opérations et des caisses</summary>
    <p class="text-sm text-slate-500 mt-2">Les 30 dernières actions sur les opérations et les caisses. Visible des administrateurs uniquement.</p>
    <div id="liste-audit-fin" class="mt-3 divide-y divide-slate-100"></div>
  </details>
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
  $('form-caisse').addEventListener('submit', enregistrerCaisse);
  $('btn-caisse-annuler').addEventListener('click', quitterEditionCaisse);
  $('liste-caisses').addEventListener('click', actionsCaisse);
  $('liste-fin').addEventListener('click', actionsOperation);
  $('form-fin').addEventListener('submit', enregistrerOperation);
  $('btn-op-annuler').addEventListener('click', quitterEditionOperation);
}

/* ---------- Chargement ---------- */
async function chargerFinances() {
  await chargerCaisses();
  const { data, error } = await db.from('finances')
    .select('id,date,type,montant,categorie,description,justificatif_url,caisse_id,mode_reglement')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) { msg('msg-liste-fin', erreurClaire(error, 'Impossible de charger les opérations.'), false); return; }
  clearMsg('msg-liste-fin');
  ops = data;
  rendreOperations();
  await chargerAudit();
}

async function chargerCaisses() {
  const { data, error } = await db.from('v_soldes_caisses')
    .select('id,nom,type,solde_initial,actif,solde,created_at')
    .order('created_at', { ascending: true });
  if (error) { msg('msg-liste-fin', erreurClaire(error, 'Impossible de charger les caisses.'), false); return; }
  caisses = data;
  rendreCaisses();
}

/* ---------- Historiques (réservés aux administrateurs) : opérations et caisses dans l'onglet Finances, RH et comptes dans l'onglet RH ---------- */
const OBJETS_AUDIT = { finances: 'opération', caisses: 'caisse', employes: 'dossier employé', conges: 'congé', utilisateurs: 'compte', comptes: 'compte', organisations: 'entreprise' };
const CHAMPS_EMPLOYE = { matricule: 'matricule', prenom: 'prénom', nom: 'nom', poste: 'poste', departement: 'département', type_contrat: 'type de contrat', date_embauche: 'date d\'embauche', telephone: 'téléphone', jours_conges_annuels: 'jours de congés', photo_url: 'photo', dossier_url: 'dossier', utilisateur_id: 'compte rattaché' };
const CHAMPS_ENTREPRISE = { nom: 'nom', sigle: 'sigle', ifu: 'IFU', rccm: 'RCCM', adresse: 'adresse', telephone: 'téléphone', email: 'email' };
const VERBES_CONGE = { approuve: 'Congé approuvé', refuse: 'Congé refusé', annule: 'Congé annulé', en_attente: 'Congé remis en attente' };

function champsModifies(avant, apres, libelles) {
  return Object.keys(libelles)
    .filter((k) => JSON.stringify(avant[k] ?? null) !== JSON.stringify(apres[k] ?? null))
    .map((k) => libelles[k]);
}

function decrireAudit(a, noms) {
  const avant = a.avant || {};
  const apres = a.apres || {};
  const l = a.apres || a.avant || {};
  let titre = (ACTIONS_AUDIT[a.action] || a.action) + ' · ' + (OBJETS_AUDIT[a.table_nom] || a.table_nom);
  let detail = '';
  switch (a.table_nom) {
    case 'finances':
      detail = (l.categorie || '') + ' · ' + fcfa(l.montant);
      if (a.action === 'UPDATE' && Number(avant.montant) !== Number(apres.montant)) detail += ' (avant : ' + fcfa(avant.montant) + ')';
      break;
    case 'caisses':
      detail = l.nom || '';
      if (a.action === 'UPDATE' && avant.nom !== apres.nom) detail += ' (avant : ' + (avant.nom || '') + ')';
      break;
    case 'employes': {
      detail = ((l.prenom || '') + ' ' + (l.nom || '')).trim() + (l.matricule ? ' (' + l.matricule + ')' : '');
      if (a.action === 'UPDATE') {
        const ch = champsModifies(avant, apres, CHAMPS_EMPLOYE);
        if (ch.length) detail += ' · modifié : ' + ch.join(', ');
      }
      break;
    }
    case 'conges': {
      if (a.action === 'INSERT') titre = 'Demande de congé';
      else if (a.action === 'DELETE') titre = 'Congé supprimé';
      else if (avant.statut !== apres.statut) titre = VERBES_CONGE[apres.statut] || 'Congé modifié';
      else titre = 'Congé modifié';
      const periode = (l.date_debut && l.date_fin) ? ' · du ' + fmtDate(l.date_debut) + ' au ' + fmtDate(l.date_fin) : '';
      detail = (noms[l.employe_id] || 'Employé') + ' · ' + (TYPES[l.type] || l.type || '') + periode;
      break;
    }
    case 'utilisateurs':
      if (a.action === 'UPDATE' && avant.role !== apres.role) {
        titre = 'Changement de rôle';
        detail = (l.nom || l.email || '') + ' : ' + (ROLES[avant.role] || avant.role) + ' → ' + (ROLES[apres.role] || apres.role);
      } else if (a.action === 'DELETE') {
        titre = 'Compte supprimé';
        detail = l.nom || l.email || '';
      } else {
        titre = 'Compte modifié';
        detail = l.nom || l.email || '';
      }
      break;
    case 'comptes':
      titre = 'Compte créé';
      detail = (l.nom || '') + (l.email ? ' (' + l.email + ')' : '') + (l.role ? ' · ' + (ROLES[l.role] || l.role) : '');
      break;
    case 'organisations':
      if (avant.actif !== undefined && avant.actif !== apres.actif) {
        titre = apres.actif ? 'Entreprise réactivée' : 'Entreprise suspendue';
        detail = l.nom || '';
      } else {
        titre = 'Profil de l\'entreprise modifié';
        const ch = champsModifies(avant, apres, CHAMPS_ENTREPRISE);
        detail = ch.length ? 'Modifié : ' + ch.join(', ') : (l.nom || '');
      }
      break;
    default:
      detail = '';
  }
  return { titre: titre, detail: detail };
}

const TABLES_AUDIT_FIN = ['finances', 'caisses'];
const TABLES_AUDIT_RH = ['employes', 'conges', 'utilisateurs', 'comptes', 'organisations'];

function afficherAudit(idListe, resultat, noms) {
  const box = $(idListe);
  if (resultat.error) { box.innerHTML = '<p class="py-3 text-sm text-rose-600">' + esc(erreurClaire(resultat.error, 'Historique indisponible pour le moment.')) + '</p>'; return; }
  if (!resultat.data.length) { box.innerHTML = '<p class="py-3 text-sm text-slate-500">Aucune action enregistrée pour l\'instant.</p>'; return; }
  box.innerHTML = resultat.data.map((a) => {
    const d = decrireAudit(a, noms);
    const qui = a.utilisateurs ? a.utilisateurs.nom : 'Système';
    return '<div class="py-3">'
      + '<p class="text-sm font-semibold">' + esc(d.titre) + '</p>'
      + (d.detail ? '<p class="text-sm text-slate-600">' + esc(d.detail) + '</p>' : '')
      + '<p class="text-xs text-slate-500">' + esc(qui) + ' · ' + new Date(a.cree_le).toLocaleString('fr-FR') + '</p></div>';
  }).join('');
}

async function chargerAudit() {
  const estAdmin = !!me && me.role === 'admin';
  show('sec-audit-fin', estAdmin);
  show('sec-audit-rh', estAdmin);
  if (!estAdmin) return;
  const colonnes = 'id,table_nom,action,avant,apres,cree_le,utilisateurs(nom)';
  const [fin, rh, liste] = await Promise.all([
    db.from('journal_audit').select(colonnes).in('table_nom', TABLES_AUDIT_FIN).order('cree_le', { ascending: false }).limit(30),
    db.from('journal_audit').select(colonnes).in('table_nom', TABLES_AUDIT_RH).order('cree_le', { ascending: false }).limit(30),
    db.from('employes').select('id,prenom,nom')
  ]);
  const noms = {};
  (liste.data || []).forEach((e) => { noms[e.id] = (e.prenom + ' ' + e.nom).trim(); });
  afficherAudit('liste-audit-fin', fin, noms);
  afficherAudit('liste-audit-rh', rh, noms);
}

/* ---------- Affichage ---------- */
function rendreCaisses() {
  const box = $('liste-caisses');
  if (!caisses.length) {
    box.innerHTML = '<p class="py-3 text-sm text-slate-500">Aucune caisse. Ajoute-en une ci-dessous.</p>';
  } else {
    box.innerHTML = caisses.map((c) => '<div class="py-3">'
      + '<div class="flex items-start justify-between gap-3">'
      + '<div class="min-w-0"><p class="text-sm font-semibold">' + esc(c.nom)
      + (c.actif ? '' : ' <span class="text-xs font-normal text-slate-400">(désactivée)</span>') + '</p>'
      + '<p class="text-xs text-slate-500">' + esc(TYPES_CAISSE[c.type] || c.type) + '</p></div>'
      + '<p class="shrink-0 text-sm font-bold ' + (Number(c.solde) < 0 ? 'text-rose-600' : 'text-slate-800') + '">' + fcfa(c.solde) + '</p></div>'
      + '<div class="mt-1 flex gap-4 text-xs font-semibold">'
      + '<button type="button" class="text-ocean" data-caisse="edit" data-id="' + esc(c.id) + '">Modifier</button>'
      + '<button type="button" class="text-rose-600" data-caisse="suppr" data-id="' + esc(c.id) + '">Supprimer</button>'
      + '</div></div>').join('');
  }
  $('k-total').textContent = fcfa(caisses.reduce((s, c) => s + Number(c.solde), 0));

  const choix = $('f-caisse');
  const precedent = choix.value;
  const caisseDeLOperation = operationEnEdition ? operationEnEdition.caisse_id : null;
  choix.innerHTML = caisses.filter((c) => c.actif || c.id === caisseDeLOperation)
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
      + '<div class="mt-1 flex gap-4 text-xs font-semibold">'
      + (o.justificatif_url ? '<button type="button" class="text-ocean" data-act="justif" data-path="' + esc(o.justificatif_url) + '">Justificatif</button>' : '')
      + '<button type="button" class="text-ocean" data-act="edit" data-id="' + esc(o.id) + '">Modifier</button>'
      + '<button type="button" class="text-rose-600" data-act="suppr" data-id="' + esc(o.id) + '">Supprimer</button>'
      + '</div></div>'
      + '<p class="shrink-0 text-sm font-bold ' + (entree ? 'text-lumina-dark' : 'text-rose-600') + '">' + (entree ? '+ ' : '− ') + fcfa(o.montant) + '</p></div>';
  }).join('');
}

/* ---------- Caisses : ajout, modification, désactivation, suppression ---------- */
function quitterEditionCaisse() {
  $('form-caisse').reset();
  $('cs-id').value = '';
  $('cs-actif').checked = true;
  show('ligne-cs-actif', false);
  $('ligne-cs-actif').classList.remove('flex');
  show('btn-caisse-annuler', false);
  $('btn-caisse').textContent = 'Ajouter';
  $('titre-caisse').textContent = 'Ajouter une caisse ou un compte';
  clearMsg('msg-caisse');
}

function modifierCaisse(id) {
  const c = caisses.find((x) => x.id === id);
  if (!c) return;
  $('cs-id').value = c.id;
  $('cs-nom').value = c.nom;
  $('cs-type').value = c.type;
  $('cs-solde').value = Number(c.solde_initial);
  $('cs-actif').checked = !!c.actif;
  show('ligne-cs-actif', true);
  $('ligne-cs-actif').classList.add('flex');
  show('btn-caisse-annuler', true);
  $('btn-caisse').textContent = 'Enregistrer les modifications';
  $('titre-caisse').textContent = 'Modifier la caisse';
  clearMsg('msg-caisse');
  $('det-caisse').open = true;
  $('det-caisse').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function enregistrerCaisse(e) {
  e.preventDefault();
  clearMsg('msg-caisse');
  const id = $('cs-id').value;
  const champs = {
    nom: $('cs-nom').value.trim(),
    type: $('cs-type').value,
    solde_initial: Math.max(0, Math.round(Number($('cs-solde').value) || 0))
  };
  let resultat;
  if (id) {
    champs.actif = $('cs-actif').checked;
    resultat = await db.from('caisses').update(champs).eq('id', id);
  } else {
    resultat = await db.from('caisses').insert(champs);
  }
  if (resultat.error) {
    const doublon = resultat.error.message.includes('duplicate');
    msg('msg-caisse', doublon ? 'Une caisse porte déjà ce nom.' : erreurClaire(resultat.error, 'La caisse n\'a pas pu être enregistrée.'), false);
    return;
  }
  const modification = !!id;
  quitterEditionCaisse();
  msg('msg-caisse', modification ? 'Caisse modifiée.' : 'Caisse ajoutée.', true);
  await chargerFinances();
}

async function actionsCaisse(e) {
  const btn = e.target.closest('button[data-caisse]');
  if (!btn) return;
  clearMsg('msg-liste-caisses');
  if (btn.dataset.caisse === 'edit') { modifierCaisse(btn.dataset.id); return; }
  const c = caisses.find((x) => x.id === btn.dataset.id);
  if (!window.confirm('Supprimer la caisse « ' + (c ? c.nom : '') + ' » ? Cette action est définitive.')) return;
  const { error } = await db.from('caisses').delete().eq('id', btn.dataset.id);
  if (error) {
    const liee = error.code === '23503' || /foreign key/i.test(error.message);
    msg('msg-liste-caisses', liee
      ? 'Suppression impossible : cette caisse contient des opérations. Désactive-la plutôt (Modifier, puis décoche « Caisse active »).'
      : erreurClaire(error, 'La caisse n\'a pas pu être supprimée.'), false);
    return;
  }
  await chargerFinances();
}

/* ---------- Opérations : modification, suppression, justificatif ---------- */
function quitterEditionOperation() {
  operationEnEdition = null;
  $('form-fin').reset();
  $('f-date').value = iso(new Date());
  $('titre-op').textContent = 'Enregistrer une opération';
  $('btn-fin').textContent = 'Enregistrer l\'opération';
  show('btn-op-annuler', false);
  show('aide-justif', false);
  $('det-op').open = false;
  rendreCaisses();
}

function modifierOperation(id) {
  const o = ops.find((x) => x.id === id);
  if (!o) return;
  operationEnEdition = o;
  rendreCaisses();
  $('f-type').value = o.type;
  $('f-date').value = o.date;
  if (o.caisse_id) $('f-caisse').value = o.caisse_id;
  $('f-mode').value = o.mode_reglement || 'especes';
  $('f-montant').value = Number(o.montant);
  $('f-cat').value = o.categorie;
  $('f-desc').value = o.description || '';
  $('f-fichier').value = '';
  $('titre-op').textContent = 'Modifier l\'opération';
  $('btn-fin').textContent = 'Mettre à jour l\'opération';
  show('btn-op-annuler', true);
  show('aide-justif', !!o.justificatif_url);
  clearMsg('msg-fin');
  $('det-op').open = true;
  $('form-fin').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function actionsOperation(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  clearMsg('msg-liste-fin');
  if (btn.dataset.act === 'edit') {
    modifierOperation(btn.dataset.id);
  } else if (btn.dataset.act === 'justif') {
    const fenetre = window.open('', '_blank');
    const { data, error } = await db.storage.from('justificatifs').createSignedUrl(btn.dataset.path, 120);
    if (error || !data) {
      if (fenetre) fenetre.close();
      msg('msg-liste-fin', erreurClaire(error, 'Le justificatif est introuvable.'), false);
      return;
    }
    if (fenetre) fenetre.location = data.signedUrl; else window.location.href = data.signedUrl;
  } else if (btn.dataset.act === 'suppr') {
    if (!window.confirm('Supprimer cette opération ? L\'action sera inscrite dans l\'historique.')) return;
    const op = ops.find((o) => o.id === btn.dataset.id);
    const { error } = await db.from('finances').delete().eq('id', btn.dataset.id);
    if (error) { msg('msg-liste-fin', erreurClaire(error, 'L\'opération n\'a pas pu être supprimée.'), false); return; }
    if (op && op.justificatif_url) await db.storage.from('justificatifs').remove([op.justificatif_url]);
    if (operationEnEdition && operationEnEdition.id === btn.dataset.id) quitterEditionOperation();
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
      if (up.error) { msg('msg-fin', erreurClaire(up.error, 'Le justificatif n\'a pas pu être envoyé.'), false); return; }
    }
    const champs = {
      type: $('f-type').value,
      date: $('f-date').value,
      montant: montant,
      categorie: $('f-cat').value.trim(),
      description: $('f-desc').value.trim() || null,
      caisse_id: $('f-caisse').value,
      mode_reglement: $('f-mode').value
    };

    if (operationEnEdition) {
      if (chemin) champs.justificatif_url = chemin;
      const { error } = await db.from('finances').update(champs).eq('id', operationEnEdition.id);
      if (error) {
        if (chemin) await db.storage.from('justificatifs').remove([chemin]);
        msg('msg-fin', erreurClaire(error, 'L\'opération n\'a pas pu être modifiée.'), false);
        return;
      }
      if (chemin && operationEnEdition.justificatif_url) {
        await db.storage.from('justificatifs').remove([operationEnEdition.justificatif_url]);
      }
      quitterEditionOperation();
      msg('msg-fin', 'Opération modifiée.', true);
      await chargerFinances();
      return;
    }

    champs.justificatif_url = chemin;
    const { error } = await db.from('finances').insert(champs);
    if (error) {
      if (chemin) await db.storage.from('justificatifs').remove([chemin]);
      msg('msg-fin', erreurClaire(error, 'L\'opération n\'a pas pu être enregistrée.'), false);
      return;
    }
    const caisseChoisie = $('f-caisse').value;
    msg('msg-fin', 'Opération enregistrée.', true);
    $('form-fin').reset();
    $('f-date').value = iso(new Date());
    await chargerFinances();
    $('f-caisse').value = caisseChoisie;
  } finally {
    btn.disabled = false;
  }
}
