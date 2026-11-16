import type { CategoryKey } from './categories';
export type { CategoryKey };
import type { BoardNode } from './board';
export type { BoardNode };

export interface Question {
  id: string;
  text: string;
  options: string[];
  answerIndex: number;
  /** Categoría ya asignada al ingerir el examen (ver scripts/ingest.mjs). */
  category: CategoryKey;
  difficulty: 'normal' | 'hard';
  source?: string;
}

export interface PlayerState {
  race: 'human' | 'elf' | 'dwarf' | 'orc';
  color: string;
  position: number;
  score: number;
  themeHits: Record<CategoryKey, number>;
  quesitos: Set<CategoryKey>;
}

export interface GameState {
  players: PlayerState[];
  currentPlayer: number;
  board: BoardNode[];
  questions: Question[];
  startedAt: number;
  finished: boolean;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlockedAt?: number;
}
