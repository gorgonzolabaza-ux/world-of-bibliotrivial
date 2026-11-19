/**
 * Ingesta de exámenes desde la línea de comandos.
 *
 * El parseo vive en `src/content/parse-exam.mjs`, compartido con la página de
 * ingesta del navegador. Aquí solo queda lo que necesita Node: leer los PDF,
 * los argumentos y escribir los ficheros.
 *
 *   node scripts/ingest.mjs --exam <pdf|txt> [--answers <pdf|txt>] [--id <id>]
 *                           [--difficulty normal|hard] [--year <aaaa>]
 *                           [--common <n>] [--overrides <json>]
 *                           [--register] [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { buildQuestions, manifestEntry } from '../src/content/parse-exam.mjs';

const ROOT = process.cwd();
const QUESTIONS_DIR = path.join(ROOT, 'content', 'questions');
const MANIFEST_PATH = path.join(ROOT, 'content', 'manifest.json');
const require = createRequire(import.meta.url);

/* Extracción de texto                                              */

async function extractPdfText(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ).href;
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, verbosity: 0 }).promise;
  let out = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    out += content.items.map((item) => item.str).join(' ') + '\n';
  }
  return out;
}

async function readText(file) {
  return file.toLowerCase().endsWith('.pdf') ? extractPdfText(file) : fs.readFileSync(file, 'utf8');
}

/* Argumentos                                                       */

function parseArgs(argv) {
  const args = { difficulty: 'normal', register: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const next = () => argv[++i];
    switch (token) {
      case '--exam': args.exam = next(); break;
      case '--answers': args.answers = next(); break;
      case '--id': args.id = next(); break;
      case '--difficulty': args.difficulty = next(); break;
      case '--year': args.year = Number(next()); break;
      case '--common': args.common = Number(next()); break;
      case '--overrides': args.overrides = next(); break;
      case '--register': args.register = true; break;
      case '--dry-run': args.dryRun = true; break;
      case '--help': case '-h': args.help = true; break;
      default:
        if (token.startsWith('--')) throw new Error(`Opción desconocida: ${token}`);
    }
  }
  return args;
}

function usage() {
  console.log(`
Ingesta de exámenes para World of BiblioTrivial

  node scripts/ingest.mjs --exam <pdf|txt> [--answers <pdf|txt>] [--id <id>]
                          [--difficulty normal|hard] [--year <aaaa>]
                          [--register] [--dry-run]

Ejemplo:
  node scripts/ingest.mjs \\
    --exam content/oposiciones/normal/2024/examen1.pdf \\
    --answers content/oposiciones/normal/2024/respuestas1.pdf \\
    --id examen1-2022 --year 2022 --register
`);
}

/* Main                                                             */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.exam) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const id = args.id ?? path.basename(args.exam, path.extname(args.exam));
  const examText = await readText(args.exam);
  const answersText = args.answers ? await readText(args.answers) : '';
  const overrides = args.overrides ? JSON.parse(fs.readFileSync(args.overrides, 'utf8')) : {};

  const result = buildQuestions({
    examText,
    answersText,
    id,
    difficulty: args.difficulty,
    year: args.year ?? null,
    commonCount: args.common,
    overrides,
  });
  const { stats } = result;

  console.log(`\nExamen: ${args.exam}`);
  console.log(`Bloques numerados encontrados: ${stats.starts}`);
  console.log(`Preguntas con cuatro opciones: ${stats.parsed}`);
  console.log(`Descartadas por formato: ${stats.rejected.length}`);
  console.log(`Sin respuesta (anuladas): ${stats.skipped.length}`);
  console.log(`Preguntas finales: ${stats.total}`);
  if (stats.commonCount) {
    console.log(`Primeras ${stats.commonCount} preguntas: materias comunes → legislación`);
  }

  if (stats.rejected.length) {
    console.log('\nDescartadas:');
    for (const item of stats.rejected) console.log(`  ${item.num}: ${item.reason}`);
  }
  if (stats.skipped.length) {
    console.log('\nSin respuesta:');
    for (const item of stats.skipped) console.log(`  ${item.num}: ${item.reason}`);
  }

  const total = stats.total || 1;
  console.log('\nReparto por categoría:');
  for (const [category, count] of Object.entries(stats.counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${category.padEnd(14)} ${String(count).padStart(3)}  ${((count / total) * 100).toFixed(0)}%`);
  }
  if (stats.weak.length) {
    console.log(`\nClasificación poco fiable (${stats.weak.length}) — revisar:`);
    for (const item of stats.weak) {
      const question = result.questions.find((q) => q.id.endsWith(`-${item.num}`));
      console.log(`  ${String(item.num).padStart(3)}  ${item.category.padEnd(13)} ${question.text.slice(0, 74)}`);
    }
  }

  console.log(`\nReparto de respuestas A/B/C/D: ${stats.distribution.join(' / ')}`);

  if (args.dryRun) {
    console.log('\n(--dry-run: no se ha escrito nada)');
    return;
  }

  const outFile = path.join(QUESTIONS_DIR, `${id}.json`);
  fs.mkdirSync(QUESTIONS_DIR, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(`\nEscrito ${path.relative(ROOT, outFile)} (${stats.total} preguntas)`);

  if (args.register) {
    const manifest = fs.existsSync(MANIFEST_PATH)
      ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
      : { version: 1, sources: [] };
    const source = manifestEntry({ id, difficulty: args.difficulty, year: args.year });
    const index = manifest.sources.findIndex((s) => s.id === id);
    if (index >= 0) manifest.sources[index] = source;
    else manifest.sources.push(source);
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`Registrado en content/manifest.json como "${id}"`);
  }
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
