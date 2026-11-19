/**
 * Declaraciones de tipos para el parser compartido, que está en `.mjs` para que
 * lo puedan usar tanto Node (scripts/ingest.mjs) como el navegador.
 */

export interface ParsedQuestion {
  id: string;
  text: string;
  options: string[];
  answerIndex: number;
  category: string;
  difficulty: string;
  source: string;
}

export interface RejectedQuestion {
  num: number;
  reason: string;
}

export interface WeakClassification {
  num: number;
  category: string;
  score: number;
}

export interface BuildStats {
  starts: number;
  parsed: number;
  rejected: RejectedQuestion[];
  skipped: RejectedQuestion[];
  weak: WeakClassification[];
  commonCount: number;
  counts: Record<string, number>;
  distribution: number[];
  total: number;
}

export interface BuildInput {
  examText: string;
  answersText?: string;
  id: string;
  difficulty: 'normal' | 'hard';
  year?: number | null;
  commonCount?: number | null;
  overrides?: Record<string, string>;
}

export interface BuildResult {
  id: string;
  title: string;
  difficulty: 'normal' | 'hard';
  year: number | null;
  questions: ParsedQuestion[];
  stats: BuildStats;
}

export function buildQuestions(input: BuildInput): BuildResult;
export function manifestEntry(input: { id: string; difficulty: string; year?: number | null }): Record<string, unknown>;
export function classify(text: string): { category: string; score: number; margin: number; scores: Record<string, number> };
export const TAXONOMY: Record<string, string[]>;
export const CATEGORY_ORDER: string[];
