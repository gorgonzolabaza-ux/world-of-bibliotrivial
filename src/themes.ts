export type ThemeKey =
  | 'legislacion'
  | 'historia'
  | 'tipologia'
  | 'procesos'
  | 'documentacion'
  | 'gestion'
  | 'servicios'
  | 'bibliografia'
  | 'tecnologias';

export interface Theme {
  key: ThemeKey;
  name: string;
  color: number;
  css: string;
  keywords: string[];
}

export const THEMES: Theme[] = [
  { key: 'legislacion', name: 'Legislación', color: 0xe74c3c, css: '#e74c3c', keywords: ['ley', 'real decreto', 'constitución', 'normativa', 'reglamento', 'bibliotecas', 'cultura', 'ministerio', 'artículo', 'disposición', 'orden'] },
  { key: 'historia', name: 'Historia Cultural', color: 0xe67e22, css: '#e67e22', keywords: ['siglo', 'historia', 'museo', 'patrimonio', 'época', 'renacimiento', 'medieval', 'moderno', 'cultura', 'arte', 'literatura'] },
  { key: 'tipologia', name: 'Tipología Bibliotecaria', color: 0xf1c40f, css: '#f1c40f', keywords: ['tipología', 'biblioteca nacional', 'biblioteca pública', 'biblioteca universitaria', 'especializada', 'archivo', 'centro de documentación', 'red'] },
  { key: 'procesos', name: 'Procesos Técnicos', color: 0x2ecc71, css: '#2ecc71', keywords: ['catalogación', 'clasificación', 'indexación', 'metadatos', 'marc', 'dewey', 'cd', 'cdud', 'procesamiento', 'normalización'] },
  { key: 'documentacion', name: 'Documentación', color: 0x1abc9c, css: '#1abc9c', keywords: ['documento', 'fondo', 'colección', 'conservación', 'restauración', 'digitalización', 'depósito legal', 'isbn', 'issn'] },
  { key: 'gestion', name: 'Gestión', color: 0x3498db, css: '#3498db', keywords: ['gestión', 'presupuesto', 'organización', 'planificación', 'calidad', 'evaluación', 'personal', 'recursos humanos', 'estadística'] },
  { key: 'servicios', name: 'Servicios Bibliotecarios', color: 0x9b59b6, css: '#9b59b6', keywords: ['servicio', 'préstamo', 'consulta', 'referencia', 'formación', 'usuarios', 'acceso', 'sala de lectura', 'extensión'] },
  { key: 'bibliografia', name: 'Bibliografía y Fuentes', color: 0x34495e, css: '#34495e', keywords: ['bibliografía', 'fuente', 'repertorio', 'catálogo', 'base de datos', 'índice', 'referencia bibliográfica', 'citación'] },
  { key: 'tecnologias', name: 'Nuevas Tecnologías', color: 0x95a5a6, css: '#95a5a6', keywords: ['tecnología', 'informática', 'software', 'digital', 'internet', 'web', 'opac', 'biblioteca digital', 'inteligencia artificial', 'datos'] },
];

export const THEME_BY_KEY: Record<ThemeKey, Theme> = Object.fromEntries(THEMES.map((t) => [t.key, t])) as Record<ThemeKey, Theme>;

export const QUESITOS_NEEDED = 10;
