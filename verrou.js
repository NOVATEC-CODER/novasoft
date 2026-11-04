/* =====================================================
 NovaSoft - module Verrou : code à 4 chiffres après une minute d'inactivité
 L'écran de verrouillage se pose PAR-DESSUS la page : rien n'est fermé ni perdu, et après le
 déverrouillage l'utilisateur retrouve exactement l'écran qu'il avait laissé.
 Le code est choisi par chaque utilisateur et vérifié par la base de données (jamais par le navigateur).
 S'appuie sur core.js : db, $, show, msg, clearMsg, notifier, erreurClaire, me
 ===================================================== */
const DELAI_INACTIVITE = 60 * 1000; // durée d'inactivité avant verrouillage (1 minute)
const CLE_ACTIVITE = 'ns-activite';
let codeExiste = false;
let verrouille = false;
let modeVerrou = ''; // 'attente', 'creer' ou 'deverrouiller'
let derniereActivite = Date.now();
let derniereEcriture = 0;
let surveillanceArmee = false;
/* ---------- Mémoire de la dernière activité (survit à une actualisation de la page) ---------- */
function lireActivite() {
 try { return JSON.parse(localStorage.getItem(CLE_ACTIVITE) || 'null'); } catch (e) { return null; }
}
function marquerActivite(idUtilisateur) {
 derniereActivite = Date.now();
 derniereEcriture = derniereActivite;
 const id = idUtilisateur || (me && me.id) || null;
 try { localStorage.setItem(CLE_ACTIVITE, JSON.stringify({ u: id, t: derniereActivite })); } catch (e) { /* stockage indisponible : on ignore */ }
}
function activiteDetectee() {
 if (verrouille) return;
 derniereActivite = Date.now();
 if (me && derniereActivite - derniereEcriture > 5000) marquerActivite();
}
function verifierInactivite() {
 if (verrouille || !codeExiste || !me) return;
 if (Date.now() - derniereActivite >= DELAI_INACTIVITE) afficherVerrou('deverrouiller');
}
/* ---------- Écran de verrouillage ---------- */
function messageVerrou(texte, ok) {
 const el = $('msg-verrou');
 el.textContent = texte;
 el.className = 'text-sm text-center ' + (texte ? '' : 'hidden ') + (ok ? 'text-emerald-700' : 'text-rose-600');
}
function afficherVerrou(mode) {
 verrouille = true;
 modeVerrou = mode;
 if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
 document.body.style.overflow = 'hidden';
 const creer = mode === 'creer';
 const attente = mode === 'attente';
 $('verrou-titre').textContent = creer ? 'Crée ton code de sécurité' : 'NovaSoft est verrouillé';
 $('verrou-texte').textContent = creer
 ? 'Choisis 4 chiffres. NovaSoft te les demandera après une minute sans activité, pour protéger ton écran.'
 : (attente ? 'Vérification…' : 'Saisis ton code à 4 chiffres pour retrouver ton écran.');
 show('form-verrou', !attente);
 show('ligne-v-code2', creer);
 $('btn-verrou').textContent = creer ? 'Enregistrer mon code' : 'Déverrouiller';
 $('v-code').value = '';
 $('v-code2').value = '';
 messageVerrou('', true);
 show('vue-verrou', true);
 if (!attente) setTimeout(() => $('v-code').focus(), 50);
}
function masquerVerrou() {
 verrouille = false;
 modeVerrou = '';
 show('vue-verrou', false);
 document.body.style.overflow = '';
 marquerActivite();
}
function texteErreurCode(error) {
 if (/simple/i.test((error && error.message) || '')) return 'Ce code est trop simple (par exemple 0000 ou 1234). Choisis-en un autre.';
 return erreurClaire(error, 'Le code n\'a pas pu être enregistré.');
}
async function deconnecterDepuisVerrou(confirmer) {
 if (confirmer && !window.confirm('Te déconnecter ? Ce que tu étais en train de saisir sera perdu.')) return;
 try { localStorage.removeItem(CLE_ACTIVITE); } catch (e) { /* on ignore */ }
 try { sessionStorage.removeItem('ns-onglet'); } catch (e) { /* on ignore */ }
 await db.auth.signOut();
 location.reload();
}
$('form-verrou').addEventListener('submit', async (e) => {
 e.preventDefault();
 const code = $('v-code').value.trim();
 if (!/^[0-9]{4}$/.test(code)) { messageVerrou('Saisis exactement 4 chiffres.', false); return; }
 const bouton = $('btn-verrou');
 bouton.disabled = true;
 try {
 if (modeVerrou === 'creer') {
 if (code !== $('v-code2').value.trim()) { messageVerrou('Les deux codes ne sont pas identiques.', false); return; }
 const r = await db.rpc('definir_code_verrouillage', { p_code: code });
 if (r.error) { messageVerrou(texteErreurCode(r.error), false); return; }
 codeExiste = true;
 masquerVerrou();
 notifier('Code enregistré. NovaSoft se verrouillera après une minute d\'inactivité.', true);
 return;
 }
 const r = await db.rpc('verifier_code_verrouillage', { p_code: code });
 if (r.error) { messageVerrou(erreurClaire(r.error, 'Vérification impossible.'), false); return; }
 const res = r.data || {};
 if (res.resultat === 'ok') { masquerVerrou(); return; }
 if (res.resultat === 'absent') { afficherVerrou('creer'); return; }
 if (res.resultat === 'bloque') {
 messageVerrou('Trop d\'erreurs. Tu vas être déconnecté : reconnecte-toi avec ton mot de passe.', false);
 setTimeout(() => deconnecterDepuisVerrou(false), 2500);
 return;
 }
 $('v-code').value = '';
 messageVerrou('Code incorrect. Il te reste ' + res.restant + ' essai' + (res.restant > 1 ? 's' : '') + '.', false);
 $('v-code').focus();
 } finally {
 bouton.disabled = false;
 }
});
['v-code', 'v-code2'].forEach((id) => {
 $(id).addEventListener('input', () => {
 $(id).value = $(id).value.replace(/[^0-9]/g, '');
 // au déverrouillage, le code est envoyé dès que les 4 chiffres sont saisis
 if (id === 'v-code' && modeVerrou === 'deverrouiller' && $(id).value.length === 4) $('btn-verrou').click();
 });
});
$('btn-verrou-sortie').addEventListener('click', () => deconnecterDepuisVerrou(true));
/* ---------- Démarrage : appelé par core.js une fois l'utilisateur chargé ---------- */
async function demarrerVerrou() {
 const v = lireActivite();
 derniereActivite = (v && me && v.u === me.id) ? v.t : 0;
 const ancien = Date.now() - derniereActivite >= DELAI_INACTIVITE;
 // activité trop ancienne : l'écran est couvert tout de suite, avant même de savoir si un code existe
 if (ancien) afficherVerrou('attente');
 const ex = await db.rpc('code_verrouillage_existe');
 if (ex.error) {
 console.warn('[NovaSoft] verrouillage indisponible', ex.error.message);
 if (verrouille) masquerVerrou();
 return;
 }
 codeExiste = ex.data === true;
 if (!codeExiste) afficherVerrou('creer');
 else if (ancien) afficherVerrou('deverrouiller');
 armerSurveillance();
}
function armerSurveillance() {
 if (surveillanceArmee) return;
 surveillanceArmee = true;
 ['pointerdown', 'keydown', 'touchstart', 'scroll', 'input'].forEach((ev) => document.addEventListener(ev, activiteDetectee, { capture: true, passive: true }));
 // au retour dans l'application (changement d'application, écran rallumé), on vérifie tout de suite
 document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verifierInactivite(); });
 window.addEventListener('pageshow', verifierInactivite);
 setInterval(verifierInactivite, 5000);
}
/* ---------- Mon compte : changer mon code ---------- */
$('form-code').addEventListener('submit', async (e) => {
 e.preventDefault();
 clearMsg('msg-code');
 const mdp = $('cd-mdp').value;
 const c1 = $('cd-code').value.trim();
 const c2 = $('cd-code2').value.trim();
 if (!mdp) { msg('msg-code', 'Saisis ton mot de passe actuel.', false); return; }
 if (!/^[0-9]{4}$/.test(c1)) { msg('msg-code', 'Le code doit contenir exactement 4 chiffres.', false); return; }
 if (c1 !== c2) { msg('msg-code', 'Les deux codes ne sont pas identiques.', false); return; }
 // le mot de passe est revérifié avant de changer le code
 const verif = await db.auth.signInWithPassword({ email: me.email, password: mdp });
 if (verif.error) { msg('msg-code', /invalid login/i.test(verif.error.message || '') ? 'Mot de passe incorrect.' : erreurClaire(verif.error, 'Vérification impossible.'), false); return; }
 const r = await db.rpc('definir_code_verrouillage', { p_code: c1 });
 if (r.error) { msg('msg-code', texteErreurCode(r.error), false); return; }
 codeExiste = true;
 $('form-code').reset();
 msg('msg-code', 'Code enregistré.', true);
});
['cd-code', 'cd-code2'].forEach((id) => {
 $(id).addEventListener('input', () => { $(id).value = $(id).value.replace(/[^0-9]/g, ''); });
});
