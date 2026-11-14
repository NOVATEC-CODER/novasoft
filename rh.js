/* =====================================================
 NovaSoft - module RH : habilitations, dossier employé enrichi, dossiers du personnel
 - « Mon dossier » : l'employé consulte sa propre fiche (poste, contrat, identité, rémunération).
 - « Dossiers du personnel » : RH (lecture et écriture) et Direction (lecture, rémunération modifiable).
 - « Habilitations » : l'administrateur donne les habilitations RH, Directeur RH, Direction et Médecin.
 Toutes les règles de confidentialité sont appliquées par la base de données ; l'écran ne fait qu'afficher.
 S'appuie sur core.js : db, $, esc, fmtDate, fcfa, iso, msg, clearMsg, show, notifier, erreurClaire, me, emp, loadATraiter
 ===================================================== */
const HABILITATIONS = {
 rh: 'RH',
 directeur_rh: 'Directeur RH',
 direction: 'Direction (DG, PCA, PDG)',
 medecin: 'Médecin'
};
const SITUATIONS = [['celibataire', 'Célibataire'], ['marie', 'Marié(e)'], ['divorce', 'Divorcé(e)'], ['veuf', 'Veuf / veuve'], ['union_libre', 'Union libre']];
const CONTRATS = ['CDI', 'CDD', 'Stage', 'Prestation', 'Autre'];
let habilitationsMoi = [];
let estRH = false;
let estDirecteurRH = false;
let estDirection = false;
let estMedecin = false;
let personnel = [];
let employeOuvert = null;
let donneesOuvertes = null;
/* ---------- Petits calculs (testés à part) ---------- */
function ancienneteTexte(debut, maintenant) {
 if (!debut) return 'Non renseignée';
 const d = new Date(debut + 'T00:00:00');
 const n = maintenant || new Date();
 let mois = (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth());
 if (n.getDate() < d.getDate()) mois -= 1;
 if (mois < 0) return 'Pas encore commencé';
 const a = Math.floor(mois / 12);
 const m = mois % 12;
 if (a === 0 && m === 0) return 'Moins d\'un mois';
 const parties = [];
 if (a) parties.push(a + (a > 1 ? ' ans' : ' an'));
 if (m) parties.push(m + ' mois');
 return parties.join(' et ');
}
function ageTexte(naissance, maintenant) {
 if (!naissance) return '';
 const d = new Date(naissance + 'T00:00:00');
 const n = maintenant || new Date();
 let age = n.getFullYear() - d.getFullYear();
 if (n.getMonth() < d.getMonth() || (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())) age -= 1;
 return age >= 0 ? age + ' ans' : '';
}
const COULEURS = {
 vert: 'bg-emerald-50 text-emerald-700',
 orange: 'bg-amber-50 text-amber-700',
 rouge: 'bg-rose-50 text-rose-700',
 gris: 'bg-slate-100 text-slate-600'
};
function statutPaiement(p, aujourdhui) {
 const auj = aujourdhui || iso(new Date());
 if (p.date_paiement) return p.date_paiement <= p.date_prevue ? ['Payé à temps', 'vert'] : ['Payé en retard', 'orange'];
 return auj > p.date_prevue ? ['En retard', 'rouge'] : ['En attente', 'gris'];
}
function bilanPaiements(paiements, aujourdhui) {
 if (!paiements || !paiements.length) return ['Aucun paiement enregistré', 'gris'];
 const recents = paiements.slice().sort((a, b) => (a.periode < b.periode ? 1 : -1)).slice(0, 6);
 const retards = recents.filter((p) => {
 const s = statutPaiement(p, aujourdhui)[0];
 return s === 'Payé en retard' || s === 'En retard';
 }).length;
 if (!retards) return ['Salaires payés à temps', 'vert'];
 return [retards + ' retard' + (retards > 1 ? 's' : '') + ' de paiement sur les ' + recents.length + ' derniers mois', 'rouge'];
}
function moisLibelle(periode) {
 return new Date(periode + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}
function datePrevue(mois, jour) {
 // mois « 2026-11 » + jour limite (1 à 31) → date réelle, ramenée au dernier jour du mois si besoin
 const [a, m] = mois.split('-').map(Number);
 const dernier = new Date(a, m, 0).getDate();
 return mois + '-' + String(Math.min(Number(jour) || 5, dernier)).padStart(2, '0');
}
function badge(texte, couleur) {
 return '<span class="px-2.5 py-1 rounded-full text-xs font-semibold ' + (COULEURS[couleur] || COULEURS.gris) + '">' + esc(texte) + '</span>';
}
/* ---------- Habilitations de la personne connectée ---------- */
async function chargerHabilitations() {
 const r = await db.from('habilitations').select('habilitation').eq('utilisateur_id', me.id);
 if (r.error) {
 console.warn('[NovaSoft] habilitations indisponibles', r.error.message);
 habilitationsMoi = [];
 } else {
 habilitationsMoi = (r.data || []).map((x) => x.habilitation);
 }
 estDirecteurRH = habilitationsMoi.includes('directeur_rh');
 estRH = estDirecteurRH || habilitationsMoi.includes('rh');
 estDirection = habilitationsMoi.includes('direction');
 estMedecin = habilitationsMoi.includes('medecin');
}
/* Appelée par core.js (loadApp) une fois la double authentification passée */
async function initialiserRH() {
 await chargerHabilitations();
 const estAdmin = me.role === 'admin';
 show('sec-traiter', estAdmin || estRH);
 show('sec-employe', estAdmin || estRH);
 if (estRH) await loadATraiter();
 show('sec-personnel', estRH || estDirection);
 show('sec-habilitations', estAdmin);
 if (emp) await chargerMonDossier(); else $('dossier-detail').innerHTML = '';
 if (estRH || estDirection) await chargerPersonnel();
 if (estAdmin) await chargerHabilitationsEquipe();
}
/* ---------- Présentation en lecture (Mon dossier) ---------- */
function ligneLecture(libelle, valeur) {
 if (valeur === null || valeur === undefined || valeur === '') return '';
 return '<div class="flex justify-between gap-3 py-1 text-sm"><span class="text-slate-500">' + esc(libelle) + '</span><span class="font-semibold text-right">' + esc(valeur) + '</span></div>';
}
function blocLecture(titre, lignes, ouvert) {
 const corps = lignes.join('');
 return '<details class="rounded-xl border border-slate-200 p-3"' + (ouvert ? ' open' : '') + '><summary class="font-semibold text-sm cursor-pointer">' + esc(titre) + '</summary><div class="mt-2 divide-y divide-slate-100">'
 + (corps || '<p class="py-2 text-sm text-slate-400">Rien n\'est encore renseigné.</p>') + '</div></details>';
}
function libelleSituation(v) {
 const s = SITUATIONS.find((x) => x[0] === v);
 return s ? s[1] : (v || '');
}
function listePaiementsHtml(paiements) {
 if (!paiements || !paiements.length) return '<p class="py-2 text-sm text-slate-400">Aucun paiement enregistré.</p>';
 return paiements.map((p) => {
 const [lib, coul] = statutPaiement(p);
 return '<div class="flex items-center justify-between gap-3 py-2 text-sm"><div><p class="font-semibold">' + esc(moisLibelle(p.periode)) + '</p>'
 + '<p class="text-xs text-slate-500">' + fcfa(p.montant) + ' · avant le ' + fmtDate(p.date_prevue) + (p.date_paiement ? ' · payé le ' + fmtDate(p.date_paiement) : '') + '</p></div>'
 + badge(lib, coul) + '</div>';
 }).join('');
}
async function chargerMonDossier() {
 const [idt, rem, pai] = await Promise.all([
 db.from('employes_identite').select('*').eq('employe_id', emp.id).maybeSingle(),
 db.from('employes_remuneration').select('*').eq('employe_id', emp.id).maybeSingle(),
 db.from('paiements_salaire').select('*').eq('employe_id', emp.id).order('periode', { ascending: false }).limit(12)
 ]);
 const blocs = [];
 blocs.push(blocLecture('Poste et contrat', [
 ligneLecture('Poste', emp.poste), ligneLecture('Département', emp.departement), ligneLecture('Type de contrat', emp.type_contrat),
 ligneLecture('Embauché(e) le', emp.date_embauche ? fmtDate(emp.date_embauche) : ''),
 ligneLecture('Ancienneté', emp.date_embauche ? ancienneteTexte(emp.date_embauche) : ''),
 ligneLecture('Fin de période d\'essai', emp.fin_periode_essai ? fmtDate(emp.fin_periode_essai) : ''),
 ligneLecture('Fin de contrat', emp.date_fin_contrat ? fmtDate(emp.date_fin_contrat) : ''),
 ligneLecture('Téléphone', emp.telephone), ligneLecture('Congés annuels', emp.jours_conges_annuels ? emp.jours_conges_annuels + ' jours' : '')
 ], true));
 if (!idt.error) {
 const i = idt.data || {};
 blocs.push(blocLecture('Identité et état civil', [
 ligneLecture('Date de naissance', i.date_naissance ? fmtDate(i.date_naissance) + ' (' + ageTexte(i.date_naissance) + ')' : ''),
 ligneLecture('Lieu de naissance', i.lieu_naissance), ligneLecture('Nationalité', i.nationalite),
 ligneLecture('Situation matrimoniale', libelleSituation(i.situation_matrimoniale)),
 ligneLecture('Enfants', i.nombre_enfants === null || i.nombre_enfants === undefined ? '' : String(i.nombre_enfants)),
 ligneLecture('Adresse', i.adresse),
 ligneLecture('Personne à prévenir', [i.urgence_nom, i.urgence_lien, i.urgence_telephone].filter(Boolean).join(' · ')),
 ligneLecture('Pièce d\'identité', [i.piece_type, i.piece_numero].filter(Boolean).join(' ' ))
 ], false));
 }
 if (!rem.error) {
 const r = rem.data || null;
 const paiements = pai.error ? [] : (pai.data || []);
 const [bilanLib, bilanCoul] = bilanPaiements(paiements);
 blocs.push('<details class="rounded-xl border border-slate-200 p-3"><summary class="font-semibold text-sm cursor-pointer">Rémunération et paiements</summary><div class="mt-2">'
 + (r ? '<div class="divide-y divide-slate-100">' + ligneLecture('Salaire de base', fcfa(r.salaire_base)) + ligneLecture('Avantages', r.avantages)
 + ligneLecture('Date limite de paiement', 'le ' + r.jour_limite_paiement + ' de chaque mois') + '</div>' : '<p class="py-2 text-sm text-slate-400">Rien n\'est encore renseigné.</p>')
 + '<div class="mt-3">' + badge(bilanLib, bilanCoul) + '</div>'
 + '<div class="mt-2 divide-y divide-slate-100">' + listePaiementsHtml(paiements) + '</div></div></details>');
 }
 $('dossier-detail').innerHTML = blocs.join('');
}
/* ---------- Dossiers du personnel (RH et Direction) ---------- */
async function chargerPersonnel() {
 const r = await db.from('employes').select('*').order('matricule', { ascending: true });
 const box = $('liste-personnel');
 if (r.error) { box.innerHTML = '<p class="py-3 text-sm text-rose-600">' + esc(erreurClaire(r.error, 'Impossible de charger le personnel.')) + '</p>'; return; }
 personnel = r.data || [];
 if (!personnel.length) { box.innerHTML = '<p class="py-3 text-sm text-slate-500">Aucun employé enregistré.</p>'; return; }
 box.innerHTML = personnel.map((e) => '<button type="button" class="block w-full text-left py-3 px-2 -mx-2 rounded-xl transition hover:bg-blue-50/60" data-emp="' + esc(e.id) + '">'
 + '<p class="text-sm font-semibold">' + esc(e.prenom + ' ' + e.nom) + '</p>'
 + '<p class="text-xs text-slate-500">' + esc([e.matricule, e.poste, e.departement].filter(Boolean).join(' · ')) + '</p></button>').join('');
}
/* Description des champs : [clé, libellé, type, options] */
const CHAMPS_CONTRAT = [
 ['poste', 'Poste', 'text'], ['departement', 'Département', 'text'],
 ['type_contrat', 'Type de contrat', 'select', CONTRATS.map((c) => [c, c])],
 ['date_embauche', 'Date d\'embauche', 'date'], ['fin_periode_essai', 'Fin de période d\'essai', 'date'], ['date_fin_contrat', 'Fin de contrat', 'date'],
 ['telephone', 'Téléphone', 'tel'], ['jours_conges_annuels', 'Jours de congés par an', 'number']
];
const CHAMPS_IDENTITE = [
 ['date_naissance', 'Date de naissance', 'date'], ['lieu_naissance', 'Lieu de naissance', 'text'], ['nationalite', 'Nationalité', 'text'],
 ['sexe', 'Sexe', 'select', [['F', 'Féminin'], ['M', 'Masculin']]],
 ['situation_matrimoniale', 'Situation matrimoniale', 'select', SITUATIONS],
 ['nombre_enfants', 'Nombre d\'enfants', 'number'], ['adresse', 'Adresse', 'text'],
 ['urgence_nom', 'Personne à prévenir (nom)', 'text'], ['urgence_lien', 'Lien avec elle', 'text'], ['urgence_telephone', 'Son téléphone', 'tel'],
 ['piece_type', 'Pièce d\'identité (type)', 'text'], ['piece_numero', 'Numéro de la pièce', 'text']
];
const CHAMPS_REMUNERATION = [
 ['salaire_base', 'Salaire de base (FCFA)', 'number'], ['avantages', 'Avantages', 'text'], ['jour_limite_paiement', 'Jour limite de paiement (1 à 31)', 'number']
];
function champHtml(prefixe, champ, valeur, editable) {
 const [cle, libelle, type, options] = champ;
 const id = prefixe + '-' + cle;
 const v = valeur === null || valeur === undefined ? '' : valeur;
 const desactive = editable ? '' : ' disabled';
 let saisie;
 if (type === 'select') {
 let opts = '<option value="">—</option>' + options.map((o) => '<option value="' + esc(o[0]) + '"' + (String(v) === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('');
 if (v && !options.some((o) => o[0] === String(v))) opts += '<option value="' + esc(v) + '" selected>' + esc(v) + '</option>';
 saisie = '<select id="' + id + '" class="champ"' + desactive + '>' + opts + '</select>';
 } else {
 saisie = '<input id="' + id + '" type="' + (type === 'number' ? 'number' : type) + '"' + (type === 'number' ? ' inputmode="numeric" min="0" step="1"' : '') + ' value="' + esc(v) + '" class="champ"' + desactive + '>';
 }
 return '<div><label class="etiq" for="' + id + '">' + esc(libelle) + '</label>' + saisie + '</div>';
}
function formulaireHtml(idForm, titre, prefixe, champs, valeurs, editable, ouvert) {
 return '<details class="rounded-xl border border-slate-200 p-3"' + (ouvert ? ' open' : '') + '><summary class="font-semibold text-sm cursor-pointer">' + esc(titre) + '</summary>'
 + '<form id="' + idForm + '" class="mt-3 space-y-3">' + champs.map((c) => champHtml(prefixe, c, valeurs ? valeurs[c[0]] : '', editable)).join('')
 + (editable ? '<button class="btn w-full" type="submit">Enregistrer</button>' : '<p class="text-xs text-slate-400">Lecture seule pour ton profil.</p>')
 + '</form></details>';
}
function lireChamps(prefixe, champs, obligatoires) {
 const vals = {};
 champs.forEach(([cle, , type]) => {
 const brut = $(prefixe + '-' + cle).value.trim();
 if (type === 'number') vals[cle] = brut === '' ? ((obligatoires || {})[cle] !== undefined ? obligatoires[cle] : null) : Math.max(0, Math.round(Number(brut)));
 else vals[cle] = brut === '' ? null : brut;
 });
 return vals;
}
async function ouvrirDossierPersonnel(id) {
 const e = personnel.find((x) => x.id === id);
 if (!e) return;
 employeOuvert = id;
 const [idt, rem, pai] = await Promise.all([
 db.from('employes_identite').select('*').eq('employe_id', id).maybeSingle(),
 db.from('employes_remuneration').select('*').eq('employe_id', id).maybeSingle(),
 db.from('paiements_salaire').select('*').eq('employe_id', id).order('periode', { ascending: false }).limit(12)
 ]);
 donneesOuvertes = { rem: rem.data || null };
 const paiements = pai.error ? [] : (pai.data || []);
 const [bilanLib, bilanCoul] = bilanPaiements(paiements);
 const peutRem = estRH || estDirection;
 const blocs = [];
 blocs.push('<div class="flex items-start justify-between gap-3"><div><p class="text-base font-bold">' + esc(e.prenom + ' ' + e.nom) + '</p>'
 + '<p class="text-xs text-slate-500">' + esc([e.matricule, e.poste].filter(Boolean).join(' · ')) + ' · ancienneté : ' + esc(ancienneteTexte(e.date_embauche)) + '</p></div>'
 + '<button type="button" id="btn-fermer-dossier" class="text-xs font-semibold text-ocean">Fermer</button></div>');
 blocs.push(formulaireHtml('form-p-contrat', 'Poste et contrat', 'pc', CHAMPS_CONTRAT, e, estRH, true));
 blocs.push(idt.error ? '' : formulaireHtml('form-p-identite', 'Identité et état civil', 'pi', CHAMPS_IDENTITE, idt.data || {}, estRH, false));
 if (!rem.error) {
 blocs.push(formulaireHtml('form-p-rem', 'Rémunération', 'pr', CHAMPS_REMUNERATION, rem.data || { jour_limite_paiement: 5, salaire_base: 0 }, peutRem, false));
 blocs.push('<details class="rounded-xl border border-slate-200 p-3"><summary class="font-semibold text-sm cursor-pointer">Paiements de salaire</summary><div class="mt-2">'
 + '<div>' + badge(bilanLib, bilanCoul) + '</div><div class="mt-2 divide-y divide-slate-100">' + listePaiementsHtml(paiements) + '</div>'
 + (peutRem ? '<form id="form-p-paiement" class="mt-3 space-y-3 border-t border-slate-100 pt-3"><p class="text-xs font-semibold text-slate-500">Enregistrer un paiement</p>'
 + '<div class="grid grid-cols-2 gap-3"><div><label class="etiq" for="pa-mois">Mois</label><input id="pa-mois" type="month" required class="champ"></div>'
 + '<div><label class="etiq" for="pa-montant">Montant (FCFA)</label><input id="pa-montant" type="number" inputmode="numeric" min="0" step="1" required class="champ" value="' + esc(rem.data ? rem.data.salaire_base : '') + '"></div></div>'
 + '<div class="grid grid-cols-2 gap-3"><div><label class="etiq" for="pa-prevue">À payer avant le</label><input id="pa-prevue" type="date" required class="champ"></div>'
 + '<div><label class="etiq" for="pa-paye">Payé le (facultatif)</label><input id="pa-paye" type="date" class="champ"></div></div>'
 + '<div><label class="etiq" for="pa-mode">Mode de règlement</label><select id="pa-mode" class="champ"><option value="">—</option><option>Virement</option><option>Espèces</option><option>Mobile Money</option><option>Chèque</option></select></div>'
 + '<button class="btn w-full" type="submit">Enregistrer le paiement</button></form>' : '')
 + '</div></details>');
 }
 const zone = $('detail-personnel');
 zone.innerHTML = '<div class="space-y-3 rounded-2xl border-2 border-slate-200 p-3">' + blocs.join('') + '</div>';
 show('detail-personnel', true);
 zone.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function fermerDossierPersonnel() {
 employeOuvert = null;
 donneesOuvertes = null;
 $('detail-personnel').innerHTML = '';
 show('detail-personnel', false);
}
$('liste-personnel').addEventListener('click', (e) => {
 const btn = e.target.closest('button[data-emp]');
 if (btn) ouvrirDossierPersonnel(btn.dataset.emp);
});
$('detail-personnel').addEventListener('click', (e) => {
 if (e.target.closest('#btn-fermer-dossier')) fermerDossierPersonnel();
});
$('detail-personnel').addEventListener('change', (e) => {
 // le jour limite de paiement de l'employé propose la date « à payer avant »
 if (e.target.id === 'pa-mois' && e.target.value) {
 const jour = donneesOuvertes && donneesOuvertes.rem ? donneesOuvertes.rem.jour_limite_paiement : 5;
 $('pa-prevue').value = datePrevue(e.target.value, jour);
 }
});
$('detail-personnel').addEventListener('submit', async (e) => {
 e.preventDefault();
 clearMsg('msg-personnel');
 const id = employeOuvert;
 if (!id) return;
 const bouton = e.target.querySelector('button[type="submit"]');
 if (bouton) bouton.disabled = true;
 try {
 let r;
 let ok = 'Enregistré.';
 if (e.target.id === 'form-p-contrat') {
 const vals = lireChamps('pc', CHAMPS_CONTRAT, { jours_conges_annuels: 30 });
 r = await db.from('employes').update(vals).eq('id', id);
 } else if (e.target.id === 'form-p-identite') {
 const vals = lireChamps('pi', CHAMPS_IDENTITE);
 vals.employe_id = id;
 r = await db.from('employes_identite').upsert(vals, { onConflict: 'employe_id' });
 } else if (e.target.id === 'form-p-rem') {
 const vals = lireChamps('pr', CHAMPS_REMUNERATION, { salaire_base: 0, jour_limite_paiement: 5 });
 if (vals.jour_limite_paiement < 1 || vals.jour_limite_paiement > 31) { msg('msg-personnel', 'Le jour limite doit être compris entre 1 et 31.', false); return; }
 vals.employe_id = id;
 r = await db.from('employes_remuneration').upsert(vals, { onConflict: 'employe_id' });
 } else if (e.target.id === 'form-p-paiement') {
 const mois = $('pa-mois').value;
 r = await db.from('paiements_salaire').upsert({
 employe_id: id,
 periode: mois + '-01',
 montant: Math.max(0, Math.round(Number($('pa-montant').value) || 0)),
 date_prevue: $('pa-prevue').value,
 date_paiement: $('pa-paye').value || null,
 mode_reglement: $('pa-mode').value || null
 }, { onConflict: 'employe_id,periode' });
 ok = 'Paiement enregistré.';
 } else {
 return;
 }
 if (r.error) { msg('msg-personnel', erreurClaire(r.error, 'Enregistrement impossible.'), false); return; }
 await chargerPersonnel();
 await ouvrirDossierPersonnel(id);
 if (emp && emp.id === id) { const m = await db.from('employes').select('*').eq('id', id).maybeSingle(); if (m.data) emp = m.data; await chargerMonDossier(); }
 msg('msg-personnel', ok, true);
 } finally {
 if (bouton) bouton.disabled = false;
 }
});
/* ---------- Habilitations (administrateur) ---------- */
async function chargerHabilitationsEquipe() {
 const [u, h] = await Promise.all([
 db.rpc('equipe_organisation'),
 db.from('habilitations').select('utilisateur_id,habilitation')
 ]);
 const box = $('liste-habilitations');
 if (u.error) { box.innerHTML = '<p class="py-3 text-sm text-rose-600">' + esc(erreurClaire(u.error, 'Impossible de charger les comptes.')) + '</p>'; return; }
 const accordees = {};
 ((h.data) || []).forEach((x) => { (accordees[x.utilisateur_id] = accordees[x.utilisateur_id] || []).push(x.habilitation); });
 box.innerHTML = (u.data || []).map((c) => {
 const cases = Object.keys(HABILITATIONS).map((k) => '<label class="flex items-center gap-2 py-1 text-sm"><input type="checkbox" data-hab="' + k + '" data-user="' + esc(c.id) + '"'
 + ((accordees[c.id] || []).includes(k) ? ' checked' : '') + '> ' + esc(HABILITATIONS[k]) + '</label>').join('');
 return '<div class="py-3"><p class="text-sm font-semibold">' + esc(c.nom) + '</p><p class="text-xs text-slate-500">' + esc(c.email) + '</p><div class="mt-1">' + cases + '</div></div>';
 }).join('');
}
$('liste-habilitations').addEventListener('change', async (e) => {
 const c = e.target.closest('input[data-hab]');
 if (!c) return;
 clearMsg('msg-habilitations');
 c.disabled = true;
 const r = await db.rpc('definir_habilitation', { p_utilisateur: c.dataset.user, p_habilitation: c.dataset.hab, p_active: c.checked });
 c.disabled = false;
 if (r.error) {
 c.checked = !c.checked;
 msg('msg-habilitations', erreurClaire(r.error, 'Habilitation non modifiée.'), false);
 return;
 }
 msg('msg-habilitations', c.checked ? 'Habilitation accordée.' : 'Habilitation retirée.', true);
 if (c.dataset.user === me.id) await initialiserRH();
});
