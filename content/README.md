# Contenido de oposiciones

Las preguntas **no se parsean en el navegador**. Se convierten a JSON en local con
`scripts/ingest.mjs`, y el juego solo lee ese JSON. Así el parseo es reproducible,
revisable antes de publicar, y los PDF de origen no viajan al despliegue.

## Estructura

```
content/
  oposiciones/            ← ORIGEN, no se publica
    normal/2024/
      examen1.pdf
      respuestas1.pdf
  questions/              ← GENERADO, esto es lo que se despliega
    examen1-2022.json
  manifest.json           ← GENERADO por --register
```

`npm run build` copia a `dist/content` **solo** el manifest y `questions/*.json`.
Los PDF se quedan en el repositorio pero no se sirven.

## Añadir un examen

1. Deja el PDF del cuestionario y el de la plantilla de respuestas en
   `content/oposiciones/<dificultad>/<año>/`.

2. Ejecuta la ingesta:

```bash
npm run ingest -- \
  --exam content/oposiciones/normal/2025/examen1.pdf \
  --answers content/oposiciones/normal/2025/respuestas1.pdf \
  --id examen1-2025 --year 2025 --difficulty normal --register
```

3. Lee el resumen que imprime. Antes de escribir nada puedes probar con `--dry-run`:

```
Bloques numerados encontrados: 88
Preguntas con cuatro opciones: 88
Descartadas por formato: 0
Sin respuesta (anuladas): 1
Preguntas finales: 87
Primeras 15 preguntas: materias comunes → legislación

Reparto por categoría:
  legislacion     37  43%
  ...

Clasificación poco fiable (13) — revisar:
   35  legislacion   En los encabezamientos de materia, los subencabezamientos pueden ser:
```

4. Si alguna clasificación no te cuadra, corrígela con un fichero de overrides:

```json
{ "35": "procesos", "85": "tecnologias" }
```

```bash
npm run ingest -- ... --overrides overrides.json
```

## Qué hace la ingesta

1. **Extrae el texto** de ambos PDF (pdfjs, solo en local).
2. **Localiza las preguntas en orden**: busca el número 1, luego el 2, etc., y exige
   que el enunciado empiece por mayúscula o `¿`. Así un `Artículo 44.` dentro de una
   opción no se confunde con la pregunta 44.
3. **Separa las cuatro opciones** `a) b) c) d)` (o mayúsculas) y limpia el enunciado.
4. **Cruza la plantilla** de respuestas, aunque venga en tres columnas
   (`1 B 34 C 67 A 2 C …`). Las preguntas sin respuesta se descartan: son las anuladas.
5. **Clasifica** por categoría con una taxonomía de palabras clave por palabra completa.
   Detecta en la cabecera cuántas preguntas son de «materias comunes» y esas van
   directas a legislación. Marca como dudosas las de puntuación baja o empatada.
6. **Valida** (cuatro opciones no vacías, enunciado con texto, respuesta dentro de rango)
   e imprime el reparto por categoría y por letra de respuesta.
7. **Escribe** `content/questions/<id>.json` y, con `--register`, actualiza el manifest.

## Formato del JSON

```json
{
  "id": "examen1-2022",
  "title": "examen1",
  "difficulty": "normal",
  "year": 2022,
  "questions": [
    {
      "id": "examen1-2022-1",
      "text": "¿En qué artículo de la Constitución Española…?",
      "options": ["Artículo 43.", "Artículo 44.", "Artículo 45.", "Artículo 46."],
      "answerIndex": 1,
      "category": "legislacion",
      "difficulty": "normal",
      "source": "examen1-2022"
    }
  ]
}
```

`answerIndex` es el índice 0-based de la opción correcta. `category` es una de las
seis del tablero: `legislacion`, `procesos`, `servicios`, `gestion`, `bibliografia`,
`tecnologias`. El cargador ignora las preguntas sin categoría válida y avisa por consola.

## Manifest

Lo genera `--register`; no hace falta tocarlo a mano:

```json
{
  "version": 1,
  "sources": [
    { "id": "examen1-2022", "difficulty": "normal", "year": 2022, "format": "json",
      "exam": "content/questions/examen1-2022.json" }
  ]
}
```

Los `id` deben ser únicos: volver a ingerir con el mismo `id` reemplaza la fuente.
