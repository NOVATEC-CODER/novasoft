/* =====================================================
 NovaSoft - console de la plateforme (super-administrateur) : interrupteur central de maintenance
 Interrupteur ON (vert) = la plateforme est accessible. OFF (rouge) = maintenance : plus aucune entreprise cliente ne peut se connecter
 (la règle est appliquée par la base de données ; seuls les super-administrateurs gardent l'accès).
 S'appuie sur core.js : db, $, msg, clearMsg, erreurClaire, etatPlateforme, MESSAGE_MAINTENANCE
 ===================================================== */
let plateformeActive = true;
function majBoutonPlateforme() {
 const b = $('btn-plateforme');
 const texte = $('plateforme-texte');
 const bouton = $('plateforme-bouton');
 const titre = $('etat-plateforme-titre');
 const detail = $('etat-plateforme-detail');
 const base = 'relative h-12 w-28 shrink-0 rounded-full shadow-inner transition-colors duration-300 ';
 b.setAttribute('aria-checked', plateformeActive ? 'true' : 'false');
 if (plateformeActive) {
 b.className = base + 'bg-emerald-500';
 texte.textContent = 'ON';
 texte.style.left = '16px';
 texte.style.right = '';
 bouton.style.transform = 'translateX(64px)';
 titre.textContent = 'Plateforme accessible';
 titre.className = 'text-base font-extrabold text-emerald-600';
 detail.textContent = 'Toutes les entreprises clientes peuvent se connecter.';
 } else {
 b.className = base + 'bg-rose-600';
 texte.textContent = 'OFF';
 texte.style.left = '';
 texte.style.right = '14px';
 bouton.style.transform = 'translateX(0)';
 titre.textContent = 'Maintenance activée';
 titre.className = 'text-base font-extrabold text-rose-600';
 detail.textContent = 'Seuls les super-administrateurs peuvent se connecter.';
 }
}
async function chargerPlateforme() {
 const etat = await etatPlateforme();
 plateformeActive = etat.active !== false;
 $('m-message').value = etat.message || MESSAGE_MAINTENANCE;
 majBoutonPlateforme();
}
$('btn-plateforme').addEventListener('click', async () => {
 clearMsg('msg-plateforme');
 const mettreEnMaintenance = plateformeActive;
 const question = mettreEnMaintenance
 ? 'Activer la maintenance ? Plus aucune entreprise cliente ne pourra se connecter, et les utilisateurs déjà connectés seront déconnectés dans les 2 minutes. Toi, tu gardes l\'accès.'
 : 'Rouvrir la plateforme à toutes les entreprises clientes ?';
 if (!window.confirm(question)) return;
 const bouton = $('btn-plateforme');
 bouton.disabled = true;
 try {
 const message = $('m-message').value.trim() || MESSAGE_MAINTENANCE;
 const r = await db.rpc('definir_plateforme', { p_active: !mettreEnMaintenance, p_message: message });
 if (r.error) { msg('msg-plateforme', erreurClaire(r.error, 'Action impossible.'), false); return; }
 plateformeActive = !mettreEnMaintenance;
 majBoutonPlateforme();
 msg('msg-plateforme', plateformeActive ? 'La plateforme est de nouveau accessible à toutes les entreprises.' : 'Maintenance activée : seuls les super-administrateurs peuvent se connecter.', true);
 } finally {
 bouton.disabled = false;
 }
});
