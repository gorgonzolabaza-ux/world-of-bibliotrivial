/**
 * Utilidades compartidas por las funciones de `/api`.
 *
 * Los ficheros que empiezan por `_` no se publican como funciones.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { del, get, list, put } from '@vercel/blob';

export interface ApiRequest {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
  end(): void;
}

export function send(res: ApiResponse, status: number, body: unknown) {
  res.status(status);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(body);
}

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest();

/**
 * Comprueba la contraseña de ingesta contra la variable de entorno.
 * Se comparan los hashes en tiempo constante para no filtrar información por
 * el tiempo de respuesta.
 */
export function passwordOk(given: unknown): boolean {
  const expected = process.env.INGEST_PASSWORD;
  if (!expected || typeof given !== 'string' || given.length === 0) return false;
  return timingSafeEqual(sha256(given), sha256(expected));
}

/* ------------------------------------------------------------------ */
/* Límite de intentos                                                  */
/* ------------------------------------------------------------------ */

const attempts = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

/** Frena la fuerza bruta por instancia; no es una defensa distribuida, solo un estorbo. */
export function tooManyAttempts(ip: string): boolean {
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || now > record.until) return false;
  return record.count >= MAX_ATTEMPTS;
}

export function noteFailure(ip: string) {
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || now > record.until) {
    attempts.set(ip, { count: 1, until: now + WINDOW_MS });
  } else {
    record.count += 1;
  }
}

export function resetAttempts(ip: string) {
  attempts.delete(ip);
}

/* ------------------------------------------------------------------ */
/* Almacenamiento                                                      */
/* ------------------------------------------------------------------ */

const MANIFEST_PATH = 'manifest.json';

export interface ManifestSource {
  id: string;
  difficulty: 'normal' | 'hard';
  year?: number;
  format: 'json';
  exam: string;
  questions?: number;
  updatedAt?: string;
}

export interface StoredManifest {
  version: number;
  updatedAt?: string;
  sources: ManifestSource[];
}

/**
 * Lee un JSON del almacén. Devuelve null si no existe.
 *
 * Cada escritura crea un blob con sufijo aleatorio, así que un documento puede
 * tener varias versiones. Se escoge siempre la más reciente: si se sobrescribe
 * el mismo nombre, el CDN del almacén sigue sirviendo la versión anterior y se
 * leería contenido viejo.
 */
export async function readJson<T>(pathname: string): Promise<T | null> {
  try {
    const stem = pathname.replace(/\.json$/, '');
    const listed = await list({ prefix: stem, limit: 200 });
    const pattern = new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(-[a-z0-9]+)?\\.json$`, 'i');
    const versions = listed.blobs
      .filter((blob) => pattern.test(blob.pathname))
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    if (versions.length === 0) return null;

    const result = await get(versions[0].url, { access: 'private' });
    if (!result || !result.stream) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function writeJson(pathname: string, value: unknown): Promise<void> {
  const blob = await put(pathname, JSON.stringify(value), {
    access: 'private',
    addRandomSuffix: true,
    allowOverwrite: true,
    contentType: 'application/json; charset=utf-8',
  });

  // se borran las versiones anteriores para que el almacén no crezca sin fin
  try {
    const stem = pathname.replace(/\.json$/, '');
    const listed = await list({ prefix: stem, limit: 200 });
    const pattern = new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(-[a-z0-9]+)?\\.json$`, 'i');
    const old = listed.blobs.filter((item) => item.pathname !== blob.pathname && pattern.test(item.pathname));
    if (old.length > 0) await del(old.map((item) => item.url));
  } catch {
    /* si falla la limpieza, el documento nuevo ya está escrito */
  }
}

/** Borra todas las versiones de un documento. */
export async function deleteJson(pathname: string): Promise<void> {
  const stem = pathname.replace(/\.json$/, '');
  const pattern = new RegExp(`^${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(-[a-z0-9]+)?\\.json$`, 'i');
  const listed = await list({ prefix: stem, limit: 200 });
  const versions = listed.blobs.filter((blob) => pattern.test(blob.pathname));
  if (versions.length > 0) await del(versions.map((blob) => blob.url));
}
export async function readManifest(): Promise<StoredManifest> {
  return (await readJson<StoredManifest>(MANIFEST_PATH)) ?? { version: 1, sources: [] };
}

export async function writeManifest(manifest: StoredManifest): Promise<void> {
  await writeJson(MANIFEST_PATH, { ...manifest, updatedAt: new Date().toISOString() });
}

export const VALID_SLUG = /^[a-z0-9][a-z0-9-]{1,48}$/;

export const CATEGORY_KEYS = [
  'legislacion',
  'procesos',
  'servicios',
  'gestion',
  'bibliografia',
  'tecnologias',
] as const;
