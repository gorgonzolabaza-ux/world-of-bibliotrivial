/**
 * Niveles de calidad gráfica.
 *
 * El coste de esta escena es casi todo relleno de píxeles: el paño cubre la
 * pantalla entera con un shader físico con sheen. Por eso lo que más manda es
 * la resolución de dibujo, y después el tamaño del mapa de sombras y el coste
 * por píxel de los materiales.
 *
 * Nada de esto quita funcionalidad: las texturas siguen todas, la física sigue
 * igual y el juego se juega igual. Solo cambia con cuántos píxeles y con cuánto
 * detalle se dibuja.
 *
 * Para forzar un nivel al probar:  ?tier=low   (o medium / high)
 * Para forzar el factor de resolución:      ?dpr=1.5
 */

export type Tier = 'high' | 'medium' | 'low';

export interface Quality {
  tier: Tier;
  /** Tope de pixel ratio (1 = píxel CSS = píxel de dibujo). */
  maxPixelRatio: number;
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  softShadows: boolean;
  /** Filtrado anisotrópico máximo de las texturas. */
  maxAnisotropy: number;
  /** Sheen del paño: es el detalle más caro por píxel de la escena. */
  sheen: boolean;
  /** Si las 66 casillas proyectan sombra (la pasada de sombras las redibuja). */
  tileShadows: boolean;
  physicsSubSteps: number;
}

const PRESETS: Record<Tier, Omit<Quality, 'tier'>> = {
  high: {
    maxPixelRatio: 2,
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    softShadows: true,
    maxAnisotropy: 16,
    sheen: true,
    tileShadows: true,
    physicsSubSteps: 6,
  },
  medium: {
    maxPixelRatio: 1.5,
    antialias: true,
    shadows: true,
    shadowMapSize: 1024,
    softShadows: false,
    maxAnisotropy: 8,
    sheen: true,
    tileShadows: false,
    physicsSubSteps: 4,
  },
  low: {
    maxPixelRatio: 1.15,
    antialias: false,
    shadows: true,
    shadowMapSize: 512,
    softShadows: false,
    maxAnisotropy: 4,
    // el paño mantiene color, relieve y rugosidad; solo se ahorra el sheen
    sheen: false,
    tileShadows: false,
    physicsSubSteps: 3,
  },
};

function detectTier(): Tier {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;

  if (coarse) {
    if (cores <= 4 || memory <= 3) return 'low';
    return 'medium';
  }
  if (cores <= 2) return 'low';
  return cores >= 8 ? 'high' : 'medium';
}

function readOverrides(): { tier?: Tier; dpr?: number } {
  if (typeof location === 'undefined') return {};
  const params = new URLSearchParams(location.search);
  const tier = params.get('tier');
  const dpr = params.get('dpr');
  return {
    tier: tier === 'high' || tier === 'medium' || tier === 'low' ? tier : undefined,
    dpr: dpr ? Number(dpr) : undefined,
  };
}

const override = readOverrides();

export const quality: Quality = {
  tier: override.tier ?? detectTier(),
  ...PRESETS[override.tier ?? detectTier()],
  maxPixelRatio: override.dpr ?? PRESETS[override.tier ?? detectTier()].maxPixelRatio,
};

/** Pixel ratio efectivo, respetando el tope del nivel. */
export function pixelRatioFor(base: number, limit: number): number {
  return Math.max(0.6, Math.min(base, limit));
}
