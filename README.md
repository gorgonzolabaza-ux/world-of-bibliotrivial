# World of BiblioTrivial

Juego 3D de navegador inspirado en Trivial Pursuit, con preguntas de la oposición de **Auxiliares de Bibliotecas (Ministerio de Cultura)**.

## Características

- Tablero 3D (Three.js) con 9 temáticas coloreadas.
- Personaje personalizable (raza: humano/elfo/enano/orco, color).
- Dificultades: Normal (C1/C2) y Difícil (A1/A2).
- Puntuación: +1 acierto, -1/3 fallo. 10 aciertos por temática = quesito.
- Persistencia local (IndexedDB): mejores tiempos y logros.
- Carga/actualización de contenido desde `content/`.

## Desarrollo

```bash
npm install
npm run dev
```

Abre http://localhost:5173

## Contenido de oposiciones

Ver `content/README.md`. Coloca PDFs o JSON y pulsa "Actualizar contenido" en el menú.

## Build

```bash
npm run build
npm run preview
```
