/** GET /api/questions?id=<examen> — preguntas de un examen publicado desde la ingesta. */

import { VALID_SLUG, readJson, readManifest, send } from './_lib.js';
import type { ApiRequest, ApiResponse } from './_lib.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido.' });

  const raw = req.query.id;
  const id = String(Array.isArray(raw) ? raw[0] : (raw ?? '')).trim().toLowerCase();
  if (!VALID_SLUG.test(id)) return send(res, 400, { error: 'Identificador no válido.' });

  // solo se sirve lo que esté dado de alta en el manifiesto: nada de rutas arbitrarias
  const manifest = await readManifest();
  if (!manifest.sources.some((source) => source.id === id)) {
    return send(res, 404, { error: 'Ese examen no está publicado.' });
  }

  const data = await readJson(`questions/${id}.json`);
  if (!data) return send(res, 404, { error: 'El examen no existe en el almacén.' });
  return send(res, 200, data);
}
