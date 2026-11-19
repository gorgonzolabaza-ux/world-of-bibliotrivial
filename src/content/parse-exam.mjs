/**
 * Parseo de exámenes de oposición: de texto plano (extraído de un PDF) a
 * preguntas con sus cuatro opciones, su respuesta correcta y su categoría.
 *
 * Este módulo es puro: no toca ficheros ni red, así que lo usa tanto el script
 * de línea de comandos (`scripts/ingest.mjs`) como la página de ingesta del
 * navegador (`src/ingest.ts`). Así las dos vías producen exactamente el mismo
 * resultado.
 */

/* ------------------------------------------------------------------ */
/* Taxonomía de categorías                                             */
/* ------------------------------------------------------------------ */

export const TAXONOMY = {
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
    'conservación', 'restauración', 'humedad', 'temperatura', 'depósito', 'kardex',
    'ordenación', 'digitalización', 'encuadernación', 'preservación', 'deterioro',
  ],
  servicios: [
    'préstamo', 'usuario', 'referencia', 'consulta', 'formación', 'alfabetización',
    'extensión', 'biblioteca pública', 'sala de lectura', 'acceso', 'atención', 'servicio',
    'interbibliotecario', 'carné', 'reserva', 'animación a la lectura', 'club de lectura',
    'usuarios', 'lector', 'divulgación', 'difusión', 'visita', 'taller',
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

export const CATEGORY_ORDER = Object.keys(TAXONOMY);

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
export function classify(text) {
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
/* Localización de preguntas                                           */
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

/**
 * Los números de página del PDF se pegan al final del texto del salto de página.
 * Se detectan porque van detrás de un signo de puntuación: "…musicales. 7".
 */
const PAGE_NUMBER_TAIL = /([.:;)])\s+\d{1,3}\s*$/;

function stripPageNumber(text) {
  return text.replace(PAGE_NUMBER_TAIL, '$1').trim();
}

/** Separa enunciado y las cuatro opciones a)…d) de un bloque. */
export function parseBlock(block) {
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
  questionText = questionText.replace(/^\d{1,3}\s*[.)]\s*/, '').trim();
  questionText = stripPageNumber(questionText);

  const options = marks.map((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : block.length;
    return stripPageNumber(block.slice(mark.start, end).replace(/\s+/g, ' '));
  });

  return { questionText, options };
}

export function parseQuestions(text) {
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
export function parseAnswerKey(text) {
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
export function detectCommonCount(text) {
  const flat = text.replace(/\s+/g, ' ');
  const m = flat.match(/(\d{1,3})\s+preguntas\s+de\s+["“']?materias\s+comunes/i);
  return m ? Number(m[1]) : 0;
}

/* ------------------------------------------------------------------ */
/* Ensamblado                                                          */
/* ------------------------------------------------------------------ */

/**
 * Convierte el texto del examen y el de la plantilla en el JSON que consume el
 * juego. Es el único punto donde se decide el id, la dificultad y la categoría
 * de cada pregunta, para que CLI y web no puedan divergir.
 *
 * @param {object} input
 * @param {string} input.examText
 * @param {string} [input.answersText]
 * @param {string} input.id           identificador de la fuente, p. ej. "examen1-2022"
 * @param {string} input.difficulty   "normal" | "hard"
 * @param {number|null} [input.year]
 * @param {number} [input.commonCount] si se omite se detecta en la cabecera
 * @param {Record<string,string>} [input.overrides] número de pregunta → categoría
 */
export function buildQuestions(input) {
  const { examText, answersText = '', id, difficulty, year = null, overrides = {} } = input;
  const answerKey = answersText ? parseAnswerKey(answersText) : new Map();
  const { parsed, rejected, starts } = parseQuestions(examText);
  const commonCount = input.commonCount !== undefined && input.commonCount !== null
    ? Number(input.commonCount)
    : detectCommonCount(examText);

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
      id: `${id}-${item.num}`,
      text: item.questionText,
      options: item.options,
      answerIndex: answerKey.get(item.num),
      category,
      difficulty,
      source: id,
      number: item.num,
    });
  }

  const counts = {};
  for (const question of questions) counts[question.category] = (counts[question.category] ?? 0) + 1;
  const answers = questions.map((q) => q.answerIndex);
  const distribution = [0, 1, 2, 3].map((i) => answers.filter((a) => a === i).length);

  return {
    id,
    title: id,
    difficulty,
    year,
    questions: questions.map(({ number, ...rest }) => rest),
    stats: {
      starts,
      parsed: parsed.length,
      rejected,
      skipped,
      weak,
      commonCount,
      counts,
      distribution,
      total: questions.length,
    },
  };
}

/** Entrada del manifest que corresponde a un examen ingerido. */
export function manifestEntry({ id, difficulty, year }) {
  return {
    id,
    difficulty,
    ...(year ? { year } : {}),
    format: 'json',
    exam: `content/questions/${id}.json`,
  };
}
