import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { COMPANY_INFO } from './companyInfo';
import type { LigneFacture } from '@/types';

const fmtNum = (n: number) =>
  new Intl.NumberFormat('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

export interface FacturePDFData {
  numero_facture: string;
  date_facture: string;
  date_echeance?: string;
  client_nom: string;
  client_adresse?: string | null;
  client_telephone?: string | null;
  projet_nom?: string | null;
  lignes: LigneFacture[];
  sous_total: number;
  tps: number;
  tvq: number;
  total_ttc: number;
  use_tvh?: boolean; // Ontario: TPS/TVH 13% instead of TPS+TVQ
}

export function generateFacturePDF(data: FacturePDFData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const rightCol = 120;

  // ── Header: Company info (left) + Invoice number (right) ──

  // Company name
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY_INFO.nom, 14, 20);

  // Invoice number (right side)
  doc.setFontSize(16);
  doc.text('FACTURE', rightCol, 15);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Facture n\u00b0  ${data.numero_facture}`, rightCol, 22);

  // Company address block
  doc.setFontSize(9);
  doc.text(COMPANY_INFO.adresse, 14, 28);
  doc.text(COMPANY_INFO.ville, 14, 33);
  doc.text(COMPANY_INFO.codePostal, 14, 38);
  doc.text(COMPANY_INFO.telephone, 14, 43);
  doc.text(COMPANY_INFO.email, 14, 51);

  // Right side: date, client, project
  let ry = 32;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Date de la facture :', rightCol, ry);
  doc.setFont('helvetica', 'normal');
  doc.text(fmtDate(data.date_facture), rightCol + 42, ry);
  ry += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Facturer \u00e0 :', rightCol, ry);
  doc.setFont('helvetica', 'normal');
  doc.text(data.client_nom, rightCol + 42, ry);
  ry += 5;

  if (data.client_adresse) {
    const addrLines = data.client_adresse.split('\n');
    for (const line of addrLines) {
      doc.text(line.trim(), rightCol + 42, ry);
      ry += 4.5;
    }
  }

  if (data.client_telephone) {
    doc.text(data.client_telephone, rightCol + 42, ry);
    ry += 5;
  }

  if (data.projet_nom) {
    doc.setFont('helvetica', 'bold');
    doc.text('Projet', rightCol, ry);
    doc.setFont('helvetica', 'normal');
    doc.text(data.projet_nom, rightCol + 42, ry);
    ry += 5;
  }

  if (data.date_echeance) {
    doc.setFont('helvetica', 'bold');
    doc.text('\u00c9ch\u00e9ance :', rightCol, ry);
    doc.setFont('helvetica', 'normal');
    doc.text(fmtDate(data.date_echeance), rightCol + 42, ry);
  }

  // ── Line items table ──

  const startY = Math.max(ry + 10, 68);

  const tableBody: (string | { content: string; styles?: Record<string, unknown> })[][] = [];

  for (const ligne of data.lignes) {
    if (ligne.isHeader) {
      tableBody.push([
        { content: ligne.description, styles: { fontStyle: 'bold' } },
        '',
        '',
        '',
      ]);
    } else {
      tableBody.push([
        ligne.description,
        ligne.unite != null ? String(ligne.unite) : '',
        ligne.cout_unitaire != null ? fmtNum(ligne.cout_unitaire) : '',
        fmtNum(ligne.montant),
      ]);
    }
  }

  autoTable(doc, {
    startY,
    head: [['Description', 'Unit\u00e9', 'Co\u00fbt unitaire', 'Montant']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [51, 51, 51],
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8.5,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { cellWidth: 95 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 32, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // ── Totals section ──

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || startY + 40;
  let ty = finalY + 8;
  const labelX = rightCol + 8;
  const valX = pageWidth - 16;

  doc.setFontSize(9);

  // Sous-total
  doc.setFont('helvetica', 'normal');
  doc.text('Sous-total', labelX, ty);
  doc.text(fmtNum(data.sous_total), valX, ty, { align: 'right' });
  ty += 6;

  // TPS line with registration number
  doc.setFontSize(8);
  doc.text(`# ${COMPANY_INFO.tps}`, 14, ty);
  doc.setFontSize(9);
  if (data.use_tvh) {
    doc.text('TPS/TVH (13%)', labelX, ty);
  } else {
    doc.text('TPS (5%)', labelX, ty);
  }
  doc.text(fmtNum(data.tps), valX, ty, { align: 'right' });
  ty += 6;

  // TVQ line with registration number (only if not TVH)
  if (!data.use_tvh) {
    doc.setFontSize(8);
    doc.text(COMPANY_INFO.tvq, 14, ty);
    doc.setFontSize(9);
    doc.text('TVQ (9,975%)', labelX, ty);
    doc.text(fmtNum(data.tvq), valX, ty, { align: 'right' });
    ty += 8;
  } else {
    ty += 2;
  }

  // Separator line
  doc.setDrawColor(51, 51, 51);
  doc.setLineWidth(0.5);
  doc.line(labelX, ty - 2, valX, ty - 2);

  // Total
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(COMPANY_INFO.conditions, 14, ty + 2);
  doc.text('Total', labelX, ty + 2);
  doc.text(fmtNum(data.total_ttc) + ' $', valX, ty + 2, { align: 'right' });

  return doc;
}
