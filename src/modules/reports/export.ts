import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { formatCurrencyAmount } from '../../constants/currencies';
import { ReportColumn, ReportTableResult } from './types';

function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCellValue(value: unknown, col: ReportColumn, currency: string): string {
  if (value === null || value === undefined) return '';
  if (col.isCurrency && typeof value === 'number') {
    return formatCurrencyAmount(value, currency);
  }
  return String(value);
}

export function buildCsvBuffer(report: ReportTableResult): Buffer {
  const headerLine = report.columns.map((c) => escapeCsvCell(c.header)).join(',');
  const dataLines = report.rows.map((row) =>
    report.columns
      .map((col) => escapeCsvCell(formatCellValue(row[col.key], col, report.currency)))
      .join(',')
  );

  const csvContent = [headerLine, ...dataLines].join('\n');
  return Buffer.from(csvContent, 'utf-8');
}

export async function buildExcelBuffer(report: ReportTableResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Restaurant Management System ERP';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(report.title.slice(0, 31));

  // Metadata rows
  sheet.addRow([report.title]);
  sheet.addRow([
    `Period: ${report.period.startDate.slice(0, 10)} to ${report.period.endDate.slice(0, 10)}`,
    `Currency: ${report.currency} (${report.currencySymbol})`,
    `Generated: ${report.generatedAt}`,
  ]);
  sheet.addRow([]);

  // Header row
  const headerRow = sheet.addRow(report.columns.map((c) => c.header));
  headerRow.font = { bold: true };

  // Data rows
  for (const row of report.rows) {
    sheet.addRow(
      report.columns.map((col) => {
        const val = row[col.key];
        if (col.isCurrency && typeof val === 'number') {
          return Number(val.toFixed(2));
        }
        return val ?? '';
      })
    );
  }

  sheet.columns.forEach((column) => {
    column.width = 20;
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function buildPdfBuffer(report: ReportTableResult): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text(report.title, { align: 'left' });
    doc.moveDown(0.3);
    doc
      .fontSize(9)
      .fillColor('#555555')
      .text(
        `Period: ${report.period.startDate.slice(0, 10)} to ${report.period.endDate.slice(0, 10)} | Currency: ${report.currency} (${report.currencySymbol}) | Generated: ${report.generatedAt}`
      );
    doc.moveDown(0.8);

    // Summary block
    doc.fillColor('#000000').fontSize(11).text('Summary', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(9);
    for (const [key, val] of Object.entries(report.summary)) {
      doc.text(`${key}: ${typeof val === 'object' ? JSON.stringify(val) : String(val)}`);
    }
    doc.moveDown(0.8);

    // Rows (formatted neatly per line to fit narrow column layouts cleanly)
    doc.fontSize(11).text(`Records (${report.rows.length})`, { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(8.5);

    const maxRows = report.rows.slice(0, 150);
    for (const row of maxRows) {
      const line = report.columns
        .map((col) => `${col.header}: ${formatCellValue(row[col.key], col, report.currency)}`)
        .join('  |  ');
      doc.text(line);
      doc.moveDown(0.2);
    }

    if (report.rows.length > 150) {
      doc.moveDown(0.4).text(`... truncated ${report.rows.length - 150} additional rows. Use CSV/Excel for full export.`);
    }

    doc.end();
  });
}

