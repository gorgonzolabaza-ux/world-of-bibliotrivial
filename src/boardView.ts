import * as THREE from 'three';
import { CATEGORIES } from './categories';
import type { CategoryKey } from './categories';
import {
  NODES,
  SECTOR_COUNT,
  PLATE_RADIUS,
  PLATE_HEIGHT,
  BOARD_RADIUS,
  BOARD_HEIGHT,
  TILE_RADIUS,
  TILE_HEIGHT,
  HQ_RADIUS,
  HQ_HEIGHT,
  HUB_RADIUS,
  HUB_HEIGHT,
} from './board';
import type { TableTextures } from './table';
import { quality } from './quality';
import dieWoodUrl from './assets/textures/die_wood.jpg?url';
import marbleUrl from './assets/textures/marble_grain.jpg?url';

export interface BoardView {
  group: THREE.Group;
  tiles: THREE.Mesh[];
  worldPos(nodeId: number): THREE.Vector3;
  highlight(ids: Set<number> | null): void;
  setQuesito(category: CategoryKey, on: boolean): void;
  resetQuesitos(): void;
}

function shade(color: number, factor: number): number {
  const c = new THREE.Color(color);
  c.multiplyScalar(factor);
  return c.getHex();
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.width = 512;
    img.height = 512;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('no se pudo cargar ' + url));
    img.src = url;
  });
}

/** Rasteriza un SVG monocromo a textura (los iconos de game-icons.net no traen width/height). */
async function loadIconTexture(url: string): Promise<THREE.Texture> {
  const res = await fetch(url);
  let svg = await res.text();
  if (!/\bwidth=/.test(svg.slice(0, 400))) {
    svg = svg.replace('<svg', '<svg width="512" height="512"');
  }
  const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(blobUrl);
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(4, quality.maxAnisotropy);
    return tex;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Veta de madera neutra para los paneles: se desatura y se comprime a un rango
 * alto de luminancia (0,72–1,00) para que multiplicada por el color de la
 * categoría añada textura sin cambiar el tono.
 */
async function loadGrainTexture(): Promise<THREE.Texture> {
  const img = await loadImage(dieWoodUrl);
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, size, size);

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  const lum = new Float32Array(size * size);
  let min = 255;
  let max = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    lum[p] = l;
    if (l < min) min = l;
    if (l > max) max = l;
  }
  const span = Math.max(1, max - min);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const t = (lum[p] - min) / span;
    const v = Math.round(255 * (0.64 + 0.36 * t));
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.115, 0.115);
  tex.center.set(0.5, 0.5);
  tex.rotation = 0.32;
  tex.anisotropy = Math.min(8, quality.maxAnisotropy);
  return tex;
}

/**
 * Mármol neutro para las casillas: se usa como mapa que multiplica el color de
 * cada categoría, así que aporta veteado sin cambiar el tono.
 */
async function loadMarbleTexture(): Promise<THREE.Texture> {
  const img = await loadImage(marbleUrl);
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.5, 0.5);
  tex.anisotropy = Math.min(8, quality.maxAnisotropy);
  return tex;
}

/**
 * Dado en perspectiva isométrica para las casillas de "tira otra vez":
 * cuerpo claro con los pips oscuros, la cara de arriba más iluminada y el
 * canto sombreado, para que se lea como una pieza y no como un icono plano.
 */
function makeDieIconTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  // vértices de la cara superior (rombo isométrico)
  const top = { x: size * 0.5, y: size * 0.2 };
  const edgeA = { x: size * 0.32, y: size * 0.185 };
  const edgeB = { x: -size * 0.32, y: size * 0.185 };
  const depth = size * 0.185;
  const add = (p: { x: number; y: number }, q: { x: number; y: number }) => ({ x: p.x + q.x, y: p.y + q.y });
  const down = (p: { x: number; y: number }) => ({ x: p.x, y: p.y + depth });

  const p1 = add(top, edgeA);
  const p2 = add(add(top, edgeA), edgeB);
  const p3 = add(top, edgeB);

  const polygon = (points: { x: number; y: number }[], fill: string | CanvasGradient) => {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(58,42,22,0.95)';
    ctx.lineWidth = size * 0.012;
    ctx.stroke();
  };

  // sombra de contacto
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(size * 0.5, size * 0.76, size * 0.33, size * 0.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(30,20,10,0.22)';
  ctx.filter = 'blur(6px)';
  ctx.fill();
  ctx.restore();

  // caras laterales
  polygon([p3, p2, down(p2), down(p3)], '#c0a271');
  polygon([p1, p2, down(p2), down(p1)], '#a98c5c');

  // cara superior
  const face = ctx.createLinearGradient(top.x - size * 0.3, top.y, top.x + size * 0.3, p2.y);
  face.addColorStop(0, '#f6ecd6');
  face.addColorStop(1, '#e2d2b2');
  polygon([top, p1, p2, p3], face);

  // pips oscuros sobre la cara superior
  const pips: [number, number][] = [
    [0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72],
  ];
  for (const [u, v] of pips) {
    const x = top.x + edgeA.x * u + edgeB.x * v;
    const y = top.y + edgeA.y * u + edgeB.y * v;
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.05, size * 0.05 * 0.72, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#33261a';
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, quality.maxAnisotropy);
  return tex;
}

export function createBoardView(textures: TableTextures): BoardView {
  const group = new THREE.Group();
  const tiles: THREE.Mesh[] = [];

  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b475, metalness: 0.72, roughness: 0.34 });

  /* ---------- base de madera ---------- */
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(BOARD_RADIUS, BOARD_RADIUS * 1.004, BOARD_HEIGHT, 128),
    new THREE.MeshStandardMaterial({
      map: textures.wood,
      normalMap: textures.woodNormal,
      color: 0xd2bda2,
      roughness: 0.6,
      metalness: 0.05,
    }),
  );
  base.position.y = -BOARD_HEIGHT / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const band = new THREE.Mesh(new THREE.TorusGeometry(BOARD_RADIUS - 0.03, 0.05, 8, 140), gold);
  band.rotation.x = Math.PI / 2;
  band.position.y = -0.045;
  group.add(band);

  /* ---------- cuñas de color (los seis sectores) ---------- */
  const sectorSpan = 360 / SECTOR_COUNT;
  // las cuñas se tocan: el hueco entre ellas era lo que dejaba ver la madera.
  // La junta la marca una incrustación dorada, no un hueco.
  const gapDeg = 0.05;
  const plateMaterials: THREE.MeshStandardMaterial[] = [];
  for (let s = 0; s < SECTOR_COUNT; s++) {
    const category = CATEGORIES[s];
    const start = THREE.MathUtils.degToRad(s * sectorSpan + gapDeg);
    const end = THREE.MathUtils.degToRad((s + 1) * sectorSpan - gapDeg);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.absarc(0, 0, PLATE_RADIUS, start, end, false);
    shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: PLATE_HEIGHT, bevelEnabled: false, curveSegments: 72 });
    geo.rotateX(-Math.PI / 2);
    const plate = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: shade(category.color, 0.58), roughness: 0.66, metalness: 0.04 }),
    );
    plate.receiveShadow = true;
    group.add(plate);
    plateMaterials.push(plate.material as THREE.MeshStandardMaterial);
  }

  /* ---------- junta dorada entre cuñas ---------- */
  // Una varilla fina en cada uno de los seis radios, a ras de la superficie.
  // Queda por debajo del centro y de las casillas, así que solo se ve el tramo
  // que separa dos paneles.
  const seamMaterial = new THREE.MeshStandardMaterial({
    // sin mapa de entorno un metal puro se ve negro: se baja el metalness y se
    // sube el color para que lea como latón pulido bajo la luz de la escena
    color: 0xe8c689,
    metalness: 0.45,
    roughness: 0.3,
  });
  const seamInner = HUB_RADIUS * 0.6;
  const seamLength = PLATE_RADIUS - seamInner;
  for (let s = 0; s < SECTOR_COUNT; s++) {
    const angle = THREE.MathUtils.degToRad(s * sectorSpan);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(seamLength, 0.014, 0.075), seamMaterial);
    seam.position.set(
      Math.cos(angle) * (seamInner + seamLength / 2),
      PLATE_HEIGHT + 0.004,
      -Math.sin(angle) * (seamInner + seamLength / 2),
    );
    seam.rotation.y = angle;
    group.add(seam);
  }

  // veta de madera en los paneles, manteniendo el color de cada categoría
  if (plateMaterials.length > 0) {
    loadGrainTexture()
      .then((grain) => {
        for (const material of plateMaterials) {
          material.map = grain;
          material.needsUpdate = true;
        }
      })
      .catch(() => {
        /* sin veta: quedan de color liso */
      });
  }

  /* ---------- casillas ---------- */
  const iconPlanes: { mesh: THREE.Mesh; category: CategoryKey }[] = [];
  const diceIconPlanes: THREE.Mesh[] = [];
  const tileMaterials: THREE.MeshStandardMaterial[] = [];
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd98a,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const addHalo = (mesh: THREE.Mesh, radius: number, x: number, z: number) => {
    const halo = new THREE.Mesh(new THREE.RingGeometry(radius * 1.14, radius * 1.46, 44), haloMaterial);
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(x, PLATE_HEIGHT + 0.009, z);
    halo.visible = false;
    group.add(halo);
    mesh.userData.halo = halo;
  };

  for (const node of NODES) {
    const p = node.pos;

    if (node.type === 'hub') {
      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(HUB_RADIUS, HUB_RADIUS * 1.03, HUB_HEIGHT, 6),
        new THREE.MeshStandardMaterial({ color: 0x3b2c1d, metalness: 0.5, roughness: 0.44 }),
      );
      hub.position.set(0, PLATE_HEIGHT + HUB_HEIGHT / 2, 0);
      hub.castShadow = quality.tileShadows;
      hub.receiveShadow = true;
      hub.userData = {
        nodeId: node.id,
        baseY: hub.position.y,
        emissive: 0x000000,
        emissiveIntensity: 0,
        glow: 0xffd08a,
      };
      group.add(hub);
      tiles.push(hub);
      addHalo(hub, HUB_RADIUS, 0, 0);

      const hubRing = new THREE.Mesh(new THREE.TorusGeometry(HUB_RADIUS * 0.99, 0.055, 8, 6), gold);
      hubRing.rotation.x = Math.PI / 2;
      hubRing.rotation.z = Math.PI / 6;
      hubRing.position.y = PLATE_HEIGHT + HUB_HEIGHT - 0.012;
      group.add(hubRing);
      continue;
    }

    const isHq = node.type === 'headquarters';
    const isRollAgain = node.type === 'rollagain';
    const height = isHq ? HQ_HEIGHT : TILE_HEIGHT;
    const radius = isHq ? HQ_RADIUS : TILE_RADIUS;

    const color = isRollAgain ? 0xded0b0 : isHq ? CATEGORIES.find((c) => c.key === node.category)!.color : shade(
      CATEGORIES.find((c) => c.key === node.category)!.color,
      1.08,
    );

    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: isRollAgain ? 0.44 : 0.32,
      metalness: isRollAgain ? 0.02 : 0.12,
      emissive: isHq ? color : 0x000000,
      emissiveIntensity: isHq ? 0.32 : 0,
    });

    const geometry = new THREE.CylinderGeometry(radius * 0.97, radius, height, 32);
    // desplaza las UV de cada casilla para que el veteado del mármol no se repita
    const uv = geometry.attributes.uv;
    const du = Math.random() * 0.62;
    const dv = Math.random() * 0.62;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) + du, uv.getY(i) + dv);
    }

    const tile = new THREE.Mesh(geometry, material);
    tileMaterials.push(material);
    tile.position.set(p.x, p.y - height / 2, p.z);
    tile.castShadow = quality.tileShadows;
    tile.receiveShadow = true;
    tile.userData = {
      nodeId: node.id,
      baseY: tile.position.y,
      emissive: isHq ? color : 0x000000,
      emissiveIntensity: isHq ? 0.32 : 0,
      glow: isRollAgain ? 0xffd08a : shade(color, 1.75),
    };
    group.add(tile);
    tiles.push(tile);
    addHalo(tile, radius, p.x, p.z);

    if (isHq) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.06, 0.045, 6, 40), gold);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(p.x, p.y - 0.02, p.z);
      ring.castShadow = false;
      group.add(ring);

      const iconMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.92, depthWrite: false });
      const icon = new THREE.Mesh(new THREE.PlaneGeometry(radius * 1.25, radius * 1.25), iconMat);
      icon.rotation.x = -Math.PI / 2;
      icon.position.set(p.x, p.y + 0.014, p.z);
      group.add(icon);
      iconPlanes.push({ mesh: icon, category: node.category });
    } else if (isRollAgain) {
      // dado grabado en las casillas de "tira otra vez"
      const icon = new THREE.Mesh(
        new THREE.PlaneGeometry(radius * 1.5, radius * 1.5),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false }),
      );
      icon.rotation.x = -Math.PI / 2;
      icon.position.set(p.x, p.y + 0.012, p.z);
      group.add(icon);
      diceIconPlanes.push(icon);
    }
  }

  /* ---------- mármol en las casillas ---------- */
  if (tileMaterials.length > 0) {
    loadMarbleTexture()
      .then((marble) => {
        for (const material of tileMaterials) {
          material.map = marble;
          material.needsUpdate = true;
        }
      })
      .catch(() => {
        /* sin mármol: quedan de color liso */
      });
  }

  /* ---------- dado grabado en las casillas de "tira otra vez" ---------- */
  if (diceIconPlanes.length > 0) {
    const tex = makeDieIconTexture();
    for (const mesh of diceIconPlanes) {
      (mesh.material as THREE.MeshBasicMaterial).map = tex;
      (mesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
    }
  }

  /* ---------- iconos de categoría sobre las sedes ---------- */
  for (const { mesh, category } of iconPlanes) {
    const def = CATEGORIES.find((c) => c.key === category)!;
    loadIconTexture(def.icon)
      .then((tex) => {
        (mesh.material as THREE.MeshBasicMaterial).map = tex;
        (mesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
      })
      .catch(() => {
        /* sin icono: la sede sigue siendo reconocible por su color */
      });
  }

  return {
    group,
    tiles,
    worldPos(nodeId: number) {
      const node = NODES[nodeId];
      return new THREE.Vector3(node.pos.x, node.pos.y, node.pos.z);
    },
    highlight(ids: Set<number> | null) {
      for (const tile of tiles) {
        const id = tile.userData.nodeId as number;
        const on = !!ids && ids.has(id);
        const material = tile.material as THREE.MeshStandardMaterial;
        const halo = tile.userData.halo as THREE.Mesh | undefined;
        if (halo) halo.visible = on;
        if (on) {
          material.emissive.setHex(tile.userData.glow as number);
          material.emissiveIntensity = 0.48;
          tile.position.y = (tile.userData.baseY as number) + 0.13;
          tile.scale.setScalar(1.11);
        } else {
          material.emissive.setHex(tile.userData.emissive as number);
          material.emissiveIntensity = tile.userData.emissiveIntensity as number;
          tile.position.y = tile.userData.baseY as number;
          tile.scale.setScalar(1);
        }
      }
    },
    setQuesito(_category: CategoryKey, _on: boolean) {
      /* los quesitos se muestran en la peana de la ficha */
    },
    resetQuesitos() {
      /* idem */
    },
  };
}
