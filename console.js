/* =====================================================
 NovaSoft - console de la plateforme (super-administrateur) : interrupteur central de maintenance
 Vert = la plateforme est accessible. Rouge = maintenance : plus aucune entreprise cliente ne peut se connecter
 (la règle est appliquée par la base de données ; seuls les super-administrateurs gardent l'accès).
 S'appuie sur core.js : db, $, msg, clearMsg, erreurClaire, etatPlateforme, MESSAGE_MAINTENANCE
 ===================================================== */
let plateformeActive = true;
function majBoutonPlateforme() {
 const b = $('btn-plateforme');
 const base = 'mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold text-white shadow-sm transition ';
 if (plateformeActive) {
 b.className = base + 'bg-emerald-600';
 b.textContent = '● Plateforme accessible — appuie pour la mettre en maintenance';
 } else {
 b.className = base + 'bg-rose-600';
 b.textContent = '● Maintenance activée — appuie pour rouvrir la plateforme';
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
