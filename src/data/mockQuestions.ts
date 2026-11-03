import type { Question } from '../types';
import { THEMES } from '../themes';

function q(id: string, theme: Question['theme'], difficulty: Question['difficulty'], text: string, options: string[], answerIndex: number): Question {
  return { id, text, options, answerIndex, theme, difficulty };
}

export const MOCK_QUESTIONS: Question[] = [
  // Legislación
  q('L1','legislacion','normal','¿Qué ley regula el Sistema Bibliotecario Español?',['Ley 10/2007','Ley 14/2011','Ley 16/1985','Ley 34/2002'],0),
  q('L2','legislacion','normal','El Ministerio de Cultura depende de:',['Gobierno de España','Comunidades Autónomas','Unión Europea','Cortes Generales'],0),
  q('L3','legislacion','hard','¿Qué artículo de la Constitución española menciona la cultura?',['Art. 44','Art. 27','Art. 39','Art. 49'],0),
  q('L4','legislacion','normal','El depósito legal se regula por:',['Real Decreto 635/2015','Ley 23/2011','Real Decreto 111/1986','Orden ECD/...'],0),
  // Historia cultural
  q('H1','historia','normal','La Biblioteca Nacional de España fue fundada en:',['1711','1811','1611','1911'],0),
  q('H2','historia','normal','El Renacimiento es un movimiento:',['Cultural y artístico','Político','Científico únicamente','Religioso'],0),
  q('H3','historia','hard','¿Quién creó la imprenta de tipos móviles?',['Gutenberg','Caxton','Manutius','Estienne'],0),
  // Tipología
  q('T1','tipologia','normal','Una biblioteca especializada se caracteriza por:',['Fondo temático concreto','Fondo general','Solo libros antiguos','Servicio a domicilio'],0),
  q('T2','tipologia','normal','La Biblioteca Pública del Estado depende de:',['Ministerio de Cultura','Ayuntamiento','Universidad','Empresa'],0),
  q('T3','tipologia','hard','Las bibliotecas universitarias se rigen por:',['Normativa universitaria y bibliotecaria','Solo normativa municipal',' Normativa de archivos','Normativa de museos'],0),
  // Procesos técnicos
  q('P1','procesos','normal','MARC es un:',['Formato de intercambio','Lenguaje de programación','Sistema operativo','Base de datos'],0),
  q('P2','procesos','normal','La CDU es un sistema de:',['Clasificación','Catalogación','Indexación','Conservación'],0),
  q('P3','procesos','hard','El campo 245 en MARC21 contiene:',['Título','Autor','Materia','Editor'],0),
  // Documentación
  q('D1','documentacion','normal','El ISBN identifica:',['Libros','Revistas','Películas','Mapas'],0),
  q('D2','documentacion','normal','El ISSN identifica:',['Publicaciones seriadas','Libros','Tesis','Mapas'],0),
  q('D3','documentacion','hard','La conservación preventiva busca:',['Evitar deterioro','Restaurar daños','Digitalizar','Encuadernar'],0),
  // Gestión
  q('G1','gestion','normal','Un indicador de calidad mide:',['Desempeño','Color','Peso','Tamaño'],0),
  q('G2','gestion','normal','La planificación estratégica define:',['Objetivos a largo plazo','Tareas diarias','Horarios','Salarios'],0),
  q('G3','gestion','hard','El cuadro de mando integral es:',['Herramienta de gestión','Catálogo','Base de datos','Red social'],0),
  // Servicios
  q('S1','servicios','normal','El préstamo interbibliotecario permite:',['Obtener documentos de otra biblioteca','Vender libros',' Digitalizar','Restaurar'],0),
  q('S2','servicios','normal','La referencia virtual se realiza por:',['Internet/correo','Solo presencial',' Teléfono únicamente','Correo postal'],0),
  q('S3','servicios','hard','Un servicio de extensión cultural busca:',['Acercar la biblioteca a la comunidad','Vender entradas',' Contratar personal','Comprar libros'],0),
  // Bibliografía
  q('B1','bibliografia','normal','Una bibliografía anotada incluye:',['Comentarios sobre las obras','Solo títulos',' Solo autores',' Solo fechas'],0),
  q('B2','bibliografia','normal','El catálogo colectivo reúne:',['Catálogos de varias bibliotecas','Un solo catálogo',' Libros de un autor',' Revistas'],0),
  q('B3','bibliografia','hard','Una cita bibliográfica APA incluye:',['Autor, año, título',' Solo título',' Solo autor',' Solo año'],0),
  // Tecnologías
  q('N1','tecnologias','normal','Un OPAC es:',['Catálogo en línea',' Sistema operativo',' Red social',' Lenguaje'],0),
  q('N2','tecnologias','normal','La digitalización convierte:',['Analógico a digital',' Digital a analógico',' Texto a audio',' Audio a texto'],0),
  q('N3','tecnologias','hard','Los metadatos describen:',['Datos sobre datos',' Solo imágenes',' Solo texto',' Solo audio'],0),
];

// ensure all themes have questions
for (const t of THEMES) {
  const cnt = MOCK_QUESTIONS.filter((q) => q.theme === t.key).length;
  if (cnt === 0) console.warn('No mock questions for', t.key);
}
