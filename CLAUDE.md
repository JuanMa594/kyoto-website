@AGENTS.md

# Kyoto — guía del proyecto

Sitio/blog sobre Kyoto construido como **una experiencia continua**, no como una
sucesión de páginas. El eje narrativo es un **camino de piedras**: navegar no es
saltar entre páginas, es avanzar por ese camino.

El documento de referencia es **[`docs/PLAN.md`](docs/PLAN.md)**. Si algo de
aquí y algo de allá se contradicen, manda el PLAN y hay que actualizar este
archivo. **Lee el PLAN antes de empezar una fase nueva.**

El idioma de trabajo es el **español**: comentarios, commits, documentación y
conversación. Los identificadores del código van en inglés.

---

## Cómo se trabaja aquí

- **Por fases, con parada al final de cada una.** Al terminar una fase o una
  página, hay que detenerse y reportar. No encadenar fases en una sola tanda: el
  usuario quiere revisar visualmente cada pieza antes de que se construya
  encima.
- **Plan antes que código.** Ante una petición de alcance amplio, primero la
  propuesta (stack, arquitectura, dudas resueltas) y sólo después implementar.
- **Proponer, no sólo ejecutar.** Evaluar críticamente el material de partida y
  aportar criterio propio en lugar de implementarlo tal cual.

## Comandos

```bash
bun install          # dependencias
bun run dev          # servidor de desarrollo → http://localhost:3000
bun run build        # export estático a out/
bun run preview      # sirve out/ como lo haría el hosting
bun run typecheck    # tsc --noEmit
bun run fonts        # regenera los .woff2 subseteados
bun run palette      # muestrea los colores de docs/referencias/*.png
```

> **En este equipo no hay Node instalado — el runtime y el gestor de paquetes es
> `bun`.** No uses `npm`/`npx`: usa `bun` / `bunx`.

---

## Las cinco reglas duras

1. **Los assets se generan por código.** Geometría procedural con
   Three/R3F/shaders → si no, un asset libre del ecosistema (Lottie, modelo CC0)
   → y sólo como último recurso dibujar un SVG a mano, **preguntando y
   justificando antes**. El motivo es funcional: la geometría procedural se
   anima por vértices, se instancia miles de veces y reacciona al input.
2. **La cámara nunca entra en la escena.** La inmersión se consigue con
   profundidad, capas en Z, parallax sutil y atmósfera — nunca con una cámara en
   primera persona. Ante una petición de «más inmersión», la respuesta es sumar
   vida al cuadro, no meter la cámara dentro.
3. **Nunca dos contextos WebGL vivos a la vez.** Si la página de gastronomía
   acaba siendo PIXI, tendrá que desmontar antes el canvas de R3F.
4. **`src/config/journey.ts` es la fuente única de verdad.** Rutas, sidebar,
   posición en el camino, paleta de zona, ambiente y hasta el set de kanji que
   se subsetea salen de ese array. Añadir una sección es añadir una entrada, no
   crear carpetas sueltas.
5. **El contenido existe siempre como DOM real.** El canvas va detrás,
   `aria-hidden`, sin capturar el puntero. Es lo que leen los buscadores y los
   lectores de pantalla.

---

## Arquitectura

```
src/
├─ app/
│   ├─ layout.tsx              ← layout raíz vacío (el <html> lo pone [locale])
│   ├─ page.tsx                ← portero de idioma en «/» (script, sin middleware)
│   ├─ not-found.tsx           ← 404.html del export
│   └─ [locale]/
│       ├─ layout.tsx          ← <html>, fuentes, providers, <SceneRoot> persistente
│       ├─ page.tsx            ← Home 京都
│       ├─ ubicacion/ eventos/ gastronomia/
│       ├─ lugares/[slug]/     ← fushimi-inari · kiyomizu-dera · gion
│       ├─ tipografia/         ← muestrario (herramienta, se borra tras decidir)
│       └─ diagnostico/        ← panel de instrumentos (se recicla en Fase 9)
├─ config/journey.ts           ← ★ fuente única de verdad
├─ audio/                      ← ambiente sonoro sintetizado (Fase 2C)
│   ├─ engine.ts               ← Web Audio: lechos, eventos y voces de fauna
│   └─ AmbientAudio.tsx        ← puente store ↔ motor; nunca antes de un gesto
├─ animation/                  ← orquestación (Fase 2A)
│   ├─ gsap.ts                 ← GSAP + Lenis bajo un solo rAF
│   ├─ presets.ts              ← curvas de tokens.css → easings de GSAP
│   ├─ useScrollScene.ts       ← scroll → `pathProgress` del store
│   └─ MotionEngine.tsx        ← enciende/apaga el motor desde el layout
├─ scene/                      ← el mundo R3F
│   ├─ SceneRoot.tsx           ← se monta en el layout y NUNCA se desmonta
│   ├─ SceneCanvas.tsx         ← el único <Canvas>
│   ├─ FoundationScene.tsx     ← escena de calibración de la Fase 1
│   ├─ objects/Stone.tsx       ← piedra procedural
│   ├─ objects/PetalGeometry.ts← pétalo, arce y hoja de bambú por contorno
│   ├─ objects/fauna/          ← los tres rigs: ave, cuadrúpedo, insecto
│   ├─ PostProcessing.tsx      ← profundidad de campo (sólo tier alto)
│   ├─ systems/elevation.ts    ← ★ altura del terreno (función pura)
│   ├─ systems/Terrain.tsx     ← malla del suelo, deformada por estación
│   ├─ systems/StonePath.tsx   ← curva en S + piedras apoyadas en el terreno
│   ├─ systems/WindField.ts    ← ★ un solo viento, con ráfagas (Fase 2A)
│   ├─ systems/WindDriver.tsx  ← lo hace avanzar dentro del <Canvas>
│   ├─ systems/PetalSystem.tsx ← ★ pétalos: posición calculada en el shader
│   ├─ systems/petals.ts       ← capas, densidad y colores (puro, sin React)
│   ├─ systems/fauna/          ← ★ bestiario, conductas, casting y director
│   ├─ quality/tiers.ts        ← detección de tier + perfiles
│   ├─ camera/framing.ts       ← ★ encuadre y regla de tercios en unidades
│   ├─ camera/CameraRig.tsx    ← aplica el encuadre + parallax de cursor
├─ store/useKyotoStore.ts      ← Zustand: viaje, calidad, a11y, audio, cursor
├─ i18n/                       ← routing, request, navigation, params
├─ messages/{es,en}.json       ← textos
├─ styles/
│   ├─ tokens.css              ← ★ paleta y ritmo (@theme de Tailwind v4)
│   ├─ globals.css
│   ├─ fonts.ts                ← next/font/local sobre los .woff2 generados
│   └─ generated/*.woff2       ← los produce `bun run fonts`; sí se versionan
├─ lib/css-vars.ts             ← puente tokens CSS → colores de Three
└─ lib/procedural.ts           ← PRNG, ruido direccional, damping
```

### Cómo se conectan las piezas

- Una ruta **no dibuja 3D**. Renderiza `<ActiveStation slug="…" />` y con eso le
  dice a la escena dónde está. La escena decide cómo llegar (Fase 1: cambia
  niebla y suelo; Fase 3: la cámara viaja por el spline).
- La **paleta vive una sola vez**, en `tokens.css`. La escena 3D la lee en
  caliente con `scenePalette()` (`src/lib/css-vars.ts`). No dupliques colores en
  TypeScript; los acentos *por estación* sí van en `journey.ts`.
- Toda página bajo `[locale]` empieza con `const locale = await
  staticLocale(params)` (`src/i18n/params.ts`): valida el idioma, llama a
  `setRequestLocale` y devuelve el tipo `Locale`. **Sin eso el export estático
  falla.**
- Los enlaces internos usan el `<Link>` de `@/i18n/navigation` con rutas **sin
  idioma** (`stationPath(station)`). El de `next/link` saca a la persona del
  idioma activo.

---

## Trampas que ya nos mordieron

- **React está clavado en 19.2.8 a propósito.** `@react-three/fiber@9.7` declara
  `react: >=19 <19.3`. Subir a 19.3 rompe la resolución de peers.
- **`three` va en 0.185.1** para que case con `@types/three@0.185.4`, que aún no
  publica la 0.186.
- **Ni One Jinja ni Gaze Nozarashi tienen un solo kanji** — son latinas puras
  (266 y 233 glifos). Los kanji los pone Zen Old Mincho. Ver
  `assets/fonts/LICENSES.md`, que además documenta que ambas son versiones
  *Demo* con «All Rights Reserved».
- **No uses `next/font/google` con familias que cubran japonés.** Google las
  sirve troceadas por `unicode-range` y next/font precarga *todos* los trozos:
  probamos M PLUS Rounded 1c como candidata a texto de lectura y metía **230
  `<link rel=preload>`** en cada página. Se descartó (ver más abajo) y con el
  pipeline local de `bun run fonts` las tres familias que sí se sirven pesan
  ~78 KB en total (Yuji Syuku suma otros ~22 KB sólo en `/es/tipografia/`).
- **`next dev` reescribe `AGENTS.md`** y crea `CLAUDE.md` si falta. Por eso este
  archivo empieza con `@AGENTS.md`: así el bloque de Next sigue vigente y esta
  guía no se pisa.
- Los **postinstall de `@parcel/watcher` y `@swc/core` están bloqueados** por
  bun y no hacen falta. No los desbloquees sin motivo.
- **La geometría del `<SceneRoot>` va en `style` inline, nunca en clases de
  Tailwind.** En dev, Turbopack inyecta el CSS vía un chunk de JS aparte del
  documento. Si el `ResizeObserver` interno de `@react-three/fiber` mide el
  contenedor antes de que ese chunk se aplique, lo ve sin `fixed inset-0` — es
  decir, sin tamaño — y el `<canvas>` queda clavado en 300×150 px (su tamaño
  por defecto) hasta el próximo reflow real de la página entera. Un `style={{
  position: 'fixed', inset: 0, ... }}` inline se aplica en el mismo commit que
  crea el nodo, sin depender de ninguna hoja de estilos, así que no hay carrera
  posible. Si el canvas alguna vez vuelve a verse en blanco al cargar, es lo
  primero que hay que revisar.
- **Sin un `lookAt` explícito, la cámara del `<Canvas>` mira perfectamente
  horizontal** (rotación identidad, eje −Z), no hacia el suelo. `CameraRig` en
  `scene/camera/CameraRig.tsx` aplica un `camera.lookAt` fijo (~6°) hacia el
  camino; el rig de scroll de la Fase 3 hereda el mismo criterio. El encuadre
  entero (posición, objetivo y fov) vive en `CAMERA_BASE`, en ese archivo: el
  `<Canvas>` lo importa en vez de tener su propia copia.
- **Lenis y GSAP comparten un único `requestAnimationFrame`.** Lenis arranca con
  `autoRaf: false` y lo hace avanzar `gsap.ticker`. Si alguien le añade su
  propio bucle, el scroll se actualiza dos veces por frame y aparece el temblor
  de un píxel. Va con `lagSmoothing(0)` mientras el motor vive, y al apagarlo se
  restaura el valor por defecto de GSAP. Todo eso está en `animation/gsap.ts`.
- **El viento y el parallax no viven en el store.** Cambian sesenta veces por
  segundo; meterlos en Zustand serían sesenta renders por segundo. Son objetos
  mutables de módulo (`WIND`, `PARALLAX`) con un único escritor cada uno, y se
  leen dentro de `useFrame` o en un uniform. El store guarda sólo lo que cambia
  a ritmo humano.
- **Un backtick dentro de un shader cierra el template literal.** Los GLSL se
  escriben como template strings (`` const VERTEX = /* glsl */ `…` ``), así que
  un comentario del tipo `// el fract() recicla` con el nombre entre backticks
  —la costumbre del resto del proyecto— termina la cadena en mitad del shader
  y TypeScript se queja de una coma que falta veinte líneas más abajo. Dentro
  de un shader, los nombres van sin comillas.
- **Un `ShaderMaterial` propio no hereda la niebla.** Hay que mezclarle
  `UniformsLib.fog` con `UniformsUtils.merge`, ponerle `fog: true` e incluir
  los chunks `fog_pars_vertex` / `fog_vertex` / `fog_pars_fragment` /
  `fog_fragment`. Sin eso el renderer no encuentra dónde escribir el color ni
  las distancias, y las partículas del fondo se ven nítidas sobre una escena
  con bruma. Lo mismo con `colorspace_fragment`: sin él los colores salen
  lavados respecto del resto de la escena, porque three guarda los colores en
  lineal y es ese chunk el que los devuelve a sRGB.
- **Una posición periódica no puede escribirse como `tiempo × velocidad` si la
  velocidad cambia.** Los pétalos caen con `fract(offset + fase)`. Mientras la
  velocidad era constante, `fase = tiempo × velocidad` valía; en cuanto la
  ráfaga la acelera, cambiar el factor mueve de golpe **todo** el producto y las
  partículas se teletransportan. La fase se integra en la CPU
  (`fase += velocidad(t) · dt`) y se manda ya sumada al shader, que es continua
  por construcción. Lo mismo vale para el desplazamiento del viento (`uDrift`) y
  para cualquier cosa que en la Fase 2C avance a velocidad variable.
- **Envolver una coordenada con `fract()` sólo es invisible si su borde queda
  fuera de cuadro.** Los pétalos circulan por una caja: al salir por un lado
  reaparecen por el otro. De lado funciona, porque la caja es más ancha que el
  encuadre y el salto ocurre donde nadie mira. **En profundidad no**: el borde
  cercano y el lejano están siempre en pantalla, así que dar la vuelta ahí es un
  salto de varias unidades hacia la cámara, con su cambio de tamaño de golpe —
  se veía como un teletransporte cada pocos segundos. La regla: una magnitud se
  puede acumular y envolver **sólo** si su costura cae fuera del cuadro; si no,
  o se desvanece en el borde o no se acumula (los pétalos usan en Z un vaivén
  acotado, no una deriva). Vale igual para la fauna de la Fase 2C.
- **Una envolvente por tramos tiene que empalmar en el valor, no sólo en la
  forma.** La ráfaga del viento pasa por cuatro fases y el temblor de la fase
  «sostiene» arrancaba en un punto cualquiera de su ciclo: la intensidad daba un
  escalón del 14 % en un frame y todos los pétalos se movían a la vez. El
  temblor va ahora envuelto en un `sin(PI · progreso)`, que vale 0 justo en los
  dos empalmes. Al cambiar de tramo, comprobar siempre que el valor de salida de
  uno es el de entrada del siguiente.
- **Un material creado por individuo es una fuga.** La fauna monta y desmonta
  actos cada veinte segundos, y una bandada son nueve gorriones: crear los
  materiales dentro de cada criatura significa abandonar miles de programas de
  GPU en una sesión larga, porque un material sólo se libera si alguien llama a
  `dispose()`. Van en una caché por especie (`rigParts.ts`). La excepción es la
  luciérnaga, que necesita opacidad propia para titilar por su cuenta: ésa sí
  crea material por individuo, y lo libera al terminar el acto.
- **Lo que un animal hace se deduce de su trayectoria, no se declara aparte.**
  Rumbo, cabeceo, alabeo, velocidad y hasta si está en el aire salen de muestrear
  la propia curva (`poseFor`). En cuanto una bandera como "va volando" se lleva
  por separado, en la primera transición dice una cosa y la posición otra — y se
  ve al instante: un ave moviendo las patas en el aire.
- **Altura de cámara e inclinación son dos mandos distintos.** La altura decide
  dónde cae el camino en el cuadro; la inclinación decide dónde cae el
  horizonte. Confundirlos lleva a "arreglar" lo uno rompiendo lo otro: inclinar
  más para bajar las piedras sube el suelo y se come el cielo. Para bajar el
  camino sin perder cielo hay que **subir la cámara**, no inclinarla.
- **El suelo no debe leerse como un "piso".** En las referencias (`1.png`,
  `3.png`, `5.png`) no hay plano de suelo: son objetos sobre el cartel crema con
  mucho espacio libre alrededor. Por eso el terreno se mezcla en un 70 % con el
  color de fondo (`groundColor` en `FoundationScene.tsx`): recibe sombra y
  niebla, pero no compite por espacio con lo que se construya encima.

---

## Composición del cuadro (regla de tercios)

El encuadre de la escena está calibrado a esta división, y **todo lo que se
añada en las fases siguientes tiene que respetarla**:

| Franja | Desde arriba | Qué vive ahí |
|---|---|---|
| Tercio superior | 0–30 % | Copas de cerezo, hojas al viento, nubes, garzas. **Se deja libre.** |
| Tercio medio | 30–65 % | Texto, y la base de los objetos: troncos, pies de torii, faroles |
| Tercio inferior | 65–100 % | El camino de piedras y, en la Fase 2, el musgo |

Números concretos del encuadre actual (`CAMERA_BASE`, en `camera/CameraRig.tsx`): cámara en
`(0, 4.2, 13)` mirando a `(0, 1.9, −9)` con `fov: 34`. Eso da una inclinación de
~6° y deja el horizonte al **32 % desde arriba**.

De ahí sale un presupuesto útil: un objeto plantado en el camino (z ≈ −6) puede
medir hasta **~8,5 unidades de alto** antes de que su copa toque el borde
superior. Un cerezo de 7 unidades queda con su copa al 17 % desde arriba, con
aire de sobra. Si algún objeto necesita ser más alto, se sube la cámara — no se
inclina.

### El relieve nunca invade el centro

Las colinas son **relieve del propio terreno**, no meshes puestos a ojo, y salen
de `station.environment` (`journey.ts`). `sideMask()` en
`scene/systems/elevation.ts` vale 0 en el pasillo central (|x| < 7), así que es
**imposible por construcción** que una colina aparezca donde va el sujeto. Si
hace falta cambiar el ancho del pasillo, se cambia ahí y se aplica a todas las
estaciones a la vez.

Cada estación declara su propio ambiente — llano, ondulado, montañoso, con
pendiente, con tinte de cielo — para que el fondo no sea siempre el mismo. La
decoración concreta de cada una (cerezos, toriis repetidos, machiya, chochin)
llega en las fases 4–8 y se cuelga de ese mismo objeto.

---

## Estado de las fases

| # | Fase | Estado |
|---|---|---|
| 0 | Definiciones (`docs/PLAN.md`) | ✅ |
| 1 | Fundación: scaffold, tokens, fuentes, `journey.ts`, store, i18n, `<SceneRoot>` | ✅ |
| 2A | Motor: Lenis + GSAP, `WindField` con ráfagas, parallax de cursor | ✅ |
| 2B | Ambiente: pétalos por capas en el shader, profundidad de campo | ✅ |
| 2C | Vida: rigs de fauna + `FaunaDirector` + audio sintetizado + controles | ✅ pendiente de revisión |
| 3 | El Camino (piedras sobre spline, cámara con scroll, sidebar radial) | ⏸ |
| 4 | Home 京都 | ⏸ |
| 5 | Ubicación 位置 | ⏸ |
| 6 | Lugares | ⏸ |
| 7 | Eventos 桜 | ⏸ |
| 8 | Gastronomía 京料理 | ⏸ |
| 9 | Pulido, rendimiento, a11y, deploy | ⏸ |

## Decisiones abiertas de la Fase 1

- **Fuente de kanji**: Zen Old Mincho (propuesta) vs Yuji Syuku. Comparar en
  `/es/tipografia/`.
- **Slugs por idioma**: hoy `/en/ubicacion` usa el slug español. Si se quieren
  slugs traducidos, se decide en la Fase 3 con `pathnames` de next-intl.

Ya decididas: titulares con **One Jinja** y párrafos/texto de lectura con
**Gaze Nozarashi** — son las dos fuentes de partida, no hubo comparación que
hacer. Si algún texto necesita negrita, se resuelve con `font-weight` en CSS
(el navegador la sintetiza; no hay un archivo Bold que subsetear).
