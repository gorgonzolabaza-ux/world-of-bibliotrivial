import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

function contentPlugin() {
  return {
    name: 'content-static',
    configureServer(server) {
      server.middlewares.use('/content', (req, res, next) => {
        const urlPath = (req.url || '/').split('?')[0];
        // solo se sirve lo que el juego consume: el manifest y los JSON de preguntas.
        // los PDF de origen no se publican ni en desarrollo.
        const allowed = urlPath === '/manifest.json' || urlPath.startsWith('/questions/');
        if (!allowed) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        const filePath = path.join(process.cwd(), 'content', urlPath);
        if (!fs.existsSync(filePath)) { next(); return; }
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) { next(); return; }
        const ext = path.extname(filePath).toLowerCase();
        const types: Record<string, string> = {
          '.json': 'application/json; charset=utf-8',
          '.pdf': 'application/pdf',
          '.md': 'text/markdown; charset=utf-8',
          '.txt': 'text/plain; charset=utf-8',
        };
        res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

export default defineConfig({
  // rutas relativas: la app funciona en la raíz (Vercel, Netlify) y también
  // bajo un subpath (GitHub Pages: /world-of-bibliotrivial/)
  base: './',
  plugins: [contentPlugin()],
  server: {
    port: 5173,
    open: true,
    // .tmp es carpeta de trabajo (capturas, utilidades): no hace falta vigilarla
    // los *.tmpdir son ficheros temporales de los editores al guardar
    watch: { ignored: ['**/.tmp/**', '**/dist/**', '**/.*.tmpdir/**', '**/*.tmp'] },
  },
  build: { target: 'es2022' },
});
