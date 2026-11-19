/** GET /api/manifest — manifiesto del contenido publicado desde la página de ingesta. */

import { get, list } from '@vercel/blob';
import { passwordOk, readManifest, send } from './_lib.js';
import type { ApiRequest, ApiResponse } from './_lib.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido.' });

  // diagnóstico, solo con la contraseña: sirve para ver qué contesta el almacén
  const header = req.headers['x-ingest-password'];
  if (passwordOk(Array.isArray(header) ? header[0] : header) && req.query.diag) {
    const report: Record<string, unknown> = { storeId: process.env.BLOB_STORE_ID ?? null };
    try {
      const result = await get('manifest.json', { access: 'private' });
      report.get = result ? `status ${result.statusCode}` : 'null';
    } catch (error) {
      report.getError = (error as Error).message;
      report.getErrorName = (error as Error).name;
    }
    try {
      const listed = await list({ limit: 10 });
      report.list = listed.blobs.map((blob) => `${blob.pathname} (${blob.size})`);
    } catch (error) {
      report.listError = (error as Error).message;
    }
    // las mismas instrucciones que readJson, pero contando qué falla
    try {
      const result = await get('manifest.json', { access: 'private' });
      report.step = result ? `leído (${result.statusCode})` : 'null';
      if (result?.stream) {
        const text = await new Response(result.stream).text();
        report.textLength = text.length;
        report.textStart = text.slice(0, 80);
        const parsed = JSON.parse(text);
        report.sources = Array.isArray(parsed.sources) ? parsed.sources.length : 'sin sources';
      }
    } catch (error) {
      report.stepError = `${(error as Error).name}: ${(error as Error).message}`;
    }
    return send(res, 200, report);
  }

  const manifest = await readManifest();
  if (manifest.sources.length === 0) {
    return send(res, 404, { error: 'Todavía no hay contenido publicado desde la ingesta.' });
  }
  return send(res, 200, manifest);
}
