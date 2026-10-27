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

const TYPES = { annuel: 'Congé annuel', maladie: 'Maladie', maternite_paternite: 'Maternité / paternité', sans_solde: 'Sans solde', autre: 'Autre' };
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
}
function clearMsg(id) { $(id).className = 'text-sm hidden'; }
function show(id, visible) { $(id).classList.toggle('hidden', !visible); }

let me = null;   // utilisateur connecté
let emp = null;  // son dossier employé

/* ---------- Création de compte : toujours par la fonction serveur « creer-compte » ---------- */
async function appelerCreationCompte(donnees) {
  const { data, error } = await db.functions.invoke(FONCTION_CREATION_COMPTE, { body: donnees });
  if (!error) {
    if (data && data.utilisateur_id) return { ok: true, id: data.utilisateur_id };
    return { ok: false, message: 'Création du compte impossible. Réessaie dans un instant.' };
  }
  let texte = 'Création du compte impossible. Réessaie dans un instant.';
  try {
    if (error.context && typeof error.context.json === 'function') {
      const d = await error.context.json();
      if (d && d.erreur) texte = d.erreur;
    }
  } catch (e) { /* on garde le message général */ }
  return { ok: false, message: texte };
}

/* ---------- Onglets ---------- */
const TAB_ON = 'flex-1 rounded-xl bg-ocean px-2 py-2 text-[13px] font-semibold text-white';
const TAB_OFF = 'flex-1 rounded-xl border border-slate-300 bg-white px-2 py-2 text-[13px] font-semibold text-slate-700';
const acces = { fin: false, ent: false };
function afficherOnglet(nom) {
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
    if (error) { msg('msg-login', 'Email ou mot de passe incorrect.', false); return; }
    await loadApp();
  } catch (err) {
    msg('msg-login', 'Connexion à Supabase impossible. Vérifie l\'adresse du projet dans le fichier.', false);
  } finally {
    btn.disabled = false;
  }
});

$('btn-logout').addEventListener('click', async () => {
  await db.auth.signOut();
  location.reload();
});

/* ---------- Chargement de l'application ---------- */
async function loadApp() {
  const { data: { user } } = await db.auth.getUser();
  if (!user) { showLogin(); return; }

  const { data, error } = await db.from('utilisateurs').select('id,nom,email,role,organisation_id').eq('id', user.id).maybeSingle();
  if (error || !data) {
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

  afficherOnglet('rh');
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

/* ---------- Mes congés ---------- */
async function loadMesConges() {
  const { data, error } = await db.from('conges')
    .select('id,type,date_debut,date_fin,motif,statut')
    .eq('employe_id', emp.id)
    .order('created_at', { ascending: false });
  const box = $('liste-mes');
  if (error) { box.innerHTML = '<p class="py-3 text-sm text-rose-600">Impossible de charger tes demandes.</p>'; return; }
  if (!data.length) { box.innerHTML = '<p class="py-3 text-sm text-slate-500">Aucune demande pour l\'instant.</p>'; return; }
  box.innerHTML = data.map((c) => {
    const [lib, cls] = STATUTS[c.statut] || [c.statut, 'bg-slate-100 text-slate-600'];
    return '<div class="py-3 flex items-start justify-between gap-3">'
      + '<div class="min-w-0"><p class="text-sm font-semibold">' + esc(TYPES[c.type] || c.type) + '</p>'
      + '<p class="text-sm text-slate-600">Du ' + fmtDate(c.date_debut) + ' au ' + fmtDate(c.date_fin) + ' (' + nbJours(c.date_debut, c.date_fin) + ' j)</p>'
      + (c.motif ? '<p class="text-xs text-slate-500 mt-0.5">' + esc(c.motif) + '</p>' : '')
      + '</div><span class="shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ' + cls + '">' + lib + '</span></div>';
  }).join('');
}

$('form-conge').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg('msg-conge');
  const debut = $('c-debut').value;
  const fin = $('c-fin').value;
  if (fin < debut) { msg('msg-conge', 'La date de fin doit être après la date de début.', false); return; }
  const { error } = await db.from('conges').insert({
    employe_id: emp.id,
    type: $('c-type').value,
    date_debut: debut,
    date_fin: fin,
    motif: $('c-motif').value.trim() || null
  });
  if (error) { msg('msg-conge', 'La demande n\'a pas pu être envoyée : ' + error.message, false); return; }
  msg('msg-conge', 'Demande envoyée. Elle est en attente de validation.', true);
  $('form-conge').reset();
  await loadMesConges();
  if (me.role === 'admin') await loadATraiter();
});

/* ---------- Espace administrateur : demandes de congé ---------- */
async function loadATraiter() {
  const { data, error } = await db.from('conges')
    .select('id,type,date_debut,date_fin,motif,employes(nom,prenom)')
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: true });
  const box = $('liste-traiter');
  if (error) { box.innerHTML = '<p class="py-3 text-sm text-rose-600">Impossible de charger les demandes.</p>'; return; }
  if (!data.length) { box.innerHTML = '<p class="py-3 text-sm text-slate-500">Aucune demande en attente.</p>'; return; }
  box.innerHTML = data.map((c) => {
    const nom = c.employes ? c.employes.prenom + ' ' + c.employes.nom : 'Employé inconnu';
    return '<div class="py-3">'
      + '<p class="text-sm font-semibold">' + esc(nom) + ' · ' + esc(TYPES[c.type] || c.type) + '</p>'
      + '<p class="text-sm text-slate-600">Du ' + fmtDate(c.date_debut) + ' au ' + fmtDate(c.date_fin) + ' (' + nbJours(c.date_debut, c.date_fin) + ' j)</p>'
      + (c.motif ? '<p class="text-xs text-slate-500 mt-0.5">' + esc(c.motif) + '</p>' : '')
      + '<div class="mt-2 flex gap-2">'
      + '<button class="btn !py-1.5 !bg-lumina-dark hover:!bg-emerald-700" data-id="' + esc(c.id) + '" data-statut="approuve">Approuver</button>'
      + '<button class="btn-clair !py-1.5" data-id="' + esc(c.id) + '" data-statut="refuse">Refuser</button>'
      + '</div></div>';
  }).join('');
}

$('liste-traiter').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-id]');
  if (!btn) return;
  btn.disabled = true;
  clearMsg('msg-traiter');
  const { error } = await db.from('conges').update({
    statut: btn.dataset.statut,
    traite_par: me.id,
    traite_le: new Date().toISOString()
  }).eq('id', btn.dataset.id);
  if (error) { msg('msg-traiter', 'Action impossible : ' + error.message, false); btn.disabled = false; return; }
  await loadATraiter();
  if (emp) await loadMesConges();
});

/* ---------- Espace administrateur : ajout d'un employé (avec création du compte) ---------- */
$('form-employe').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg('msg-employe');
  const prenom = $('e-prenom').value.trim();
  const nom = $('e-nom').value.trim();
  const email = $('e-email').value.trim().toLowerCase();
  const mdp = $('e-mdp').value;
  const role = $('e-role').value;
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
    poste: $('e-poste').value.trim() || null,
    departement: $('e-dep').value.trim() || null
  });
  if (error) {
    const doublon = error.message.includes('duplicate');
    msg('msg-employe', doublon ? 'Ce matricule ou ce compte a déjà un dossier.' : 'Enregistrement impossible : ' + error.message, false);
    return;
  }

  let avert = '';
  if (utilisateurId && !compteCree && role !== 'employe') {
    const u = await db.from('utilisateurs').update({ role: role }).eq('id', utilisateurId);
    if (u.error) avert = ' Le rôle n\'a pas pu être changé : ' + u.error.message;
  }
  msg('msg-employe', 'Employé enregistré.' + (compteCree ? ' Compte créé : il peut se connecter avec cet email et le mot de passe provisoire.' : '') + avert, !avert);
  $('form-employe').reset();
  if (utilisateurId === me.id) await loadApp();
});

/* ---------- Entreprises (super-administrateurs) ---------- */
async function loadEntreprises() {
  const { data, error } = await db.from('organisations').select('id,nom,sigle,actif,created_at').order('created_at', { ascending: true });
  const box = $('liste-ent');
  if (error) { box.innerHTML = '<p class="py-3 text-sm text-rose-600">Impossible de charger les entreprises.</p>'; return; }
  if (!data.length) { box.innerHTML = '<p class="py-3 text-sm text-slate-500">Aucune entreprise.</p>'; return; }
  box.innerHTML = data.map((o) => '<div class="py-3 flex items-start justify-between gap-3">'
    + '<div class="min-w-0"><p class="text-sm font-semibold">' + esc(o.nom) + (o.sigle ? ' (' + esc(o.sigle) + ')' : '') + '</p>'
    + '<p class="text-xs text-slate-500">Créée le ' + new Date(o.created_at).toLocaleDateString('fr-FR') + '</p></div>'
    + '<div class="shrink-0 text-right">'
    + '<span class="px-2.5 py-1 rounded-full text-xs font-semibold ' + (o.actif ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700') + '">' + (o.actif ? 'Active' : 'Suspendue') + '</span>'
    + '<button class="block ml-auto mt-1 text-xs font-semibold ' + (o.actif ? 'text-rose-600' : 'text-ocean') + '" data-org="' + esc(o.id) + '" data-actif="' + (o.actif ? '0' : '1') + '">' + (o.actif ? 'Suspendre' : 'Réactiver') + '</button>'
    + '</div></div>').join('');
}

$('liste-ent').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-org]');
  if (!btn) return;
  const activer = btn.dataset.actif === '1';
  const question = activer ? 'Réactiver cette entreprise ?' : 'Suspendre cette entreprise ? Ses utilisateurs ne pourront plus accéder à leurs données.';
  if (!window.confirm(question)) return;
  clearMsg('msg-liste-ent');
  const { error } = await db.rpc('definir_actif_organisation', { p_id: btn.dataset.org, p_actif: activer });
  if (error) { msg('msg-liste-ent', 'Action impossible : ' + error.message, false); return; }
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
  const btn = $('btn-ent');
  btn.disabled = true;
  try {
    const o = await db.from('organisations').insert({ nom: nom, sigle: sigle }).select('id').single();
    if (o.error) { msg('msg-ent', 'Création de l\'entreprise impossible : ' + o.error.message, false); return; }
    const orgId = o.data.id;
    // Le compte du premier administrateur est créé par la fonction serveur
    const r = await appelerCreationCompte({ email: email, nom: adminNom, mot_de_passe: mdp, role: 'admin', organisation_id: orgId });
    if (!r.ok) {
      await db.from('organisations').delete().eq('id', orgId);
      msg('msg-ent', r.message, false);
      return;
    }
    msg('msg-ent', 'Entreprise créée. Son administrateur peut se connecter avec cet email et le mot de passe provisoire.', true);
    $('form-ent').reset();
    await loadEntreprises();
  } finally {
    btn.disabled = false;
  }
});

/* ---------- Profil de l'entreprise ---------- */
function remplirProfil(o) {
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
  if (error) { msg('msg-profil', 'Enregistrement impossible : ' + error.message, false); return; }
  $('role').textContent = (ROLES[me.role] || me.role) + ' · ' + $('p-nom').value.trim();
  msg('msg-profil', 'Profil enregistré.', true);
});

/* ---------- Mon compte : changer le mot de passe ---------- */
$('form-mdp').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg('msg-mdp');
  const nouveau = $('m-nouveau').value;
  if (nouveau.length < 8) { msg('msg-mdp', 'Le mot de passe doit contenir au moins 8 caractères.', false); return; }
  if (nouveau !== $('m-confirm').value) { msg('msg-mdp', 'Les deux mots de passe ne sont pas identiques.', false); return; }
  const { error } = await db.auth.updateUser({ password: nouveau });
  if (error) { msg('msg-mdp', 'Changement impossible : ' + error.message, false); return; }
  msg('msg-mdp', 'Mot de passe mis à jour.', true);
  $('form-mdp').reset();
});

/* ---------- Démarrage (appelé depuis index.html quand tous les scripts sont chargés) ---------- */
async function demarrer() {
  try {
    const { data: { session } } = await db.auth.getSession();
    if (session) await loadApp(); else showLogin();
  } catch (err) {
    showLogin();
  }
}
