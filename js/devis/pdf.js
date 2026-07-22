// ═══════════════════════════════════════════════════
// GlamBook — Devis : génération PDF (jsPDF + autotable)
// Design sobre & élégant, adapté au secteur beauté / mariage.
// ═══════════════════════════════════════════════════
import { jsPDF } from 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm';
import autoTable from 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/+esm';
import { computeTotals, euros } from '/js/devis/model.js';

// Palette (RGB) alignée sur le design system GlamBook
const ROSE  = [232, 84, 122];
const ROSEF = [196, 58, 96];
const OR    = [212, 175, 55];
const NOIR  = [17, 17, 17];
const GRIS  = [107, 114, 128];
const BORD  = [229, 231, 235];
const ROSECL = [253, 232, 239];

const dateFR = (d, withTime = false) => {
  if (!d) return '—';
  const opts = withTime
    ? { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'long', year: 'numeric' };
  return new Date(d).toLocaleDateString('fr-FR', opts);
};

/**
 * Construit le document PDF d'un devis.
 * @param {import('./model.js').Quote} quote
 * @returns {jsPDF}
 */
export function buildQuotePdf(quote) {
  const t = computeTotals(quote);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();   // 210
  const M = 16;                                  // marge
  let y = 0;

  // ── Bandeau d'en-tête ──
  doc.setFillColor(...NOIR);
  doc.rect(0, 0, W, 34, 'F');
  doc.setFillColor(...ROSE);
  doc.rect(0, 34, W, 1.4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...ROSE);
  doc.text('Glam', M, 20);
  const glamW = doc.getTextWidth('Glam');
  doc.setTextColor(...OR);
  doc.text('Book', M + glamW, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(230, 230, 230);
  doc.text('DEVIS', M, 27);

  // Numéro & date à droite
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(quote.quoteNumber || 'DEVIS', W - M, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(200, 200, 200);
  doc.text(`Émis le ${dateFR(new Date())}`, W - M, 22, { align: 'right' });
  if (quote.validUntil) {
    doc.text(`Valable jusqu'au ${dateFR(quote.validUntil)}`, W - M, 27, { align: 'right' });
  }

  y = 46;

  // ── Blocs MUA / Cliente ──
  const colW = (W - M * 2 - 8) / 2;
  const blockLabel = (x, label) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.setTextColor(...ROSE);
    doc.text(label.toUpperCase(), x, y);
  };
  blockLabel(M, 'Prestataire');
  blockLabel(M + colW + 8, 'Cliente');

  doc.setDrawColor(...BORD); doc.setLineWidth(0.2);
  doc.line(M, y + 1.6, M + colW, y + 1.6);
  doc.line(M + colW + 8, y + 1.6, W - M, y + 1.6);

  const lines = (x, arr) => {
    let yy = y + 7;
    arr.forEach((ln, i) => {
      if (!ln) return;
      doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
      doc.setFontSize(i === 0 ? 10 : 8.6);
      doc.setTextColor(...(i === 0 ? NOIR : GRIS));
      doc.text(String(ln), x, yy);
      yy += i === 0 ? 5.5 : 4.6;
    });
    return yy;
  };
  const muaEnd = lines(M, [
    quote.mua.name,
    quote.mua.address,
    quote.mua.siret ? `SIRET : ${quote.mua.siret}` : '',
    quote.mua.email, quote.mua.phone,
  ]);
  const cliEnd = lines(M + colW + 8, [
    quote.client.name,
    quote.client.email, quote.client.phone,
    quote.client.eventAddress ? `Événement : ${quote.client.eventAddress}` : '',
  ]);
  y = Math.max(muaEnd, cliEnd) + 4;

  // ── Bandeau événement ──
  if (quote.eventDate || quote.client.eventAddress) {
    doc.setFillColor(...ROSECL);
    doc.roundedRect(M, y, W - M * 2, 11, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.setTextColor(...ROSEF);
    doc.text('Prestation prévue le', M + 4, y + 7);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...NOIR);
    doc.text(dateFR(quote.eventDate, true), M + 42, y + 7);
    y += 16;
  } else {
    y += 2;
  }

  // ── Tableau des prestations ──
  const body = (quote.items || [])
    .filter(it => it.title)
    .map(it => {
      const line = (Number(it.qty) || 0) * Math.round(Number(it.unitPriceCents) || 0);
      return [it.title, String(it.qty), euros(it.unitPriceCents), euros(line)];
    });
  if (t.travelCents > 0) {
    body.push([
      `Frais de déplacement (${quote.travelDistanceKm} km × ${euros(quote.travelRateCents)}/km)`,
      '', '', euros(t.travelCents),
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [['Prestation', 'Qté', 'Prix unitaire', 'Total']],
    body,
    margin: { left: M, right: M },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, textColor: NOIR, lineColor: BORD, lineWidth: 0.1 },
    headStyles: { fillColor: NOIR, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, halign: 'left' },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 16, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: [250, 250, 251] },
  });

  y = doc.lastAutoTable.finalY + 6;

  // ── Totaux (encadré à droite) ──
  const boxW = 78, boxX = W - M - boxW;
  const row = (label, val, opts = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.big ? 11 : 9);
    doc.setTextColor(...(opts.color || GRIS));
    doc.text(label, boxX, y);
    doc.setTextColor(...(opts.valColor || NOIR));
    doc.text(val, W - M, y, { align: 'right' });
    y += opts.big ? 7 : 5.6;
  };
  row('Total HT', euros(t.subtotalCents));
  if (quote.vatExempt) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(7.6);
    doc.setTextColor(...GRIS);
    doc.text('TVA non applicable, art. 293 B du CGI', boxX, y);
    y += 5.6;
  } else {
    row(`TVA (${quote.vatRate} %)`, euros(t.vatCents));
  }
  // séparateur
  doc.setDrawColor(...ROSE); doc.setLineWidth(0.4);
  doc.line(boxX, y - 2, W - M, y - 2);
  y += 2;
  row('Total TTC', euros(t.totalCents), { bold: true, big: true, color: NOIR, valColor: ROSEF });

  if (t.depositCents > 0) {
    y += 1;
    row('Acompte à la réservation', euros(t.depositCents), { bold: true });
    row('Solde le jour J', euros(t.balanceCents));
  }

  y += 4;

  // ── Conditions de paiement / notes ──
  const para = (label, text) => {
    if (!text) return;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.setTextColor(...ROSE);
    doc.text(label.toUpperCase(), M, y); y += 4.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4);
    doc.setTextColor(...GRIS);
    const wrapped = doc.splitTextToSize(text, W - M * 2);
    doc.text(wrapped, M, y);
    y += wrapped.length * 4.2 + 3;
  };
  para('Conditions de paiement', quote.paymentTerms);
  para('Notes', quote.notes);

  // ── Zone signature ──
  const pageH = doc.internal.pageSize.getHeight();
  let sigY = Math.max(y + 6, pageH - 52);
  doc.setDrawColor(...BORD); doc.setLineWidth(0.2);
  doc.line(M, sigY - 4, W - M, sigY - 4);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.setTextColor(...NOIR);
  doc.text('Bon pour accord', W - M - 60, sigY + 2);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.6);
  doc.setTextColor(...GRIS);
  doc.text('Date & signature de la cliente', W - M - 60, sigY + 6.5);

  // cadre signature
  const sbX = W - M - 60, sbY = sigY + 9, sbW = 60, sbH = 26;
  doc.setDrawColor(...BORD);
  doc.roundedRect(sbX, sbY, sbW, sbH, 1.5, 1.5, 'S');

  if (quote.signatureData) {
    try {
      doc.addImage(quote.signatureData, 'PNG', sbX + 2, sbY + 2, sbW - 4, sbH - 4, undefined, 'FAST');
    } catch (_) { /* image invalide : on laisse le cadre vide */ }
    if (quote.signedName || quote.signedAt) {
      doc.setFontSize(7); doc.setTextColor(...GRIS);
      const who = [quote.signedName, quote.signedAt ? dateFR(quote.signedAt, true) : '']
        .filter(Boolean).join(' — ');
      doc.text(who, sbX, sbY + sbH + 4);
    }
    // Tampon "SIGNÉ"
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.setTextColor(...OR);
    doc.text('✓ SIGNÉ', M, sbY + 6);
  }

  // ── Pied de page ──
  doc.setDrawColor(...BORD); doc.setLineWidth(0.2);
  doc.line(M, pageH - 12, W - M, pageH - 12);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  doc.setTextColor(...GRIS);
  doc.text('Devis généré via GlamBook — glambook', M, pageH - 8);
  doc.text(quote.mua.name || '', W - M, pageH - 8, { align: 'right' });

  return doc;
}

/** Prévisualise le PDF dans une modale intégrée (évite les pop-ups bloqués par le navigateur). */
export function previewQuotePdf(quote) {
  const doc = buildQuotePdf(quote);
  const name = `${quote.quoteNumber || 'devis'}.pdf`;
  const url = doc.output('bloburl');
  showPdfModal(url, name);
}

/** Affiche un PDF (blob URL) dans une superposition plein écran, avec repli téléchargement. */
function showPdfModal(url, name) {
  document.getElementById('gb-pdf-modal')?.remove();

  const ov = document.createElement('div');
  ov.id = 'gb-pdf-modal';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.72);display:flex;flex-direction:column;';

  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;background:#111;color:#fff;';
  bar.innerHTML = '<span style="font-weight:700;font-size:.9rem;">Aperçu du devis</span>';

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;';
  const dl = document.createElement('a');
  dl.href = url; dl.download = name; dl.textContent = '⬇ Télécharger';
  dl.style.cssText = 'background:#E8547A;color:#fff;text-decoration:none;font-weight:700;font-size:.82rem;padding:8px 16px;border-radius:8px;';
  const openTab = document.createElement('a');
  openTab.href = url; openTab.target = '_blank'; openTab.rel = 'noopener'; openTab.textContent = 'Ouvrir';
  openTab.style.cssText = 'background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4);text-decoration:none;font-weight:700;font-size:.82rem;padding:8px 16px;border-radius:8px;';
  const close = document.createElement('button');
  close.textContent = 'Fermer';
  close.style.cssText = 'background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4);font-weight:700;font-size:.82rem;padding:8px 16px;border-radius:8px;cursor:pointer;';
  actions.append(dl, openTab, close);
  bar.appendChild(actions);

  const frame = document.createElement('iframe');
  frame.src = url;
  frame.setAttribute('title', 'Aperçu PDF');
  frame.style.cssText = 'flex:1;width:100%;border:0;background:#525659;';

  ov.append(bar, frame);
  document.body.appendChild(ov);

  const cleanup = () => { ov.remove(); setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 1000); };
  close.onclick = cleanup;
  ov.addEventListener('click', (e) => { if (e.target === ov) cleanup(); });
  document.addEventListener('keydown', function esc(e){ if (e.key === 'Escape') { cleanup(); document.removeEventListener('keydown', esc); } });
}

/** Renvoie une dataURL du PDF (pour embed <iframe> ou téléchargement). */
export function quotePdfDataUrl(quote) {
  return buildQuotePdf(quote).output('datauristring');
}

/** Télécharge le PDF. */
export function downloadQuotePdf(quote) {
  const doc = buildQuotePdf(quote);
  doc.save(`${quote.quoteNumber || 'devis'}.pdf`);
}
