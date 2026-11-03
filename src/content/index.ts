import { MOCK_QUESTIONS } from '../data/mockQuestions';
import { loadQuestionsFromManifest } from './loader';
import type { Question } from '../types';

let cache: Record<string, Question[]> = {};

export async function getQuestions(difficulty: 'normal' | 'hard', force = false): Promise<Question[]> {
  const key = difficulty;
  if (!force && cache[key]?.length) return cache[key];
  const fromContent = await loadQuestionsFromManifest(difficulty);
  const mock = MOCK_QUESTIONS.filter((q) => q.difficulty === difficulty);
  const combined = [...fromContent, ...mock];
  // de-dup by text
  const seen = new Set<string>();
  const deduped = combined.filter((q) => {
    const k = q.text.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  cache[key] = deduped;
  return deduped;
}

export function clearQuestionCache() {
  cache = {};
}
