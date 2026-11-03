import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildBoard, NODES, ADJ, nodePosition } from './board';
import { createPlayerMesh } from './player';
import { THEMES, THEME_BY_KEY, QUESITOS_NEEDED } from './themes';
import { getQuestions, clearQuestionCache } from './content';
import { loadBestRuns, saveBestRun, unlockAchievement, loadAchievements } from './persistence';
import { ACHIEVEMENTS, achievementName } from './achievements';
import type { GameState, PlayerState, Question, ThemeKey } from './types';

// ---------- DOM ----------
const app = document.getElementById('app')!;
const menu = document.getElementById('menu')!;
const hud = document.getElementById('hud')!;
const diceBtn = document.getElementById('dice') as HTMLButtonElement;
const modal = document.getElementById('modal')!;
const qtext = document.getElementById('qtext')!;
const qopts = document.getElementById('qopts')!;
const qfeedback = document.getElementById('qfeedback')!;
const scoreEl = document.getElementById('score')!;
const themeEl = document.getElementById('theme')!;
const quesitosEl = document.getElementById('quesitos')!;
const statusEl = document.getElementById('status')!;

// ---------- Three.js setup ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f1a);
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 22, 22);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
app.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(10, 20, 10);
scene.add(dir);

// ---------- Board ----------
buildBoard();
const tileMeshes: THREE.Mesh[] = [];
const tileGroup = new THREE.Group();
scene.add(tileGroup);

for (const node of NODES) {
  const p = node.pos;
  const geom = new THREE.CylinderGeometry(node.type === 'hub' ? 2.2 : 0.6, node.type === 'hub' ? 2.2 : 0.6, 0.25, node.type === 'hub' ? 32 : 16);
  const theme = THEME_BY_KEY[node.theme];
  const color = node.type === 'hub' ? 0x1a2033 : (node.type === 'rollagain' ? 0xffffff : theme.color);
  const mat = new THREE.MeshStandardMaterial({ color, flatShading: true, emissive: node.isQuesitoSlot ? theme.color : 0x000000, emissiveIntensity: node.isQuesitoSlot ? 0.4 : 0 });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(p.x, p.y, p.z);
  mesh.userData.nodeId = node.id;
  tileGroup.add(mesh);
  tileMeshes.push(mesh);

  if (node.isQuesitoSlot) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ring.position.set(p.x, p.y + 0.18, p.z);
    ring.rotation.x = Math.PI / 2;
    tileGroup.add(ring);
  }
}

// draw spokes (paths to center)
const spokeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
for (const node of NODES) {
  if (node.type !== "headquarters") continue;
  let outerId = -1;
  let hubId = -1;
  for (const nb of ADJ[node.id]) {
    if (NODES[nb].type === "hub") hubId = nb;
    else if (NODES[nb].type !== "headquarters") outerId = nb;
  }
  if (outerId >= 0) {
    const pts = [new THREE.Vector3(NODES[outerId].pos.x, 0.15, NODES[outerId].pos.z), new THREE.Vector3(node.pos.x, 0.15, node.pos.z)];
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    tileGroup.add(new THREE.Line(geom, spokeMat));
  }
  if (hubId >= 0) {
    const pts = [new THREE.Vector3(node.pos.x, 0.15, node.pos.z), new THREE.Vector3(NODES[hubId].pos.x, 0.15, NODES[hubId].pos.z)];
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    tileGroup.add(new THREE.Line(geom, spokeMat));
  }
}

// center pegs
const centerPegs: Record<string, THREE.Mesh> = {};
const pegGroup = new THREE.Group();
scene.add(pegGroup);
THEMES.forEach((t, i) => {
  const a = (i / THEMES.length) * Math.PI * 2;
  const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8), new THREE.MeshStandardMaterial({ color: t.color, flatShading: true }));
  peg.position.set(2.2 * Math.cos(a), 0.5, 2.2 * Math.sin(a));
  peg.visible = false;
  pegGroup.add(peg);
  centerPegs[t.key] = peg;
});

// ---------- Game state ----------
let state: GameState | null = null;
let playerMesh: THREE.Group | null = null;
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
  const p = nodePosition(id);
  return new THREE.Vector3(p.x, 0.6, p.z);
}

function initPlayerMesh(race: any, color: string) {
  if (playerMesh) scene.remove(playerMesh);
  playerMesh = createPlayerMesh(race, color);
  scene.add(playerMesh);
  playerMesh.position.copy(nodeWorldPos(0));
}

function renderQuesitos() {
  quesitosEl.innerHTML = '';
  if (!state) return;
  const p = state.players[0];
  for (const t of THEMES) {
    const el = document.createElement('div');
    el.className = 'quesito' + (p.quesitos.has(t.key as ThemeKey) ? ' on' : '');
    el.style.color = t.css;
    el.style.background = p.quesitos.has(t.key as ThemeKey) ? t.css : 'transparent';
    quesitosEl.appendChild(el);
  }
}

function updateHUD() {
  if (!state) return;
  const p = state.players[0];
  scoreEl.textContent = p.score.toFixed(2);
  const node = NODES[p.position];
  themeEl.textContent = node.type === 'hub' ? 'Centro' : THEME_BY_KEY[node.theme].name;
  const hitsEl = document.getElementById('themeHits')!;
  hitsEl.textContent = node.type === 'hub' ? '-' : `${p.themeHits[node.theme] || 0}/${QUESITOS_NEEDED}`;
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
    themeHits: Object.fromEntries(THEMES.map((t) => [t.key, 0])) as any,
    quesitos: new Set(),
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

  for (const t of THEMES) centerPegs[t.key].visible = false;

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
  tileMeshes.forEach((m) => {
    const id = m.userData.nodeId as number;
    if (on && reachableNodes.has(id)) {
      (m.material as THREE.MeshStandardMaterial).emissive.set(0xffffff);
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6;
    } else {
      const node = NODES[id];
      const theme = THEME_BY_KEY[node.theme];
      (m.material as THREE.MeshStandardMaterial).emissive.set(node.isQuesitoSlot ? theme.color : 0x000000);
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = node.isQuesitoSlot ? 0.4 : 0;
    }
  });
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
  const roll = 1 + Math.floor(Math.random() * 6);
  diceBtn.textContent = `ðŸŽ² ${roll}`;
  const { nodes, paths } = computeReachable(state.players[0].position, roll);
  reachableNodes = nodes;
  reachablePaths = paths;
  choosingMove = true;
  animating = false;
  highlightReachable(true);
  diceBtn.disabled = false;
  diceBtn.textContent = '🎲 Cancelar y re-tirar';
  statusEl.textContent = `Elige una casilla a ${roll} pasos (clic en una casilla resaltada).`;
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
  diceBtn.textContent = 'ðŸŽ² Lanzar dado';
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function animateMove(target: THREE.Vector3): Promise<void> {
  return new Promise((resolve) => {
    if (!playerMesh) { resolve(); return; }
    const start = playerMesh.position.clone();
    const duration = 160;
    const t0 = performance.now();
    function step() {
      const now = performance.now();
      const t = Math.min(1, (now - t0) / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      playerMesh!.position.lerpVectors(start, target, eased);
      playerMesh!.position.y = 0.6 + Math.sin(t * Math.PI) * 0.6;
      if (t < 1) requestAnimationFrame(step);
      else { playerMesh!.position.copy(target); resolve(); }
    }
    requestAnimationFrame(step);
  });
}

// ---------- Questions ----------
function pickQuestion(theme: ThemeKey): Question | null {
  if (!state) return null;
  const pool = state.questions.filter((q) => q.theme === theme);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

async function onLand(nodeId: number) {
  if (!state) return;
  const node = NODES[nodeId];
  const p = state.players[0];

  if (node.type === 'rollagain') {
    statusEl.textContent = 'Casilla "Tira otra vez": vuelve a lanzar.';
    return;
  }

  if (node.type === 'hub') {
    let cat: ThemeKey;
    const missing = THEMES.filter((t) => !p.quesitos.has(t.key as ThemeKey));
    if (missing.length > 0 && p.quesitos.size < THEMES.length) {
      cat = missing[Math.floor(Math.random() * missing.length)].key as ThemeKey;
    } else {
      cat = THEMES[Math.floor(Math.random() * THEMES.length)].key as ThemeKey;
    }
    const isFinal = p.quesitos.size >= THEMES.length;
    const q = pickQuestion(cat);
    if (q) await askQuestion(q, false, isFinal);
    return;
  }

  const q = pickQuestion(node.theme);
  if (q) await askQuestion(q, node.isQuesitoSlot, false);
}
async function askQuestion(q: Question, isHeadquarters: boolean, isFinal: boolean) {
  currentQuestion = q;
  answering = false;
  qtext.textContent = q.text;
  qopts.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.textContent = `${'ABCD'[i]}) ${opt}`;
    btn.addEventListener('click', () => answerQuestion(i, isHeadquarters, isFinal));
    qopts.appendChild(btn);
  });
  qfeedback.textContent = '';
  modal.classList.add('open');
}

async function answerQuestion(idx: number, isHeadquarters: boolean, isFinal: boolean) {
  if (!state || !currentQuestion || answering) return;
  answering = true;
  qopts.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true));
  const q = currentQuestion;
  const p = state.players[0];
  const correct = idx === q.answerIndex;
  if (correct) {
    p.score += 1;
    p.themeHits[q.theme] = (p.themeHits[q.theme] || 0) + 1;
    streak += 1;
    qfeedback.textContent = 'âœ… Â¡Correcto! (+1)';
    qfeedback.style.color = '#2ecc71';
    if (isHeadquarters && p.themeHits[q.theme] >= QUESITOS_NEEDED && !p.quesitos.has(q.theme)) {
      p.quesitos.add(q.theme);
      centerPegs[q.theme].visible = true;
      unlockAchievement('quesito_' + q.theme);
      qfeedback.textContent += ' ðŸ§€ Â¡Quesito conseguido!';
    }
    if (streak === 5) unlockAchievement('streak_5');
    if (streak === 10) unlockAchievement('streak_10');
    if (!perThemeWrong[q.theme] && p.themeHits[q.theme] === QUESITOS_NEEDED) {
      unlockAchievement('perfect_theme_' + q.theme);
    }
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
        qtext.textContent = 'ðŸ† Â¡Partida completada!';
        qopts.innerHTML = '';
        qfeedback.textContent = `Tiempo: ${(duration / 1000).toFixed(1)}s Â· Puntos: ${p.score.toFixed(2)}`;
        qfeedback.style.color = '#f5c518';
        const backBtn = document.createElement('button');
        backBtn.textContent = 'Volver al menÃº';
        backBtn.style.marginTop = '12px';
        backBtn.addEventListener('click', () => {
          modal.classList.remove('open');
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
    perThemeWrong[q.theme] = true;
    qfeedback.textContent = `âŒ Incorrecto. La respuesta era ${'ABCD'[q.answerIndex]}. (-1/3)`;
    qfeedback.style.color = '#e74c3c';
  }
  updateHUD();

  setTimeout(() => {
    if (finalWon) { finalWon = false; return; }
    modal.classList.remove('open');
    currentQuestion = null;
    answering = false;
    choosingMove = false;
    diceBtn.disabled = false;
  }, 1400);
}

function checkEnd() { /* handled in answerQuestion */ }

// ---------- Render loop ----------
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
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
  if (r.length) statusEl.textContent = (statusEl.textContent || '') + ` Â· Mejores partidas: ${r.length}`;
});
refreshMenuStats();
