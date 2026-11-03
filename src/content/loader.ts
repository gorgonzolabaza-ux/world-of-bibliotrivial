import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { THEMES } from '../themes';
import type { Question } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export interface ManifestSource {
  id: string;
  difficulty: 'normal' | 'hard';
  year?: number;
  format?: 'json' | 'pdf';
  exam: string;
  answers?: string;
  theme?: string;
}

export interface Manifest {
  version: number;
  sources: ManifestSource[];
}

export async function fetchManifest(): Promise<Manifest | null> {
  try {
    const res = await fetch('/content/manifest.json', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as Manifest;
  } catch {
    return null;
  }
}

async function extractPdfText(url: string): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({ url } as any);
  const pdf = await loadingTask.promise;
  let full = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const strings = content.items.map((it: any) => it.str);
    full += strings.join(' ') + '\n';
  }
  return full;
}

function classifyTheme(text: string): Question['theme'] {
  const lower = text.toLowerCase();
  let best: { key: string; score: number } = { key: THEMES[0].key, score: -1 };
  for (const t of THEMES) {
    let score = 0;
    for (const kw of t.keywords) {
      const re = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      const m = lower.match(re);
      if (m) score += m.length;
    }
    if (score > best.score) best = { key: t.key, score };
  }
  return best.key as Question['theme'];
}

function parseAnswerMap(text: string): Map<number, number> {
  const map = new Map<number, number>();
  const letterToIdx = (l: string) => 'ABCD'.indexOf(l.toUpperCase());
  const t = text.replace(/\s+/g, ' ');
  const patterns = [
    /\b(\d+)\s*[\.\)\-:]\s*([A-Da-d])\b/g,
    /\b(\d+)\s+([A-Da-d])\b/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(t)) !== null) {
      const n = parseInt(m[1], 10);
      const idx = letterToIdx(m[2]);
      if (idx >= 0 && !map.has(n)) map.set(n, idx);
    }
    if (map.size > 0) break;
  }
  return map;
}

function parseQuestionsFromText(text: string, answerMap: Map<number, number>, difficulty: 'normal' | 'hard', forcedTheme?: string): Question[] {
  const questions: Question[] = [];
  const t = text.replace(/\s+/g, ' ').trim();
  // find numbered question blocks
  const qRegex = /(?:^|\s)(\d+)\s*[\.\)]\s*(.*?)(?=(?:\s\d+\s*[\.\)]\s)|$)/g;
  let m;
  let counter = 0;
  while ((m = qRegex.exec(t)) !== null) {
    const num = parseInt(m[1], 10);
    const block = m[2].trim();
    // find where options start
    const optStartMatch = block.match(/(?:^|\s)([A-Da-d])\s*[\.\)]\s*/);
    let qtext = block;
    let optionsPart = '';
    if (optStartMatch) {
      const idx = optStartMatch.index as number;
      // if index 0, no question text
      if (idx > 0) {
        qtext = block.slice(0, idx).trim();
        optionsPart = block.slice(idx).trim();
      } else {
        qtext = '';
        optionsPart = block;
      }
    }
    // parse options
    const options: string[] = [];
    const oRegex = /([A-Da-d])\s*[\.\)]\s*(.*?)(?=\s[A-Da-d]\s*[\.\)]|$)/g;
    let om;
    oRegex.lastIndex = 0;
    while ((om = oRegex.exec(optionsPart)) !== null) {
      options.push(om[2].trim());
    }
    if (options.length < 2 || !qtext.trim()) continue;
    while (options.length < 4) options.push('');
    const answerIndex = answerMap.has(num) ? answerMap.get(num)! : 0;
    const theme = (forcedTheme as Question['theme']) || classifyTheme(qtext + ' ' + options.join(' '));
    questions.push({
      id: `pdf-${num}-${counter++}`,
      text: qtext.trim(),
      options: options.slice(0, 4),
      answerIndex,
      theme,
      difficulty,
      source: 'pdf',
    });
  }
  return questions;
}

export async function loadQuestionsFromManifest(difficulty: 'normal' | 'hard'): Promise<Question[]> {
  const manifest = await fetchManifest();
  if (!manifest) return [];
  const out: Question[] = [];
  for (const src of manifest.sources) {
    if (src.difficulty !== difficulty) continue;
    if (src.format === 'pdf' || src.exam.toLowerCase().endsWith('.pdf')) {
      const text = await extractPdfText(src.exam);
      let answerMap = new Map<number, number>();
      if (src.answers) {
        const atext = await extractPdfText(src.answers);
        answerMap = parseAnswerMap(atext);
      }
      const qs = parseQuestionsFromText(text, answerMap, difficulty, src.theme);
      out.push(...qs);
    } else {
      const res = await fetch(src.exam, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      const items = data.questions || data;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const theme = it.theme || classifyTheme((it.text || '') + ' ' + (it.options || []).join(' '));
        out.push({
          id: `${src.id}-${i}`,
          text: it.text,
          options: it.options,
          answerIndex: it.answer ?? it.answerIndex ?? 0,
          theme,
          difficulty,
          source: src.id,
        });
      }
    }
  }
  return out;
}
