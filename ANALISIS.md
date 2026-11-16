# Análisis de `world-of-bibliotrivial`

Fecha del análisis: 2026-11-16 · Commit analizado: `4b2fe3a` (único commit, "Initial commit: World of BiblioTrivial")

> **Actualización posterior (mismo día).** Ya se ha implementado el rediseño visual del tablero: mesa de fieltro y madera, rueda de seis sectores con seis sedes y agrupación de los nueve temas en seis categorías. El punto 4.1(1) —temas sin preguntas suficientes— sigue vigente en parte (Gestión se queda en 6 preguntas para los 10 aciertos que pide el quesito), y el resto del análisis (parser, clasificador, contenido de relleno) continúa pendiente. Las capturas del estado actual están en `capturas/10-menu.png`, `11-tablero.png`, `12-tirada.png` y `13-pregunta.png`.

---

## 1. Qué es

Juego 3D de navegador (Vite + TypeScript + Three.js) que adapta el Trivial Pursuit a las oposiciones de **Auxiliares de Biblioteca de la Comunidad de Castilla y León** (convocatoria de 2022, Orden PRE/822/2021). El tablero es un anillo de 72 casillas con 9 "sedes" temáticas y un centro; cada acierto suma 1 punto, cada fallo resta 1/3, y a los 10 aciertos en un tema se puede conseguir el quesito al caer en su sede.

| Dato | Valor |
|---|---|
| Stack | Vite 7 · TypeScript 5.9 · Three.js 0.180 · idb-keyval · pdfjs-dist 5 |
| Tamaño | ~150 KB de código + ~380 KB de PDFs (sin `node_modules`) |
| Archivos fuente | 14 en `src/`, 5 scripts, 4 JSON de contenido |
| Historial | 1 commit · sin ramas · sin releases |
| Tests / CI / licencia | No hay |
| Despliegue | No configurado (sin `base`, sin workflow) |

## 2. Arquitectura

```
index.html            → menú, HUD, modal de pregunta (todo el CSS inline)
src/main.ts           → 499 líneas: escena, tablero, dado, movimiento, preguntas, puntuación
  ├─ board.ts         → genera los 82 nodos y el grafo de adyacencia
  ├─ themes.ts        → 9 temas con color + palabras clave para clasificar
  ├─ player.ts        → muñeco low-poly (humano/elfo/enano/orco)
  ├─ persistence.ts   → IndexedDB: mejores tiempos y logros
  ├─ achievements.ts  → 5 logros fijos + logros dinámicos por quesito
  ├─ content/index.ts → cachea, mezcla y deduplica preguntas
  └─ content/loader.ts→ manifest → PDF (pdfjs) o JSON → Question[]
content/manifest.json → declara las fuentes
content/questions/*.json → 87 preguntas del examen real + 7 de ejemplo
content/oposiciones/normal/2024/ → PDF original, TXT extraído y 2 PDF de prueba
scripts/*.cjs|mjs   → herramientas puntuales (extraer texto, parsear, generar PDF de prueba)
vite.config.ts      → plugin que sirve /content en dev; en build lo copia copy-content.mjs
```

**Flujo de una partida:** menú → `getQuestions(dificultad)` → dado (1-6) → BFS que calcula todos los destinos alcanzables exactamente en N pasos sin retroceder → clic en casilla → animación → `onLand()` → pregunta del tema de la casilla (en el centro, de un tema pendiente) → acierto/fallo → vuelta a tirar. Con los 9 quesitos, una pregunta acertada en el centro gana.

**Topología del tablero (verificada):** 72 casillas exteriores (cada tema aparece 8 veces, intercalado), 18 de ellas "tira otra vez"; 9 sedes en un radio interior, cada una enlazada al centro y a una casilla exterior de su propio tema; 1 nodo central adyacente a las 9 sedes. Total 82 nodos. No hay callejones sin salida: desde cualquier nodo y con cualquier tirada hay entre 2 y 29 destinos.

## 3. Lo que funciona (comprobado, no supuesto)

- `npx tsc --noEmit` pasa limpio con `strict: true`.
- `npm run build` genera `dist/` correctamente (936 KB de JS + 2,1 MB de worker de pdfjs) y copia `content/`.
- La app arranca y se juega en un navegador real (Chrome headless vía CDP). Único error de consola: `favicon.ico` 404.
- Carga **112 preguntas** en dificultad normal; el HUD, los 9 puntos de quesito, el dado, el resaltado de destinos y el modal de pregunta funcionan.
- **Los datos del examen real son correctos**: las 87 preguntas tienen respuestas que coinciden al 100 % con la plantilla oficial y la pregunta 62 (ANULADA) está correctamente excluida. Ese trabajo está bien hecho.
- No hay preguntas duplicadas por texto en el JSON del examen, ni `answerIndex` fuera de rango, ni opciones vacías.

Capturas en `capturas/`: `01-menu.png`, `02-tablero.png`, `03-tirada.png`, `04-pregunta.png`, `05-feedback.png`.

## 4. Problemas, por gravedad

### 4.1 Bloqueantes

**(1) El contenido no da para terminar la partida.** Para ganar hacen falta 9 quesitos × 10 aciertos + 1 pregunta final = **91 aciertos**, y la dificultad normal tiene **111 preguntas** (112 en runtime). Seis de los nueve temas no llegan a 10 preguntas distintas:

| tema | preguntas | ¿quesito sin repetir? |
|---|---|---|
| legislación | 59 | sí |
| historia | 5 | no |
| tipología | 3 | no |
| procesos | 4 | no |
| documentación | 7 | no |
| gestión | 6 | no |
| servicios | 10 | justo |
| bibliografía | 7 | no |
| tecnologías | 10 | justo |

El 53 % del contenido es legislación. Peor: **la dificultad "Difícil (A1/A2)" tiene 11 preguntas en total** (2 de legislación y 1 de cada otro tema) y no existe la carpeta `content/oposiciones/dificil/` que el propio `content/README.md` documenta. Ese modo es un esqueleto.

**(2) El parser de PDF de runtime está roto justo donde importa.** Ejecutando el parser de `src/content/loader.ts` sobre el texto real del examen:

- Produce **83 preguntas en vez de 87**: pierde las nº 1, 2, 44, 52, 63, 64, 87 y 88.
- **Inventa dos preguntas falsas** con número `2012` y `1490`: la regex `(\d+)\s*[\.\)]` interpreta años del enunciado como numeración. Eso además desplaza el texto de las preguntas 64 y 88.
- Mete la pregunta **62 (ANULADA) con `answerIndex: 0`**, es decir, la marca como "A" en vez de descartarla. El script offline `parse-exam.cjs` sí la descarta (`if (!answerMap.has(num)) continue`), así que **las dos rutas de carga no se comportan igual**.

Esto explica por qué existe `fix-exam.cjs`: es un parche manual con 8 preguntas hardcodeadas que compensan exactamente las 8 que el parser pierde. Si mañana se añade otro examen en PDF y se pulsa "Actualizar contenido", el resultado será silenciosamente malo.

**(3) El clasificador de temas está desbocado.** `classifyTheme()` asigna a legislación cualquier pregunta que contenga `bibliotecas` (49 apariciones en el examen), `cultura` (13), `artículo` (28), `ley` (16) u `orden` (2). Resultado: 61 de 87 preguntas acaban en legislación. Los temas no son una clasificación, son un cajón de sastre.

**(4) Todo el contenido de relleno tiene la respuesta en la opción A.** Las 28 preguntas de `src/data/mockQuestions.ts` y las 7 de `content/questions/ejemplo-*.json` tienen `answerIndex: 0`. Son 35 de 111 preguntas (32 %) en las que se puede acertar siempre pulsando A.

**(5) Mojibake UTF-8 en el código.** `src/main.ts` contiene 12 secuencias doblemente codificadas (líneas 267, 313, 398, 404, 423, 425, 429, 444). Se ve en pantalla:

- `âŒ Incorrecto. La respuesta era B. (-1/3)` en vez de `❌`
- `ðŸŽ² Lanzar dado` en el botón del dado **después de cada pregunta**

Es una regresión típica de copiar/pegar entre codificaciones; el emoji correcto (`🎲`) sí está en la línea 275 y en `index.html`, así que el archivo está mezclado.

### 4.2 Jugabilidad y UX

- **El número de la tirada nunca se ve en el botón.** La línea 267 escribe `🎲 ${roll}` y la 275 lo sobrescribe inmediatamente con "Cancelar y re-tirar". El resultado solo aparece en la línea de estado.
- **El resaltado de destinos los vuelve casi blancos** (`emissive: 0xffffff`, intensidad 0.6): se pierde el color del tema justo cuando hay que elegir.
- **Las 72 casillas del anillo se solapan**: diámetro 1,2 sobre una circunferencia de 56,5 → separación 0,78. Se ve como un tubo continuo y el raycast puede seleccionar la casilla vecina.
- **Los 9 puntos de quesito del HUD son todos grises** hasta conseguirlos: el color del tema se asigna a `color`, pero el CSS solo usa `currentColor` en `box-shadow` cuando la clase es `.on`. No se sabe qué tema es cada punto.
- **`pickQuestion` no evita repetir**: elige al azar con reemplazo del pool del tema. Con pools de 1-3 preguntas se ve la misma pregunta en bucle.
- **La fase final es trivial**: el centro es adyacente a las 9 sedes, así que con un 1 se pasa de cualquier sede al centro; y el centro siempre pregunta por un tema pendiente.
- El texto de estado dice "Elige una casilla a **1 pasos**".
- No hay botón de abandonar/reiniciar, ni pantalla de instrucciones, ni indicación de la pregunta nº X.
- El modal no se cierra con Escape ni atrapa el foco; el tablero 3D es inaccesible por teclado o lector de pantalla.
- `OrbitControls` sin límites: se puede poner la cámara debajo del tablero.

### 4.3 Técnicos y de proyecto

- `npm run ingest` apunta a `scripts/ingest.mjs`, que **no existe**.
- El manifest declara `op-2024-normal-pdf` apuntando a los PDF de prueba de `gen-test-pdfs.mjs` (1,1 KB y 656 B). Esos PDF entran en producción: de ahí salen 2 preguntas basura, una de ellas casi duplicada de una del mock ("Que ley regula el sistema bibliotecario?" vs "¿Qué ley regula el Sistema Bibliotecario Español?"), que no se deduplica porque el texto difiere.
- `examen1-2024` tiene `"year": 2022` (el examen es de 2022; el id y la carpeta dicen 2024).
- `fetch('/content/manifest.json')` es absoluto y `vite.config.ts` no define `base` → al publicar en GitHub Pages bajo subruta (`/world-of-bibliotrivial/`) no cargaría nada.
- `saveBestRun()` y `unlockAchievement()` hacen leer-modificar-escribir en IndexedDB sin esperar: dos desbloqueos seguidos pueden perder uno.
- Código muerto: `loadSettings`/`saveSettings`/`clearAll`, la interfaz `Achievement`, `checkEnd()`, `currentPath`, `ACHIEVEMENTS` importado sin usar en `main.ts`.
- `.gitignore` filtra una ruta personal del autor: `C:\Users\Gorgonzola\AppData\Local\Temp\opencode\` (delata que se generó con opencode).
- Peso: 2,1 MB de worker de pdfjs se cargan en el bundle y el 100 % de las partidas con el JSON ya parseado no lo necesita. Sin code splitting (`three` + `pdfjs` en un único chunk de 936 KB).
- `main.ts` es un monolito de 499 líneas con estado global mutable y sin separación entre lógica de juego y render.
- Sin tests, sin CI, sin `LICENSE`, sin `repository`/`engines` en `package.json`.

## 5. Diagnóstico de fondo

El proyecto tiene **dos capas con niveles de madurez muy distintos**:

- La **capa de presentación** (Three.js, HUD, modal, persistencia) es un prototipo digno y funciona de punta a punta.
- La **capa de contenido** —que es el verdadero valor del proyecto— está construida sobre un parser frágil y un clasificador que no clasifica, y el autor lo sabe: `fix-exam.cjs` con respuestas escritas a mano es la prueba.

Por eso la deuda prioritaria no es visual. Arreglar el pipeline de contenido (parser → clasificador → pool por tema → revisión manual) es lo que convierte esto de demo en juego. Lo demás (tirada visible, resaltado, solape de casillas, mojibake) es media tarde de trabajo cada cosa.

## 6. Siguiente paso: elige el orden

| Opción | Qué haría | Por qué |
|---|---|---|
| **A. Pipeline de contenido** (recomendada) | Reescribir el parser PDF (anclado a la numeración real, descartar ANULADA, cortar en años), sustituir `classifyTheme` por clasificación por origen del examen + keywords ponderadas, y generar pools por tema con revisión | Desbloquea el juego: sin 10 preguntas por tema no hay partida posible |
| **B. Jugabilidad y UX** | Mostrar la tirada, resaltar sin lavar el color, colores en el HUD, evitar preguntas repetidas, reglas y reinicio | Se nota de inmediato al jugar |
| **C. Tablero** | Menos casillas (36-40), sin solape, radios limpios, cámara con límites | Es la parte más "3D" y la que peor se ve |
| **D. Empaquetado** | `base`, GitHub Pages, code splitting, favicon, `LICENSE` | Publicarlo |
