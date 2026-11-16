import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BOARD_RADIUS, BOARD_HEIGHT } from './board';
import feltUrl from './assets/textures/felt_color.jpg?url';
import feltNormalUrl from './assets/textures/felt_normal.jpg?url';
import feltRoughUrl from './assets/textures/felt_rough.jpg?url';
import woodUrl from './assets/textures/wood_color.jpg?url';
import woodNormalUrl from './assets/textures/wood_normal.jpg?url';

export interface TableTextures {
  felt: THREE.Texture;
  feltNormal: THREE.Texture;
  feltRough: THREE.Texture;
  wood: THREE.Texture;
  woodNormal: THREE.Texture;
}

/** Texturas CC0 de Poly Haven y ambientCG (ver CREDITOS.md). */
export function loadTableTextures(renderer: THREE.WebGLRenderer): TableTextures {
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const prep = (tex: THREE.Texture, repeat: number, srgb = true) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.anisotropy = maxAniso;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const feltRepeat = 32;
  return {
    felt: prep(loader.load(feltUrl), feltRepeat),
    feltNormal: prep(loader.load(feltNormalUrl), feltRepeat, false),
    feltRough: prep(loader.load(feltRoughUrl), feltRepeat, false),
    wood: prep(loader.load(woodUrl), 2),
    woodNormal: prep(loader.load(woodNormalUrl), 2, false),
  };
}

export function configureRenderer(renderer: THREE.WebGLRenderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
}

/** Degradado radial de fondo: sala oscura con la mesa iluminada. */
function makeBackgroundTexture(): THREE.Texture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size * 0.5, size * 0.46, size * 0.04, size * 0.5, size * 0.5, size * 0.78);
  g.addColorStop(0, '#6d5842');
  g.addColorStop(0.4, '#30241a');
  g.addColorStop(1, '#0c0906');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Mancha de sombra suave bajo el tablero (contacto con el paño). */
function makeShadowTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,0.62)');
  g.addColorStop(0.3, 'rgba(0,0,0,0.54)');
  g.addColorStop(0.62, 'rgba(0,0,0,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Paño, luces y sombras: el "sitio" donde está el juego. */
export function createStage(scene: THREE.Scene, textures: TableTextures) {
  scene.background = makeBackgroundTexture();
  scene.fog = new THREE.Fog(0x1a1109, 40, 78);

  // paño de fieltro verde, como una mesa de billar
  const feltMaterial = new THREE.MeshPhysicalMaterial({
    map: textures.felt,
    normalMap: textures.feltNormal,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: textures.feltRough,
    roughness: 1,
    metalness: 0,
    // ojo: el color del material está compensado para la luz cálida de la escena,
    // de forma que el paño renderizado sea el #1c5450 medido en la foto de referencia
    color: 0x0b5a8e,
    // el "sheen" es lo que hace que una tela se lea como tela: reflejo suave en ángulo rasante
    sheen: 0.85,
    sheenRoughness: 0.62,
    sheenColor: new THREE.Color(0x59bdb0),
  });
  const felt = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), feltMaterial);
  felt.rotation.x = -Math.PI / 2;
  felt.position.y = -BOARD_HEIGHT;
  felt.receiveShadow = true;
  scene.add(felt);

  // sombra de contacto difusa bajo el tablero
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(BOARD_RADIUS * 2.8, BOARD_RADIUS * 2.8),
    new THREE.MeshBasicMaterial({
      map: makeShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = -BOARD_HEIGHT + 0.004;
  scene.add(contact);

  // luces: cálidas, de lámpara de mesa
  const hemi = new THREE.HemisphereLight(0xffe2bd, 0x4a2f1b, 0.78);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffd39a, 2.7);
  key.position.set(9.5, 17, 8.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -17;
  key.shadow.camera.right = 17;
  key.shadow.camera.top = 17;
  key.shadow.camera.bottom = -17;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 55;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.028;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffb277, 0.5);
  fill.position.set(-11, 9, -9);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffc98a, 0.62);
  rim.position.set(-4, 4, 13);
  scene.add(rim);

  // foco cálido sobre la mesa, como la lámpara colgada encima
  const lamp = new THREE.PointLight(0xffb469, 26, 46, 2);
  lamp.position.set(0, 16, 6);
  scene.add(lamp);

  scene.add(new THREE.AmbientLight(0xffe9d5, 0.18));
}

const VIEW_ELEVATION = 0.74; // rad ≈ 42°
const VIEW_FILL = 0.8; // fracción del encuadre que ocupa el tablero
const VIEW_ZOOM = 0.76; // acerca la cámara ~25 % en tamaño aparente del tablero

/**
 * Encuadra el tablero en tres pasos: distancia para que quepa, zoom, y centrado
 * vertical. La elipse del tablero en perspectiva no está centrada en el lienzo
 * (el borde cercano se proyecta más lejos), así que sin el último paso el
 * tablero se sale por abajo al acercarse.
 */
function fitCamera(camera: THREE.PerspectiveCamera, target: THREE.Vector3) {
  const radius = BOARD_RADIUS + 0.5;
  const samples: THREE.Vector3[] = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    samples.push(new THREE.Vector3(Math.cos(a) * radius, 0.3, -Math.sin(a) * radius));
  }

  const place = (distance: number) => {
    camera.position.set(0, distance * Math.sin(VIEW_ELEVATION), distance * Math.cos(VIEW_ELEVATION));
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
  };

  // 1 · distancia a la que el círculo ocupa VIEW_FILL del encuadre
  let distance = 26;
  const probe = new THREE.Vector3();
  for (let iter = 0; iter < 8; iter++) {
    place(distance);
    let extent = 0;
    for (const p of samples) {
      probe.copy(p).project(camera);
      extent = Math.max(extent, Math.abs(probe.x), Math.abs(probe.y));
    }
    if (extent < 0.0001) break;
    const correction = extent / VIEW_FILL;
    distance *= correction;
    if (Math.abs(correction - 1) < 0.012) break;
  }

  // 2 · acercar
  distance *= VIEW_ZOOM;

  // 3 · centrar la elipse en vertical moviendo el punto de mira
  const halfTan = Math.tan((camera.fov * Math.PI) / 360);
  for (let iter = 0; iter < 8; iter++) {
    place(distance);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of samples) {
      probe.copy(p).project(camera);
      if (probe.y < minY) minY = probe.y;
      if (probe.y > maxY) maxY = probe.y;
    }
    const mid = (minY + maxY) / 2;
    if (Math.abs(mid) < 0.004) break;
    target.y += mid * distance * halfTan;
  }

  place(distance);
}

export function createCamera(): {
  camera: THREE.PerspectiveCamera;
  fit: () => void;
  target: THREE.Vector3;
} {
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 240);
  const target = new THREE.Vector3(0, 0, 0);
  const fit = () => fitCamera(camera, target);
  fit();
  return { camera, fit, target };
}

export function createControls(camera: THREE.PerspectiveCamera, dom: HTMLElement, target: THREE.Vector3) {
  const controls = new OrbitControls(camera, dom);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.target.copy(target);
  controls.minDistance = 11;
  controls.maxDistance = 48;
  controls.minPolarAngle = 0.22;
  controls.maxPolarAngle = 1.06; // no se puede mirar por debajo de la mesa
  controls.update();
  return controls;
}
