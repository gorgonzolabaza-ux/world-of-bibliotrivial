/**
 * POST /api/ingest
 *
 * Recibe el examen ya parseado en el navegador, lo valida y lo publica en el
 * almacén del que lee el juego. La contraseña se comprueba aquí, en servidor,
 * contra la variable de entorno INGEST_PASSWORD.
 *
 * El PDF no llega nunca aquí: el parseo ocurre en el navegador del
 * administrador, así que los exámenes no salen de su equipo.
 */

import { del } from '@vercel/blob';
import {
  CATEGORY_KEYS,
  VALID_SLUG,
  noteFailure,
  passwordOk,
  readManifest,
  resetAttempts,
  send,
  tooManyAttempts,
  writeJson,
  writeManifest,
} from './_lib.js';
import type { ApiRequest, ApiResponse } from './_lib.js';

const MAX_QUESTIONS = 400;
const VALID_CATEGORIES = new Set<string>(CATEGORY_KEYS);

interface IncomingQuestion {
  id?: unknown;
  text?: unknown;
  options?: unknown;
  answerIndex?: unknown;
  category?: unknown;
}

interface IncomingPayload {
  id?: unknown;
  title?: unknown;
  difficulty?: unknown;
  year?: unknown;
  questions?: unknown;
}

interface IncomingBody {
  password?: unknown;
  payload?: IncomingPayload;
  dryRun?: boolean;
}

function clientIp(req: ApiRequest): string {
  const header = req.headers['x-forwarded-for'];
  const value = Array.isArray(header) ? header[0] : header;
  return (value ?? 'desconocida').split(',')[0].trim();
}

/** Deja el examen en la forma exacta que espera el juego. */
function sanitize(payload: IncomingPayload, fallbackId: string) {
  const id = String(payload.id ?? fallbackId).trim().toLowerCase();
  const difficulty = payload.difficulty === 'hard' ? 'hard' : 'normal';
  const year = Number.isFinite(Number(payload.year)) && Number(payload.year) > 1900 ? Number(payload.year) : null;
  const title = String(payload.title ?? id).slice(0, 120);

  if (!VALID_SLUG.test(id)) {
    throw new Error('El identificador solo admite minúsculas, números y guiones (2–49 caracteres).');
  }

  const raw = Array.isArray(payload.questions) ? payload.questions : [];
  if (raw.length === 0) throw new Error('No hay preguntas que publicar.');
  if (raw.length > MAX_QUESTIONS) throw new Error(`Demasiadas preguntas (máximo ${MAX_QUESTIONS}).`);

  const questions = raw.map((item: IncomingQuestion, index: number) => {
    const text = String(item.text ?? '').replace(/\s+/g, ' ').trim();
    const options = Array.isArray(item.options) ? item.options.map((o) => String(o).trim()) : [];
    const answerIndex = Number(item.answerIndex);
    const category = String(item.category ?? '');

    if (text.length < 5) throw new Error(`Pregunta ${index + 1}: enunciado demasiado corto.`);
    if (options.length !== 4 || options.some((option) => option.length === 0)) {
      throw new Error(`Pregunta ${index + 1}: debe tener cuatro opciones no vacías.`);
    }
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
      throw new Error(`Pregunta ${index + 1}: respuesta correcta fuera de rango.`);
    }
    if (!VALID_CATEGORIES.has(category)) {
      throw new Error(`Pregunta ${index + 1}: categoría desconocida "${category}".`);
    }

    return {
      id: String(item.id ?? `${id}-${index + 1}`).slice(0, 80),
      text: text.slice(0, 600),
      options: options.map((option) => option.slice(0, 400)),
      answerIndex,
      category,
      difficulty,
      source: id,
    };
  });

  return {
    id,
    title,
    difficulty,
    year,
    questions,
  };
}

/**
 * DELETE /api/ingest?id=<examen> — retira un examen publicado.
 * La contraseña va en la cabecera `x-ingest-password`.
 */
async function remove(req: ApiRequest, res: ApiResponse) {
  const header = req.headers['x-ingest-password'];
  const given = Array.isArray(header) ? header[0] : header;
  if (!passwordOk(given)) return send(res, 401, { error: 'Contraseña incorrecta.' });

  const raw = req.query.id;
  const id = String(Array.isArray(raw) ? raw[0] : (raw ?? '')).trim().toLowerCase();
  if (!VALID_SLUG.test(id)) return send(res, 400, { error: 'Identificador no válido.' });

  const manifest = await readManifest();
  const before = manifest.sources.length;
  manifest.sources = manifest.sources.filter((source) => source.id !== id);
  if (manifest.sources.length === before) {
    return send(res, 404, { error: 'Ese examen no estaba publicado.' });
  }
  await writeManifest(manifest);
  await del(`questions/${id}.json`).catch(() => {
    /* si el fichero ya no está, el manifest es lo que manda */
  });
  return send(res, 200, { ok: true, id, sources: manifest.sources.length });
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === 'DELETE') return remove(req, res);
  if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido.' });

  const ip = clientIp(req);
  if (tooManyAttempts(ip)) {
    return send(res, 429, { error: 'Demasiados intentos. Espera unos minutos.' });
  }

  let body: IncomingBody;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body as IncomingBody);
  } catch {
    return send(res, 400, { error: 'El cuerpo de la petición no es JSON válido.' });
  }

  if (!passwordOk(body?.password)) {
    noteFailure(ip);
    return send(res, 401, { error: 'Contraseña incorrecta.' });
  }
  resetAttempts(ip);

  // la página comprueba la contraseña antes de dejar subir nada
  if (body?.dryRun === true) return send(res, 200, { ok: true });

  if (!process.env.BLOB_STORE_ID) {
    return send(res, 500, { error: 'Falta el almacén de contenido en este despliegue.' });
  }

  let clean;
  try {
    clean = sanitize(body?.payload ?? {}, 'examen');
  } catch (error) {
    return send(res, 400, { error: (error as Error).message });
  }

  const pathname = `questions/${clean.id}.json`;
  await writeJson(pathname, clean);

  const manifest = await readManifest();
  const entry = {
    id: clean.id,
    difficulty: clean.difficulty as 'normal' | 'hard',
    ...(clean.year ? { year: clean.year } : {}),
    format: 'json' as const,
    exam: `api/questions?id=${clean.id}`,
    questions: clean.questions.length,
    updatedAt: new Date().toISOString(),
  };
  const index = manifest.sources.findIndex((source) => source.id === clean.id);
  if (index >= 0) manifest.sources[index] = entry;
  else manifest.sources.push(entry);
  await writeManifest(manifest);

  return send(res, 200, {
    ok: true,
    id: clean.id,
    questions: clean.questions.length,
    replaced: index >= 0,
    sources: manifest.sources.length,
  });
}
