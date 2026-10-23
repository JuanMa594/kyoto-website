# Fase 6A — Fushimi Inari 伏見稲荷大社: plan de implementación

> **Para quien ejecute:** se implementa en esta misma sesión, tarea a tarea,
> a continuación de escribir el plan (lo pidió el usuario). Los pasos van con
> casillas (`- [ ]`). **Commits:** ninguno; los decide el usuario.

**Objetivo:** la subida de Eventos a Fushimi Inari como un monte que se sube
por gradas entre galerías de toriis —unas **densas**, apeñuscadas, con la luz
y la sombra del bambú de arriba; otras **abiertas**, por donde cruza la
fauna—, tres ema con los mitos del lugar en los rellanos, y arriba la
explanada con el rōmon, sus zorros de piedra, los nobori con la greca y la
tarjeta del templo.

**Spec:** `docs/superpowers/specs/2026-10-18-fase-6a-fushimi-inari-design.md`
(con las galerías densas/abiertas del 2026-10-22 y la §18 de este plan,
«Correcciones al planificar», que se copia al spec al terminar).

**Stack:** Next 16 · R3F 9.7 · three 0.185.1 · GSAP 3.15 · bun ·
gltf-transform + meshoptimizer (el zorro).

## Restricciones globales

- Runtime y gestor: **bun** (`bun`, `bunx`); nunca npm/npx.
- Comentarios y documentación en español; identificadores en inglés.
- Regla 1: todo por código (rōmon, ema, nobori, greca, losas, gradas). El
  único asset es el zorro (`fox_realistic.glb`, Sketchfab Standard), al
  pipeline de `bun run models`.
- Regla 2: la cámara nunca entra: ≥ 1,5 u de todo pilar y poste, y el *nuki*
  de cada torii ≥ 1,5 u por encima de ella, **caminando y viajando**.
- Regla 3: un solo `<Canvas>`; nada de esto abre otro contexto.
- Regla 4: todo sale de `journey.ts`: las galerías se declaran por trecho y
  se colocan solas desde las paradas; las gradas y los rellanos salen del
  tramo; las ema, de las tarjetas.
- Regla 5: el texto es DOM real; la tarjeta del templo está siempre en el
  HTML (un `<dialog>` cerrado).
- Todo GLSL nuevo se compila en un WebGL2 real; sin backticks en los
  shaders; sin nombres que tapen variables de fuera; derivadas antes de
  cualquier `if` no uniforme o `discard`; sin palabras reservadas (`half`…).
- Lo nuevo es `MeshStandardMaterial` (o `MeshBasicMaterial`) +
  `onBeforeCompile`: niebla y espacio de color gratis.
- Con `frameloop="demand"` lo que cambia pide su frame (`invalidate()`).
- Lo pesado se monta en diferido desde `StationDecor` (`lazy()`).
- `check:path` verde al terminar, con lo nuevo dentro.

## Foco de revisión

1. **Las densas no son una pared.** La separación de las densas vive en una
   sola constante, `GALLERY_SPACING.densa` en `journey.ts` (1,0 u). Si en la
   revisión se ven como un muro plano, se cambia a 1,2 y no hay que tocar nada
   más: el número de toriis, sus extremos que se abren, el musgo y las
   comprobaciones salen de ahí.
2. **La cámara en la cuesta.** Mirando cuesta arriba la cámara sube (el tope
   de inclinación): los toriis de la parte empinada son más altos que los del
   llano, cada uno lo justo para que el *nuki* quede 1,5 u sobre la cámara.
3. **La revelación.** La última galería (densa) termina en la cámara de la
   estación: el rōmon aparece al salir de ella.
4. **La fauna.** En las densas no cruza nada (aceptado); en los rellanos y en
   las abiertas, sí. Mínimo del reparto medido sobre toda la subida.
5. **Sin WebGL, 静 y vertical**: la tarjeta del templo y el botón funcionan;
   las ema vuelven a la tarjeta de papel.

---

### Tarea 1: Las paradas con llano y los rellanos en el camino

**Archivos:** crear `src/scene/path/tramoStops.ts`; modificar
`src/scene/path/journeyPath.ts`, `src/animation/journeyScroll.ts`,
`src/animation/useJourneyScroll.ts` (si pasa el llano), `scripts/check-path.ts`.

- [ ] `tramoStops.ts` (puro, sin importar `journeyPath`: calcula las
  profundidades desde `JOURNEY`): `READING_DRIFT`, `STOP_DRIFT`,
  `tramoLead(i)` —la fracción del tramo que es llano (`flat`) y se camina antes
  del primer trecho— y `tramoTrechos(i)`: la fracción que avanza cada trecho.
  Sin llano, todos iguales (Ubicación no cambia); con él, el primer trecho
  suma el llano y el resto de la subida se reparte entre `cards + 1`.
  `cardStopDepth(i, card)`: la d absoluta de una parada.
- [ ] `journeyScroll.ts`: `tramoFraction`, `tramoCardOpacity`, `tramoUnroll`,
  `tramoSignOpacity` y `cardStopD` con trechos de largo distinto; **el vh de
  cada trecho es proporcional a lo que avanza**, así la cámara camina igual de
  rápido en todos. Firma: añaden un parámetro opcional `trechos` (por defecto
  iguales) que `PathTramo`/`useJourneyScroll` sacan de la estación.
- [ ] **Rellanos**: `pathY` deja de ser un `smoothstep` puro en los tramos con
  `tramo.stairs`: su pendiente es la del `smoothstep` con una meseta en cada
  parada de tarjeta con cartel (de 7 u antes a 3 u después, bordes suaves), y
  la integral se normaliza para llegar exacta a la altura de la siguiente
  estación. Tabla precalculada (paso 0,05 u) e interpolación lineal.
- [ ] Comprobaciones: Ubicación no cambia (sus tres paradas); con llano,
  ninguna parada de Eventos cae en el llano y caminar va igual de rápido
  (±5 %); los rellanos son llanos (< 1 %) y la subida no pasa de 12°; la
  altura de Fushimi es exacta; el tramo sigue empezando y acabando llano.

### Tarea 2: Las gradas

**Archivos:** crear `src/scene/path/stairs.ts` (puro) y
`src/scene/systems/Stairs.tsx`; modificar `journey.ts`
(`StationTramo.stairs`), `elevation.ts` (`groundY` y `walkY`),
`scene/path/stones.ts`, `stoneSurface.ts`, `camera/pathRig.ts`,
`decor/ground.ts`, `systems/fauna/behaviors.ts` (`groundAt`),
`FoundationScene.tsx`, `scripts/check-path.ts`.

- [ ] **Corrección del spec:** las gradas no se cuantizan en la malla del
  terreno —su rejilla es de 2 u: un escalón de 0,35 se dibujaría como una
  rampa—. Son una **malla aparte**, `Stairs`, encima del terreno liso: cada
  huella es un bloque cuya cara de arriba está en
  `riser · ceil(pathY / riser)` (nunca por debajo de la ladera) y cuya
  contrahuella se ve entera. A lo ancho (|u| ≤ 3,1 + 0,7 de bisel, más anchas
  en los rellanos) la huella baja hasta la ladera: no hay paredes laterales.
- [ ] `groundY` = lo más alto entre el terreno y la grada (lo usan las
  piedras, la decoración y el musgo). La cámara sigue el **terreno liso**
  (`terrainY`), nunca la grada. Para la fauna, `walkY`: la grada con la
  contrahuella suavizada en 0,3 u (subir un escalón no es un salto).
- [ ] Las piedras del camino, en la subida, **una por huella**, centradas y
  sin serpentear; en una huella larga (un rellano), cada ~1,45 u; nunca a
  menos de 0,5 u de una contrahuella.
- [ ] Material: el del terreno (tinte de zona, pétalos caídos) en la huella y
  piedra (`ishiDeep`) en la contrahuella, por color de vértice.
- [ ] Comprobaciones: gradas monótonas, contrahuella constante, fuera de la
  subida nada cambia; la cámara sube lisa (su altura sigue al terreno, no a la
  grada); ninguna piedra sobre un canto.

### Tarea 3: El torii inari y las galerías

**Archivos:** crear `src/scene/objects/torii/inari.ts`,
`src/scene/decor/gallery.ts` (puro), `src/scene/systems/ToriiGallery.tsx`;
modificar `toriiGeometry.ts`, `journey.ts` (`DecorGallery`,
`GALLERY_SPACING`), `placement.ts`, `footprints.ts`, `moss.ts`, `contact.ts`,
`StationDecor.tsx`, `scripts/check-fushimi.ts` (nuevo, en `check:path`).

- [ ] `inari.ts`: myōjin con *daiwa*, kasagi curvado con la cara de arriba
  negra, shimaki, gakuzuka, nuki pasante y *nemaki* negro. Luz entre ejes
  8 u (pilares a |u| = 4), pilar de 0,64 u de diámetro, *nuki* a 6,8 u en el
  llano.
- [ ] **Corrección del spec:** cada torii lleva su **alzada**: los pilares se
  estiran (en el shader, por instancia) lo justo para que el *nuki* quede
  1,5 u sobre la cámara que pasa por debajo. En lo empinado la cámara va hasta
  ~7,5 u sobre la grada (el tope de inclinación la sube): esos toriis son más
  altos. La alzada es una función suave de d: los vecinos casi no se
  distinguen.
- [ ] `journey.ts`:
  `DecorGallery { kind: 'galeria'; variant: 'densa' | 'abierta'; trecho: number }`
  —el trecho 0 va del principio de la subida a la primera parada; el último,
  de la última parada a la estación siguiente— y
  `GALLERY_SPACING = { densa: 1.0, abierta: 3.2 }`, **el mando del foco de
  revisión 1**.
- [ ] `gallery.ts`: de cada declaración, sus toriis. Un trecho deja libre
  `[parada − 15, parada + 3]` (lo que tapa la ema desde su cámara) y, el
  último, termina 5 u por delante de la cámara de la estación siguiente (la
  revelación). Las densas abren su ritmo en los 4 primeros y últimos pasos
  hasta el de las abiertas. Cada torii, con el rumbo del camino en su d.
- [ ] `ToriiGallery`: una `InstancedMesh` por material (bermellón, negro),
  con alzada y matiz por instancia; su sombra con la misma alzada.
- [ ] Huellas: cada pilar es un círculo sólido para la fauna; para la cámara y
  las piedras, **una franja por costado** (no el pasillo entero, que es por
  donde pasa la cámara: corrección del spec). Musgo y sombra de contacto al
  pie de cada pilar, en las densas en uno de cada dos.
- [ ] Comprobaciones (`check-fushimi.ts`): separación en su rango; el hueco
  entre pilares ≥ 0,25 u; ningún torii en la zona libre de una parada; *nuki*
  y pilares lejos de la cámara caminando y en los viajes Eventos ↔ Fushimi y
  Ubicación ↔ Fushimi; la última galería termina en la cámara de Fushimi.

### Tarea 4: El bambú de arriba (komorebi)

**Archivos:** modificar `journey.ts` (`DecorGrove.lean`, `canopy`),
`decor/bamboo.ts`, `systems/BambooGrove.tsx`; crear
`src/scene/shaders/komorebi.ts` y `src/scene/systems/LightShafts.tsx`;
modificar `Terrain.tsx`, `Stairs.tsx`, `ToriiGallery.tsx`.

- [ ] Dosel: macizos de bambú a los lados de las galerías, más altos que los
  toriis (9–14 u), **inclinados hacia el camino** (`lean`) y con las hojas
  arrojando sombra (`canopy`), del lado del sol (la izquierda) más cerrados.
- [ ] Moteado (tier alto y medio, corrección del spec: es barato): manchas de
  hoja que derivan despacio, en el suelo, la grada y los pilares, sólo dentro
  de los tramos de galería (un peso por d, `gallerySpans`).
- [ ] Haces de luz (tier alto): planos aditivos muy tenues en los rellanos.
- [ ] Comprobaciones: el dosel más alto que el *nuki*, lejos de la cámara y de
  las piedras; el tercio superior de los rellanos, libre de hojas del dosel
  desde la cámara de su parada.

### Tarea 5: Las ema

**Archivos:** crear `src/scene/objects/ema/` (`ema.ts` puro,
`emaGeometry.ts`, `EmaKake.tsx`); modificar `journey.ts`
(`TramoCard.sign.board`), `placement.ts` (`EmaItem`), `footprints.ts`,
`moss.ts`, `contact.ts`, `pebbles.ts`, `StationDecor.tsx`,
`components/sections/*` (si hace falta), `messages`.

- [ ] El ema-kake (dos postes, tres travesaños, tejadillo), las ema de zorro
  instanciadas (cara pintada en el shader, se mecen cada una con su fase) y la
  ema grande pentagonal con su cordón rojo: la zona de escritura.
- [ ] Se coloca como un kōsatsu (delante de su parada, paralela a la imagen,
  apartada de las piedras) y proyecta su zona de escritura en `KOSATSU.rects`:
  el texto, la tarjeta de lectura y la vuelta al papel son los de la 5B, sin
  cambios.
- [ ] Textos de las tres ema (§9.1 del spec), ES/EN, ≤ 60 palabras.
- [ ] Comprobaciones: tres ema en Eventos, delante de su parada, en un
  rellano, sin torii ni bambú entre la cámara y la tabla; el cuerpo de letra
  con la regla de los kōsatsu.

### Tarea 6: La explanada

**Archivos:** crear `src/scene/objects/nobori/` (`nobori.ts`,
`noboriGeometry.ts`, `Nobori.tsx`); modificar `stones.ts` (losas),
`StonePath.tsx`, `stoneSurface.ts`, `journey.ts` (decoración de Fushimi).

- [ ] Las losas: las piedras se ensanchan en losas planas y grandes al
  terminar la última galería (|u| ≲ 6, densas cerca del eje, sueltas hacia el
  borde), con escala por eje, y entran en `stoneTopY`.
- [ ] Los nobori: mástil y tela roja de borde blanco con la greca (raimon) en
  el shader; se mecen con `WIND` como tela, con su sombra.
- [ ] Faroles kasuga y yukimi, arbustos y bambú de fondo en la plaza.

### Tarea 7: El rōmon y los zorros de piedra

**Archivos:** crear `src/scene/objects/romon/` (`romon.ts`,
`romonGeometry.ts`, `Romon.tsx`, `lights.ts`) y
`src/scene/objects/kitsune/` (`statue.ts`, `KitsuneStatue.tsx`); modificar
`journey.ts` (`DecorRomon`, `DecorKitsune`), `footprints.ts`, `moss.ts`,
`contact.ts`, `StationDecor.tsx`.

- [ ] El rōmon: *kidan* de piedra con escalinata, dos pisos de pilares
  bermellón con paños blancos, ménsulas en bloques, balcón con barandilla, dos
  tejados de corteza con los aleros curvados y dos chōchin emisivos
  (`ROMON_LIGHTS`: apagados hasta que se toca la puerta).
- [ ] Los zorros: el modelo del kitsune con material de piedra (granito y
  musgo en lo hondo) sobre un pedestal, con babero rojo y la llave o la joya.
  Sentados si la postura de la deformación lo permite; si no, de pie.
- [ ] Comprobaciones: desde la cámara de Fushimi el rōmon en la mitad
  izquierda, entero y con aire arriba, sin tapar la zona del título; nada a
  menos de 1,5 u de la cámara.

### Tarea 8: La plantilla de los lugares, el paneo y los faroles

**Archivos:** crear `src/components/lugares/PlaceCartel.tsx`,
`LandmarkInput.tsx`, `TempleReader.tsx`, `greca.ts`,
`src/scene/camera/pan.ts`; modificar `lugares/[slug]/page.tsx`,
`journey.ts` (`Station.place`), `CameraRig.tsx`, `globals.css`, `messages`.

- [ ] `PlaceCartel`: el cartel de `6.png` —el rōmon en la escena a la
  izquierda; a la derecha *Fushimi Inari Taisha* y 伏見稲荷大社 con
  `<InkKanji>`, tagline, resumen y el botón «Contemplar el rōmon»—. La página
  lo usa si la estación declara `place`; Kiyomizu-dera y Gion siguen con el
  andamio.
- [ ] `TempleReader`: la tarjeta del templo (párrafo y ficha) en un
  `<dialog>` que está siempre en el HTML; la greca en la esquina, calculada en
  `greca.ts`.
- [ ] `LandmarkInput`: la zona DOM sobre la puerta proyectada (cursor de mano,
  `aria-label`), como la tabla de los kōsatsu.
- [ ] `PAN`: un desvío acotado del encuadre (≤ 6° y un poco de lado), sólo con
  la cámara asentada en la estación, sin 静 ni movimiento reducido; lo suma
  `CameraRig`. Al abrir la tarjeta se encienden los faroles (`ROMON_LIGHTS`) y
  al cerrarla se apagan y la cámara vuelve.
- [ ] Comprobaciones: el paneo dentro de sus topes y de `RIG_LIMITS`, vuelve a
  cero; los textos en los dos idiomas.

### Tarea 9: El kitsune vivo

**Archivos:** `scripts/optimize-models.ts` (el trabajo del zorro),
`public/models/fauna/kitsune.glb`, `assets/models/LICENSES.md`,
`systems/fauna/bestiary.ts`, `behaviors.ts`, `anchoring.ts` (`SLIDE`),
`journey.ts` (fauna de Fushimi), `scripts/check-fauna.ts`.

- [ ] Copiar `fox_realistic.glb` a `assets/models/source/fauna/`, listar sus
  canales y medir su pose; estático con deformación por regiones, al trote.
- [ ] `senda`: entra por un costado en un rellano, sale al eje, **sube por el
  camino** (las gradas de verdad: `walkY`), se para a mirar atrás y se va por
  el otro lado o subiendo por el eje hasta la niebla. Empieza y termina fuera
  de cuadro. Una sola conducta.
- [ ] Comprobaciones: las de toda conducta (cuatro aspectos, recorrido
  simulado) y que sale en una subida normal.

### Tarea 10: Calibración, revisión en el navegador y documentación

- [ ] Capturas por CDP: la entrada a la primera galería, una densa desde
  dentro, una ema en su parada (horizontal y vertical), la llegada a la plaza,
  el cartel, el rōmon tocado, `?fauna=kitsune`, la lista con 静. Consola sin
  «Shader Error».
- [ ] `check:path`, `typecheck`, `build`.
- [ ] Spec (§18), PLAN.md (6A en revisión), CLAUDE.md (arquitectura, trampas,
  estado). Parar y reportar.

---

## 18. Correcciones al planificar (se copian al spec)

| Spec | Corrección | Por qué |
|---|---|---|
| §4.1 «las gradas son del terreno» | Malla aparte sobre el terreno liso; `groundY` las incluye, la cámara no | La rejilla del terreno es de 2 u: un escalón de 0,35 sería una rampa |
| §4.1 rellanos «huellas más largas» | Mesetas en `pathY` en cada parada con cartel | Una meseta del camino es un rellano de verdad: la cámara y la fauna lo pisan llano |
| §4.2 *nuki* a ~6,8 u | Alzada por torii, según la cámara que pasa por debajo | Cuesta arriba el tope de inclinación sube la cámara hasta ~7,5 u sobre la grada |
| §4.3 «la cámara y las piedras ven la galería entera como franja» | Una franja por costado | La cámara pasa por dentro de la galería |
| §4.5 haces sólo en tier alto | El moteado también en tier medio; los haces, sólo alto | El moteado es una cuenta en el fragmento: sin él, en tier medio (sin sombras) las densas no tienen luz |

## 19. Estado al terminar (2026-10-23)

Implementadas las tareas 1–9 y la documentación. `check:path` (con el nuevo
`scripts/check-fushimi.ts`), `typecheck` y `build` en verde; la tarjeta del
templo y las ema están en el HTML exportado. Revisado en capturas por CDP: la
subida (galerías abiertas y densas, el dosel, el moteado), las tres ema en su
parada (horizontal y vertical: en vertical, la tarjeta de papel), la explanada
y el cartel de Fushimi como `6.png`, el rōmon tocado (paneo, faroles y
tarjeta), la lista con 静.

Lo que queda para la revisión del usuario:

- **El kitsune vivo** no se pudo ver en las capturas: el Chrome sin GPU dibuja
  a ~1 fps y el reloj de la escena casi no avanza. Lo cubren las comprobaciones
  puras (empieza y termina fuera de cuadro, pisa las gradas, sale en ≥ 87 % de
  los repartos de la plaza). Para verlo: `bun run dev` y
  `/es/lugares/fushimi-inari/?fauna=kitsune` (o `/es/eventos/?fauna=kitsune`
  bajando hasta un rellano).
- **Los haces de luz** (capa 3 del bambú de arriba) no se hicieron: el dosel,
  su sombra y el moteado ya dan la luz. Se añaden si en la revisión falta.
- **Las densas**: si se leen como pared, `GALLERY_SPACING.densa` de 1,0 a 1,2.
