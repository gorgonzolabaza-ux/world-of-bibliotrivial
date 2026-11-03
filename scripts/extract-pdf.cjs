const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href;

async function extract(url) {
  const data = new Uint8Array(fs.readFileSync(url));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  let full = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const strings = content.items.map(it => it.str);
    full += strings.join(' ') + '\n';
  }
  return full;
}

(async () => {
  const pairs = [
    ['content/oposiciones/normal/2024/examen1.pdf', 'content/oposiciones/normal/2024/examen1.txt'],
    ['content/oposiciones/normal/2024/respuestas1.pdf', 'content/oposiciones/normal/2024/respuestas1.txt'],
  ];
  for (const [src, dst] of pairs) {
    const t = await extract(src);
    fs.writeFileSync(dst, t, 'utf8');
    console.log('wrote', dst, t.length, 'chars');
  }
})();
