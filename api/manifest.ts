/** GET /api/manifest — manifiesto del contenido publicado desde la página de ingesta. */

import { readManifest, send } from './_lib';
import type { ApiRequest, ApiResponse } from './_lib';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido.' });

  const manifest = await readManifest();
  if (manifest.sources.length === 0) {
    return send(res, 404, { error: 'Todavía no hay contenido publicado desde la ingesta.' });
  }
  return send(res, 200, manifest);
}
