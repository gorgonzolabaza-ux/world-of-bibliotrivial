# Créditos y licencias de los recursos

## Texturas 3D

| Archivo | Recurso | Autor | Licencia |
|---|---|---|---|
| `src/assets/textures/felt_color.jpg`, `felt_normal.jpg`, `felt_rough.jpg` | [Fabric 034](https://ambientcg.com/view?id=Fabric034) (fieltro real: color, normal y rugosidad) | ambientCG | **CC0** (dominio público) |
| `src/assets/textures/wood_color.jpg`, `wood_normal.jpg` | [Dark Wood](https://polyhaven.com/a/dark_wood) | Poly Haven | **CC0** (dominio público) |
| `src/assets/textures/die_wood.jpg` | [Fine Grained Wood](https://polyhaven.com/a/fine_grained_wood), aclarada y desaturada para el dado | Poly Haven | **CC0** (dominio público) |

Poly Haven libera todo su catálogo como CC0 y ambientCG hace lo mismo con sus materiales PBR: uso comercial permitido y sin obligación de atribución. Ver <https://polyhaven.com/license> y <https://ambientcg.com/view?id=License>.

El fieltro se tiñe de verde en el material (`MeshPhysicalMaterial` con `color` verde y `sheen`) en lugar de traer el color horneado, para poder ajustar el tono del paño sin volver a descargar la textura.

## Iconos de categoría

Los seis iconos son obra de **Lorc** y se distribuyen bajo **Creative Commons Attribution 3.0** desde <https://game-icons.net>.

| Categoría | Icono | Enlace |
|---|---|---|
| Legislación | *Scales* | <https://game-icons.net/1x1/lorc/scales.html> |
| Procesos y documentación | *Scroll unfurled* | <https://game-icons.net/1x1/lorc/scroll-unfurled.html> |
| Servicios y tipología | *Open book* | <https://game-icons.net/1x1/lorc/open-book.html> |
| Gestión | *Gears* | <https://game-icons.net/1x1/lorc/gears.html> |
| Bibliografía e historia | *Quill ink* | <https://game-icons.net/1x1/lorc/quill-ink.html> |
| Nuevas tecnologías | *Circuitry* | <https://game-icons.net/1x1/lorc/circuitry.html> |

> Icons made by Lorc. Available on <https://game-icons.net> (CC BY 3.0).

Se han descargado con fondo transparente (`/icons/ffffff/transparent/...`) y no se han modificado más que para teñirlos por CSS o rasterizarlos a textura.

## Modelos 3D

El dado y la ficha con pedestal están generados por código con Three.js (`src/die.ts`, `src/token.ts`), así que no dependen de ningún modelo externo.

En la raíz del proyecto está el pack **[KayKit Board Game Bits](https://kaylousberg.itch.io/board-game-bits)** de Kay Lousberg (**CC0**, 35 MB, no versionado en git). Se descargó para la ficha, el dado y las cartas, pero de momento solo se ha usado como referencia visual:

- El **dado de KayKit** no sirve para el juego: sus pips van horneados en un atlas de degradados sin un mapeo documentado de cara→valor, así que no hay forma de garantizar que la cara que se ve arriba sea el número que mueve la ficha. El dado procedural sí lo garantiza.
- La **ficha con quesito** es geometría propia, porque ninguna pieza del pack tiene los seis huecos de cuña que pide el juego.
- `pawn_*`, `meeple_*`, `token_*`, `playercard_*` y `hourglass` quedan disponibles para siguientes pasos (fichas de jugadores adicionales, temporizador, cartas en 3D).

## Contenido de oposiciones

Las preguntas provienen del examen real de Auxiliares de Biblioteca de la Comunidad de Castilla y León (convocatoria de 2022, Orden PRE/822/2021), que es un documento público. La plantilla de respuestas oficial se ha usado para validar las soluciones.

## Librerías

| Paquete | Licencia |
|---|---|
| [three](https://threejs.org) | MIT |
| [cannon-es](https://github.com/pmndrs/cannon-es) | MIT |
| [vite](https://vitejs.dev) | MIT |
| [pdfjs-dist](https://mozilla.github.io/pdf.js/) | Apache-2.0 |
| [idb-keyval](https://github.com/jakearchibald/idb-keyval) | Apache-2.0 |

## Aviso sobre marcas

*Trivial Pursuit* es una marca registrada de Hasbro. Este proyecto es un juego de preguntas propio inspirado en la mecánica de tablero circular con cuñas; no usa el nombre, el logotipo ni los materiales gráficos originales del juego comercial.
