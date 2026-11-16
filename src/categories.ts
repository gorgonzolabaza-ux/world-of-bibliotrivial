/**
 * Las seis categorías del tablero (las cuñas del quesito).
 * El examen se reparte entre ellas al ingerirlo: ver scripts/ingest.mjs.
 */
export type CategoryKey =
  | 'legislacion'
  | 'procesos'
  | 'servicios'
  | 'gestion'
  | 'bibliografia'
  | 'tecnologias';

export interface Category {
  key: CategoryKey;
  name: string;
  short: string;
  color: number;
  css: string;
  icon: string;
}

import iconLegislacion from './assets/icons/legislacion.svg?url';
import iconProcesos from './assets/icons/procesos.svg?url';
import iconServicios from './assets/icons/servicios.svg?url';
import iconGestion from './assets/icons/gestion.svg?url';
import iconBibliografia from './assets/icons/bibliografia.svg?url';
import iconTecnologias from './assets/icons/tecnologias.svg?url';

export const CATEGORIES: Category[] = [
  {
    key: 'legislacion',
    name: 'Legislación',
    short: 'Legislación',
    color: 0xc0392b,
    css: '#c0392b',
    icon: iconLegislacion,
  },
  {
    key: 'procesos',
    name: 'Procesos y documentación',
    short: 'Procesos',
    color: 0xd98324,
    css: '#d98324',
    icon: iconProcesos,
  },
  {
    key: 'servicios',
    name: 'Servicios y tipología',
    short: 'Servicios',
    color: 0x2e8b57,
    css: '#2e8b57',
    icon: iconServicios,
  },
  {
    key: 'gestion',
    name: 'Gestión',
    short: 'Gestión',
    color: 0x2d6cb5,
    css: '#2d6cb5',
    icon: iconGestion,
  },
  {
    key: 'bibliografia',
    name: 'Bibliografía e historia',
    short: 'Bibliografía',
    color: 0x8048b0,
    css: '#8048b0',
    icon: iconBibliografia,
  },
  {
    key: 'tecnologias',
    name: 'Nuevas tecnologías',
    short: 'Tecnologías',
    color: 0x1793a8,
    css: '#1793a8',
    icon: iconTecnologias,
  },
];

export const CATEGORY_BY_KEY: Record<CategoryKey, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
) as Record<CategoryKey, Category>;

/** Todas las cuñas que hay que reunir para poder ir a por la pregunta final. */
export const WEDGES_TO_WIN = CATEGORIES.length;
