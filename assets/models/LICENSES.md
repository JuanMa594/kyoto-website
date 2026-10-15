# Modelos 3D — procedencia y licencias

Los originales viven en `assets/models/source/` y **no se versionan**: la garza
sola pesa 127,7 MB y GitHub no acepta archivos de más de 100 MB. Lo que sí se
versiona es lo que produce `bun run models` en `public/models/`.

Todos los modelos de la fauna se publican **modificados**: simplificados (la
garza pasa de 1,9 millones a 6.000 triángulos), sin texturas —su color va
horneado en los vértices—, reorientados y escalados. La mariposa conserva su
esqueleto y su animación, con las texturas reducidas a 256 px en WebP; la
libélula se publica sin esqueleto (su animación no movía las alas) y con las
alas marcadas como translúcidas para que el sitio las pinte.

## Atribución obligatoria (CC BY)

Estas licencias exigen dar crédito de forma visible e indicar que hubo cambios.
**Antes de publicar el sitio tiene que existir una sección de créditos** que las
recoja (anotado en `docs/PLAN.md`, §11 — Fase 9).

| Uso | Modelo | Autor | Licencia |
|---|---|---|---|
| Garza (`fauna/garza.glb`) | ["Grey Heron – Standing Rigged Bird"](https://skfb.ly/pMJYq) | Pigcraft | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) |
| Gorrión (`fauna/gorrion.glb`) | "Cactus wren" | Poly by Google, vía Poly Pizza | CC BY |
| *(sin usar todavía)* | ["Japanese Maple"](https://skfb.ly/oGyJw) | endlessvoidmc | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) |

El gorrión es en realidad un cucarachero de cactus, un ave del desierto de
Norteamérica. Se usa como gorrión a sabiendas: a veinte píxeles y en bandada no
se distinguen.

## Resto de modelos

| Uso | Modelo | Procedencia |
|---|---|---|
| Mariposa (`fauna/mariposa.glb`) | "CC0 アゲハ Swallowtail Butterfly, Papilio xuthus" | ffish.asia / floraZia.com (Sketchfab). El título dice CC0; los metadatos del archivo dicen «Sketchfab Standard». Se acredita igualmente |
| Libélula (`fauna/libelula.glb`) | "Dragonfly7687" | Lolnyjkamen (Sketchfab). Metadatos: «Sketchfab Standard» |
| Ardilla, tanuki, milano, gato | — | Gratuitos sin exigencia de atribución, o generados con herramientas de IA (Meshy, Tripo) |

## En la carpeta de originales pero sin usar

| Modelo | Por qué |
|---|---|
| `fox_realistic.glb` (locvin, Sketchfab Standard) | El kitsune llega en la Fase 6, entre los toriis |
| `animal_crossing_new_horizons_koi.glb` | **No se puede publicar**: es un asset de Animal Crossing, propiedad de Nintendo, diga lo que diga quien lo subió. La carpa se hará propia cuando haya agua en escena |
| `butterfly.glb` (assetfactory) | Se prefirió la *Papilio xuthus*, que es la especie japonesa exacta |
| `Luciernaga3D.glb`, `Luciernaga volando3D.glb` | A su tamaño en pantalla (~8 px) la forma no se ve; la luciérnaga se dibuja como un punto de luz |
