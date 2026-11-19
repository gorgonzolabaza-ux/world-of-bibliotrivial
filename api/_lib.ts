/**
 * Utilidades compartidas por las funciones de `/api`.
 *
 * Los ficheros que empiezan por `_` no se publican como funciones.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { get, put } from '@vercel/blob';

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

/** Lee un JSON del almacén. Devuelve null si no existe. */
export async function readJson<T>(pathname: string): Promise<T | null> {
  try {
    const result = await get(pathname, { access: 'private' });
    if (!result) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function writeJson(pathname: string, value: unknown): Promise<void> {
  await put(pathname, JSON.stringify(value), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json; charset=utf-8',
  });
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
