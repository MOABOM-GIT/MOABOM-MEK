import type { CpapMeasurementResult } from './cpapMeasurement';

type CpapPdfLabels = {
  title: string;
  mask: string;
  confidence: string;
  scanData: string;
  reasons: string;
  tips: string;
  scannedAt: string;
  measurementRows: { label: string; value: string }[];
};

export function printCpapResultPdf(
  result: CpapMeasurementResult,
  labels: CpapPdfLabels,
): void {
  const measurementRows = labels.measurementRows
    .map(row => `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.value)}</td></tr>`)
    .join('');

  const reasons = result.recommendation.reasons?.map(r => `<li>${escapeHtml(r)}</li>`).join('') ?? '';
  const tips = result.recommendation.tips?.map(tip => `<li>${escapeHtml(tip)}</li>`).join('') ?? '';

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(labels.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 24px; color: #0f172a; }
    h1 { font-size: 1.25rem; margin: 0 0 8px; }
    h2 { font-size: 1rem; margin: 20px 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    td { border-bottom: 1px solid #e2e8f0; padding: 6px 4px; }
    ul { margin: 0; padding-left: 1.2rem; }
  </style>
</head>
<body>
  <h1>${escapeHtml(labels.title)}</h1>
  <p><strong>${escapeHtml(labels.mask)}:</strong> ${escapeHtml(result.recommendation.name)}</p>
  <p>${escapeHtml(labels.confidence)}: ${result.recommendation.confidence}%</p>
  <p style="color:#64748b;font-size:0.85rem">${escapeHtml(labels.scannedAt)}: ${new Date().toLocaleString()}</p>
  <h2>${escapeHtml(labels.scanData)}</h2>
  <table>${measurementRows}</table>
  ${reasons ? `<h2>${escapeHtml(labels.reasons)}</h2><ul>${reasons}</ul>` : ''}
  ${tips ? `<h2>${escapeHtml(labels.tips)}</h2><ul>${tips}</ul>` : ''}
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900');
  if (!printWindow) {
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
