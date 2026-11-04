/* =====================================================
 NovaSoft - noyau : configuration, connexion, RH, entreprises, profil
 Les modules (finances.js, ...) s'appuient sur les outils définis ici.
 ===================================================== */
/* ---------- Configuration Supabase (clé publique uniquement) ---------- */
const SUPABASE_URL = 'https://tnsvcvbrybzelfxxhttn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_R2Jh5Ta4PT2K-3z0MlLtCg_AdXHtXvh';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// Nom de la fonction serveur de création de comptes (nom attribué par Supabase au déploiement)
const FONCTION_CREATION_COMPTE = 'smooth-responder';
/* ---------- Logo : nom du fichier présent dans le dépôt GitHub ---------- */
const LOGO = 'file_00000000bf78820e9224a8e64b5b79d3.png';
document.querySelectorAll('img[data-logo]').forEach((img) => { img.src = LOGO; });
/* ---------- Outils ---------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR');
const nbJours = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const fcfa = (n) => new Intl.NumberFormat('fr-FR').format(Number(n) || 0) + ' FCFA';
const TYPES = { annuel: 'Congé annuel', maladie: 'Maladie', maternite_paternite: 'Maternité /paternité', sans_solde: 'Sans solde', autre: 'Autre' };
const STATUTS = {
 en_attente: ['En attente', 'bg-amber-50 text-amber-700'],
 approuve: ['Approuvé', 'bg-emerald-50 text-emerald-700'],
 refuse: ['Refusé', 'bg-rose-50 text-rose-700'],
 annule: ['Annulé', 'bg-slate-100 text-slate-600']
};
const ROLES = { admin: 'Admin', comptable: 'Comptable', employe: 'Employé' };
function msg(id, texte, ok) {
 const el = $(id);
 el.textContent = texte;
 el.className = 'text-sm ' + (ok ? 'text-emerald-700' : 'text-rose-600');
 // un message placé dans une section repliée ouvre cette section, pour qu'il reste visible
 const section = el.closest('details');
 if (section && !section.open) section.open = true;
 // la confirmation (ou l'erreur) s'affiche aussi en bas de l'écran, où que tu sois dans la page
 if (id !== 'msg-login') notifier(texte, ok);
}
/* ---------- Notification visible en bas de l'écran ---------- */
let minuteurNotif = null;
function notifier(texte, ok) {
 let el = $('notif');
 if (!el) {
 el = document.createElement('div');
 el.id = 'notif';
 el.setAttribute('role', 'status');
 document.body.appendChild(el);
 }
 el.textContent = texte;
 el.className = 'pointer-events-none fixed bottom-5 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl px-4 py-3 text-center text-sm font-semibold text-white shadow-xl transition-opacity duration-300 '
 + (ok ? 'bg-gradient-to-r from-emerald-600 to-lumina-dark' : 'bg-rose-600');
 el.style.opacity = '1';
 clearTimeout(minuteurNotif);
 minuteurNotif = setTimeout(() => { el.style.opacity = '0'; }, ok ? 4000 : 7000);
}
function clearMsg(id) { $(id).className = 'text-sm hidden'; }
/* ---------- Sections repliables : le téléphone se souvient de celles que tu as ouvertes ou fermées ---------- */
function memoriserSections() {
 document.querySelectorAll('details[id]').forEach((d) => {
 try {
 const etat = localStorage.getItem('ns-ouvert-' + d.id);
 if (etat === '1') d.open = true;
 if (etat === '0') d.open = false;
 } catch (e) { /* stockage indisponible : on ignore */ }
 d.addEventListener('toggle', () => {
 try { localStorage.setItem('ns-ouvert-' + d.id, d.open ? '1' : '0'); } catch (e) { /* stockage indisponible : on ignore */ }
 });
 });
}
function show(id, visible) { $(id).classList.toggle('hidden', !visible); }
/* ---------- Messages d'erreur compréhensibles (le détail technique reste dans la console du navigateur) ---------- */
function erreurClaire(error, defaut) {
 if (error) console.error('[NovaSoft]', defaut || '', error);
 const texte = String((error && error.message) || '').toLowerCase();
 const code = error && error.code;
 const generique = (defaut ? defaut + ' ' : '') + 'Réessaie dans un instant. Si le problème continue, contacte ton administrateur.';
 if (!error) return generique;
 if (texte.includes('failed to fetch') || texte.includes('networkerror') || texte.includes('network request failed') || texte.includes('load failed') || texte.includes('failed to send a request')) return 'Connexion impossible. Vérifie ta connexion Internet puis réessaie.';
 if (texte.includes('rate limit') || texte.includes('too many')) return 'Trop de tentatives. Patiente quelques minutes avant de réessayer.';
 if (code === '23505' || texte.includes('duplicate')) return 'Cet élément existe déjà.';
 if (code === '23503' || texte.includes('foreign key')) return 'Action impossible : cet élément est utilisé ailleurs dans NovaSoft.';
 if (code === '23502') return 'Un champ obligatoire est vide. Vérifie le formulaire.';
 if (code === '23514') return 'Une valeur saisie n\'est pas acceptée. Vérifie le formulaire.';
 if (code === '42501' || texte.includes('row-level security') || texte.includes('permission denied')) return 'Cette action n\'est pas autorisée pour ton compte. Si tu penses que c\'est une erreur, contacte ton administrateur.';
 if (texte.includes('jwt') || texte.includes('session') || texte.includes('not authenticated')) return 'Ta session a expiré. Reconnecte-toi.';
 if (texte.includes('should be different')) return 'Le nouveau mot de passe doit être différent de l\'ancien.';
 if (texte.includes('password') && (texte.includes('weak') || texte.includes('at least') || texte.includes('characters'))) return 'Ce mot de passe est trop simple. Choisis-en un plus long, avec des lettres et des chiffres.';
 if (texte.includes('maximum allowed size') || texte.includes('too large') || texte.includes('payload')) return 'Le fichier est trop volumineux. Choisis un fichier de 10 Mo au maximum.';
 if (texte.includes('mime type')) return 'Ce type de fichier n\'est pas accepté. Utilise une photo ou un PDF.';
 return generique;
}
let me = null; // utilisateur connecté
let emp = null; // son dossier employé
let entrepriseNom = ''; // nom de son entreprise (utilisé sur les impressions)
/* ---------- Création de compte : toujours par la fonction serveur « creer-compte » ----------*/
async function appelerCreationCompte(donnees) {
 const { data, error } = await db.functions.invoke(FONCTION_CREATION_COMPTE, { body: donnees
});
 if (!error) {
 if (data && data.utilisateur_id) return { ok: true, id: data.utilisateur_id };
 return { ok: false, message: 'Création du compte impossible. Réessaie dans un instant.' };
 }
 console.error('[NovaSoft] création de compte', error);
 let texte = 'Création du compte impossible. Réessaie dans un instant.';
 if (error.name === 'FunctionsFetchError' || error.name === 'FunctionsRelayError') texte ='Connexion impossible. Vérifie ta connexion Internet puis réessaie.';
 try {
 if (error.context && typeof error.context.json === 'function') {
 const d = await error.context.json();
 if (d && d.erreur) texte = d.erreur;
 }
 } catch (e) { /* on garde le message général */ }
 return { ok: false, message: texte };
}
/* ---------- Onglets ---------- */
const TAB_ON = 'flex-1 rounded-xl bg-gradient-to-r from-ocean to-blue-600 px-2 py-2 text-[13px] font-semibold text-white shadow-md transition';
const TAB_OFF = 'flex-1 rounded-xl border border-slate-300 bg-white px-2 py-2 text-[13px] font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:border-ocean hover:bg-blue-50 hover:text-ocean hover:shadow-sm';
const acces = { fin: false, ent: false };
function afficherOnglet(nom) {
 try { sessionStorage.setItem('ns-onglet', nom); } catch (e) { /* stockage indisponible : on ignore */ }
 ['rh', 'fin', 'ent'].forEach((n) => {
 show('onglet-' + n, nom === n);
 $('tab-' + n).className = nom === n ? TAB_ON : TAB_OFF;
 });
 if (!acces.fin) $('tab-fin').classList.add('hidden');
 if (!acces.ent) $('tab-ent').classList.add('hidden');
}
$('tab-rh').addEventListener('click', () => afficherOnglet('rh'));
$('tab-fin').addEventListener('click', () => afficherOnglet('fin'));
$('tab-ent').addEventListener('click', () => afficherOnglet('ent'));
/* ---------- Connexion ---------- */
function showLogin() {
 show('vue-chargement', false);
 show('vue-app', false);
 show('vue-login', true);
}
$('form-login').addEventListener('submit', async (e) => {
 e.preventDefault();
 clearMsg('msg-login');
 const btn = $('btn-login');
 btn.disabled = true;
 try {
 const { error } = await db.auth.signInWithPassword({
 email: $('login-email').value.trim(),
 password: $('login-mdp').value
 });
 if (error) { msg('msg-login', /invalid login/i.test(error.message || '') ? 'Email ou mot de passe incorrect.' : erreurClaire(error, 'Connexion impossible.'), false); return; }
 await loadApp();
 } catch (err) {
 console.error('[NovaSoft] connexion', err);
 msg('msg-login', 'Connexion impossible pour le moment. Vérifie ta connexion Internet puis réessaie.', false);
 } finally {
 btn.disabled = false;
 }
});
$('btn-logout').addEventListener('click', async () => {
 try { sessionStorage.removeItem('ns-onglet'); } catch (e) { /* on ignore */ }
 await db.auth.signOut();
 location.reload();
});
/* ---------- Chargement de l'application ---------- */
async function loadApp() {
 const { data: { user } } = await db.auth.getUser();
 if (!user) { showLogin(); return; }
 const { data, error } = await db.from('utilisateurs').select('id,nom,email,role,organisation_id').eq('id', user.id).maybeSingle();
 if (error) {
 showLogin();
 msg('msg-login', erreurClaire(error, 'Chargement impossible.'), false);
 return;
 }
 if (!data) {
 await db.auth.signOut();
 showLogin();
 msg('msg-login', 'Ce compte n\'est pas encore enregistré dans NovaSoft.', false);
 return;
 }
 me = data;
 if (!me.organisation_id) {
 await db.auth.signOut();
 showLogin();
 msg('msg-login', 'Ce compte n\'est rattaché à aucune entreprise. Contacte ton administrateur.', false);
 return;
 }
 const sa = await db.rpc('est_super_admin');
 const estSuper = sa.data === true;
 const org = await db.from('organisations').select('nom,sigle,ifu,rccm,adresse,telephone,email,actif').eq('id', me.organisation_id).maybeSingle();
 if (!org.data && !estSuper) {
 await db.auth.signOut();
 showLogin();
 msg('msg-login', 'Accès suspendu pour cette entreprise. Contacte NOVATEC.', false);
 return;
 }
 entrepriseNom = (org.data && org.data.nom) || '';
 $('who').textContent = me.nom;
 $('role').textContent = (ROLES[me.role] || me.role) + (org.data ? ' · ' + org.data.nom : '');
 const r = await db.from('employes').select('*').eq('utilisateur_id', me.id).maybeSingle();
 emp = r.data || null;
 renderDossier();
 const estAdmin = me.role === 'admin';
 const accesFin = me.role === 'admin' || me.role === 'comptable';
 acces.fin = accesFin;
 acces.ent = estSuper;
 show('sec-conge', !!emp);
 show('sec-mes', !!emp);
 show('sec-traiter', estAdmin);
 show('sec-employe', estAdmin);
 show('sec-profil', estAdmin);
 if (estAdmin && org.data) remplirProfil(org.data);
 show('onglets', accesFin || estSuper);
 if (emp) await loadMesConges();
 if (estAdmin) await loadATraiter();
 if (accesFin) await chargerFinances();
 if (estSuper) await loadEntreprises();
 // après une actualisation, on retrouve l'onglet où l'on était (si le compte y a droit)
 let ongletInitial = 'rh';
 try { ongletInitial = sessionStorage.getItem('ns-onglet') || 'rh'; } catch (e) { /* stockage indisponible : on ignore */ }
 if (!['rh', 'fin', 'ent'].includes(ongletInitial) || (ongletInitial === 'fin' && !acces.fin) || (ongletInitial === 'ent' && !acces.ent)) ongletInitial = 'rh';
 afficherOnglet(ongletInitial);
 show('vue-chargement', false);
 show('vue-login', false);
 show('vue-app', true);
}
function renderDossier() {
 const info = $('dossier-info');
 if (emp) {
 const ligne = [emp.poste, emp.departement].filter(Boolean).join(', ');
 info.innerHTML = '<span class="font-semibold">' + esc(emp.prenom + ' ' + emp.nom) + '</span>'
 + (ligne ? ' · ' + esc(ligne) : '')
 + '<br>Matricule ' + esc(emp.matricule)
 + ' · ' + esc(emp.jours_conges_annuels) + ' jours de congés par an';
 } else if (me.role === 'admin') {
 info.textContent = 'Tu n\'as pas encore de dossier employé. Ajoute-le plus bas avec ton propre email pour pouvoir demander un congé.';
 } else {
 info.textContent = 'Ton dossier employé n\'est pas encore créé. Demande à un administrateur de l\'ajouter.';
 }
}
/* ---------- Congés : statut affiché et justificatifs ---------- */
const FORMATS_JUSTIFICATIF = 'application/pdf,image/*,.doc,.docx';
function statutConge(c) {
 // « En attente » + un motif de l'administrateur = demande mise en attente de justificatif
 if (c.statut === 'en_attente' && c.motif_decision) return ['En attente de justificatif', 'bg-amber-50 text-amber-700'];
 return STATUTS[c.statut] || [c.statut, 'bg-slate-100 text-slate-600'];
}
async function ouvrirJustificatifConge(chemin) {
 const fenetre = window.open('', '_blank');
 const { data, error } = await db.storage.from('justificatifs-conges').createSignedUrl(chemin, 120);
 if (error || !data) {
 if (fenetre) fenetre.close();
 window.alert(erreurClaire(error, 'Le justificatif est introuvable.'));
 return;
 }
 if (fenetre) fenetre.location = data.signedUrl; else window.location.href = data.signedUrl;
}
/* Envoie un justificatif et le rattache à la demande. Retourne null si tout va bien, sinon un message clair. */
async function envoyerJustificatifConge(congeId, fichier) {
 if (fichier.size > 10 * 1024 * 1024) return 'Le justificatif dépasse 10 Mo.';
 const chemin = me.organisation_id + '/' + me.id + '/' + Date.now() + '-' + fichier.name.replace(/[^a-zA-Z0-9._-]/g, '_');
 const up = await db.storage.from('justificatifs-conges').upload(chemin, fichier, {
contentType: fichier.type || undefined });
 if (up.error) return erreurClaire(up.error, 'Le justificatif n\'a pas pu être envoyé.');
 const r = await db.rpc('joindre_justificatif_conge', { p_conge: congeId, p_chemin: chemin });
 if (r.error) {
 if (/introuvable/i.test(r.error.message || '')) return 'Cette demande a déjà été traitée : le justificatif ne peut plus être ajouté.';
 return erreurClaire(r.error, 'Le justificatif n\'a pas pu être joint à la demande.');
 }
 return null;
}
/* ---------- Mes congés ---------- */
async function loadMesConges() {
 const { data, error } = await db.from('conges')
 .select('id,type,date_debut,date_fin,motif,statut,motif_decision,justificatif_url')
 .eq('employe_id', emp.id)
 .order('created_at', { ascending: false });
 const box = $('liste-mes');
 if (error) { box.innerHTML = '<p class="py-3 text-sm text-rose-600">' + esc(erreurClaire(error, 'Impossible de charger tes demandes.')) + '</p>'; return; }
 if (!data.length) { box.innerHTML = '<p class="py-3 text-sm text-slate-500">Aucune demande pour l\'instant.</p>'; return; }
 box.innerHTML = data.map((c) => {
 const [lib, cls] = statutConge(c);
 const attendJustificatif = c.statut === 'en_attente' && !!c.motif_decision;
 return '<div class="py-3 px-2 -mx-2 rounded-xl transition hover:bg-blue-50/60">'
 + '<div class="flex items-start justify-between gap-3">'
 + '<div class="min-w-0"><p class="text-sm font-semibold">' + esc(TYPES[c.type] || c.type)
+ '</p>'
 + '<p class="text-sm text-slate-600">Du ' + fmtDate(c.date_debut) + ' au ' + fmtDate(c.date_fin) + ' (' + nbJours(c.date_debut, c.date_fin) + ' j)</p>'
 + (c.motif ? '<p class="text-xs text-slate-500 mt-0.5">' + esc(c.motif) + '</p>' : '')
 + (c.motif_decision ? '<p class="text-xs text-slate-700 mt-1"><span class="font-semibold">Réponse de l\'administration :</span> ' + esc(c.motif_decision) + '</p>' : '')
 + (c.justificatif_url ? '<button type="button" class="mt-1 text-xs font-semibold text-ocean" data-act="voir" data-path="' + esc(c.justificatif_url) + '">Voir mon justificatif</button>' : '')
 + '</div><span class="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ' + cls + '">' + lib + '</span></div>'
 + (attendJustificatif
 ? '<div class="mt-2 space-y-2"><input id="jf-' + esc(c.id) + '" type="file" accept="' + FORMATS_JUSTIFICATIF + '" class="champ">'
 + '<button type="button" class="btn !py-1.5" data-act="joindre" data-id="' + esc(c.id) + '">' + (c.justificatif_url ? 'Remplacer le justificatif' : 'Joindre un justificatif') + '</button></div>'
 : '')
 + '</div>';
 }).join('');
}
$('liste-mes').addEventListener('click', async (e) => {
 const btn = e.target.closest('button[data-act]');
 if (!btn) return;
 clearMsg('msg-mes');
 if (btn.dataset.act === 'voir') { await ouvrirJustificatifConge(btn.dataset.path); return; }
 if (btn.dataset.act === 'joindre') {
 const champ = $('jf-' + btn.dataset.id);
 const fichier = champ && champ.files[0];
 if (!fichier) { msg('msg-mes', 'Choisis d\'abord un fichier.', false); return; }
 btn.disabled = true;
 const erreur = await envoyerJustificatifConge(btn.dataset.id, fichier);
 btn.disabled = false;
 if (erreur) { msg('msg-mes', erreur, false); return; }
 await loadMesConges();
 if (me.role === 'admin') await loadATraiter();
 await chargerAudit();
 msg('msg-mes', 'Justificatif envoyé. L\'administrateur peut maintenant le consulter.', true);
 }
});
$('form-conge').addEventListener('submit', async (e) => {
 e.preventDefault();
 clearMsg('msg-conge');
 const debut = $('c-debut').value;
 const fin = $('c-fin').value;
 if (fin < debut) { msg('msg-conge', 'La date de fin doit être après la date de début.', false); return; }
 const fichier = $('c-fichier').files[0];
 if (fichier && fichier.size > 10 * 1024 * 1024) { msg('msg-conge', 'Le justificatif dépasse 10 Mo.', false); return; }
 const bouton = $('form-conge').querySelector('button[type="submit"]');
 bouton.disabled = true;
 try {
 // une demande identique, déjà envoyée et encore valable, n'est pas renvoyée
 const doublon = await db.from('conges').select('id,statut')
 .eq('employe_id', emp.id).eq('type', $('c-type').value).eq('date_debut', debut).eq('date_fin', fin)
 .in('statut', ['en_attente', 'approuve']).limit(1);
 if (!doublon.error && doublon.data && doublon.data.length) {
 msg('msg-conge', 'Tu as déjà envoyé cette demande (' + (doublon.data[0].statut ==='approuve' ? 'déjà approuvée' : 'en attente de validation') + '). Tu la retrouves dans « Mes demandes ».', false);
 return;
 }
 const { data, error } = await db.from('conges').insert({
 employe_id: emp.id,
 type: $('c-type').value,
 date_debut: debut,
 date_fin: fin,
 motif: $('c-motif').value.trim() || null
 }).select('id').single();
 if (error) { msg('msg-conge', erreurClaire(error, 'La demande n\'a pas pu être envoyée.'), false); return; }
 let texte = 'Demande envoyée. Elle est en attente de validation.';
 let ok = true;
 if (fichier) {
 const erreur = await envoyerJustificatifConge(data.id, fichier);
 if (erreur) { texte = 'Demande envoyée, mais le justificatif n\'a pas pu être joint : ' + erreur; ok = false; }
 }
 $('form-conge').reset();
 await loadMesConges();
 if (me.role === 'admin') { await loadATraiter(); await chargerAudit(); }
 if (ok) {
 clearMsg('msg-conge');
 $('sec-conge').open = false;
 notifier(texte, true);
 $('sec-mes').scrollIntoView({ behavior: 'smooth', block: 'start' });
 } else {
 msg('msg-conge', texte, false);
 }
 } finally {
 bouton.disabled = false;
 }
});
/* ---------- Espace administrateur : demandes de congé (approuver, refuser, mettre en attente) ---------- */
async function loadATraiter() {
 const { data, error } = await db.from('conges')
 
.select('id,type,date_debut,date_fin,motif,motif_decision,justificatif_url,employes(nom,prenom) ')
 .eq('statut', 'en_attente')
 .order('created_at', { ascending: true });
 const box = $('liste-traiter');
 if (error) { box.innerHTML = '<p class="py-3 text-sm text-rose-600">' + esc(erreurClaire(error, 'Impossible de charger les demandes.')) + '</p>'; return; }
 if (!data.length) { box.innerHTML = '<p class="py-3 text-sm text-slate-500">Aucune demande en attente.</p>'; return; }
 box.innerHTML = data.map((c) => {
 const nom = c.employes ? c.employes.prenom + ' ' + c.employes.nom : 'Employé inconnu';
 const id = esc(c.id);
 return '<div class="py-3 px-2 -mx-2 rounded-xl transition hover:bg-blue-50/60">'
 + '<p class="text-sm font-semibold">' + esc(nom) + ' · ' + esc(TYPES[c.type] || c.type)
 + (c.motif_decision ? ' <span class="ml-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700">En attente de justificatif</span>' : '') + '</p>'
 + '<p class="text-sm text-slate-600">Du ' + fmtDate(c.date_debut) + ' au ' + fmtDate(c.date_fin) + ' (' + nbJours(c.date_debut, c.date_fin) + ' j)</p>'
 + (c.motif ? '<p class="text-xs text-slate-500 mt-0.5">Motif du demandeur : ' + esc(c.motif) + '</p>' : '')
 + (c.motif_decision ? '<p class="text-xs text-slate-700 mt-1"><span class="font-semibold">Ta dernière réponse :</span> ' + esc(c.motif_decision) + '</p>' : '')
 + (c.justificatif_url
 ? '<button type="button" class="mt-1 text-xs font-semibold text-ocean" data-act="voir" data-path="' + esc(c.justificatif_url) + '">Voir le justificatif du demandeur</button>'
 : '<p class="text-xs text-slate-400 mt-1">Aucun justificatif joint.</p>')
 + '<label class="etiq mt-2" for="mot-' + id + '">Motif de la décision</label>'
 + '<textarea id="mot-' + id + '" rows="2" class="champ" placeholder="Obligatoire pour refuser ou mettre en attente"></textarea>'
 + '<div class="mt-2 grid grid-cols-3 gap-2">'
 + '<button type="button" class="btn !px-2 !py-1.5 text-xs !bg-lumina-dark hover:!bg-emerald-700" data-id="' + id + '" data-nom="' + esc(nom) + '" data-statut="approuve">Approuver</button>'
 + '<button type="button" class="btn-clair !px-2 !py-1.5 text-xs" data-id="' + id + '" data-nom="' + esc(nom) + '" data-statut="en_attente">Mettre en attente</button>'
 + '<button type="button" class="btn-clair !px-2 !py-1.5 text-xs !text-rose-600" data-id="' + id + '" data-nom="' + esc(nom) + '" data-statut="refuse">Refuser</button>'
 + '</div></div>';
 }).join('');
}
$('liste-traiter').addEventListener('click', async (e) => {
 const voir = e.target.closest('button[data-act="voir"]');
 if (voir) { await ouvrirJustificatifConge(voir.dataset.path); return; }
 const btn = e.target.closest('button[data-statut]');
 if (!btn) return;
 const statut = btn.dataset.statut;
 const champ = $('mot-' + btn.dataset.id);
 const motif = champ ? champ.value.trim() : '';
 if ((statut === 'refuse' || statut === 'en_attente') && motif.length < 3) {
 msg('msg-traiter', statut === 'refuse'
 ? 'Écris le motif du refus avant de refuser.'
 : 'Écris ce que tu attends du demandeur (par exemple : un certificat médical) avant de mettre en attente.', false);
 if (champ) champ.focus();
 return;
 }
 const groupe = btn.parentElement.querySelectorAll('button');
 groupe.forEach((b) => { b.disabled = true; });
 clearMsg('msg-traiter');
 const { error } = await db.from('conges').update({
 statut: statut,
 motif_decision: motif || null,
 traite_par: me.id,
 traite_le: new Date().toISOString()
 }).eq('id', btn.dataset.id);
 if (error) { msg('msg-traiter', erreurClaire(error, 'Action impossible.'), false); groupe.forEach((b) => { b.disabled = false; }); return; }
 await loadATraiter();
 if (emp) await loadMesConges();
 await chargerAudit();
 const verbe = statut === 'approuve' ? 'approuvé' : (statut === 'refuse' ? 'refusé' : 'mis en attente de justificatif');
 msg('msg-traiter', 'Congé de ' + (btn.dataset.nom || 'l\'employé') + ' ' + verbe + '.', true);
});
/* ---------- Espace administrateur : ajout d'un employé (avec création du compte) ----------*/
$('e-poste').addEventListener('change', () => {
 const autre = $('e-poste').value === '__autre';
 show('ligne-poste-autre', autre);
 if (!autre) $('e-poste-autre').value = '';
});
$('form-employe').addEventListener('submit', async (e) => {
 e.preventDefault();
 clearMsg('msg-employe');
 const prenom = $('e-prenom').value.trim();
 const nom = $('e-nom').value.trim();
 const email = $('e-email').value.trim().toLowerCase();
 const mdp = $('e-mdp').value;
 const role = $('e-role').value;
 const posteChoisi = $('e-poste').value;
 const poste = posteChoisi === '__autre' ? $('e-poste-autre').value.trim() : posteChoisi;
 if (posteChoisi === '__autre' && !poste) { msg('msg-employe', 'Précise le poste, ou choisis-en un dans la liste.', false); return; }
 let utilisateurId = null;
 let compteCree = false;
 if (email) {
 const { data } = await db.from('utilisateurs').select('id').eq('email', email).maybeSingle();
 if (data) {
 utilisateurId = data.id;
 } else {
 if (mdp.length < 8) {
 msg('msg-employe', 'Aucun compte avec cet email. Saisis un mot de passe provisoire d\'au moins 8 caractères pour le créer.', false);
 return;
 }
 // Le compte est créé par la fonction serveur (jamais par le navigateur)
 const r = await appelerCreationCompte({ email: email, nom: prenom + ' ' + nom, mot_de_passe: mdp, role: role });
 if (!r.ok) { msg('msg-employe', r.message, false); return; }
 utilisateurId = r.id;
 compteCree = true;
 }
 }
 const { error } = await db.from('employes').insert({
 utilisateur_id: utilisateurId,
 matricule: $('e-matricule').value.trim(),
 prenom: prenom,
 nom: nom,
 poste: poste || null,
 departement: $('e-dep').value.trim() || null
 });
 if (error) {
 const doublon = error.message.includes('duplicate');
 msg('msg-employe', doublon ? 'Ce matricule ou ce compte a déjà un dossier.' : erreurClaire(error, 'L\'employé n\'a pas pu être enregistré.'), false);
 return;
 }
 let avert = '';
 if (utilisateurId && !compteCree && role !== 'employe') {
 const u = await db.from('utilisateurs').update({ role: role }).eq('id', utilisateurId);
 if (u.error) avert = ' ' + erreurClaire(u.error, 'Le rôle n\'a pas pu être changé.');
 }
 msg('msg-employe', 'Employé enregistré.' + (compteCree ? ' Compte créé : il peut se connecter avec cet email et le mot de passe provisoire.' : '') + avert, !avert);
 $('form-employe').reset();
 show('ligne-poste-autre', false);
 await chargerAudit();
 if (utilisateurId === me.id) await loadApp();
});
/* ---------- Entreprises (super-administrateurs) ---------- */
/* Groupe d'entreprises : société mère, filiales, entreprises liées (un lien n'ouvre aucun accès aux données) */
let entreprises = [];
let liensGroupe = {};
function lirePourcentage(valeur) {
 const n = Number(String(valeur || '').replace(',', '.'));
 return Number.isFinite(n) && n > 0 && n <= 100 ? n : null;
}
/* Une filiale est en général détenue à plus de 50 % ; en dessous, c'est une participation : on demande confirmation en cas d'écart */
function confirmerPourcentage(type, pct) {
 const txt = String(pct).replace('.', ',');
 if (type === 'filiale' && pct <= 50) {
 return window.confirm('Une filiale est en général détenue à plus de 50 %. Pour ' + txt + ' %, le type « Participation » est peut-être plus adapté. Enregistrer quand même comme filiale ?');
 }
 if (type === 'participation' && pct > 50) {
 return window.confirm('Au-delà de 50 %, il s\'agit en général d\'une filiale. Enregistrer quand même comme participation ?');
 }
 return true;
}
function libelleLien(id) {
 const l = liensGroupe[id];
 if (!l) return '';
 const mere = entreprises.find((x) => x.id === l.mere_id);
 const nom = mere ? mere.nom : 'une autre entreprise';
 const pct = (l.pourcentage !== null && l.pourcentage !== undefined) ? ' (' + String(Number(l.pourcentage)).replace('.', ',') + ' %)' : '';
 if (l.type_lien === 'filiale') return 'Filiale de ' + nom + pct;
 if (l.type_lien === 'participation') return 'Participation de ' + nom + pct;
 return 'Entreprise liée à ' + nom;
}
function remplirChoixEntreprises() {
 const options = (premier) => (premier ? '<option value="">' + premier + '</option>' : '')
 + entreprises.map((o) => '<option value="' + esc(o.id) + '">' + esc(o.nom) + '</option>').join('');
 [['n-mere', 'Aucune (société indépendante)'], ['l-org', ''], ['l-mere', 'Aucune (retirer le lien)']].forEach(([id, premier]) => {
 const el = $(id);
 const precedent = el.value;
 el.innerHTML = options(premier);
 if (precedent && entreprises.some((o) => o.id === precedent)) el.value = precedent;
 });
}
async function definirLien(orgId, mereId, type, pct) {
 const r = await db.rpc('definir_lien_organisation', {
 p_org: orgId, p_mere: mereId || null, p_type: type, p_pourcentage: type === 'liee' ? null : pct
 });
 if (!r.error) return null;
 if (/circulaire/i.test(r.error.message || '')) return 'Ce lien créerait une boucle entre les entreprises.';
 return erreurClaire(r.error, 'Le rattachement n\'a pas pu être enregistré.');
}
async function loadEntreprises() {
 const { data, error } = await db.from('organisations').select('id,nom,sigle,ifu,rccm,adresse,telephone,email,actif,created_at').order('created_at', {
ascending: true });
 const box = $('liste-ent');
 if (error) { box.innerHTML = '<p class="py-3 text-sm text-rose-600">' + esc(erreurClaire(error, 'Impossible de charger les entreprises.')) + '</p>'; return; }
 entreprises = data;
 liensGroupe = {};
 const liens = await db.from('liens_organisations').select('organisation_id,mere_id,type_lien,pourcentage');
 if (liens.error) console.warn('[NovaSoft] liens de groupe indisponibles', liens.error.message);
 else (liens.data || []).forEach((l) => { liensGroupe[l.organisation_id] = l; });
 remplirChoixEntreprises();
 if (!data.length) { box.innerHTML = '<p class="py-3 text-sm text-slate-500">Aucune entreprise.</p>'; return; }
 box.innerHTML = data.map((o) => {
 const lien = libelleLien(o.id);
 return '<div class="py-3 px-2 -mx-2 rounded-xl transition hover:bg-blue-50/60 flex items-start justify-between gap-3">'
 + '<div class="min-w-0"><p class="text-sm font-semibold">' + esc(o.nom) + (o.sigle ? ' ('
+ esc(o.sigle) + ')' : '') + '</p>'
 + (lien ? '<p class="text-xs font-semibold text-ocean mt-0.5">' + esc(lien) + '</p>' : '')
 + '<p class="text-xs text-slate-500">Créée le ' + new Date(o.created_at).toLocaleDateString('fr-FR') + '</p></div>'
 + '<div class="shrink-0 text-right">'
 + '<span class="px-2.5 py-1 rounded-full text-xs font-semibold ' + (o.actif ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700') + '">' + (o.actif ? 'Active' : 'Suspendue') + '</span>'
 + (me && o.id === me.organisation_id
 ? '<span class="block mt-1 text-xs text-slate-400">Ton entreprise</span>'
 : '<button class="block ml-auto mt-1 text-xs font-semibold ' + (o.actif ? 'text-rose-600' : 'text-ocean') + '" data-org="' + esc(o.id) + '" data-actif="' + (o.actif ? '0' : '1') + '">' + (o.actif ? 'Suspendre' : 'Réactiver') + '</button>')
 + '</div></div>';
 }).join('');
}
$('liste-ent').addEventListener('click', async (e) => {
 const btn = e.target.closest('button[data-org]');
 if (!btn) return;
 if (me && btn.dataset.org === me.organisation_id) { msg('msg-liste-ent', 'Tu ne peux pas suspendre l\'entreprise à laquelle ton compte est rattaché.', false); return; }
 const activer = btn.dataset.actif === '1';
 const question = activer ? 'Réactiver cette entreprise ?' : 'Suspendre cette entreprise ? Ses utilisateurs ne pourront plus accéder à leurs données.';
 if (!window.confirm(question)) return;
 clearMsg('msg-liste-ent');
 const { error } = await db.rpc('definir_actif_organisation', { p_id: btn.dataset.org, p_actif: activer });
 if (error) { msg('msg-liste-ent', erreurClaire(error, 'Action impossible.'), false); return;
}
 await loadEntreprises();
});
$('form-ent').addEventListener('submit', async (e) => {
 e.preventDefault();
 clearMsg('msg-ent');
 const nom = $('n-nom').value.trim();
 const sigle = $('n-sigle').value.trim() || null;
 const adminNom = $('n-admin-nom').value.trim();
 const email = $('n-admin-email').value.trim().toLowerCase();
 const mdp = $('n-admin-mdp').value;
 if (mdp.length < 8) { msg('msg-ent', 'Le mot de passe doit contenir au moins 8 caractères.', false); return; }
 const mereChoisie = $('n-mere').value;
 const typeLien = $('n-type-lien').value;
 const pctLien = lirePourcentage($('n-pct').value);
 if (mereChoisie && typeLien !== 'liee' && pctLien === null) {
 msg('msg-ent', 'Indique le pourcentage de détention de la société mère (entre 0,01 et 100).', false);
 return;
 }
 if (mereChoisie && typeLien !== 'liee' && !confirmerPourcentage(typeLien, pctLien)) return;
 const btn = $('btn-ent');
 btn.disabled = true;
 try {
 const o = await db.from('organisations').insert({ nom: nom, sigle: sigle
}).select('id').single();
 if (o.error) { msg('msg-ent', erreurClaire(o.error, 'L\'entreprise n\'a pas pu être créée.'), false); return; }
 const orgId = o.data.id;
 // Le compte du premier administrateur est créé par la fonction serveur
 const r = await appelerCreationCompte({ email: email, nom: adminNom, mot_de_passe: mdp, role: 'admin', organisation_id: orgId });
 if (!r.ok) {
 await db.from('organisations').delete().eq('id', orgId);
 msg('msg-ent', r.message, false);
 return;
 }
 let texte = 'Entreprise créée. Son administrateur peut se connecter avec cet email et le mot de passe provisoire.';
 let ok = true;
 if (mereChoisie) {
 const erreurLien = await definirLien(orgId, mereChoisie, typeLien, pctLien);
 if (erreurLien) { texte += ' Le rattachement au groupe a échoué : ' + erreurLien; ok =false; }
 }
 $('form-ent').reset();
 show('ligne-lien', false);
 await loadEntreprises();
 msg('msg-ent', texte, ok);
 } finally {
 btn.disabled = false;
 }
});
/* ---------- Relier une entreprise à un groupe ---------- */
function majChampPct(prefixe) {
 show(prefixe + '-bloc-pct', $(prefixe === 'n' ? 'n-type-lien' : 'l-type-lien').value !=='liee');
}
$('n-mere').addEventListener('change', () => { show('ligne-lien', !!$('n-mere').value); majChampPct('n'); });
$('n-type-lien').addEventListener('change', () => majChampPct('n'));
$('l-type-lien').addEventListener('change', () => majChampPct('l'));
$('l-org').addEventListener('change', () => {
 // préremplit avec le lien actuel de l'entreprise choisie
 const l = liensGroupe[$('l-org').value];
 $('l-mere').value = l ? l.mere_id : '';
 $('l-type-lien').value = l ? l.type_lien : 'filiale';
 $('l-pct').value = (l && l.pourcentage !== null && l.pourcentage !== undefined) ?String(Number(l.pourcentage)).replace('.', ',') : '';
 majChampPct('l');
});
$('form-lien').addEventListener('submit', async (e) => {
 e.preventDefault();
 clearMsg('msg-lien');
 const orgId = $('l-org').value;
 const mereId = $('l-mere').value;
 const type = $('l-type-lien').value;
 const pct = lirePourcentage($('l-pct').value);
 if (!orgId) { msg('msg-lien', 'Choisis l\'entreprise à relier.', false); return; }
 if (mereId && mereId === orgId) { msg('msg-lien', 'Une entreprise ne peut pas être sa propre société mère.', false); return; }
 if (mereId && type !== 'liee' && pct === null) { msg('msg-lien', 'Indique le pourcentage de détention de la société mère (entre 0,01 et 100).', false); return; }
 if (mereId && type !== 'liee' && !confirmerPourcentage(type, pct)) return;
 if (!mereId && !window.confirm('Retirer le lien de cette entreprise avec son groupe ?'))
return;
 const erreur = await definirLien(orgId, mereId, type, pct);
 if (erreur) { msg('msg-lien', erreur, false); return; }
 await loadEntreprises();
 msg('msg-lien', mereId ? 'Lien enregistré.' : 'Lien retiré.', true);
});
/* ---------- Profil de l'entreprise ---------- */
let profilEntreprise = null;
function remplirProfil(o) {
 profilEntreprise = o;
 $('p-nom').value = o.nom || '';
 $('p-sigle').value = o.sigle || '';
 $('p-ifu').value = o.ifu || '';
 $('p-rccm').value = o.rccm || '';
 $('p-adresse').value = o.adresse || '';
 $('p-tel').value = o.telephone || '';
 $('p-email').value = o.email || '';
}
$('form-profil').addEventListener('submit', async (e) => {
 e.preventDefault();
 clearMsg('msg-profil');
 const vide = (id) => $(id).value.trim() || null;
 const { error } = await db.from('organisations').update({
 nom: $('p-nom').value.trim(),
 sigle: vide('p-sigle'),
 ifu: vide('p-ifu'),
 rccm: vide('p-rccm'),
 adresse: vide('p-adresse'),
 telephone: vide('p-tel'),
 email: vide('p-email')
 }).eq('id', me.organisation_id);
 if (error) { msg('msg-profil', erreurClaire(error, 'Le profil n\'a pas pu être enregistré.'), false); return; }
 entrepriseNom = $('p-nom').value.trim();
 profilEntreprise = { nom: $('p-nom').value.trim(), sigle: vide('p-sigle'), ifu: vide('p-ifu'), rccm: vide('p-rccm'), adresse: vide('p-adresse'), telephone: vide('p-tel'), email: vide('p-email') };
 $('role').textContent = (ROLES[me.role] || me.role) + ' · ' + $('p-nom').value.trim();
 msg('msg-profil', 'Profil enregistré.', true);
 await chargerAudit();
});
/* ---------- Impression / PDF / Excel : liste des entreprises clientes et fiche de l'entreprise ----------
 Utilise l'outil commun ouvrirMenuExport() du fichier exports.js */
function rapportEntreprises() {
 const lignes = entreprises.map((o) => [
 o.nom + (o.sigle ? ' (' + o.sigle + ')' : ''),
 o.ifu || '',
 o.rccm || '',
 o.adresse || '',
 [o.telephone, o.email].filter(Boolean).join(' · '),
 libelleLien(o.id),
 o.actif ? 'Active' : 'Suspendue',
 new Date(o.created_at).toLocaleDateString('fr-FR')
 ]);
 return {
 titre: 'Entreprises clientes',
 sousTitre: lignes.length + ' entreprise(s) au ' + new Date().toLocaleDateString('fr-FR'),
 colonnes: [
 { titre: 'Entreprise', type: 'texte' }, { titre: 'IFU', type: 'texte' }, { titre: 'RCCM', type: 'texte' },
 { titre: 'Adresse', type: 'texte' }, { titre: 'Contact', type: 'texte' }, { titre: 'Groupe', type: 'texte' },
 { titre: 'Statut', type: 'texte' }, { titre: 'Créée le', type: 'texte' }
 ],
 lignes: lignes
 };
}
function rapportProfil() {
 const o = profilEntreprise || {};
 return {
 titre: 'Profil de l\'entreprise',
 sousTitre: 'Fiche au ' + new Date().toLocaleDateString('fr-FR'),
 module: 'rh',
 colonnes: [{ titre: 'Rubrique', type: 'texte' }, { titre: 'Information', type: 'texte' }],
 lignes: [
 ['Nom', o.nom || ''], ['Sigle', o.sigle || ''], ['IFU', o.ifu || ''], ['RCCM', o.rccm || ''],
 ['Adresse', o.adresse || ''], ['Téléphone', o.telephone || ''], ['Email', o.email || '']
 ]
 };
}
$('exp-ent').addEventListener('click', () => ouvrirMenuExport(rapportEntreprises()));
$('exp-profil').addEventListener('click', () => ouvrirMenuExport(rapportProfil()));
/* ---------- Mon compte : changer le mot de passe ---------- */
$('form-mdp').addEventListener('submit', async (e) => {
 e.preventDefault();
 clearMsg('msg-mdp');
 const nouveau = $('m-nouveau').value;
 if (nouveau.length < 8) { msg('msg-mdp', 'Le mot de passe doit contenir au moins 8 caractères.', false); return; }
 if (nouveau !== $('m-confirm').value) { msg('msg-mdp', 'Les deux mots de passe ne sont pas identiques.', false); return; }
 const { error } = await db.auth.updateUser({ password: nouveau });
 if (error) { msg('msg-mdp', erreurClaire(error, 'Le mot de passe n\'a pas pu être changé.'), false); return; }
 msg('msg-mdp', 'Mot de passe mis à jour.', true);
 $('form-mdp').reset();
});
/* ---------- Démarrage (appelé depuis index.html quand tous les scripts sont chargés) --------
-- */
async function demarrer() {
 try {
 const { data: { session } } = await db.auth.getSession();
 if (session) await loadApp(); else showLogin();
 } catch (err) {
 showLogin();
 }
}
