import * as THREE from 'three';
import { buildBoard, NODES, ADJ } from './board';
import { createPlayerToken } from './token';
import type { Race } from './player';
import { createDie } from './die';
import { CATEGORIES, CATEGORY_BY_KEY } from './categories';
import type { Category, CategoryKey } from './categories';
import { createBoardView } from './boardView';
import { configureRenderer, createCamera, createControls, createStage, loadTableTextures, pixelRatioFor, tuneFogForCamera, updateControlLimits } from './table';
import { quality } from './quality';
import { getQuestions, clearQuestionCache } from './content';
import { loadBestRuns, saveBestRun, unlockAchievement, loadAchievements } from './persistence';
import { achievementName } from './achievements';
import type { GameState, PlayerState, Question } from './types';

// ---------- DOM ----------
const app = document.getElementById('app')!;
const menu = document.getElementById('menu')!;
const hud = document.getElementById('hud')!;
const diceBtn = document.getElementById('dice') as HTMLButtonElement;
const modal = document.getElementById('modal')!;
const card3d = document.getElementById('card3d')!;
const qcat = document.getElementById('qcat')!;
const qtext = document.getElementById('qtext')!;
const qopts = document.getElementById('qopts')!;
const qfeedback = document.getElementById('qfeedback')!;
const scoreEl = document.getElementById('score')!;
const themeEl = document.getElementById('theme')!;
const quesitosEl = document.getElementById('quesitos')!;
const statusEl = document.getElementById('status')!;

// ---------- Escena: mesa, cámara y tablero ----------
const scene = new THREE.Scene();
const renderer = new THREE.WebGLRenderer({
  antialias: quality.antialias,
  powerPreference: 'high-performance',
});
configureRenderer(renderer);
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const { camera, fit, target: cameraTarget } = createCamera();
const controls = createControls(camera, renderer.domElement, cameraTarget);
let userMovedCamera = false;
controls.addEventListener('start', () => {
  userMovedCamera = true;
});

const textures = loadTableTextures(renderer);
createStage(scene, textures);
tuneFogForCamera(scene, camera);

buildBoard();
const boardView = createBoardView(textures);
scene.add(boardView.group);
const tileMeshes = boardView.tiles;

const token = createPlayerToken('human', '#4a90d9');
token.group.visible = false;
scene.add(token.group);

const die = await createDie();
scene.add(die.mesh);

// ---------- Game state ----------
let state: GameState | null = null;
let questions: Question[] = [];
let currentQuestion: Question | null = null;
let answering = false;
let finalWon = false;
let streak = 0;
let perThemeWrong: Record<string, boolean> = {};
let startedAt = 0;
let animating = false;
let choosingMove = false;
let reachableNodes: Set<number> = new Set();
let reachablePaths: Map<number, number[]> = new Map();
let currentPath: number[] = [];

function nodeWorldPos(id: number): THREE.Vector3 {
  return boardView.worldPos(id);
}

/** Abre la carta mostrando el dorso y la gira al cabo de un instante. */
let flipTimer: number | undefined;
function openCard() {
  window.clearTimeout(flipTimer);
  modal.classList.add('open');
  card3d.classList.remove('flipped');
  flipTimer = window.setTimeout(() => card3d.classList.add('flipped'), 360);
}

/** Devuelve la carta a su dorso antes de retirarla. */
function closeCard() {
  window.clearTimeout(flipTimer);
  card3d.classList.remove('flipped');
  flipTimer = window.setTimeout(() => modal.classList.remove('open'), 300);
}

function initPlayerMesh(race: Race, color: string) {
  token.setRace(race, color);
  token.group.visible = true;
  token.group.position.copy(nodeWorldPos(0));
}

function renderQuesitos() {
  quesitosEl.innerHTML = '';
  if (!state) return;
  const p = state.players[0];
  for (const category of CATEGORIES) {
    const el = document.createElement('div');
    const earned = p.quesitos.has(category.key);
    el.className = 'quesito' + (earned ? ' on' : '');
    el.style.setProperty('--cat', category.css);
    el.style.setProperty('--icon', `url("${category.icon}")`);
    el.title = category.name;
    el.setAttribute('aria-label', category.name);
    quesitosEl.appendChild(el);
  }
}

function updateHUD() {
  if (!state) return;
  const p = state.players[0];
  scoreEl.textContent = p.score.toFixed(2);
  const node = NODES[p.position];
  if (node.type === 'hub') {
    themeEl.textContent = 'Centro';
    themeEl.style.color = '#d9b475';
    const hitsEl = document.getElementById('themeHits')!;
    hitsEl.textContent = '-';
  } else {
    const category = CATEGORY_BY_KEY[node.category];
    themeEl.textContent = category.name;
    themeEl.style.color = category.css;
    const hitsEl = document.getElementById('themeHits')!;
    hitsEl.textContent = `${p.themeHits[node.category] || 0}`;
  }
  renderQuesitos();
}

async function startGame() {
  const race = (document.getElementById('race') as HTMLSelectElement).value as any;
  const difficulty = (document.getElementById('difficulty') as HTMLSelectElement).value as 'normal' | 'hard';
  const color = (document.getElementById('color') as HTMLInputElement).value;

  questions = await getQuestions(difficulty);
  if (questions.length === 0) {
    statusEl.textContent = 'No hay preguntas. Pulsa "Actualizar contenido".';
    return;
  }

  const player: PlayerState = {
    race, color, position: 0, score: 0,
    themeHits: Object.fromEntries(CATEGORIES.map((c) => [c.key, 0])) as Record<CategoryKey, number>,
    quesitos: new Set<CategoryKey>(),
  };

  state = {
    players: [player],
    currentPlayer: 0,
    board: NODES,
    questions,
    startedAt: Date.now(),
    finished: false,
  };
  startedAt = Date.now();
  streak = 0;
  perThemeWrong = {};

  initPlayerMesh(race, color);
  menu.style.display = 'none';
  hud.style.display = 'block';
  diceBtn.style.display = 'block';
  diceBtn.textContent = '🎲 Lanzar dado';
  diceBtn.disabled = false;

  boardView.resetQuesitos();
  token.reset();

  // ayuda de desarrollo: ?debug=quesitos arranca con las seis cuñas puestas
  if (new URLSearchParams(window.location.search).get('debug') === 'quesitos') {
    CATEGORIES.forEach((c) => token.setQuesito(c.key, true));
  }

  updateHUD();
  statusEl.textContent = `Cargadas ${questions.length} preguntas (${difficulty}).`;
}

document.getElementById('startBtn')!.addEventListener('click', startGame);

document.getElementById('updateBtn')!.addEventListener('click', async () => {
  statusEl.textContent = 'Actualizando contenido...';
  clearQuestionCache();
  const diff = (document.getElementById('difficulty') as HTMLSelectElement).value as 'normal' | 'hard';
  const qs = await getQuestions(diff, true);
  statusEl.textContent = `Actualizado: ${qs.length} preguntas disponibles.`;
});

// ---------- Movement / BFS ----------
function computeReachable(start: number, steps: number): { nodes: Set<number>; paths: Map<number, number[]> } {
  // BFS tracking previous to avoid immediate backtrack
  const resultNodes = new Set<number>();
  const resultPaths = new Map<number, number[]>();
  // state: nodeId, prevId, path
  type Frame = { node: number; prev: number; path: number[] };
  let frontier: Frame[] = [{ node: start, prev: -1, path: [start] }];
  for (let s = 0; s < steps; s++) {
    const next: Frame[] = [];
    for (const f of frontier) {
      for (const nb of ADJ[f.node]) {
        if (nb === f.prev) continue; // no backtrack
        // avoid revisiting same node in same path? allow cycles but not immediate
        if (f.path.includes(nb)) continue; // avoid loops
        next.push({ node: nb, prev: f.node, path: [...f.path, nb] });
      }
    }
    // dedupe by node keeping first path
    const byNode = new Map<number, Frame>();
    for (const fr of next) {
      if (!byNode.has(fr.node)) byNode.set(fr.node, fr);
    }
    frontier = Array.from(byNode.values());
  }
  for (const f of frontier) {
    resultNodes.add(f.node);
    if (!resultPaths.has(f.node)) resultPaths.set(f.node, f.path);
  }
  return { nodes: resultNodes, paths: resultPaths };
}

function highlightReachable(on: boolean) {
  boardView.highlight(on ? reachableNodes : null);
}

diceBtn.addEventListener('click', async () => {
  if (!state || state.finished || animating) return;
  if (modal.classList.contains('open')) return;
  if (choosingMove) {
    // cancel selection and re-roll
    choosingMove = false;
    highlightReachable(false);
    reachableNodes.clear();
    reachablePaths.clear();
    statusEl.textContent = '';
  }
  animating = true;
  diceBtn.disabled = true;
  diceBtn.textContent = 'Tirando…';
  const roll = await die.roll();
  const { nodes, paths } = computeReachable(state.players[0].position, roll);
  reachableNodes = nodes;
  reachablePaths = paths;
  choosingMove = true;
  animating = false;
  highlightReachable(true);
  diceBtn.disabled = false;
  diceBtn.textContent = '🎲 Cancelar y re-tirar';
  statusEl.textContent = `Sacas un ${roll}: elige una casilla a ${roll} ${roll === 1 ? 'paso' : 'pasos'}.`;
});

// click to select destination
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
renderer.domElement.addEventListener('click', (ev) => {
  if (!choosingMove || !state) return;
  mouse.x = (ev.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(ev.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(tileMeshes);
  if (hits.length === 0) return;
  const mesh = hits[0].object as THREE.Mesh;
  const nodeId = mesh.userData.nodeId as number;
  if (!reachableNodes.has(nodeId)) return;
  // move
  choosingMove = false;
  highlightReachable(false);
  const path = reachablePaths.get(nodeId)!;
  currentPath = path;
  animatePath(path).then(() => {
    state!.players[0].position = nodeId;
    updateHUD();
    onLand(nodeId);
  });
});

async function animatePath(path: number[]) {
  animating = true;
  diceBtn.disabled = true;
  for (let i = 1; i < path.length; i++) {
    await animateMove(nodeWorldPos(path[i]));
    await sleep(80);
  }
  animating = false;
  diceBtn.disabled = false;
  diceBtn.textContent = '🎲 Lanzar dado';
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function animateMove(target: THREE.Vector3): Promise<void> {
  return new Promise((resolve) => {
    const start = token.group.position.clone();
    const duration = 170;
    const t0 = performance.now();
    function step() {
      const now = performance.now();
      const t = Math.min(1, (now - t0) / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      token.group.position.lerpVectors(start, target, eased);
      token.group.position.y = target.y + Math.sin(t * Math.PI) * 0.5;
      if (t < 1) requestAnimationFrame(step);
      else { token.group.position.copy(target); resolve(); }
    }
    requestAnimationFrame(step);
  });
}

// ---------- Questions ----------
function pickQuestion(category: CategoryKey): Question | null {
  if (!state) return null;
  const pool = state.questions.filter((q) => q.category === category);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * En el centro el jugador elige categoría (regla del Trivial para cuando aún
 * no tiene las seis cuñas). Se reutiliza la carta ya abierta: solo cambia el
 * contenido, sin volver a girarla.
 */
function chooseCategory(options: Category[]): Promise<CategoryKey> {
  return new Promise((resolve) => {
    currentQuestion = null;
    answering = false;
    qcat.textContent = 'Centro';
    qcat.style.color = '#f3d79b';
    qcat.style.backgroundColor = 'rgba(217,180,117,0.18)';
    qtext.textContent = 'Elige la categoría de la pregunta';
    qfeedback.textContent = '';
    qopts.innerHTML = '';
    for (const category of options) {
      const btn = document.createElement('button');
      btn.textContent = category.name;
      btn.style.borderLeft = `4px solid ${category.css}`;
      btn.addEventListener(
        'click',
        () => {
          qopts.innerHTML = '';
          statusEl.textContent = `Pregunta de ${category.name}.`;
          resolve(category.key);
        },
        { once: true },
      );
      qopts.appendChild(btn);
    }
    openCard();
  });
}

async function onLand(nodeId: number) {
  if (!state) return;
  const node = NODES[nodeId];
  const p = state.players[0];

  // "tira otra vez": tirada extra sin pregunta
  if (node.type === 'rollagain') {
    statusEl.textContent = 'Casilla "Tira otra vez": vuelves a lanzar sin pregunta.';
    window.setTimeout(() => {
      if (state && !state.finished && !animating && !choosingMove && !modal.classList.contains('open')) diceBtn.click();
    }, 900);
    return;
  }

  // centro
  if (node.type === 'hub') {
    const isFinal = p.quesitos.size >= CATEGORIES.length;
    if (isFinal) {
      // la pregunta final es de una categoría elegida por los rivales: aquí, al azar
      const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)].key;
      const q = pickQuestion(category);
      if (q) await askQuestion(q, false, true);
      return;
    }
    const missing = CATEGORIES.filter((c) => !p.quesitos.has(c.key));
    const category = await chooseCategory(missing);
    const q = pickQuestion(category);
    if (q) await askQuestion(q, false, false, true);
    return;
  }

  // casilla normal o sede de categoría
  const q = pickQuestion(node.category);
  if (q) await askQuestion(q, node.isQuesitoSlot, false);
}

async function askQuestion(q: Question, isHeadquarters: boolean, isFinal: boolean, alreadyOpen = false) {
  currentQuestion = q;
  answering = false;
  const category = CATEGORY_BY_KEY[q.category];
  qcat.textContent = isFinal ? 'Pregunta final' : category.name;
  qcat.style.color = isFinal ? '#f5c518' : '#ffffff';
  qcat.style.backgroundColor = isFinal ? 'rgba(245,197,24,0.18)' : category.css;
  qtext.textContent = q.text;
  qopts.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.textContent = `${'ABCD'[i]}) ${opt}`;
    btn.addEventListener('click', () => answerQuestion(i, isHeadquarters, isFinal));
    qopts.appendChild(btn);
  });
  qfeedback.textContent = '';
  if (!alreadyOpen) openCard();
}

async function answerQuestion(idx: number, isHeadquarters: boolean, isFinal: boolean) {
  if (!state || !currentQuestion || answering) return;
  answering = true;
  qopts.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true));
  const q = currentQuestion;
  const p = state.players[0];
  const category = q.category;
  const correct = idx === q.answerIndex;
  if (correct) {
    p.score += 1;
    p.themeHits[category] = (p.themeHits[category] || 0) + 1;
    streak += 1;
    qfeedback.textContent = '✅ ¡Correcto! (+1)';
    qfeedback.style.color = '#2ecc71';
    // regla del Trivial: acertar en la sede de una categoría te da su cuña
    if (isHeadquarters && !p.quesitos.has(category)) {
      p.quesitos.add(category);
      boardView.setQuesito(category, true);
      token.setQuesito(category, true);
      unlockAchievement('quesito_' + category);
      if (!perThemeWrong[category]) unlockAchievement('perfect_theme_' + category);
      qfeedback.textContent += ' 🧀 ¡Quesito conseguido!';
    }
    if (streak === 5) unlockAchievement('streak_5');
    if (streak === 10) unlockAchievement('streak_10');
    if (isFinal) {
      finalWon = true;
      // win
      state.finished = true;
      const duration = Date.now() - startedAt;
      diceBtn.style.display = 'none';
      saveBestRun({ difficulty: (document.getElementById('difficulty') as HTMLSelectElement).value, durationMs: duration, date: Date.now(), score: p.score });
      unlockAchievement('first_win');
      if (Object.keys(perThemeWrong).length === 0) unlockAchievement('no_errors');
      if (duration < 5 * 60 * 1000) unlockAchievement('speed_demon');
      setTimeout(() => {
        modal.classList.add('open');
        qcat.textContent = 'Partida completada';
        qcat.style.backgroundColor = 'rgba(245,197,24,0.18)';
        qcat.style.color = '#f5c518';
        qtext.textContent = '🏆 ¡Has ganado!';
        qopts.innerHTML = '';
        qfeedback.textContent = `Tiempo: ${(duration / 1000).toFixed(1)}s · Puntos: ${p.score.toFixed(2)}`;
        qfeedback.style.color = '#f5c518';
        const backBtn = document.createElement('button');
        backBtn.textContent = 'Volver al menú';
        backBtn.style.marginTop = '12px';
        backBtn.addEventListener('click', () => {
          closeCard();
          menu.style.display = 'flex';
          hud.style.display = 'none';
          diceBtn.style.display = 'none';
          refreshMenuStats();
        });
        qopts.appendChild(backBtn);
      }, 1200);
    }
  } else {
    p.score -= 1 / 3;
    streak = 0;
    perThemeWrong[category] = true;
    qfeedback.textContent = `❌ Incorrecto. La respuesta era ${'ABCD'[q.answerIndex]}. (-1/3)`;
    qfeedback.style.color = '#e74c3c';
    if (isFinal) {
      // regla del Trivial: si fallas la final, tienes que salir del centro y volver
      qfeedback.textContent += ' Sal del centro y vuelve para intentarlo otra vez.';
    }
  }
  updateHUD();

  setTimeout(() => {
    if (finalWon) { finalWon = false; return; }
    closeCard();
    currentQuestion = null;
    answering = false;
    choosingMove = false;
    diceBtn.disabled = false;
  }, 1400);
}

// ---------- Render loop ----------
const clock = new THREE.Clock();

/*
 * Resolución adaptativa. El coste de esta escena es relleno de píxeles, así que
 * lo más eficaz en un móvil flojo es dibujar menos píxeles, no menos cosas: se
 * mantienen físicas, texturas, sombras y carta, y baja solo la resolución de
 * dibujo. Si el dispositivo va sobrado, vuelve a subir sola.
 */
let renderScale = pixelRatioFor(window.devicePixelRatio, quality.maxPixelRatio);
let sampledFrames = 0;
let sampledTime = 0;
let warmup = 2.5;
let cooldown = 0;

function adaptResolution(frameSeconds: number) {
  if (warmup > 0) {
    warmup -= frameSeconds;
    return;
  }
  if (cooldown > 0) {
    cooldown -= frameSeconds;
    return;
  }
  sampledFrames++;
  sampledTime += frameSeconds;
  if (sampledFrames < 90) return;

  const average = sampledTime / sampledFrames;
  sampledFrames = 0;
  sampledTime = 0;

  const ceiling = quality.maxPixelRatio;
  const floor = Math.max(0.65, ceiling * 0.5);
  let next = renderScale;
  if (average > 1 / 45 && renderScale > floor) next = Math.max(floor, renderScale - 0.2);
  else if (average < 1 / 58 && renderScale < ceiling) next = Math.min(ceiling, renderScale + 0.15);

  if (Math.abs(next - renderScale) > 0.01) {
    renderScale = next;
    renderer.setPixelRatio(renderScale);
    renderer.setSize(window.innerWidth, window.innerHeight);
    cooldown = 1.5;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05);
  die.update(dt);
  token.update(dt);
  controls.update();
  renderer.render(scene, camera);
  adaptResolution(raw);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (!userMovedCamera) {
    fit();
    updateControlLimits(controls, camera);
    tuneFogForCamera(scene, camera);
  }
});

async function refreshMenuStats() {
  const runs = await loadBestRuns();
  const ach = await loadAchievements();
  const bestEl = document.getElementById('bestRuns')!;
  if (runs.length) {
    const sorted = [...runs].sort((a, b) => a.durationMs - b.durationMs).slice(0, 5);
    bestEl.innerHTML = 'Mejores tiempos:<br>' + sorted.map((r, i) => `${i + 1}. ${(r.durationMs / 1000).toFixed(1)}s (${r.difficulty})`).join('<br>');
  } else {
    bestEl.textContent = '';
  }
  const achEl = document.getElementById('achList')!;
  if (ach.length) {
    achEl.innerHTML = 'Logros: ' + ach.map((a) => achievementName(a.id)).join(', ');
  } else {
    achEl.innerHTML = '';
  }
}

loadAchievements().then((a) => {
  if (a.length) statusEl.textContent = `Logros desbloqueados: ${a.length}`;
});
loadBestRuns().then((r) => {
  if (r.length) statusEl.textContent = (statusEl.textContent || '') + ` · Mejores partidas: ${r.length}`;
});
refreshMenuStats();
