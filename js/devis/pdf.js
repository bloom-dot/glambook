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

  // ── Logo MUA (letterhead, optionnel) ──
  if (quote.mua.logoUrl) {
    try {
      const props = doc.getImageProperties(quote.mua.logoUrl);
      const h = 14, w = Math.min(48, h * props.width / props.height);
      doc.addImage(quote.mua.logoUrl, props.fileType || 'PNG', M, y - 2, w, h);
      y += 16;
    } catch (_) { /* logo illisible : on l'ignore */ }
  }

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

const escHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Prévisualise le devis en HTML dans une modale intégrée.
 * Universel : fonctionne sur mobile ET desktop, sans pop-up ni PDF en iframe.
 * Le bouton « Télécharger le PDF » fournit le fichier réel.
 */
export function previewQuotePdf(quote) {
  document.getElementById('gb-pdf-modal')?.remove();
  const t = computeTotals(quote);

  const ov = document.createElement('div');
  ov.id = 'gb-pdf-modal';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;flex-direction:column;'
    + 'font-family:Inter,-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;';

  // Barre d'actions
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;'
    + 'background:#111;color:#fff;flex:0 0 auto;';
  bar.innerHTML = '<span style="font-weight:800;font-size:.95rem;">Aperçu du devis</span>';
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;';
  const dl = document.createElement('button');
  dl.textContent = '⬇ Télécharger le PDF';
  dl.style.cssText = 'background:#E8547A;color:#fff;border:none;font-weight:700;font-size:.82rem;padding:9px 16px;border-radius:8px;cursor:pointer;';
  dl.onclick = () => downloadQuotePdf(quote);
  const close = document.createElement('button');
  close.textContent = 'Fermer';
  close.style.cssText = 'background:transparent;color:#fff;border:1px solid rgba(255,255,255,.4);font-weight:700;font-size:.82rem;padding:9px 16px;border-radius:8px;cursor:pointer;';
  actions.append(dl, close);
  bar.appendChild(actions);

  // Zone défilante + feuille
  const scroll = document.createElement('div');
  scroll.style.cssText = 'flex:1 1 auto;overflow:auto;padding:20px 12px;-webkit-overflow-scrolling:touch;';
  const sheet = document.createElement('div');
  sheet.style.cssText = 'max-width:720px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.25);';
  sheet.innerHTML = quoteToHtml(quote, t);
  scroll.appendChild(sheet);

  ov.append(bar, scroll);
  document.body.appendChild(ov);

  const cleanup = () => ov.remove();
  close.onclick = cleanup;
  ov.addEventListener('click', (e) => { if (e.target === ov) cleanup(); });
  document.addEventListener('keydown', function onEsc(e){ if (e.key === 'Escape') { cleanup(); document.removeEventListener('keydown', onEsc); } });
}

/** Rendu HTML du devis (miroir du PDF), responsive. */
function quoteToHtml(q, t) {
  const line = (it) => `<tr>
    <td style="padding:9px 6px;border-bottom:1px solid #F3F4F6;">${escHtml(it.title)}</td>
    <td style="padding:9px 6px;border-bottom:1px solid #F3F4F6;text-align:center;">${escHtml(it.qty)}</td>
    <td style="padding:9px 6px;border-bottom:1px solid #F3F4F6;text-align:right;">${escHtml(euros(it.unitPriceCents))}</td>
    <td style="padding:9px 6px;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:700;">${escHtml(euros((Number(it.qty)||0)*Math.round(Number(it.unitPriceCents)||0)))}</td>
  </tr>`;
  const items = (q.items || []).filter(it => it.title).map(line).join('');
  const travelRow = t.travelCents > 0
    ? `<tr><td style="padding:9px 6px;border-bottom:1px solid #F3F4F6;">Frais de déplacement (${escHtml(q.travelDistanceKm)} km × ${escHtml(euros(q.travelRateCents))}/km)</td><td></td><td></td><td style="padding:9px 6px;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:700;">${escHtml(euros(t.travelCents))}</td></tr>`
    : '';
  const party = (label, lines) => `<div style="flex:1;min-width:180px;">
    <div style="font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#E8547A;margin-bottom:6px;border-bottom:1px solid #E5E7EB;padding-bottom:3px;">${label}</div>
    ${lines.filter(Boolean).map((l,i)=>`<div style="font-size:${i===0?'14px':'12.5px'};font-weight:${i===0?'700':'400'};color:${i===0?'#111':'#6B7280'};margin-bottom:2px;">${escHtml(l)}</div>`).join('')}
  </div>`;
  const eventBand = (q.eventDate || q.client.eventAddress) ? `
    <div style="background:#FDE8EF;border-radius:8px;padding:10px 14px;margin:14px 0;font-size:13px;color:#C43A60;">
      <b>Prestation prévue :</b> <span style="color:#111;">${escHtml(dateFR(q.eventDate, true))}${q.client.eventAddress ? ' — ' + escHtml(q.client.eventAddress) : ''}</span>
    </div>` : '';
  const tvaRow = q.vatExempt
    ? `<div style="font-style:italic;font-size:12px;color:#6B7280;text-align:right;margin:2px 0;">TVA non applicable, art. 293 B du CGI</div>`
    : `<div style="display:flex;justify-content:space-between;font-size:13px;color:#6B7280;padding:3px 0;">TVA (${escHtml(q.vatRate)} %)<b style="color:#111;">${escHtml(euros(t.vatCents))}</b></div>`;
  const depositRows = t.depositCents > 0 ? `
    <div style="display:flex;justify-content:space-between;font-size:13px;color:#6B7280;padding:3px 0;">Acompte à la réservation<b style="color:#111;">${escHtml(euros(t.depositCents))}</b></div>
    <div style="display:flex;justify-content:space-between;font-size:13px;color:#6B7280;padding:3px 0;">Solde le jour J<b style="color:#111;">${escHtml(euros(t.balanceCents))}</b></div>` : '';
  const terms = q.paymentTerms ? `<div style="margin-top:14px;font-size:12.5px;color:#6B7280;"><b style="color:#111;">Conditions de paiement :</b> ${escHtml(q.paymentTerms)}</div>` : '';
  const notes = q.notes ? `<div style="margin-top:6px;font-size:12.5px;color:#6B7280;">${escHtml(q.notes)}</div>` : '';
  const signed = q.signatureData
    ? `<div style="margin-top:6px;"><img src="${escHtml(q.signatureData)}" alt="Signature" style="max-height:70px;"/><div style="font-size:11px;color:#6B7280;">${escHtml([q.signedName, q.signedAt ? dateFR(q.signedAt, true) : ''].filter(Boolean).join(' — '))}</div></div>`
    : `<div style="margin-top:6px;height:64px;border:1px dashed #E5E7EB;border-radius:6px;"></div>`;

  return `
    <div style="background:#111;padding:18px 22px;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:20px;font-weight:900;color:#E8547A;letter-spacing:-.03em;">Glam<span style="color:#D4AF37;">Book</span></div>
      <div style="text-align:right;color:#fff;">
        <div style="font-weight:800;">${escHtml(q.quoteNumber || 'DEVIS')}</div>
        <div style="font-size:11px;color:#bbb;">Émis le ${escHtml(dateFR(new Date()))}${q.validUntil ? ' · valable jusqu’au ' + escHtml(dateFR(q.validUntil)) : ''}</div>
      </div>
    </div>
    <div style="padding:20px 22px;">
      ${q.mua.logoUrl ? `<div style="margin-bottom:14px;"><img src="${escHtml(q.mua.logoUrl)}" alt="Logo" style="max-height:48px;max-width:180px;object-fit:contain;"/></div>` : ''}
      <div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:6px;">
        ${party('Prestataire', [q.mua.name, q.mua.address, q.mua.siret ? 'SIRET : '+q.mua.siret : '', q.mua.email, q.mua.phone])}
        ${party('Cliente', [q.client.name, q.client.email, q.client.phone])}
      </div>
      ${eventBand}
      <table style="width:100%;border-collapse:collapse;font-size:13.5px;margin-top:6px;">
        <thead><tr style="background:#111;color:#fff;">
          <th style="padding:8px 6px;text-align:left;font-size:11px;text-transform:uppercase;">Prestation</th>
          <th style="padding:8px 6px;text-align:center;font-size:11px;">Qté</th>
          <th style="padding:8px 6px;text-align:right;font-size:11px;">P.U.</th>
          <th style="padding:8px 6px;text-align:right;font-size:11px;">Total</th>
        </tr></thead>
        <tbody>${items}${travelRow}</tbody>
      </table>
      <div style="max-width:300px;margin-left:auto;margin-top:12px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#6B7280;padding:3px 0;">Total HT<b style="color:#111;">${escHtml(euros(t.subtotalCents))}</b></div>
        ${tvaRow}
        <div style="display:flex;justify-content:space-between;font-size:17px;font-weight:800;border-top:2px solid #E8547A;margin-top:6px;padding-top:8px;">Total TTC<span style="color:#C43A60;">${escHtml(euros(t.totalCents))}</span></div>
        ${depositRows}
      </div>
      ${terms}${notes}
      <div style="margin-top:20px;border-top:1px solid #E5E7EB;padding-top:12px;">
        <div style="font-weight:800;font-size:13px;">Bon pour accord</div>
        <div style="font-size:11px;color:#6B7280;">Date &amp; signature de la cliente</div>
        ${signed}
      </div>
    </div>`;
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
