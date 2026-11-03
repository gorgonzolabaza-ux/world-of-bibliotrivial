import type { ThemeKey } from './types';
import { THEMES } from './themes';

export type TileType = 'normal' | 'headquarters' | 'hub' | 'rollagain';

export interface BoardNode {
  id: number;
  theme: ThemeKey;
  type: TileType;
  isQuesitoSlot: boolean;
  pos: { x: number; y: number; z: number };
}

const OUTER_COUNT = 72; // 8 per theme * 9, colors interleaved

export const NODES: BoardNode[] = [];
export const ADJ: number[][] = [];

function addNode(n: BoardNode) {
  NODES.push(n);
  ADJ.push([]);
}
function link(a: number, b: number) {
  if (!ADJ[a].includes(b)) ADJ[a].push(b);
  if (!ADJ[b].includes(a)) ADJ[b].push(a);
}

export function buildBoard() {
  NODES.length = 0;
  ADJ.length = 0;

  const R = 9;
  const r = 4.2;

  // Outer ring: colors interleaved
  for (let i = 0; i < OUTER_COUNT; i++) {
    const theme = THEMES[i % THEMES.length].key as ThemeKey;
    const angle = (i / OUTER_COUNT) * Math.PI * 2;
    const type: TileType = (i % 4 === 2) ? 'rollagain' : 'normal';
    addNode({
      id: NODES.length,
      theme,
      type,
      isQuesitoSlot: false,
      pos: { x: R * Math.cos(angle), y: 0.12, z: R * Math.sin(angle) },
    });
  }

  // Outer ring adjacency
  for (let i = 0; i < OUTER_COUNT; i++) {
    link(i, (i + 1) % OUTER_COUNT);
    link(i, (i - 1 + OUTER_COUNT) % OUTER_COUNT);
  }

  // Headquarters: one per theme, at theme center angles
  const hqBase = NODES.length;
  for (let k = 0; k < THEMES.length; k++) {
    const theme = THEMES[k].key as ThemeKey;
    const angle = ((k + 0.5) / THEMES.length) * Math.PI * 2;
    addNode({
      id: NODES.length,
      theme,
      type: 'headquarters',
      isQuesitoSlot: true,
      pos: { x: r * Math.cos(angle), y: 0.12, z: r * Math.sin(angle) },
    });
  }

  // Hub
  const hubId = NODES.length;
  addNode({
    id: hubId,
    theme: THEMES[0].key as ThemeKey,
    type: 'hub',
    isQuesitoSlot: false,
    pos: { x: 0, y: 0.2, z: 0 },
  });

  // Link each headquarters to hub and to nearest outer node of same theme
  for (let k = 0; k < THEMES.length; k++) {
    const hqId = hqBase + k;
    const themeKey = THEMES[k].key;
    // find outer node of same theme closest in angle
    const hqAngle = ((k + 0.5) / THEMES.length) * Math.PI * 2;
    let bestOuter = -1;
    let bestDist = Infinity;
    for (let i = 0; i < OUTER_COUNT; i++) {
      if (NODES[i].theme !== themeKey) continue;
      const a = (i / OUTER_COUNT) * Math.PI * 2;
      const d = Math.abs(Math.atan2(Math.sin(a - hqAngle), Math.cos(a - hqAngle)));
      if (d < bestDist) { bestDist = d; bestOuter = i; }
    }
    if (bestOuter >= 0) link(hqId, bestOuter);
    link(hqId, hubId);
  }

  return NODES;
}

export function nodePosition(id: number): { x: number; y: number; z: number } {
  return NODES[id].pos;
}
