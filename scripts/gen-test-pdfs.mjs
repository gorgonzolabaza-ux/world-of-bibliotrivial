import fs from 'node:fs';
import path from 'node:path';

function pdfWithLines(lines) {
  const content = lines.map((l, i) => `BT /F1 12 Tf 50 ${750 - i * 18} Td (${l.replace(/[()\\]/g, '\\$&')}) Tj ET`).join('\n');
  const stream = `BT\n${content}\nET`;
  // build objects
  const objs = [];
  objs.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  objs.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  objs.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj');
  const streamObj = `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`;
  objs.push(streamObj);
  objs.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (const o of objs) {
    offsets.push(pdf.length);
    pdf += o + '\n';
  }
  const xrefPos = pdf.length;
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  for (const off of offsets) pdf += String(off).padStart(10, '0') + ' 00000 n \n';
  pdf += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF\n';
  return pdf;
}

const examLines = [
  '1. Que ley regula el sistema bibliotecario?',
  'A) Ley 10/2007',
  'B) Ley 14/2011',
  'C) Ley 16/1985',
  'D) Ley 34/2002',
  '2. La CDU es un sistema de:',
  'A) Clasificacion',
  'B) Catalogacion',
  'C) Indexacion',
  'D) Conservacion',
];
const answerLines = [
  '1. A',
  '2. A',
];

const dir = path.resolve('content/oposiciones/normal/2024');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'examen.pdf'), pdfWithLines(examLines));
fs.writeFileSync(path.join(dir, 'respuestas.pdf'), pdfWithLines(answerLines));
console.log('PDFs creados');
