import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  NODES,
  BOARD_RADIUS,
  BOARD_HEIGHT,
  PLATE_HEIGHT,
  TILE_RADIUS,
  TILE_HEIGHT,
  HQ_RADIUS,
  HQ_HEIGHT,
  HUB_RADIUS,
  HUB_HEIGHT,
} from './board';
import dieWoodUrl from './assets/textures/die_wood.jpg?url';

const SIZE = 1.5625; // 25 % más grande que el dado anterior
const HALF = SIZE / 2;
const ROUND = SIZE * 0.09; // radio del redondeo de aristas

/** Valor de cada cara en el orden de materiales de BoxGeometry: +x, -x, +y, -y, +z, -z. */
const FACE_VALUES = [1, 6, 2, 5, 3, 4];
const FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  5: [[-1, -1], [-1, 1], [0, 0], [1, -1], [1, 1]],
  6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('no se pudo cargar ' + url));
    img.src = url;
  });
}

function faceTexture(value: number, wood: HTMLImageElement | null): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  if (wood) {
    ctx.drawImage(wood, 0, 0, size, size);
  } else {
    ctx.fillStyle = '#d9c8a8';
    ctx.fillRect(0, 0, size, size);
  }

  // sombreado suave en los bordes: la cara no es plana
  const shade = ctx.createRadialGradient(size / 2, size / 2, size * 0.12, size / 2, size / 2, size * 0.74);
  shade.addColorStop(0, 'rgba(255,252,244,0.10)');
  shade.addColorStop(1, 'rgba(52,34,16,0.22)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, size, size);

  // pips taladrados: hueco oscuro con luz en el labio inferior
  const offset = size * 0.255;
  const radius = size * 0.077;
  for (const [px, py] of PIPS[value]) {
    const cx = size / 2 + px * offset;
    const cy = size / 2 + py * offset;
    ctx.beginPath();
    ctx.arc(cx, cy + radius * 0.22, radius * 1.06, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,246,228,0.5)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(38,25,13,0.92)';
    ctx.fill();
    const inner = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
    inner.addColorStop(0, 'rgba(0,0,0,0.35)');
    inner.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Cubo con las aristas redondeadas, manteniendo los seis grupos de material. */
function roundedBoxGeometry(size: number, radius: number, segments: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(size, size, size, segments, segments, segments);
  const pos = geo.attributes.position;
  const half = size / 2;
  const inner = half - radius;
  const v = new THREE.Vector3();
  const d = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const cx = THREE.MathUtils.clamp(v.x, -inner, inner);
    const cy = THREE.MathUtils.clamp(v.y, -inner, inner);
    const cz = THREE.MathUtils.clamp(v.z, -inner, inner);
    d.set(v.x - cx, v.y - cy, v.z - cz);
    const len = d.length();
    if (len > 1e-6) {
      d.multiplyScalar(radius / len);
      pos.setXYZ(i, cx + d.x, cy + d.y, cz + d.z);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export interface Die {
  mesh: THREE.Mesh;
  roll(): Promise<number>;
  update(dt: number): void;
  isBusy(): boolean;
}

const SETTLE_SPEED = 0.45;
const SETTLE_SPIN = 0.75;
const SETTLE_TIME = 0.26;
const MAX_ROLL_TIME = 6;

/**
 * Dado de seis caras con simulación física sobre el tablero: cae entre las casillas,
 * rueda, bota y el número se lee de la cara que queda mirando hacia arriba.
 */
export async function createDie(): Promise<Die> {
  let wood: HTMLImageElement | null = null;
  try {
    wood = await loadImage(dieWoodUrl);
  } catch {
    /* sin textura: cara lisa */
  }

  const materials = FACE_VALUES.map(
    (value) =>
      new THREE.MeshStandardMaterial({
        map: faceTexture(value, wood),
        roughness: 0.55,
        metalness: 0.02,
      }),
  );

  const mesh = new THREE.Mesh(roundedBoxGeometry(SIZE, ROUND, 10), materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -34, 0) });
  world.allowSleep = true;
  (world.solver as CANNON.GSSolver).iterations = 12;

  const boardMaterial = new CANNON.Material('board');
  const dieMaterial = new CANNON.Material('die');
  world.addContactMaterial(
    new CANNON.ContactMaterial(boardMaterial, dieMaterial, { friction: 0.45, restitution: 0.3 }),
  );

  const addStatic = (shape: CANNON.Shape, x: number, y: number, z: number) => {
    const body = new CANNON.Body({ type: CANNON.Body.STATIC, shape, material: boardMaterial });
    body.position.set(x, y, z);
    world.addBody(body);
  };

  // superficie del tablero
  addStatic(new CANNON.Box(new CANNON.Vec3(BOARD_RADIUS, 0.3, BOARD_RADIUS)), 0, PLATE_HEIGHT - 0.3, 0);
  // paño, por si el dado se sale del tablero
  const felt = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), material: boardMaterial });
  felt.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  felt.position.set(0, -BOARD_HEIGHT, 0);
  world.addBody(felt);

  // cada casilla como obstáculo: el dado bota entre ellas en vez de hundirse
  for (const node of NODES) {
    if (node.type === 'hub') {
      addStatic(
        new CANNON.Box(new CANNON.Vec3(HUB_RADIUS * 0.9, HUB_HEIGHT / 2, HUB_RADIUS * 0.9)),
        0,
        node.pos.y - HUB_HEIGHT / 2,
        0,
      );
      continue;
    }
    const isHq = node.type === 'headquarters';
    const r = isHq ? HQ_RADIUS : TILE_RADIUS;
    const h = isHq ? HQ_HEIGHT : TILE_HEIGHT;
    addStatic(
      new CANNON.Box(new CANNON.Vec3(r * 0.95, h / 2, r * 0.95)),
      node.pos.x,
      node.pos.y - h / 2,
      node.pos.z,
    );
  }

  const body = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Box(new CANNON.Vec3(HALF, HALF, HALF)),
    material: dieMaterial,
    linearDamping: 0.26,
    angularDamping: 0.2,
  });
  body.allowSleep = true;
  body.sleepSpeedLimit = SETTLE_SPEED;
  body.sleepTimeLimit = SETTLE_TIME;
  world.addBody(body);

  // posición de reposo inicial: sobre las casillas del sector frontal
  const rest = new THREE.Vector3(0, 0.22 + HALF, 6.2);
  body.position.set(rest.x, rest.y, rest.z);
  body.quaternion.setFromEuler(0.15, 0.5, 0.1);
  mesh.position.copy(rest);

  let rolling = false;
  let elapsed = 0;
  let calm = 0;
  let resolveRoll: ((value: number) => void) | null = null;

  const upFace = (): number => {
    const q = new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
    let best = -2;
    let index = 0;
    for (let i = 0; i < FACE_NORMALS.length; i++) {
      const y = FACE_NORMALS[i].clone().applyQuaternion(q).y;
      if (y > best) {
        best = y;
        index = i;
      }
    }
    return FACE_VALUES[index];
  };

  const finish = () => {
    rolling = false;
    mesh.position.set(body.position.x, body.position.y, body.position.z);
    mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
    const value = upFace();
    const done = resolveRoll;
    resolveRoll = null;
    done?.(value);
  };

  return {
    mesh,
    isBusy: () => rolling,
    roll() {
      if (rolling) return Promise.resolve(upFace());
      rolling = true;
      elapsed = 0;
      calm = 0;

      // tiro plano desde fuera del tablero: entra cruzando en diagonal y toca
      // la mesa con un ángulo cercano a 35-40°, no en caída vertical
      const targetAngle = THREE.MathUtils.degToRad(200 + Math.random() * 140);
      const targetRadius = 4 + Math.random() * 2.4;
      const tx = Math.cos(targetAngle) * targetRadius;
      const tz = -Math.sin(targetAngle) * targetRadius;

      const originAngle = targetAngle + THREE.MathUtils.degToRad((Math.random() - 0.5) * 55);
      const originRadius = 12.2 + Math.random() * 2.4;
      const ox = Math.cos(originAngle) * originRadius;
      const oz = -Math.sin(originAngle) * originRadius;
      const oy = PLATE_HEIGHT + 2.0 + Math.random() * 0.8;

      // balística: velocidad inicial para llegar al objetivo en 'flight' segundos
      const G = -34;
      const restY = PLATE_HEIGHT + HALF;
      const flight = 0.5 + Math.random() * 0.14;

      body.wakeUp();
      body.position.set(ox, oy, oz);
      body.quaternion.setFromEuler(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      body.velocity.set(
        (tx - ox) / flight,
        (restY - oy) / flight - 0.5 * G * flight,
        (tz - oz) / flight,
      );
      body.angularVelocity.set(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16,
      );
      body.sleepState = CANNON.Body.AWAKE;

      return new Promise<number>((resolve) => {
        resolveRoll = resolve;
      });
    },
    update(dt: number) {
      if (!rolling) return;
      elapsed += dt;
      world.step(1 / 120, dt, 6);
      mesh.position.set(body.position.x, body.position.y, body.position.z);
      mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);

      const speed = body.velocity.length();
      const spin = body.angularVelocity.length();
      if (speed < SETTLE_SPEED && spin < SETTLE_SPIN) calm += dt;
      else calm = 0;

      if (calm > SETTLE_TIME || body.sleepState === CANNON.Body.SLEEPING || elapsed > MAX_ROLL_TIME) {
        body.velocity.setZero();
        body.angularVelocity.setZero();
        finish();
      }
    },
  };
}
