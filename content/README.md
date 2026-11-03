# Contenido de oposiciones

Coloca aquí los exámenes reales. Estructura recomendada:

```
content/
  manifest.json
  oposiciones/
    normal/          # dificultad Normal (grupos C1/C2)
      2023/
        examen.pdf
        respuestas.pdf
    dificil/         # dificultad Difícil (grupos A1/A2)
      2024/
        examen.pdf
        respuestas.pdf
  questions/         # JSON ya parseados (opcional)
```

## Formato de manifest.json

```json
{
  "version": 1,
  "sources": [
    { "id": "op-2023-normal", "difficulty": "normal", "year": 2023, "format": "pdf", "exam": "content/oposiciones/normal/2023/examen.pdf", "answers": "content/oposiciones/normal/2023/respuestas.pdf" },
    { "id": "extra", "difficulty": "normal", "format": "json", "exam": "content/questions/ejemplo-normal.json" }
  ]
}
```

Las rutas en `exam`/`answers` son relativas a la raíz del proyecto y se sirven en `/content/...`.

## Formato JSON de preguntas

```json
{ "questions": [ { "text": "...", "options": ["A","B","C","D"], "answer": 0, "theme": "legislacion" } ] }
```

`theme` es opcional; si falta se clasifica automáticamente por palabras clave.
`answer` es el índice 0-based de la opción correcta.

Pulsa "Actualizar contenido" en el menú para re-escanear.
