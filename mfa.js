/* =====================================================
 NovaSoft - module MFA : double authentification (TOTP) par application d'authentification
 À la connexion, l'utilisateur saisit le code à 6 chiffres de son application (Google Authenticator,
 Microsoft Authenticator, Authy...). Le code est vérifié par le service d'authentification, jamais par le navigateur.
 MFA_POUR_TOUS = true : la double authentification est obligatoire pour tous les administrateurs, comptables et super-administrateurs
 (à garder synchronisé avec le réglage « mfa_pour_tous » de la base). Avec false, seuls les comptes de MFA_COMPTES_PILOTE sont obligés.
 Tout compte qui a déjà activé la double authentification doit la saisir, quelle que soit cette liste.
 S'appuie sur core.js : db, $, show, notifier, erreurClaire, msg, showLogin, me
 ===================================================== */
const MFA_POUR_TOUS = true;
const MFA_COMPTES_PILOTE = ['novatecbenin@gmail.com', 'novasoftmanagement@gmail.com', 'kfdos83@gmail.com'];
let mfaResolution = null;
let mfaMode = '';
let mfaFacteurId = null;
function mfaRequis(estSuper) {
 if (!me) return false;
 if (MFA_POUR_TOUS) return estSuper === true || me.role === 'admin' || me.role === 'comptable';
 return MFA_COMPTES_PILOTE.includes(String(me.email || '').toLowerCase());
}
function messageMfa(texte, ok) {
 const el = $('msg-mfa');
 el.textContent = texte;
 el.className = 'text-sm text-center ' + (texte ? '' : 'hidden ') + (ok ? 'text-emerald-700' : 'text-rose-600');
}
function texteErreurMfa(error) {
 const t = String((error && error.message) || '').toLowerCase();
 const code = String((error && error.code) || '');
 if (code === 'mfa_verification_failed' || t.includes('invalid totp')) return 'Code incorrect. Vérifie le code affiché dans ton application (il change toutes les 30 secondes) et l\'heure de ton téléphone.';
 if (code === 'mfa_totp_enroll_not_enabled' || t.includes('enroll is disabled') || t.includes('verify is disabled')) return 'La double authentification n\'est pas activée sur la plateforme. Contacte l\'administrateur de NovaSoft.';
 return erreurClaire(error, 'Vérification impossible.');
}
function fermerEcranMfa() {
 show('vue-mfa', false);
 document.body.style.overflow = '';
 $('mfa-code').value = '';
 messageMfa('', true);
}
async function preparerEcranMfa(mode) {
 mfaMode = mode;
 mfaFacteurId = null;
 $('mfa-code').value = '';
 messageMfa('', true);
 $('btn-mfa').disabled = true;
 $('mfa-titre').textContent = mode === 'inscrire' ? 'Active la double authentification' : 'Double authentification';
 $('mfa-texte').textContent = mode === 'inscrire'
 ? 'Pour protéger ce compte, NovaSoft demande un code à 6 chiffres en plus du mot de passe.'
 : 'Saisis le code à 6 chiffres affiché dans ton application d\'authentification.';
 show('bloc-mfa-inscrire', mode === 'inscrire');
 document.body.style.overflow = 'hidden';
 show('vue-mfa', true);
 const liste = await db.auth.mfa.listFactors();
 if (liste.error) { messageMfa(texteErreurMfa(liste.error), false); return; }
 if (mode === 'verifier') {
 const f = (liste.data && liste.data.totp || [])[0];
 if (!f) { messageMfa('Aucune double authentification trouvée pour ce compte. Déconnecte-toi et contacte l\'administrateur de NovaSoft.', false); return; }
 mfaFacteurId = f.id;
 $('btn-mfa').disabled = false;
 setTimeout(() => $('mfa-code').focus(), 50);
 return;
 }
 // inscription : on nettoie d'abord une tentative précédente restée à moitié faite
 const anciens = ((liste.data && liste.data.all) || []).filter((f) => f.status !== 'verified');
 for (const f of anciens) { await db.auth.mfa.unenroll({ factorId: f.id }); }
 const e = await db.auth.mfa.enroll({ factorType: 'totp', issuer: 'NovaSoft', friendlyName: 'NovaSoft ' + Date.now() });
 if (e.error) { messageMfa(texteErreurMfa(e.error), false); return; }
 const totp = e.data.totp || {};
 const qr = String(totp.qr_code || '');
 $('mfa-qr').src = qr.startsWith('data:') ? qr : 'data:image/svg+xml;utf-8,' + encodeURIComponent(qr);
 $('mfa-secret').textContent = totp.secret || '';
 const lien = String(totp.uri || '');
 $('mfa-lien').href = lien.startsWith('otpauth://') ? lien : '#';
 mfaFacteurId = e.data.id;
 $('btn-mfa').disabled = false;
}
async function ecranMfa(mode) {
 const attente = new Promise((resolve) => { mfaResolution = resolve; });
 try { await preparerEcranMfa(mode); } catch (err) { console.error('[NovaSoft] double authentification', err); messageMfa(erreurClaire(err, 'Préparation impossible.'), false); }
 return attente;
}
/* Appelée par loadApp() : renvoie true quand l'utilisateur peut continuer, false si l'écran de connexion a pris le relais */
async function verifierMfa(estSuper) {
 let aal;
 try { aal = await db.auth.mfa.getAuthenticatorAssuranceLevel(); } catch (err) { aal = { error: err }; }
 if (aal.error || !aal.data) {
 console.warn('[NovaSoft] niveau de double authentification indisponible', aal.error);
 if (!mfaRequis(estSuper)) return true;
 await db.auth.signOut();
 showLogin();
 msg('msg-login', 'Connexion impossible pour le moment. Vérifie ta connexion Internet puis réessaie.', false);
 return false;
 }
 if (aal.data.currentLevel === 'aal2') return true;
 if (aal.data.nextLevel === 'aal2') return ecranMfa('verifier');
 if (mfaRequis(estSuper)) return ecranMfa('inscrire');
 return true;
}
$('form-mfa').addEventListener('submit', async (e) => {
 e.preventDefault();
 const code = $('mfa-code').value.trim();
 if (!/^[0-9]{6}$/.test(code)) { messageMfa('Saisis les 6 chiffres affichés dans ton application.', false); return; }
 if (!mfaFacteurId) { messageMfa('Préparation en cours, réessaie dans un instant.', false); return; }
 const bouton = $('btn-mfa');
 bouton.disabled = true;
 try {
 const ch = await db.auth.mfa.challenge({ factorId: mfaFacteurId });
 if (ch.error) { messageMfa(texteErreurMfa(ch.error), false); return; }
 const v = await db.auth.mfa.verify({ factorId: mfaFacteurId, challengeId: ch.data.id, code: code });
 if (v.error) { $('mfa-code').value = ''; messageMfa(texteErreurMfa(v.error), false); return; }
 const inscription = mfaMode === 'inscrire';
 fermerEcranMfa();
 if (inscription) notifier('Double authentification activée. Elle te sera demandée à chaque connexion.', true);
 if (mfaResolution) { const suite = mfaResolution; mfaResolution = null; suite(true); }
 } finally {
 bouton.disabled = false;
 }
});
$('mfa-code').addEventListener('input', () => {
 $('mfa-code').value = $('mfa-code').value.replace(/[^0-9]/g, '');
 if ($('mfa-code').value.length === 6 && !$('btn-mfa').disabled) $('btn-mfa').click();
});
$('mfa-copier').addEventListener('click', async () => {
 try { await navigator.clipboard.writeText($('mfa-secret').textContent); notifier('Clé copiée.', true); } catch (e) { notifier('Copie impossible : recopie la clé à la main.', false); }
});
$('btn-mfa-sortie').addEventListener('click', async () => {
 try { sessionStorage.removeItem('ns-onglet'); } catch (e) { /* on ignore */ }
 await db.auth.signOut();
 location.reload();
});
