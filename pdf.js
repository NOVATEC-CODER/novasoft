/* =====================================================
 NovaSoft - module PDF : génère un vrai fichier PDF (sans passer par l'impression du téléphone)
 Un « rapport » est l'objet décrit dans exports.js : { titre, sousTitre, colonnes, lignes, totaux, note }.
 genererPDF(rapport) renvoie les octets du fichier ; telechargerPDF() le télécharge ; partagerPDF() ouvre le menu de partage
 du téléphone (e-mail, WhatsApp...). Polices standard Helvetica : aucune bibliothèque externe, rien à charger.
 S'appuie sur exports.js : entrepriseNom, me, nombreFr, cellule, editeur, slug, iso
 ===================================================== */
const LARGEURS_HELVETICA = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const CORRESPONDANCE_WINANSI = { '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '...', '→': '->', '\u202f': ' ', '\u00a0': ' ', 'œ': '\x9c', 'Œ': '\x8c', '€': '\x80', '•': '\x95' };
function versWinAnsi(texte) {
 let sortie = '';
 for (const c of String(texte === null || texte === undefined ? '' : texte)) {
 if (CORRESPONDANCE_WINANSI[c] !== undefined) sortie += CORRESPONDANCE_WINANSI[c];
 else if (c === '\n' || c === '\r' || c === '\t') sortie += ' ';
 else if (c.charCodeAt(0) < 256) sortie += c;
 else sortie += '?';
 }
 return sortie;
}
function echapperPDF(t) { return t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
function largeurTexte(t, taille, gras) {
 let l = 0;
 for (const c of t) {
 const code = c.charCodeAt(0);
 let w;
 if (code >= 32 && code <= 126) w = LARGEURS_HELVETICA[code - 32];
 else {
 const base = c.normalize('NFD').charAt(0);
 const bc = base.charCodeAt(0);
 w = (bc >= 32 && bc <= 126) ? LARGEURS_HELVETICA[bc - 32] : 556;
 }
 l += w;
 }
 return l * taille / 1000 * (gras ? 1.07 : 1);
}
function decouperTexte(t, largeurMax, taille, gras) {
 const mots = t.split(' ');
 const lignes = [];
 let courante = '';
 const coupeMot = (mot) => {
 // un mot plus large que la colonne est coupé en morceaux
 let morceau = '';
 for (const c of mot) {
 if (largeurTexte(morceau + c, taille, gras) > largeurMax && morceau) { lignes.push(morceau); morceau = c; } else morceau += c;
 }
 return morceau;
 };
 mots.forEach((mot) => {
 const essai = courante ? courante + ' ' + mot : mot;
 if (largeurTexte(essai, taille, gras) <= largeurMax) { courante = essai; return; }
 if (courante) lignes.push(courante);
 courante = largeurTexte(mot, taille, gras) > largeurMax ? coupeMot(mot) : mot;
 });
 lignes.push(courante);
 return lignes;
}
function couleurPDF(hex) {
 const n = parseInt(hex.replace('#', ''), 16);
 return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(' ');
}
function genererPDF(r) {
 const paysage = r.colonnes.length >= 6;
 const PW = paysage ? 842 : 595;
 const PH = paysage ? 595 : 842;
 const M = 34;
 const largeurUtile = PW - 2 * M;
 const taille = r.colonnes.length >= 8 ? 7.5 : (r.colonnes.length >= 6 ? 8.5 : 9.5);
 const interligne = taille * 1.25;
 const pad = 4;
 // largeurs de colonnes : chaque colonne reçoit au moins la place de son mot le plus long, le reste est réparti selon le contenu
 const mini = [];
 const voulu = [];
 r.colonnes.forEach((c, i) => {
 const textes = [versWinAnsi(c.titre)].concat(r.lignes.map((l) => versWinAnsi(cellule(c, l[i]))));
 let mot = 0;
 let plein = 0;
 textes.forEach((t, k) => {
 const gras = k === 0;
 plein = Math.max(plein, largeurTexte(t, taille, gras));
 t.split(' ').forEach((m) => { mot = Math.max(mot, largeurTexte(m, taille, gras)); });
 });
 mini.push(Math.min(mot, 140) + 2 * pad + 2);
 voulu.push(Math.max(mini[i], Math.min(plein, 230) + 2 * pad + 2));
 });
 const sommeMini = mini.reduce((a, b) => a + b, 0);
 let largeurs;
 if (sommeMini >= largeurUtile) {
 largeurs = mini.map((m) => (m / sommeMini) * largeurUtile);
 } else {
 largeurs = mini.slice();
 let reste = largeurUtile - sommeMini;
 const manque = voulu.map((v, i) => v - mini[i]);
 const totalManque = manque.reduce((a, b) => a + b, 0);
 if (totalManque > 0) {
 const part = Math.min(1, reste / totalManque);
 largeurs = largeurs.map((l, i) => l + manque[i] * part);
 reste -= totalManque * part;
 }
 if (reste > 0.01) {
 const base = largeurs.reduce((a, b) => a + b, 0);
 largeurs = largeurs.map((l) => l + reste * (l / base));
 }
 }
 const pages = [];
 let flux;
 let y;
 const COL_BLEU = couleurPDF('#0052CC');
 function ecrire(texte, x, yy, gras, couleur, tailleTexte) {
 flux.push('BT /' + (gras ? 'F2' : 'F1') + ' ' + (tailleTexte || taille) + ' Tf ' + (couleur || '0.059 0.090 0.165') + ' rg ' + x.toFixed(2) + ' ' + yy.toFixed(2) + ' Td (' + echapperPDF(texte) + ') Tj ET');
 }
 function rect(x, yy, w, h, couleur) { flux.push(couleur + ' rg ' + x.toFixed(2) + ' ' + yy.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + ' re f'); }
 function nouvellePage(premiere) {
 flux = [];
 pages.push(flux);
 y = PH - M;
 if (premiere) {
 ecrire('NovaSoft', M, y - 14, true, COL_BLEU, 18);
 const droite = versWinAnsi(entrepriseNom || '');
 const edit = versWinAnsi(editeur());
 ecrire(droite, PW - M - largeurTexte(droite, 10, true), y - 8, true, '0.059 0.090 0.165', 10);
 ecrire(edit, PW - M - largeurTexte(edit, 8, false), y - 20, false, '0.278 0.333 0.412', 8);
 rect(M, y - 28, largeurUtile, 2, COL_BLEU);
 y -= 48;
 ecrire(versWinAnsi(r.titre), M, y, true, COL_BLEU, 15);
 y -= 16;
 if (r.sousTitre) { ecrire(versWinAnsi(r.sousTitre), M, y, false, '0.278 0.333 0.412', 10); y -= 14; }
 y -= 6;
 } else {
 ecrire('NovaSoft - ' + versWinAnsi(r.titre) + ' (suite)', M, y - 8, true, COL_BLEU, 9);
 y -= 24;
 }
 }
 function enteteTableau() {
 const hauteur = interligne + 2 * pad;
 rect(M, y - hauteur, largeurUtile, hauteur, COL_BLEU);
 let x = M;
 r.colonnes.forEach((c, i) => {
 const t = versWinAnsi(c.titre);
 const ligne = decouperTexte(t, largeurs[i] - 2 * pad, taille, true)[0];
 const dx = c.type === 'montant' ? largeurs[i] - pad - largeurTexte(ligne, taille, true) : pad;
 ecrire(ligne, x + dx, y - pad - taille * 0.9, true, '1 1 1', taille);
 x += largeurs[i];
 });
 y -= hauteur;
 }
 function ligneTableau(valeurs, options) {
 const gras = !!(options && options.gras);
 const cellules = r.colonnes.map((c, i) => decouperTexte(versWinAnsi(cellule(c, valeurs[i])), largeurs[i] - 2 * pad, taille, gras));
 const nb = Math.max(...cellules.map((c) => c.length));
 const hauteur = nb * interligne + 2 * pad;
 if (y - hauteur < M + 22) { nouvellePage(false); enteteTableau(); }
 if (options && options.fond) rect(M, y - hauteur, largeurUtile, hauteur, options.fond);
 let x = M;
 cellules.forEach((lignes, i) => {
 lignes.forEach((t, k) => {
 const adroite = r.colonnes[i].type === 'montant' || !!(options && options.droite && options.droite.includes(i));
 const dx = adroite ? largeurs[i] - pad - largeurTexte(t, taille, gras) : pad;
 ecrire(t, x + dx, y - pad - taille * 0.9 - k * interligne, gras, null, taille);
 });
 x += largeurs[i];
 });
 rect(M, y - hauteur, largeurUtile, 0.4, couleurPDF('#e2e8f0'));
 y -= hauteur;
 }
 nouvellePage(true);
 enteteTableau();
 r.lignes.forEach((l, idx) => ligneTableau(l, { fond: idx % 2 ? couleurPDF('#f8fafc') : null }));
 (r.totaux || []).forEach((t) => {
 const valeurs = new Array(r.colonnes.length).fill('');
 valeurs[Math.max(0, r.colonnes.length - 2)] = t[0];
 valeurs[r.colonnes.length - 1] = t[1];
 // le libellé du total est aligné à droite de l'avant-dernière colonne
 ligneTableau(valeurs, { gras: true, fond: couleurPDF('#eff6ff'), droite: [Math.max(0, r.colonnes.length - 2)] });
 });
 if (r.note) {
 const lignes = decouperTexte(versWinAnsi(r.note), largeurUtile, 8.5, false);
 y -= 10;
 lignes.forEach((t) => { if (y < M + 22) { nouvellePage(false); } ecrire(t, M, y, false, couleurPDF('#b45309'), 8.5); y -= 11; });
 }
 // pieds de page
 const n = pages.length;
 pages.forEach((f, i) => {
 flux = f;
 const pied = 'NovaSoft - un service de NOVATEC   |   page ' + (i + 1) + ' sur ' + n;
 ecrire(pied, (PW - largeurTexte(pied, 7.5, false)) / 2, M - 14, false, '0.580 0.639 0.722', 7.5);
 });
 // assemblage du fichier
 const objets = [];
 objets[1] = '<< /Type /Catalog /Pages 2 0 R >>';
 const refsPages = pages.map((_, i) => (5 + 2 * i) + ' 0 R');
 objets[2] = '<< /Type /Pages /Kids [' + refsPages.join(' ') + '] /Count ' + pages.length + ' >>';
 objets[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
 objets[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
 pages.forEach((f, i) => {
 const contenu = f.join('\n');
 objets[5 + 2 * i] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (6 + 2 * i) + ' 0 R >>';
 objets[6 + 2 * i] = '<< /Length ' + contenu.length + ' >>\nstream\n' + contenu + '\nendstream';
 });
 let sortie = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
 const positions = [];
 for (let i = 1; i < objets.length; i++) {
 positions[i] = sortie.length;
 sortie += i + ' 0 obj\n' + objets[i] + '\nendobj\n';
 }
 const debutXref = sortie.length;
 sortie += 'xref\n0 ' + objets.length + '\n0000000000 65535 f \n';
 for (let i = 1; i < objets.length; i++) sortie += String(positions[i]).padStart(10, '0') + ' 00000 n \n';
 sortie += 'trailer\n<< /Size ' + objets.length + ' /Root 1 0 R /Info << /Title (' + echapperPDF(versWinAnsi(r.titre)) + ') /Producer (NovaSoft) >> >>\nstartxref\n' + debutXref + '\n%%EOF\n';
 const octets = new Uint8Array(sortie.length);
 for (let i = 0; i < sortie.length; i++) octets[i] = sortie.charCodeAt(i) & 255;
 return octets;
}
function nomFichierPDF(r) {
 return ('novasoft-' + slug(r.titre + ' ' + (r.sousTitre || ''))).slice(0, 70) + '-' + iso(new Date()) + '.pdf';
}
function telechargerPDF(r) {
 const blob = new Blob([genererPDF(r)], { type: 'application/pdf' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = nomFichierPDF(r);
 document.body.appendChild(a);
 a.click();
 a.remove();
 setTimeout(() => URL.revokeObjectURL(url), 5000);
 return true;
}
function partageDisponible() {
 try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [new File([new Uint8Array(1)], 'a.pdf', { type: 'application/pdf' })] })); } catch (e) { return false; }
}
async function partagerPDF(r) {
 const fichier = new File([genererPDF(r)], nomFichierPDF(r), { type: 'application/pdf' });
 try {
 await navigator.share({ files: [fichier], title: 'NovaSoft - ' + r.titre });
 return true;
 } catch (e) {
 if (e && e.name === 'AbortError') return false;
 console.error('[NovaSoft] partage impossible', e);
 return telechargerPDF(r);
 }
}
