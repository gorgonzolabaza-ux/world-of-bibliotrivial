#!/usr/bin/env node
/**
 * Ingesta privada de exámenes en PDF.
 *
 *   node scripts/ingest.mjs --exam content/oposiciones/normal/2024/examen1.pdf \
 *                           --answers content/oposiciones/normal/2024/respuestas1.pdf \
 *                           --id examen1-2022 --difficulty normal --year 2022 --register
 *
 * Extrae el texto, separa las preguntas y sus cuatro opciones, cruza la plantilla
 * de respuestas, clasifica por categoría, valida y escribe content/questions/<id>.json.
 * Los PDF nunca se publican: al desplegar solo viaja el JSON resultante.
 *
 * Opciones:
 *   --exam <pdf|txt>        examen (obligatorio)
 *   --answers <pdf|txt>     plantilla de respuestas (opcional; sin ella no hay solución)
 *   --id <id>               identificador de la fuente (por defecto, el nombre del examen)
 *   --difficulty normal|hard
 *   --year <aaaa>
 *   --register              añade/actualiza la fuente en content/manifest.json
 *   --dry-run               analiza y resume, sin escribir nada
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const QUESTIONS_DIR = path.join(ROOT, 'content', 'questions');
const MANIFEST_PATH = path.join(ROOT, 'content', 'manifest.json');
const require = createRequire(import.meta.url);

/* ------------------------------------------------------------------ */
/* Taxonomía: las seis categorías del tablero                          */
/* ------------------------------------------------------------------ */

const TAXONOMY = {
  legislacion: [
    'constitución', 'estatuto de autonomía', 'estatuto', 'ley orgánica', 'ley', 'real decreto',
    'decreto legislativo', 'decreto', 'orden', 'reglamento', 'disposición', 'artículo',
    'administración', 'gobierno', 'comunidad autónoma', 'comunidad de castilla y león',
    'competencia', 'procedimiento administrativo', 'transparencia', 'protección de datos',
    'función pública', 'convenio', 'sindicato', 'recurso', 'derecho', 'jurídico', 'normativa',
    'cortes', 'diputación', 'municipio', 'provincia', 'defensor del pueblo', 'tribunal',
  ],
  procesos: [
    'catalogación', 'clasificación', 'clasificación decimal', 'cdu', 'dewey', 'marc', 'marc21',
    'metadatos', 'encabezamiento', 'tesauro', 'isbd', 'rda', 'signatura', 'expurgo',
    'indización', 'índice', 'registro bibliográfico', 'descripción bibliográfica',
    'punto de acceso', 'autoridad', 'formato', 'norma iso', 'iso', 'proceso técnico',
    'sellado', 'tejuelo', 'catalogar', 'recuperación de la información',
    // el bloque de documentación se agrupa aquí
    'conservación', 'restauración', 'humedad', 'temperatura', 'depósito', 'kardex',
    'ordenación', 'digitalización', 'encuadernación', 'preservación', 'deterioro',
  ],
  servicios: [
    'préstamo', 'usuario', 'referencia', 'consulta', 'formación', 'alfabetización',
    'extensión', 'biblioteca pública', 'sala de lectura', 'acceso', 'atención', 'servicio',
    'interbibliotecario', 'carné', 'reserva', 'animación a la lectura', 'club de lectura',
    'usuarios', 'lector', 'divulgación', 'difusión', 'visita', 'taller',
    // tipología de bibliotecas
    'biblioteca nacional', 'biblioteca universitaria', 'biblioteca especializada',
    'biblioteca escolar', 'red de bibliotecas', 'tipología', 'horario',
  ],
  gestion: [
    'gestión', 'presupuesto', 'planificación', 'calidad', 'evaluación', 'indicador',
    'personal', 'organización', 'estadística', 'recursos humanos', 'organigrama',
    'dirección', 'estrategia', 'efqm', 'plan estratégico', 'gestión de calidad',
    'productividad', 'coste', 'contratación', 'selección de personal', 'formación del personal',
    'desiderata', 'adquisición', 'compra', 'proveedor', 'suscripción', 'marketing',
    'coordinación', 'equipo', 'liderazgo', 'iso 9001', 'carta de servicios', 'gestión de la colección',
  ],
  bibliografia: [
    'bibliografía', 'isbn', 'issn', 'depósito legal', 'patrimonio', 'incunable', 'imprenta',
    'libro antiguo', 'edición', 'catálogo colectivo', 'repertorio', 'fuentes', 'historia',
    'archivo', 'museo', 'manuscrito', 'encuadernación', 'exlibris', 'bibliófilo',
    'obras de referencia', 'biblioteca nacional', 'patrimonio bibliográfico', 'siglo',
    // historia del libro y publicaciones
    'publicación', 'publicaciones periódicas', 'seriada', 'monografía', 'bestiario',
    'libro', 'editorial', 'autor', 'obra',
  ],
  tecnologias: [
    'opac', 'sigb', 'automatización', 'sistema integrado', 'software', 'hardware', 'internet',
    'web', 'digital', 'digitalización', 'repositorio', 'base de datos', 'formato electrónico',
    'inteligencia artificial', 'rss', 'api', 'aplicación', 'programa', 'red', 'servidor',
    'metadatos', 'acceso remoto', 'ebook', 'dispositivo', 'tecnología', 'informática',
  ],
};

const CATEGORY_ORDER = Object.keys(TAXONOMY);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Cada palabra clave se busca como palabra completa, no como trozo de otra. */
const KEYWORD_PATTERNS = CATEGORY_ORDER.map((category) => ({
  category,
  patterns: TAXONOMY[category].map((keyword) => ({
    regex: new RegExp(`(?<![\\p{L}])${escapeRegExp(keyword)}(?![\\p{L}])`, 'gu'),
    weight: keyword.includes(' ') ? 3 : keyword.length >= 10 ? 2 : 1,
  })),
}));

/** Puntúa un texto contra la taxonomía; cada palabra pesa según lo específica que sea. */
function classify(text) {
  const lower = text.toLowerCase().replace(/\s+/g, ' ');
  const scores = {};
  for (const { category, patterns } of KEYWORD_PATTERNS) {
    let score = 0;
    for (const { regex, weight } of patterns) {
      regex.lastIndex = 0;
      if (regex.test(lower)) score += weight;
    }
    scores[category] = score;
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [best, second] = ranked;
  return { category: best[0], score: best[1], margin: best[1] - second[1], scores };
}

/* ------------------------------------------------------------------ */
/* Extracción de texto                                                 */
/* ------------------------------------------------------------------ */

async function extractPdfText(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ).href;
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
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

/* ------------------------------------------------------------------ */
/* Parseo                                                              */
/* ------------------------------------------------------------------ */

const LOOKS_LIKE_START = '[A-ZÁÉÍÓÚÜÑÇ¿¡«"“]';

/**
 * Busca el inicio de la pregunta `num` a partir de `from`.
 * Se busca un número concreto y en orden, así que un "Artículo 44." dentro de una
 * opción nunca se confunde con la pregunta 44: cuando toca el 44, esas opciones
 * ya se han consumido. El lookahead exige que empiece por mayúscula o ¿ para no
 * enganchar referencias tipo "artículo 15. de la ley".
 */
function findQuestionStart(text, num, from) {
  const re = new RegExp(`(?:^|\\s)${num}\\s*[.)]\\s*(?=${LOOKS_LIKE_START})`, 'g');
  re.lastIndex = from;
  const m = re.exec(text);
  if (!m) return null;
  return { index: m.index, contentStart: m.index + m[0].length };
}

function collectStarts(text, max = 400) {
  const starts = [];
  let cursor = 0;
  for (let num = 1; num <= max; num++) {
    const start = findQuestionStart(text, num, cursor);
    if (!start) break;
    starts.push({ num, ...start });
    cursor = start.contentStart;
  }
  return starts;
}

/** Separa enunciado y las cuatro opciones a)…d) de un bloque. */
function parseBlock(block) {
  const re = /(?:^|\s)([a-dA-D])[).]\s+/g;
  const marks = [];
  let cursor = 0;
  for (const letter of ['a', 'b', 'c', 'd']) {
    re.lastIndex = cursor;
    let found = null;
    let m;
    while ((m = re.exec(block))) {
      if (m[1].toLowerCase() === letter) {
        found = m;
        break;
      }
    }
    if (!found) return null;
    marks.push({ start: found.index + found[0].length, index: found.index });
    cursor = found.index + found[0].length;
  }

  let questionText = block.slice(0, marks[0].index).replace(/\s+/g, ' ').trim();
  // el número de página o de pregunta que se cuela delante del enunciado
  questionText = questionText.replace(/^\d{1,3}\s*[.)]\s*/, '').trim();

  const options = marks.map((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : block.length;
    return block.slice(mark.start, end).replace(/\s+/g, ' ').trim();
  });
  // la última opción se corta donde empieza el bloque siguiente; por si acaso,
  // se recorta un posible arranque de la pregunta siguiente pegado al final
  options[3] = options[3].replace(/\s+\d{1,3}\s*[.)]\s*$/, '').trim();

  return { questionText, options };
}

function parseQuestions(text) {
  const starts = collectStarts(text);
  const parsed = [];
  const rejected = [];

  for (let i = 0; i < starts.length; i++) {
    const from = starts[i].contentStart;
    const to = i + 1 < starts.length ? starts[i + 1].index : Math.min(text.length, from + 1200);
    const block = text.slice(from, to);
    const result = parseBlock(block);
    if (!result) {
      rejected.push({ num: starts[i].num, reason: 'no se encontraron las cuatro opciones' });
      continue;
    }
    if (result.questionText.length < 6) {
      rejected.push({ num: starts[i].num, reason: 'enunciado demasiado corto' });
      continue;
    }
    if (result.options.some((option) => option.length < 1)) {
      rejected.push({ num: starts[i].num, reason: 'alguna opción está vacía' });
      continue;
    }
    parsed.push({ num: starts[i].num, ...result });
  }

  return { parsed, rejected, starts: starts.length };
}

/** Plantilla de respuestas: "1 B 34 C 67 A 2 C …" (aunque venga en tres columnas). */
function parseAnswerKey(text) {
  const flat = text.replace(/\s+/g, ' ');
  const map = new Map();
  const re = /\b(\d{1,3})\s+([A-D])\b/g;
  let m;
  while ((m = re.exec(flat))) {
    const num = Number(m[1]);
    const index = 'ABCD'.indexOf(m[2]);
    if (!map.has(num)) map.set(num, index);
  }
  return map;
}

/**
 * Muchas convocatorias dicen en la cabecera cuántas preguntas son de "materias
 * comunes". Esas van siempre a legislación, así que no hace falta adivinarlas.
 */
function detectCommonCount(text) {
  const flat = text.replace(/\s+/g, ' ');
  const m = flat.match(/(\d{1,3})\s+preguntas\s+de\s+["“']?materias\s+comunes/i);
  return m ? Number(m[1]) : 0;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.exam) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const examText = await readText(args.exam);
  const answerKey = args.answers ? parseAnswerKey(await readText(args.answers)) : new Map();
  const { parsed, rejected, starts } = parseQuestions(examText);
  const commonCount = args.common !== undefined ? args.common : detectCommonCount(examText);
  const overrides = args.overrides
    ? JSON.parse(fs.readFileSync(args.overrides, 'utf8'))
    : {};

  const questions = [];
  const skipped = [];
  const weak = [];

  for (const item of parsed) {
    if (!answerKey.has(item.num)) {
      skipped.push({ num: item.num, reason: 'sin respuesta en la plantilla (¿anulada?)' });
      continue;
    }
    const haystack = `${item.questionText} ${item.options.join(' ')}`;
    let category;
    let score = 99;
    let margin = 99;
    if (overrides[String(item.num)]) {
      category = overrides[String(item.num)];
    } else if (commonCount && item.num <= commonCount) {
      category = 'legislacion';
    } else {
      ({ category, score, margin } = classify(haystack));
      if (score === 0 || margin === 0) weak.push({ num: item.num, category, score });
    }
    questions.push({
      id: `${args.id ?? path.basename(args.exam, path.extname(args.exam))}-${item.num}`,
      text: item.questionText,
      options: item.options,
      answerIndex: answerKey.get(item.num),
      category,
      difficulty: args.difficulty,
      source: args.id ?? path.basename(args.exam, path.extname(args.exam)),
      number: item.num,
    });
  }

  /* resumen */
  console.log(`\nExamen: ${args.exam}`);
  console.log(`Bloques numerados encontrados: ${starts}`);
  console.log(`Preguntas con cuatro opciones: ${parsed.length}`);
  console.log(`Descartadas por formato: ${rejected.length}`);
  console.log(`Sin respuesta (anuladas): ${skipped.length}`);
  console.log(`Preguntas finales: ${questions.length}`);
  if (commonCount) console.log(`Primeras ${commonCount} preguntas: materias comunes → legislación`);

  if (rejected.length) {
    console.log('\nDescartadas:');
    for (const item of rejected) console.log(`  ${item.num}: ${item.reason}`);
  }
  if (skipped.length) {
    console.log('\nSin respuesta:');
    for (const item of skipped) console.log(`  ${item.num}: ${item.reason}`);
  }

  const counts = {};
  for (const question of questions) counts[question.category] = (counts[question.category] ?? 0) + 1;
  const total = questions.length || 1;
  console.log('\nReparto por categoría:');
  for (const [category, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${category.padEnd(14)} ${String(count).padStart(3)}  ${((count / total) * 100).toFixed(0)}%`);
  }
  if (weak.length) {
    console.log(`\nClasificación poco fiable (${weak.length}) — revisar:`);
    for (const item of weak) {
      const question = questions.find((q) => q.number === item.num);
      console.log(`  ${String(item.num).padStart(3)}  ${item.category.padEnd(13)} ${question.text.slice(0, 74)}`);
    }
  }

  const answers = questions.map((q) => q.answerIndex);
  const distribution = [0, 1, 2, 3].map((i) => answers.filter((a) => a === i).length);
  console.log(`\nReparto de respuestas A/B/C/D: ${distribution.join(' / ')}`);

  if (args.dryRun) {
    console.log('\n(--dry-run: no se ha escrito nada)');
    return;
  }

  const id = args.id ?? path.basename(args.exam, path.extname(args.exam));
  const outFile = path.join(QUESTIONS_DIR, `${id}.json`);
  fs.mkdirSync(QUESTIONS_DIR, { recursive: true });
  // se quita `number` del JSON publicado: solo sirve para revisar la ingesta
  const payload = {
    id,
    title: path.basename(args.exam, path.extname(args.exam)),
    difficulty: args.difficulty,
    year: args.year ?? null,
    questions: questions.map(({ number, ...rest }) => rest),
  };
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`\nEscrito ${path.relative(ROOT, outFile)} (${questions.length} preguntas)`);

  if (args.register) {
    const manifest = fs.existsSync(MANIFEST_PATH)
      ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
      : { version: 1, sources: [] };
    const source = {
      id,
      difficulty: args.difficulty,
      ...(args.year ? { year: args.year } : {}),
      format: 'json',
      exam: `content/questions/${id}.json`,
    };
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
