import type { ThemeKey } from './themes';
export type { ThemeKey };
import type { BoardNode } from './board';
export type { BoardNode };

export interface Question {
  id: string;
  text: string;
  options: string[];
  answerIndex: number;
  theme: ThemeKey;
  difficulty: 'normal' | 'hard';
  source?: string;
}

export interface PlayerState {
  race: 'human' | 'elf' | 'dwarf' | 'orc';
  color: string;
  position: number;
  score: number;
  themeHits: Record<ThemeKey, number>;
  quesitos: Set<ThemeKey>;
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
