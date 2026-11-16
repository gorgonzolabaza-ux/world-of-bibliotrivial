import fs from 'node:fs';
import path from 'node:path';

/**
 * Publica solo lo que el juego necesita: el manifest y los JSON de preguntas.
 * Los PDF de origen (content/oposiciones/**) se quedan fuera del despliegue.
 */
const src = path.resolve('content');
const dst = path.resolve('dist', 'content');

fs.mkdirSync(path.join(dst, 'questions'), { recursive: true });
fs.copyFileSync(path.join(src, 'manifest.json'), path.join(dst, 'manifest.json'));

let copied = 0;
for (const entry of fs.readdirSync(path.join(src, 'questions'), { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
  fs.copyFileSync(path.join(src, 'questions', entry.name), path.join(dst, 'questions', entry.name));
  copied++;
}

console.log(`Contenido publicado: manifest.json + ${copied} fichero(s) de preguntas (los PDF no se publican)`);
