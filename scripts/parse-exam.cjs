const fs = require('node:fs');

// Load themes keywords from src/themes.ts? Parse manually: import via regex? We'll hardcode minimal keyword map by reading file.
const themesSrc = fs.readFileSync('src/themes.ts', 'utf8');
// extract THEMES array keywords via eval-ish: build a simple list of {key, keywords}
const themeBlocks = [...themesSrc.matchAll(/key:\s*'(\w+)'[\s\S]*?keywords:\s*\[([^\]]*)\]/g)];
const THEMES = themeBlocks.map(m => ({
  key: m[1],
  keywords: [...m[2].matchAll(/'([^']+)'/g)].map(x => x[1]),
}));

function classifyTheme(text) {
  const lower = text.toLowerCase();
  let best = { key: THEMES[0].key, score: -1 };
  for (const t of THEMES) {
    let score = 0;
    for (const kw of t.keywords) {
      const re = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      const m = lower.match(re);
      if (m) score += m.length;
    }
    if (score > best.score) best = { key: t.key, score };
  }
  return best.key;
}

function parseAnswerMap(text) {
  const map = new Map();
  const t = text.replace(/\s+/g, ' ');
  const patterns = [/\b(\d+)\s*[\.\)\-:]\s*([A-Da-d])\b/g, /\b(\d+)\s+([A-Da-d])\b/g];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(t)) !== null) {
      const n = parseInt(m[1], 10);
      const idx = 'ABCD'.indexOf(m[2].toUpperCase());
      if (idx >= 0 && !map.has(n)) map.set(n, idx);
    }
    if (map.size > 0) break;
  }
  // handle ANULADA: skip (no answer)
  return map;
}

function parseQuestions(text, answerMap, difficulty) {
  const questions = [];
  const t = text.replace(/\s+/g, ' ').trim();
  const qRegex = /(?:^|\s)(\d+)\s*[\.\)]\s*(.*?)(?=(?:\s\d+\s*[\.\)]\s)|$)/g;
  let m;
  let counter = 0;
  while ((m = qRegex.exec(t)) !== null) {
    const num = parseInt(m[1], 10);
    const block = m[2].trim();
    const optStartMatch = block.match(/(?:^|\s)([A-Da-d])\s*[\.\)]\s*/);
    let qtext = block;
    let optionsPart = '';
    if (optStartMatch) {
      const idx = optStartMatch.index;
      if (idx > 0) {
        qtext = block.slice(0, idx).trim();
        optionsPart = block.slice(idx).trim();
      } else {
        qtext = '';
        optionsPart = block;
      }
    }
    const options = [];
    const oRegex = /([A-Da-d])\s*[\.\)]\s*(.*?)(?=\s[A-Da-d]\s*[\.\)]|$)/g;
    let om;
    oRegex.lastIndex = 0;
    while ((om = oRegex.exec(optionsPart)) !== null) {
      options.push(om[2].trim());
    }
    if (options.length < 2 || !qtext.trim()) continue;
    // skip anulada questions (answer not in map)
    if (!answerMap.has(num)) {
      // could be anulada; skip
      continue;
    }
    while (options.length < 4) options.push('');
    const answerIndex = answerMap.get(num);
    const theme = classifyTheme(qtext + ' ' + options.join(' '));
    questions.push({
      id: `examen1-${num}`,
      text: qtext.trim(),
      options: options.slice(0, 4),
      answer: answerIndex,
      theme,
      difficulty,
      source: 'examen1-2022',
    });
    counter++;
  }
  return questions;
}

const examText = fs.readFileSync('content/oposiciones/normal/2024/examen1.txt', 'utf8');
const ansText = fs.readFileSync('content/oposiciones/normal/2024/respuestas1.txt', 'utf8');
const answerMap = parseAnswerMap(ansText);
console.log('answer map size:', answerMap.size);
const qs = parseQuestions(examText, answerMap, 'normal');
console.log('parsed:', qs.length);

// write JSON
const out = { questions: qs };
fs.writeFileSync('content/questions/examen1-normal.json', JSON.stringify(out, null, 2), 'utf8');
console.log('written content/questions/examen1-normal.json');
