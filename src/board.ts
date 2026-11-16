import type { CategoryKey } from './categories';
import { CATEGORIES } from './categories';

export type TileType = 'normal' | 'headquarters' | 'hub' | 'rollagain';

export interface BoardNode {
  id: number;
  category: CategoryKey;
  type: TileType;
  isQuesitoSlot: boolean;
  /** y = altura de la cara superior de la casilla (donde se apoya la ficha). */
  pos: { x: number; y: number; z: number };
  angle: number;
  ringIndex: number;
}

/* ---------------- medidas del tablero (unidades de mundo) ---------------- */

export const SECTOR_COUNT = 6;
export const RING_PER_SECTOR = 7;
export const HQ_INDEX = 3;

export const RING_RADIUS = 9.8;
export const SPOKE_RADII = [3.4, 4.95, 6.5, 8.05];

export const PLATE_RADIUS = 11.25;
export const PLATE_HEIGHT = 0.06;
export const BOARD_RADIUS = 11.9;
export const BOARD_HEIGHT = 0.55;

export const TILE_RADIUS = 0.62;
export const TILE_HEIGHT = 0.16;
export const HQ_RADIUS = 0.78;
export const HQ_HEIGHT = 0.24;
export const HUB_RADIUS = 1.8;
export const HUB_HEIGHT = 0.28;

export const NORMAL_SURFACE = PLATE_HEIGHT + TILE_HEIGHT;
export const HQ_SURFACE = PLATE_HEIGHT + HQ_HEIGHT;
export const HUB_SURFACE = PLATE_HEIGHT + HUB_HEIGHT;

/* ---------------- grafo ---------------- */

export const NODES: BoardNode[] = [];
export const ADJ: number[][] = [];

/** Ángulo en grados: 0 = derecha (+x), crece hacia -z (horario visto desde arriba). */
function polar(radius: number, angleDeg: number): { x: number; z: number } {
  const a = (angleDeg * Math.PI) / 180;
  return { x: radius * Math.cos(a), z: -radius * Math.sin(a) };
}

function addNode(n: BoardNode): number {
  NODES.push(n);
  ADJ.push([]);
  return n.id;
}

function link(a: number, b: number) {
  if (!ADJ[a].includes(b)) ADJ[a].push(b);
  if (!ADJ[b].includes(a)) ADJ[b].push(a);
}

export function buildBoard(): BoardNode[] {
  NODES.length = 0;
  ADJ.length = 0;

  const sectorSpan = 360 / SECTOR_COUNT;
  const ringStep = sectorSpan / RING_PER_SECTOR;

  // 0 · centro
  const hubId = addNode({
    id: 0,
    category: CATEGORIES[0].key,
    type: 'hub',
    isQuesitoSlot: false,
    pos: { x: 0, y: HUB_SURFACE, z: 0 },
    angle: 0,
    ringIndex: -1,
  });

  // 1 · radios (del centro hacia fuera)
  const spokes: number[][] = [];
  for (let s = 0; s < SECTOR_COUNT; s++) {
    const category = CATEGORIES[s].key;
    const center = s * sectorSpan + sectorSpan / 2;
    const ids: number[] = [];
    for (const radius of SPOKE_RADII) {
      const p = polar(radius, center);
      ids.push(
        addNode({
          id: NODES.length,
          category,
          type: 'normal',
          isQuesitoSlot: false,
          pos: { x: p.x, y: NORMAL_SURFACE, z: p.z },
          angle: center,
          ringIndex: -1,
        }),
      );
    }
    link(hubId, ids[0]);
    for (let j = 1; j < ids.length; j++) link(ids[j - 1], ids[j]);
    spokes.push(ids);
  }

  // 2 · anillo exterior: 7 casillas por sector, la de en medio es la sede
  const ringStart = NODES.length;
  for (let s = 0; s < SECTOR_COUNT; s++) {
    const category = CATEGORIES[s].key;
    for (let i = 0; i < RING_PER_SECTOR; i++) {
      const angle = s * sectorSpan + (i + 0.5) * ringStep;
      const isHq = i === HQ_INDEX;
      const isRollAgain = i === 1;
      const p = polar(RING_RADIUS, angle);
      addNode({
        id: NODES.length,
        category,
        type: isHq ? 'headquarters' : isRollAgain ? 'rollagain' : 'normal',
        isQuesitoSlot: isHq,
        pos: { x: p.x, y: isHq ? HQ_SURFACE : NORMAL_SURFACE, z: p.z },
        angle,
        ringIndex: s * RING_PER_SECTOR + i,
      });
    }
  }

  const ringCount = SECTOR_COUNT * RING_PER_SECTOR;
  for (let k = 0; k < ringCount; k++) {
    link(ringStart + k, ringStart + ((k + 1) % ringCount));
  }

  // 3 · cada sede cierra su radio
  for (let s = 0; s < SECTOR_COUNT; s++) {
    const hqId = ringStart + s * RING_PER_SECTOR + HQ_INDEX;
    link(hqId, spokes[s][spokes[s].length - 1]);
  }

  return NODES;
}

export function nodePosition(id: number): { x: number; y: number; z: number } {
  return NODES[id].pos;
}
