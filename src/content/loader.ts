import type { CategoryKey } from '../categories';
import { CATEGORIES } from '../categories';
import type { Question } from '../types';

export interface ManifestSource {
  id: string;
  difficulty: 'normal' | 'hard';
  year?: number;
  format?: 'json';
  exam: string;
  theme?: string;
}

export interface Manifest {
  version: number;
  sources: ManifestSource[];
}

const VALID_CATEGORIES = new Set<string>(CATEGORIES.map((c) => c.key));

/** BASE_URL es './' para que funcione igual en la raíz que en un subpath. */
const base = () => import.meta.env.BASE_URL;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Manifiesto del contenido. Se juntan dos fuentes:
 *   1. lo publicado desde la página de ingesta (`/api/manifest`, almacén Blob),
 *   2. lo que va en el repositorio (`content/manifest.json`).
 * Si el mismo examen está en las dos, gana el publicado, que es el más reciente.
 * Cuando no hay nada publicado —o en desarrollo, sin funciones— queda solo el
 * manifiesto del repo.
 */
export async function fetchManifest(): Promise<Manifest | null> {
  const [remote, local] = await Promise.all([
    fetchJson<Manifest>(`${base()}api/manifest`),
    fetchJson<Manifest>(`${base()}content/manifest.json`),
  ]);

  const sources: ManifestSource[] = [];
  const seen = new Set<string>();
  for (const source of [...(remote?.sources ?? []), ...(local?.sources ?? [])]) {
    if (!source?.id || seen.has(source.id)) continue;
    seen.add(source.id);
    sources.push(source);
  }
  if (sources.length === 0) return null;
  return { version: remote?.version ?? local?.version ?? 1, sources };
}

/**
 * Carga las preguntas ya parseadas. El PDF no se toca aquí: se convierte a JSON
 * en la página de ingesta (o con `scripts/ingest.mjs`) y esto solo lo lee.
 */
export async function loadQuestionsFromManifest(difficulty: 'normal' | 'hard'): Promise<Question[]> {
  const manifest = await fetchManifest();
  if (!manifest) return [];

  const out: Question[] = [];
  for (const source of manifest.sources) {
    if (source.difficulty !== difficulty) continue;
    try {
      const res = await fetch(`${base()}${source.exam}`, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      const items = Array.isArray(data) ? data : data.questions;
      if (!Array.isArray(items)) continue;

      items.forEach((item: any, index: number) => {
        const category = String(item.category ?? '');
        if (!item.text || !Array.isArray(item.options) || item.options.length < 2) return;
        if (!VALID_CATEGORIES.has(category)) {
          console.warn(`[contenido] ${source.id}#${index}: categoría desconocida "${category}", se omite`);
          return;
        }
        out.push({
          id: item.id ?? `${source.id}-${index}`,
          text: String(item.text),
          options: item.options.map((option: unknown) => String(option)),
          answerIndex: Number(item.answerIndex ?? item.answer ?? 0),
          category: category as CategoryKey,
          difficulty,
          source: source.id,
        });
      });
    } catch (error) {
      console.warn(`[contenido] no se pudo cargar ${source.exam}`, error);
    }
  }
  return out;
}
