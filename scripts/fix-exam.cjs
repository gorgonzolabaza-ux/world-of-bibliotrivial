const fs = require('node:fs');
const file = 'content/questions/examen1-normal.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

// dedupe by id, keep first
const seen = new Set();
const deduped = data.questions.filter(q => {
  if (seen.has(q.id)) return false;
  seen.add(q.id);
  return true;
});

// missing questions to add manually
const missing = [
  { id: 'examen1-1', text: '¿En qué artículo de la Constitución Española está regulado el acceso a la cultura a la que todos tienen derecho?, señale la respuesta correcta:', options: ['Artículo 43.', 'Artículo 44.', 'Artículo 45.', 'Artículo 46.'], answer: 1, theme: 'legislacion' },
  { id: 'examen1-2', text: 'Señale la respuesta incorrecta en relación con el Defensor del Pueblo regulado en el artículo 54 de la Constitución Española:', options: ['Una ley orgánica regulará la institución del Defensor del Pueblo.', 'Es un alto comisionado de las Cortes Generales.', 'Es designado por el Presidente del Gobierno.', 'Puede supervisar la actividad de la Administración.'], answer: 2, theme: 'legislacion' },
  { id: 'examen1-44', text: '¿Cuál de las siguientes normas ISO regula el préstamo interbibliotecario?', options: ['La ISO 10160.', 'La ISO 10162.', 'La ISO 9001.', 'Ninguna de ellas.'], answer: 0, theme: 'servicios' },
  { id: 'examen1-52', text: 'En relación con el catálogo colectivo del Patrimonio Bibliográfico Español (CCPB), señale la respuesta correcta:', options: ['Describe distintas ediciones de obras impresas entre los siglos XV y XX (hasta 1958) existentes en bibliotecas españolas.', 'Describe obras impresas a partir de 1958.', 'Es elaborado exclusivamente por el Ministerio de Cultura y Deporte.', 'Es elaborado exclusivamente por la Biblioteca Nacional.'], answer: 0, theme: 'bibliografia' },
  { id: 'examen1-63', text: '¿En qué año se creó la Red Automatizada de Bibliotecas de Castilla y León (RABEL)?, señale la respuesta correcta:', options: ['2009.', '1998.', '2000.', '2012.'], answer: 0, theme: 'tecnologias' },
  { id: 'examen1-64', text: '¿Qué es KAMISHIBAI?', options: ['Una forma de contar historias.', 'Un escritor de novela japonés.', 'Un tipo de verso.', 'Poema épico chino.'], answer: 0, theme: 'servicios' },
  { id: 'examen1-87', text: '¿Cuál es el incunable español ilustrado más antiguo?', options: ['La Crónica de España, impresa en Zaragoza en 1479.', 'Los trabajos de Hércules, impreso en Zamora en 1483.', 'El "Fasciculus temporum" impreso en Sevilla en 1480.', 'Tirant lo Blanch, impreso en Valencia en 1490.'], answer: 2, theme: 'historia' },
  { id: 'examen1-88', text: 'La Orden CYT/1199/2019, de 29 de noviembre, por la que se desarrolla la Estructura Orgánica de los Servicios Centrales de la Consejería de Cultura y Turismo establece que la promoción de la lectura y del libro será ejercida por:', options: ['El Servicio de Bibliotecas y Biblioteca de Castilla y León.', 'La Dirección General de Políticas Culturales de la Consejería de Cultura y Turismo.', 'La Biblioteca de Castilla y León.', 'El Consejo de Archivos, Bibliotecas y Centros Museísticos de Castilla y León.'], answer: 0, theme: 'gestion' },
];

for (const q of missing) {
  if (!deduped.some(x => x.id === q.id)) {
    deduped.push({
      id: q.id,
      text: q.text,
      options: q.options,
      answerIndex: q.answer,
      answer: q.answer,
      theme: q.theme,
      difficulty: 'normal',
      source: 'examen1-2022',
    });
  }
}

// normalize: ensure answerIndex present
for (const q of deduped) {
  if (q.answer !== undefined && q.answerIndex === undefined) q.answerIndex = q.answer;
  if (q.answerIndex !== undefined && q.answer === undefined) q.answer = q.answerIndex;
}

data.questions = deduped;
fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
console.log('total questions:', deduped.length);
