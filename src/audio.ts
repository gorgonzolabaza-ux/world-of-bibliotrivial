/**
 * Sonidos del juego, sintetizados con Web Audio.
 *
 * No hay ficheros de audio: cada efecto se genera en el momento con osciladores
 * y ruido filtrado. Así no añaden ni un byte al bundle y se pueden ajustar por
 * código. Son deliberadamente secos y cortos, de mesa de madera.
 *
 * Los navegadores no dejan sonar hasta que hay un gesto del usuario, así que el
 * contexto se crea en el primer clic (al empezar la partida).
 */

const STORAGE_KEY = 'wob.sonido';

let context: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();
let noise: AudioBuffer | null = null;

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? 'off' : 'on');
  } catch {
    /* sin almacenamiento: el ajuste dura la sesión */
  }
  if (master && context) {
    master.gain.setTargetAtTime(value ? 0 : 0.9, context.currentTime, 0.02);
  }
}

/** Estado del contexto: 'running' cuando suena de verdad. Útil para depurar. */
export function audioState(): string {
  return context ? context.state : 'sin crear';
}

/** Crea o reanuda el contexto de audio. Se llama desde un gesto del usuario. */
export function unlockAudio() {
  ensure();
}

function ensure(): AudioContext | null {
  const Ctor =
    typeof window === 'undefined'
      ? undefined
      : window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!context) {
    context = new Ctor();
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(context.destination);
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noise) {
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noise;
}

interface ClickOptions {
  freq: number;
  q?: number;
  gain: number;
  decay: number;
}

/** Golpe de ruido filtrado: el "toc" de una pieza sobre la mesa. */
function click(ctx: AudioContext, at: number, options: ClickOptions) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = options.freq;
  filter.Q.value = options.q ?? 1.6;
  const env = ctx.createGain();
  env.gain.setValueAtTime(options.gain, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + options.decay);
  source.connect(filter);
  filter.connect(env);
  env.connect(master!);
  source.start(at);
  source.stop(at + options.decay + 0.02);
}

interface ToneOptions {
  freq: number;
  type?: OscillatorType;
  gain: number;
  attack?: number;
  decay: number;
  slideTo?: number;
}

function tone(ctx: AudioContext, at: number, options: ToneOptions) {
  const osc = ctx.createOscillator();
  osc.type = options.type ?? 'sine';
  osc.frequency.setValueAtTime(options.freq, at);
  if (options.slideTo) osc.frequency.exponentialRampToValueAtTime(options.slideTo, at + options.decay);

  const env = ctx.createGain();
  const attack = options.attack ?? 0.004;
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(options.gain, at + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, at + attack + options.decay);

  osc.connect(env);
  env.connect(master!);
  osc.start(at);
  osc.stop(at + attack + options.decay + 0.05);
}

/** Dado rodando: repiqueteo que se va espaciando hasta que se para. */
export function playDice() {
  const ctx = ensure();
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + 0.02;
  const count = 12;
  let at = t0;
  for (let i = 0; i < count; i++) {
    const progress = i / (count - 1);
    // los golpes se separan y se apagan a medida que el dado pierde energía
    click(ctx, at, {
      freq: 1500 + Math.random() * 2600,
      q: 1.3,
      gain: 0.2 - progress * 0.11,
      decay: 0.05 + Math.random() * 0.035,
    });
    at += 0.055 + progress * progress * 0.16;
  }
  // el dado se asienta
  tone(ctx, at, { freq: 165, type: 'sine', gain: 0.16, decay: 0.16, slideTo: 90 });
  click(ctx, at, { freq: 700, q: 2.4, gain: 0.12, decay: 0.05 });
}

/** La ficha salta de casilla en casilla. */
export function playStep() {
  const ctx = ensure();
  if (!ctx || muted) return;
  const at = ctx.currentTime + 0.005;
  click(ctx, at, { freq: 1000 + Math.random() * 400, q: 2.4, gain: 0.13, decay: 0.04 });
  tone(ctx, at, { freq: 210 + Math.random() * 50, type: 'sine', gain: 0.07, decay: 0.07 });
}

/** Quesito conseguido: tres notas que suben. */
export function playQuesito() {
  const ctx = ensure();
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + 0.02;
  const notes = [1046.5, 1318.5, 1568]; // do6, mi6, sol6
  notes.forEach((freq, i) => {
    tone(ctx, t0 + i * 0.085, { freq, type: 'triangle', gain: 0.14, decay: 0.3 });
  });
  tone(ctx, t0 + 0.25, { freq: 2093, type: 'sine', gain: 0.07, decay: 0.45 });
}

/** Victoria: arpegio de do mayor con la nota final sostenida. */
export function playWin() {
  const ctx = ensure();
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + 0.05;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // do5, mi5, sol5, do6
  notes.forEach((freq, i) => {
    const at = t0 + i * 0.15;
    tone(ctx, at, { freq, type: 'triangle', gain: 0.13, decay: 0.8 });
    tone(ctx, at, { freq: freq * 2, type: 'sine', gain: 0.045, decay: 0.5 });
  });
  tone(ctx, t0 + 0.6, { freq: 1046.5, type: 'triangle', gain: 0.12, attack: 0.01, decay: 1.3 });
  tone(ctx, t0 + 0.6, { freq: 1568, type: 'sine', gain: 0.05, attack: 0.01, decay: 1.1 });
}
