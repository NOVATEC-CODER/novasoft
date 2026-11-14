/* =====================================================
 NovaSoft - module Exports : impression / PDF et Excel
 Un seul outil, utilisé par tous les modules (existants et futurs).
 Un « rapport » est un objet :
 {
 titre, sousTitre,
 module: 'fin' ou 'rh' (pour inscrire l'export dans l'historique),
 colonnes: [{ titre, type: 'texte' | 'montant' }],
 lignes: [[valeur, valeur, ...]],
 totaux: [[libellé, valeur]] (facultatif),
 note: '...' (facultatif)
 }
 Pour ajouter l'export à un nouvel écran : construire un rapport,
 puis appeler ouvrirMenuExport(rapport).
 S'appuie sur core.js et finances.js :
 db, $, esc, iso, fmtDate, fcfa, me, entrepriseNom, LOGO, ops, caisses, MODES,
 decrireAudit, TABLES_AUDIT_FIN, TABLES_AUDIT_RH, chargerAudit, erreurClaire
 ===================================================== */
const nombreFr = new Intl.NumberFormat('fr-FR');
/* ---------- Petits outils ---------- */
function libelleMois(mois) {
 return new Date(mois + '-01T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}
function dateHeure(d) { return new Date(d).toLocaleString('fr-FR'); }
function slug(t) {
 return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function cellule(col, v) {
 if (v === '' || v === null || v === undefined) return '';
 return col.type === 'montant' ? nombreFr.format(Number(v)) : String(v);
}
function editeur() {
 return 'Édité le ' + dateHeure(new Date()) + (me ? ' par ' + me.nom : '');
}
/* ---------- Impression / PDF : le rapport est affiché dans la page même, et seul lui est imprimé ----------
 (plus de fenêtre secondaire : fiable sur téléphone, avec « Enregistrer au format PDF ») */
const CSS_IMPRESSION = '@media screen{#zone-impression{display:none}}'
 + '@page{size:A4;margin:14mm}'
 + '@media print{'
 + 'body>*:not(#zone-impression){display:none!important}'
 + 'html,body{background:#fff!important;min-height:0!important;height:auto!important;margin:0!important;padding:0!important}'
 + '#zone-impression{display:block;font-family:Arial,Helvetica,sans-serif;color:#0f172a;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
 + '#zone-impression .top{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0052CC;padding-bottom:8px}'
 + '#zone-impression .logo{height:34px;width:auto;display:block}'
 + '#zone-impression .ent{text-align:right;font-size:11px;color:#475569}'
 + '#zone-impression h1{font-size:18px;font-weight:bold;margin:14px 0 2px;color:#0052CC}'
 + '#zone-impression .sous{margin:0 0 10px;color:#475569}'
 + '#zone-impression table{width:100%;border-collapse:collapse}'
 + '#zone-impression th{background:#0052CC;color:#fff;text-align:left;padding:6px;font-size:11px}'
 + '#zone-impression td{border-bottom:1px solid #e2e8f0;padding:5px 6px;vertical-align:top}'
 + '#zone-impression th.d,#zone-impression td.d{text-align:right;white-space:nowrap}'
 + '#zone-impression tbody tr:nth-child(even) td{background:#f8fafc}'
 + '#zone-impression tr.tot td{font-weight:bold;background:#eff6ff;border-bottom:1px solid #bfdbfe}'
 + '#zone-impression thead{display:table-header-group}'
 + '#zone-impression tr{page-break-inside:avoid}'
 + '#zone-impression .note{margin-top:10px;color:#b45309;font-size:11px}'
 + '#zone-impression .pied{margin-top:18px;text-align:center;color:#94a3b8;font-size:10px}'
 + '}';
function corpsRapport(r) {
 const logo = new URL(LOGO, location.href).href;
 const nbCol = r.colonnes.length;
 const entete = r.colonnes.map((c) => '<th class="' + (c.type === 'montant' ? 'd' : '') + '">'
+ esc(c.titre) + '</th>').join('');
 const corps = r.lignes.map((l) => '<tr>' + l.map((v, i) => '<td class="' + (r.colonnes[i].type === 'montant' ? 'd' : '') + '">' + esc(cellule(r.colonnes[i], v)) + '</td>').join('') + '</tr>').join('');
 const totaux = (r.totaux || []).map((t) => '<tr class="tot"><td colspan="' + Math.max(1, nbCol - 1) + '" class="d">' + esc(t[0]) + '</td><td class="d">' + esc(nombreFr.format(Number(t[1]))) + '</td></tr>').join('');
 return '<div class="top"><img class="logo" src="' + esc(logo) + '" alt="NovaSoft">'
 + '<div class="ent"><b>' + esc(entrepriseNom || '') + '</b><br>' + esc(editeur()) + '</div> </div>'
 + '<h1>' + esc(r.titre) + '</h1>' + (r.sousTitre ? '<p class="sous">' + esc(r.sousTitre) + '</p>' : '')
 + '<table><thead><tr>' + entete + '</tr></thead><tbody>' + corps + totaux + '</tbody> </table>'
 + (r.note ? '<p class="note">' + esc(r.note) + '</p>' : '')
 + '<p class="pied">NovaSoft · un service de NOVATEC</p>';
}
function imprimerRapport(r) {
 // nettoyage d'une éventuelle impression précédente
 ['zone-impression', 'style-impression'].forEach((id) => { const e = $(id); if (e) e.remove();
});
 const style = document.createElement('style');
 style.id = 'style-impression';
 style.textContent = CSS_IMPRESSION;
 const zone = document.createElement('div');
 zone.id = 'zone-impression';
 zone.innerHTML = corpsRapport(r);
 document.head.appendChild(style);
 document.body.appendChild(zone);
 // le titre de la page devient le nom du fichier PDF proposé
 const titrePage = document.title;
 document.title = 'NovaSoft - ' + r.titre + (r.sousTitre ? ' - ' + r.sousTitre : '');
 const nettoyer = () => {
 window.removeEventListener('afterprint', nettoyer);
 zone.remove();
 style.remove();
 document.title = titrePage;
 };
 window.addEventListener('afterprint', nettoyer);
 // on attend que le logo soit chargé avant d'ouvrir la fenêtre d'impression
 let lance = false;
 const lancer = () => {
 if (lance) return;
 lance = true;
 try { window.print(); } catch (e) { console.error('[NovaSoft] impression', e); nettoyer();
}
 };
 const logo = zone.querySelector('img');
 if (logo && !logo.complete) {
 logo.addEventListener('load', lancer);
 logo.addEventListener('error', lancer);
 setTimeout(lancer, 1500);
 } else {
 setTimeout(lancer, 100);
 }
 return true;
}
/* ---------- Excel : fichier CSV (séparateur point-virgule, accents conservés), ouvert directement par Excel ---------- */
function csvCellule(v) {
 if (v === null || v === undefined) return '';
 const s = String(v);
 return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function construireCSV(r) {
 const nbCol = r.colonnes.length;
 const lignes = [[r.titre]];
 if (r.sousTitre) lignes.push([r.sousTitre]);
 lignes.push([entrepriseNom || '', editeur()]);
 lignes.push([]);
 lignes.push(r.colonnes.map((c) => c.titre));
 r.lignes.forEach((l) => lignes.push(l));
 if (r.totaux && r.totaux.length) {
 lignes.push([]);
 r.totaux.forEach((t) => {
 const ligne = new Array(nbCol).fill('');
 ligne[Math.max(0, nbCol - 2)] = t[0];
 ligne[nbCol - 1] = t[1];
 lignes.push(ligne);
 });
 }
 if (r.note) { lignes.push([]); lignes.push([r.note]); }
 return '\ufeff' + lignes.map((l) => l.map(csvCellule).join(';')).join('\r\n');
}
function telechargerCSV(r) {
 const blob = new Blob([construireCSV(r)], { type: 'text/csv;charset=utf-8' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = ('novasoft-' + slug(r.titre + ' ' + (r.sousTitre || ''))).slice(0, 70) + '-' + iso(new Date()) + '.csv';
 document.body.appendChild(a);
 a.click();
 a.remove();
 setTimeout(() => URL.revokeObjectURL(url), 2000);
}
/* ---------- Trace de l'export dans l'historique (exigence REP-05) ---------- */
async function journaliserExport(r, format) {
 if (!r.module) return;
 try {
 const { error } = await db.rpc('journaliser_export', {
 p_module: r.module,
 p_objet: r.titre + (r.sousTitre ? ' — ' + r.sousTitre : ''),
 p_format: format,
 p_lignes: r.lignes.length
 });
 if (error) { console.error('[NovaSoft] export non inscrit dans l\'historique', error);
return; }
 if (typeof chargerAudit === 'function') chargerAudit();
 } catch (e) {
 console.error('[NovaSoft] export non inscrit dans l\'historique', e);
 }
}
/* ---------- Petit menu : Imprimer / PDF ou Excel ---------- */
function ouvrirMenuExport(r) {
 const ancien = $('menu-export');
 if (ancien) ancien.remove();
 if (!r.lignes.length) { window.alert('Rien à imprimer ni à exporter pour cette période.'); return; }
 const fond = document.createElement('div');
 fond.id = 'menu-export';
 fond.className = 'fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-4';
 const partage = typeof partageDisponible === 'function' && partageDisponible();
 fond.innerHTML = '<div class="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-3">'
 + '<p class="font-bold text-lg">' + esc(r.titre) + '</p>'
 + '<p class="text-sm text-slate-500">' + esc(r.sousTitre || '') + (r.sousTitre ? ' · ' : '') + r.lignes.length + ' ligne(s)</p>'
 + '<button type="button" data-fmt="pdf" class="w-full rounded-xl bg-gradient-to-r from-ocean to-lumina px-4 py-2.5 text-sm font-semibold text-white shadow-sm">Télécharger le PDF</button>'
 + (partage ? '<button type="button" data-fmt="partage" class="btn-clair w-full">Partager le PDF (e-mail, WhatsApp…)</button>' : '')
 + '<button type="button" data-fmt="csv" class="btn-clair w-full">Télécharger pour Excel</button>'
 + '<button type="button" data-fmt="impression" class="w-full py-1 text-xs font-semibold text-ocean">Imprimer avec l\'imprimante du téléphone</button>'
 + '<button type="button" data-fmt="annuler" class="btn-clair w-full">Annuler</button>'
 + '</div>';
 fond.addEventListener('click', async (e) => {
 if (e.target === fond) { fond.remove(); return; }
 const btn = e.target.closest('button[data-fmt]');
 if (!btn) return;
 const fmt = btn.dataset.fmt;
 if (fmt === 'annuler') { fond.remove(); return; }
 let ok = true;
 if (fmt === 'partage') {
 const envoye = partagerPDF(r); // doit partir tout de suite : le téléphone exige un geste de ta part
 fond.remove();
 if (await envoye) journaliserExport(r, 'pdf');
 return;
 }
 if (fmt === 'pdf') ok = telechargerPDF(r);
 else if (fmt === 'impression') ok = imprimerRapport(r);
 else telechargerCSV(r);
 fond.remove();
 if (ok) journaliserExport(r, fmt === 'csv' ? 'csv' : 'pdf');
 });
 document.body.appendChild(fond);
}
/* =====================================================
 Rapports disponibles
 ===================================================== */
function rapportTableauDeBord() {
 const mois = $('f-mois').value;
 const duMois = ops.filter((o) => o.date.startsWith(mois));
 const somme = (type) => duMois.filter((o) => o.type === type).reduce((s, o) => s + Number(o.montant), 0);
 const rec = somme('recette');
 const dep = somme('depense');
 const lignes = [
 ['Recettes du mois', rec],
 ['Dépenses du mois', dep],
 ['Solde du mois', rec - dep],
 ['Trésorerie totale', caisses.reduce((s, c) => s + Number(c.solde), 0)]
 ];
 caisses.forEach((c) => lignes.push(['Solde · ' + c.nom, Number(c.solde)]));
 return {
 titre: 'Tableau de bord', sousTitre: libelleMois(mois), module: 'fin',
 colonnes: [{ titre: 'Indicateur', type: 'texte' }, { titre: 'Montant (FCFA)', type: 'montant' }],
 lignes: lignes
 };
}
function rapportCaisses() {
 return {
 titre: 'Caisses et comptes', sousTitre: 'Situation au ' + new Date().toLocaleDateString('fr-FR'), module: 'fin',
 colonnes: [
 { titre: 'Caisse', type: 'texte' }, { titre: 'Type', type: 'texte' }, { titre: 'Statut', type: 'texte' },
 { titre: 'Solde initial (FCFA)', type: 'montant' }, { titre: 'Solde actuel (FCFA)', type: 'montant' }
 ],
 lignes: caisses.map((c) => [c.nom, TYPES_CAISSE[c.type] || c.type, c.actif ? 'Active' : 'Désactivée', Number(c.solde_initial), Number(c.solde)]),
 totaux: [['Trésorerie totale', caisses.reduce((s, c) => s + Number(c.solde), 0)]]
 };
}
function rapportOperations() {
 const mois = $('f-mois').value;
 const duMois = ops.filter((o) => o.date.startsWith(mois));
 const somme = (type) => duMois.filter((o) => o.type === type).reduce((s, o) => s + Number(o.montant), 0);
 const rec = somme('recette');
 const dep = somme('depense');
 return {
 titre: 'Opérations du mois', sousTitre: libelleMois(mois), module: 'fin',
 colonnes: [
 { titre: 'Date', type: 'texte' }, { titre: 'Type', type: 'texte' }, { titre: 'Caisse', type: 'texte' },
 { titre: 'Catégorie', type: 'texte' }, { titre: 'Description', type: 'texte' }, { titre: 'Règlement', type: 'texte' },
 { titre: 'Montant (FCFA)', type: 'montant' }
 ],
 lignes: duMois.map((o) => {
 const caisse = caisses.find((c) => c.id === o.caisse_id);
 return [fmtDate(o.date), o.type === 'recette' ? 'Recette' : 'Dépense', caisse ?caisse.nom : '', o.categorie, o.description || '', MODES[o.mode_reglement] || o.mode_reglement || '', Number(o.montant)];
 }),
 totaux: [['Total recettes', rec], ['Total dépenses', dep], ['Solde du mois', rec - dep]]
 };
}
/* Relevé des mouvements d'une caisse pour le mois choisi, avec solde après chaque ligne */
function rapportReleve(caisseId) {
 const c = caisses.find((x) => x.id === caisseId);
 if (!c) return null;
 const mois = $('f-mois').value;
 const debut = mois + '-01';
 const mouvement = (o) => (o.type === 'recette' ? 1 : -1) * Number(o.montant);
 const avant = ops.filter((o) => o.caisse_id === caisseId && o.date < debut).reduce((s, o) => s + mouvement(o), 0);
 const ouverture = Number(c.solde_initial) + avant;
 // la liste est triée du plus récent au plus ancien : on l'inverse pour lire le relevé dans l'ordre
 const duMois = ops.filter((o) => o.caisse_id === caisseId &&o.date.startsWith(mois)).reverse();
 let solde = ouverture;
 let rec = 0;
 let dep = 0;
 const lignes = [['', 'Solde d\'ouverture', '', '', '', '', ouverture]];
 duMois.forEach((o) => {
 solde += mouvement(o);
 const estRecette = o.type === 'recette';
 if (estRecette) rec += Number(o.montant); else dep += Number(o.montant);
 lignes.push([fmtDate(o.date), o.categorie, o.description || '', MODES[o.mode_reglement] || o.mode_reglement || '', estRecette ? Number(o.montant) : '', estRecette ? '' : Number(o.montant), solde]);
 });
 return {
 titre: 'Relevé de caisse · ' + c.nom, sousTitre: libelleMois(mois), module: 'fin',
 colonnes: [
 { titre: 'Date', type: 'texte' }, { titre: 'Libellé', type: 'texte' }, { titre: 'Description', type: 'texte' }, { titre: 'Règlement', type: 'texte' },
 { titre: 'Recette', type: 'montant' }, { titre: 'Dépense', type: 'montant' }, { titre: 'Solde (FCFA)', type: 'montant' }
 ],
 lignes: lignes,
 totaux: [['Total recettes', rec], ['Total dépenses', dep], ['Solde de clôture', solde]],
 note: ops.length >= 1000 ? 'Attention : seules les 1000 opérations les plus récentes sont chargées. Le solde d\'ouverture peut être incomplet.' : ''
 };
}
function exporterReleve(caisseId) {
 const r = rapportReleve(caisseId);
 if (r) ouvrirMenuExport(r);
}
/* Historiques (réservés aux administrateurs) : jusqu'aux 500 dernières actions */
async function exporterAudit(module) {
 const estRh = module === 'rh';
 const tables = estRh ? TABLES_AUDIT_RH : TABLES_AUDIT_FIN;
 const [journal, liste] = await Promise.all([
 db.from('journal_audit')
 .select('id,table_nom,action,avant,apres,cree_le,utilisateurs(nom)')
 .in('table_nom', tables)
 .order('cree_le', { ascending: false })
 .limit(500),
 db.from('employes').select('id,prenom,nom')
 ]);
 if (journal.error) { window.alert(erreurClaire(journal.error, 'L\'historique n\'a pas pu être chargé.')); return; }
 const noms = {};
 (liste.data || []).forEach((e) => { noms[e.id] = (e.prenom + ' ' + e.nom).trim(); });
 const lignes = journal.data.map((a) => {
 const d = decrireAudit(a, noms);
 return [dateHeure(a.cree_le), d.titre, d.detail, a.utilisateurs ? a.utilisateurs.nom : 'Système'];
 });
 ouvrirMenuExport({
 titre: estRh ? 'Historique RH et comptes' : 'Historique des opérations et des caisses',
 sousTitre: 'Les ' + lignes.length + ' dernières actions au ' + new Date().toLocaleDateString('fr-FR'),
 module: module,
 colonnes: [{ titre: 'Date et heure', type: 'texte' }, { titre: 'Action', type: 'texte' }, {
titre: 'Détail', type: 'texte' }, { titre: 'Auteur', type: 'texte' }],
 lignes: lignes
 });
}
