import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BOARD_RADIUS, BOARD_HEIGHT } from './board';
import { quality } from './quality';
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
  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), quality.maxAnisotropy);
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
  renderer.setPixelRatio(pixelRatioFor(window.devicePixelRatio, quality.maxPixelRatio));
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = quality.softShadows ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
}

/** Pixel ratio efectivo, respetando el tope del nivel de calidad. */
export function pixelRatioFor(base: number, limit: number): number {
  return Math.max(0.6, Math.min(base, limit));
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
  const feltOptions: THREE.MeshStandardMaterialParameters = {
    map: textures.felt,
    normalMap: textures.feltNormal,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: textures.feltRough,
    roughness: 1,
    metalness: 0,
    // ojo: el color del material está compensado para la luz cálida de la escena,
    // de forma que el paño renderizado sea el #1c5450 medido en la foto de referencia
    color: 0x0b5a8e,
  };
  // El sheen (reflejo suave en ángulo rasante) es lo que hace que la tela se lea
  // como tela, pero es también lo más caro por píxel de toda la escena: el paño
  // ocupa la pantalla entera. En el nivel bajo se cambia por un material estándar
  // manteniendo color, relieve y rugosidad.
  const feltMaterial = quality.sheen
    ? new THREE.MeshPhysicalMaterial({
        ...feltOptions,
        sheen: 0.85,
        sheenRoughness: 0.62,
        sheenColor: new THREE.Color(0x59bdb0),
      })
    : new THREE.MeshStandardMaterial(feltOptions);
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
  key.castShadow = quality.shadows;
  key.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
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
// Fracción del encuadre que ocupa el tablero en su dimensión limitante.
// En apaisado limita el alto; en vertical, el ancho: el mismo valor vale para
// las dos, así que en un móvil en vertical el tablero tampoco se sale.
const VIEW_FILL = 0.84;

/**
 * Encuadra el tablero en dos pasos: distancia a la que ocupa VIEW_FILL y
 * centrado vertical. La elipse del tablero en perspectiva no está centrada en
 * el lienzo (el borde cercano se proyecta más lejos), así que sin el segundo
 * paso el tablero se sale por abajo.
 */
function fitCamera(camera: THREE.PerspectiveCamera, target: THREE.Vector3) {
  // En vertical (móvil) se sube la cámara: el tablero es un círculo y en una
  // pantalla estrecha solo cabe a lo ancho, así que una vista más cenital
  // aprovecha mucho mejor el alto disponible.
  const elevation = camera.aspect < 0.9 ? 0.98 : VIEW_ELEVATION;
  const radius = BOARD_RADIUS + 0.5;
  const samples: THREE.Vector3[] = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    samples.push(new THREE.Vector3(Math.cos(a) * radius, 0.3, -Math.sin(a) * radius));
  }

  const place = (distance: number) => {
    camera.position.set(0, distance * Math.sin(elevation), distance * Math.cos(elevation));
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
  };

  const probe = new THREE.Vector3();
  const halfTan = Math.tan((camera.fov * Math.PI) / 360);

  /** Centra la elipse en vertical moviendo el punto de mira. */
  const centerVertically = (distance: number) => {
    target.y = 0;
    for (let iter = 0; iter < 6; iter++) {
      place(distance);
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of samples) {
        probe.copy(p).project(camera);
        if (probe.y < minY) minY = probe.y;
        if (probe.y > maxY) maxY = probe.y;
      }
      const mid = (minY + maxY) / 2;
      if (Math.abs(mid) < 0.003) break;
      target.y += mid * distance * halfTan;
    }
  };

  /*
   * El tamaño y el centrado van juntos: mover el punto de mira cambia la
   * extensión proyectada y acercarse cambia el centrado. Se resuelven en un
   * solo bucle, ajustando la distancia con la elipse ya centrada, hasta que
   * ocupa VIEW_FILL del encuadre en su dimensión limitante (el ancho en
   * vertical, el alto en apaisado).
   */
  let distance = 26;
  for (let iter = 0; iter < 10; iter++) {
    centerVertically(distance);
    place(distance);
    let extent = 0;
    for (const p of samples) {
      probe.copy(p).project(camera);
      extent = Math.max(extent, Math.abs(probe.x), Math.abs(probe.y));
    }
    if (extent < 0.0001) break;
    const correction = extent / VIEW_FILL;
    distance *= correction;
    if (Math.abs(correction - 1) < 0.008) break;
  }

  centerVertically(distance);
  place(distance);
}

export function createCamera(): {
  camera: THREE.PerspectiveCamera;
  fit: () => void;
  target: THREE.Vector3;
} {
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 240);
  const target = new THREE.Vector3(0, 0, 0);
  const fit = () => {
    fitCamera(camera, target);
    // depuración del encuadre: ?debug=fit
    if (new URLSearchParams(location.search).get('debug') === 'fit') {
      const v = new THREE.Vector3();
      let ex = 0;
      let ey = 0;
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        v.set(Math.cos(a) * (BOARD_RADIUS + 0.5), 0.3, -Math.sin(a) * (BOARD_RADIUS + 0.5)).project(camera);
        ex = Math.max(ex, Math.abs(v.x));
        ey = Math.max(ey, Math.abs(v.y));
      }
      console.log('[fit]', JSON.stringify({
        aspect: +camera.aspect.toFixed(3),
        inner: [window.innerWidth, window.innerHeight],
        distance: +camera.position.length().toFixed(2),
        ex: +ex.toFixed(3),
        ey: +ey.toFixed(3),
        targetY: +target.y.toFixed(2),
      }));
    }
  };
  fit();
  return { camera, fit, target };
}

export function createControls(camera: THREE.PerspectiveCamera, dom: HTMLElement, target: THREE.Vector3) {
  const controls = new OrbitControls(camera, dom);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.target.copy(target);
  controls.minPolarAngle = 0.22;
  controls.maxPolarAngle = 1.06; // no se puede mirar por debajo de la mesa
  updateControlLimits(controls, camera);
  controls.update();
  return controls;
}

/**
 * Los límites de zoom salen de la distancia que ha calculado el encuadre.
 * Si se fijan a mano, en pantallas estrechas el encuadre necesita mucha más
 * distancia de la prevista y los controles recortan la cámara: el tablero
 * acaba saliéndose de la pantalla.
 */
export function updateControlLimits(controls: OrbitControls, camera: THREE.PerspectiveCamera) {
  const distance = camera.position.length();
  controls.minDistance = Math.max(6, distance * 0.55);
  controls.maxDistance = Math.max(24, distance * 1.9);
}

/** La niebla se ajusta a la distancia de cámara: si no, en vertical el tablero se empaña. */
export function tuneFogForCamera(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  const distance = camera.position.length();
  const fog = scene.fog;
  if (fog instanceof THREE.Fog) {
    // empieza justo pasado el tablero y se cierra más allá, para que el paño
    // se funda con la penumbra pero el tablero quede limpio
    fog.near = distance * 1.02;
    fog.far = distance * 2.4;
  }
}
