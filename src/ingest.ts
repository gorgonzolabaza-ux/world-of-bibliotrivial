/**
 * Página de ingesta: convierte un examen y su plantilla de respuestas en
 * tarjetas del juego y las publica.
 *
 * Los PDF se leen y se parsean **en el navegador**: el fichero no viaja a
 * ningún servidor. Lo único que sale de aquí es el JSON ya limpio, y para eso
 * hace falta la contraseña, que se valida en `/api/ingest`.
 */

import { buildQuestions } from './content/parse-exam.mjs';
import type { BuildResult } from './content/parse-exam.mjs';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const gate = $<HTMLElement>('gate');
const panel = $<HTMLElement>('panel');
const passwordInput = $<HTMLInputElement>('password');
const gateMsg = $<HTMLParagraphElement>('gateMsg');
const enterBtn = $<HTMLButtonElement>('enter');

const examInput = $<HTMLInputElement>('exam');
const answersInput = $<HTMLInputElement>('answers');
const examIdInput = $<HTMLInputElement>('examId');
const difficultyInput = $<HTMLSelectElement>('difficulty');
const yearInput = $<HTMLInputElement>('year');
const processBtn = $<HTMLButtonElement>('process');
const processMsg = $<HTMLParagraphElement>('processMsg');

const review = $<HTMLElement>('review');
const statsEl = $<HTMLElement>('stats');
const warningsEl = $<HTMLElement>('warnings');
const rowsEl = $<HTMLElement>('rows');
const publishBtn = $<HTMLButtonElement>('publish');
const publishMsg = $<HTMLParagraphElement>('publishMsg');

let password = '';
let result: BuildResult | null = null;

function setMessage(element: HTMLElement, text: string, kind: 'error' | 'ok' | '' = '') {
  element.textContent = text;
  element.className = `msg ${kind}`.trim();
}

/* ------------------------------------------------------------------ */
/* Extracción de texto de un PDF                                       */
/* ------------------------------------------------------------------ */

async function pdfToText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, verbosity: 0 }).promise;
  let text = '';
  for (let page = 1; page <= doc.numPages; page++) {
    const content = await (await doc.getPage(page)).getTextContent();
    text += content.items.map((item) => ('str' in item ? item.str : '')).join(' ') + '\n';
  }
  return text;
}

/* ------------------------------------------------------------------ */
/* Paso 1 · contraseña                                                 */
/* ------------------------------------------------------------------ */

async function tryEnter() {
  const value = passwordInput.value.trim();
  if (!value) {
    setMessage(gateMsg, 'Escribe la contraseña.', 'error');
    return;
  }
  enterBtn.disabled = true;
  setMessage(gateMsg, 'Comprobando…');
  try {
    const res = await fetch('./api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: value, dryRun: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(gateMsg, data?.error ?? 'No se ha podido comprobar la contraseña.', 'error');
      return;
    }
    password = value;
    passwordInput.value = '';
    gate.classList.add('hidden');
    panel.classList.remove('hidden');
    examInput.focus();
  } catch {
    setMessage(gateMsg, 'No hay conexión con el servidor de ingesta.', 'error');
  } finally {
    enterBtn.disabled = false;
  }
}

enterBtn.addEventListener('click', tryEnter);
passwordInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') void tryEnter();
});

/* ------------------------------------------------------------------ */
/* Paso 2 · procesar                                                   */
/* ------------------------------------------------------------------ */

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

examInput.addEventListener('change', () => {
  if (examIdInput.value.trim()) return;
  const name = examInput.files?.[0]?.name ?? '';
  const slug = slugify(name.replace(/\.pdf$/i, ''));
  if (slug) examIdInput.value = slug;
});

async function process() {
  const examFile = examInput.files?.[0];
  const answersFile = answersInput.files?.[0];
  if (!examFile || !answersFile) {
    setMessage(processMsg, 'Hacen falta los dos PDF: examen y respuestas.', 'error');
    return;
  }
  const id = slugify(examIdInput.value || examFile.name.replace(/\.pdf$/i, ''));
  if (!/^[a-z0-9][a-z0-9-]{1,48}$/.test(id)) {
    setMessage(processMsg, 'El identificador debe tener al menos 2 caracteres: minúsculas, números y guiones.', 'error');
    return;
  }

  processBtn.disabled = true;
  review.classList.add('hidden');
  setMessage(processMsg, 'Leyendo los PDF…');
  try {
    const [examText, answersText] = await Promise.all([pdfToText(examFile), pdfToText(answersFile)]);
    setMessage(processMsg, 'Interpretando las preguntas…');
    result = buildQuestions({
      examText,
      answersText,
      id,
      difficulty: difficultyInput.value === 'hard' ? 'hard' : 'normal',
      year: yearInput.value ? Number(yearInput.value) : null,
    });
    render(result);
    setMessage(processMsg, '', '');
    review.classList.remove('hidden');
    review.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    console.error(error);
    setMessage(processMsg, `No se han podido leer los PDF: ${(error as Error).message}`, 'error');
  } finally {
    processBtn.disabled = false;
  }
}

processBtn.addEventListener('click', () => void process());

function render(built: BuildResult) {
  const { stats, questions } = built;

  statsEl.innerHTML = '';
  const chip = (label: string, value: string | number) => {
    const element = document.createElement('span');
    element.className = 'chip';
    element.innerHTML = `${label} <b>${value}</b>`;
    statsEl.appendChild(element);
  };
  chip('Preguntas', stats.total);
  chip('Bloques leídos', stats.starts);
  chip('Descartadas', stats.rejected.length);
  chip('Sin respuesta', stats.skipped.length);
  const distribution = stats.distribution.map((count, index) => `${'ABCD'[index]}: ${count}`).join(' · ');
  chip('Respuestas', distribution);

  warningsEl.innerHTML = '';
  const warnings: string[] = [];
  if (stats.rejected.length) {
    warnings.push(`${stats.rejected.length} bloque(s) descartado(s) por formato: ${stats.rejected.slice(0, 6).map((item) => item.num).join(', ')}${stats.rejected.length > 6 ? '…' : ''}`);
  }
  if (stats.skipped.length) {
    warnings.push(`${stats.skipped.length} pregunta(s) sin respuesta en la plantilla: ${stats.skipped.map((item) => item.num).join(', ')}`);
  }
  if (stats.weak.length) {
    warnings.push(`${stats.weak.length} clasificación(es) poco fiables (revisa la categoría en el juego si algo chirría)`);
  }
  if (questions.length === 0) {
    warnings.push('No se ha reconocido ninguna pregunta: ¿seguro que es el PDF del examen y no el de respuestas?');
  }
  if (warnings.length) {
    const list = document.createElement('ul');
    for (const text of warnings) {
      const item = document.createElement('li');
      item.textContent = text;
      list.appendChild(item);
    }
    warningsEl.appendChild(list);
  }

  rowsEl.innerHTML = '';
  questions.slice(0, 200).forEach((question, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="num">${index + 1}</td>
      <td>${escapeHtml(question.text)}</td>
      <td class="ans">${'ABCD'[question.answerIndex] ?? '?'}</td>
      <td class="cat">${escapeHtml(question.category)}</td>
    `;
    rowsEl.appendChild(row);
  });

  publishBtn.disabled = questions.length === 0;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

/* ------------------------------------------------------------------ */
/* Paso 3 · publicar                                                   */
/* ------------------------------------------------------------------ */

async function publish() {
  if (!result) return;
  publishBtn.disabled = true;
  setMessage(publishMsg, 'Publicando…');
  try {
    const res = await fetch('./api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, payload: result }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(publishMsg, data?.error ?? 'No se ha podido publicar.', 'error');
      return;
    }
    setMessage(
      publishMsg,
      `Publicado: ${data.questions} preguntas en "${data.id}". ${data.replaced ? 'Se ha reemplazado el examen anterior. ' : ''}Ya están en el juego.`,
      'ok',
    );
    const link = document.createElement('p');
    link.innerHTML = '<a href="./">Ir al juego</a> · <a href="./?debug=top">Ver el tablero</a>';
    publishMsg.appendChild(link);
  } catch {
    setMessage(publishMsg, 'No hay conexión con el servidor de ingesta.', 'error');
  } finally {
    publishBtn.disabled = false;
  }
}

publishBtn.addEventListener('click', () => void publish());
