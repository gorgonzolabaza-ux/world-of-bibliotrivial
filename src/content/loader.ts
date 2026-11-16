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

export async function fetchManifest(): Promise<Manifest | null> {
  try {
    const res = await fetch('/content/manifest.json', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as Manifest;
  } catch {
    return null;
  }
}

/**
 * Carga las preguntas ya parseadas. El PDF no se toca en el navegador: se
 * convierte a JSON en local con `scripts/ingest.mjs` y aquí solo se lee ese JSON.
 */
export async function loadQuestionsFromManifest(difficulty: 'normal' | 'hard'): Promise<Question[]> {
  const manifest = await fetchManifest();
  if (!manifest) return [];

  const out: Question[] = [];
  for (const source of manifest.sources) {
    if (source.difficulty !== difficulty) continue;
    try {
      const res = await fetch(source.exam, { cache: 'no-store' });
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
