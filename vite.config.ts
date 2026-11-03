import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

function contentPlugin() {
  return {
    name: 'content-static',
    configureServer(server) {
      server.middlewares.use('/content', (req, res, next) => {
        const urlPath = (req.url || '/').split('?')[0];
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
  plugins: [contentPlugin()],
  server: { port: 5173, open: true },
  build: { target: 'es2022' },
});
