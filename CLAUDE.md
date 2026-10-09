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
bun run models       # assets/models/source → public/models (fauna optimizada)
bun run geo          # Natural Earth → icons/japan.generated.ts (Japón del ícono)
bun run palette      # muestrea los colores de docs/referencias/*.png
bun run kanji        # KanjiVG → components/kanji/strokes.generated.ts (trazos de los kanji)
bun run check:path   # comprobaciones puras del camino, el terreno, la cámara, el scroll, la fauna, la navegación y la decoración
```

En desarrollo, **`?fauna=<especie>`** en cualquier página (`/es/ubicacion?fauna=libelula`)
fuerza a esa especie como único elenco, con huecos de 3–6 s entre actos: sirve
para revisar un animal sin esperar a que el reparto lo saque. En producción no
existe.

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
├─ animation/                  ← orquestación (Fase 2A, 3A)
│   ├─ gsap.ts                 ← GSAP + Lenis bajo un solo rAF
│   ├─ presets.ts              ← curvas de tokens.css → easings de GSAP
│   ├─ journeyScroll.ts        ← scroll → profundidad; el tramo, sus paradas y la llegada (puro)
│   ├─ useJourneyScroll.ts     ← ScrollTrigger del contenido y del tramo
│   ├─ travel.ts               ← desfase de viaje: los saltos se recorren, no se saltan
│   └─ MotionEngine.tsx        ← enciende/apaga el motor desde el layout
├─ scene/                      ← el mundo R3F
│   ├─ SceneRoot.tsx           ← se monta en el layout y NUNCA se desmonta
│   ├─ SceneCanvas.tsx         ← el único <Canvas>
│   ├─ FoundationScene.tsx     ← el mundo del camino (terreno, piedras, aire, vida)
│   ├─ path/journeyPath.ts     ← ★ el sendero: eje, altura, pesos de zona y `PATH`
│   ├─ path/stones.ts          ← dónde va cada piedra (puro)
│   ├─ path/stoneSurface.ts    ← lo alto de las piedras, para lo que las pisa
│   ├─ objects/stoneGeometry.ts← piedra procedural (12 formas instanciadas)
│   ├─ objects/PetalGeometry.ts← pétalo, arce y hoja de bambú por contorno
│   ├─ objects/fauna/          ← cuerpos: modelo + deformación, animado, luz
│   ├─ objects/torii/          ← el torii ryōbu: medidas (puro), geometría y componente
│   ├─ objects/Shrub.tsx       ← el arbusto podado en nube (o-karikomi)
│   ├─ decor/                  ← ★ la decoración de journey.ts (Fase 4)
│   │   ├─ placement.ts        ← descriptor → mundo, por aspecto (puro)
│   │   ├─ footprints.ts       ← huellas: piedras, cámara y fauna (puro)
│   │   ├─ bamboo.ts shrub.ts  ← cañas, hojas y masas (puro, three)
│   │   ├─ materials.ts        ← MeshStandardMaterial + cartel + viento
│   │   └─ StationDecor.tsx    ← monta la zona y sus dos vecinas
│   ├─ shaders/                ← cartelLook (washi + tinta) y windSway (flexión y aleteo)
│   ├─ PostProcessing.tsx      ← profundidad de campo (sólo tier alto)
│   ├─ systems/elevation.ts    ← ★ altura del terreno, global (función pura)
│   ├─ systems/Terrain.tsx     ← una malla para todo el camino, color por zona
│   ├─ systems/StonePath.tsx   ← las piedras de todo el recorrido, instanciadas
│   ├─ systems/Atmosphere.tsx  ← niebla, cielo y sol que siguen a la cámara
│   ├─ systems/WindField.ts    ← ★ un solo viento, con ráfagas (Fase 2A)
│   ├─ systems/WindDriver.tsx  ← lo hace avanzar dentro del <Canvas>
│   ├─ systems/sway.ts         ← ★ los muelles del bambú y los arbustos (CPU → uBend)
│   ├─ systems/BambooGrove.tsx ← el bambú de una estación, instanciado
│   ├─ systems/intro.ts        ← `INTRO`: la bruma de la entrada de la Home
│   ├─ systems/PetalSystem.tsx ← ★ pétalos: posición calculada en el shader
│   ├─ systems/petals.ts       ← capas, densidad y colores (puro, sin React)
│   ├─ systems/fauna/          ← ★ bestiario, conductas, anclaje, casting y director
│   ├─ quality/tiers.ts        ← detección de tier + perfiles
│   ├─ camera/framing.ts       ← ★ encuadre local y regla de tercios en unidades
│   ├─ camera/pathRig.ts       ← ★ el encuadre sobre el camino, topes anti-mareo (puro)
│   ├─ camera/CameraRig.tsx    ← único escritor de `PATH` + parallax de cursor
├─ store/useKyotoStore.ts      ← Zustand: estación, zona, calidad, a11y, audio, cursor
├─ components/nav/             ← ★ la navegación (Fase 3C)
│   ├─ JourneyNav.tsx          ← persistente en el layout; estación actual desde la URL
│   ├─ RadialSidebar.tsx       ← el riel de piedras del escritorio
│   ├─ MobileNav.tsx           ← la barra y el abanico
│   ├─ railProgress.ts         ← profundidad → riel, barra y abanico (puro)
│   ├─ useRailProgress.ts      ← la marca «tú», desde gsap.ticker (fuera de React)
│   └─ icons/                  ← los seis íconos calculados + sus microanimaciones
├─ components/sections/        ← StationShell, PathTramo (el tramo), ContentArrival
├─ components/home/            ← HomeIntro (la entrada), introScript, WalkHint (Fase 4)
├─ components/kanji/           ← InkKanji: el kanji dibujado trazo a trazo (KanjiVG)
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

Fuera de `src/`: `scripts/` (pipelines de fuentes, paleta, modelos, kanji y el Japón
del ícono de Ubicación) y `assets/` (originales; los trazos de KanjiVG, CC BY-SA,
en `assets/kanji/`). Los modelos originales de `assets/models/source/` **no
se versionan** —la garza pesa 127 MB y GitHub no acepta más de 100—; sí se
versionan los optimizados de `public/models/`. Créditos y licencias en
`assets/models/LICENSES.md`.

### Cómo se conectan las piezas

- Una ruta **no dibuja 3D**. Renderiza `<ActiveStation slug="…" />` y con eso le
  dice a la escena **adónde ir**; la cámara viaja por el camino hasta allí (la
  primera estación de la visita es un aterrizaje, sin viaje). Y termina en
  `<PathTramo>`, cuyo scroll lleva la cámara a la siguiente estación. **El
  tramo se camina y se lee**: lo que hay a los lados del camino se declara en
  `journey.ts` (`station.tramo.cards`, con sus textos en `messages`), cada
  tarjeta alarga el tramo con una parada de lectura y la cámara casi se detiene
  en ella. Sin tarjetas, el tramo es sólo camino, proporcional a su distancia (el de la Home, 64 u, mide la mitad que los demás).
  Un tramo puede empezar con un llano recto (`tramo.flat`, en unidades): el de
  Eventos camina 50 u entre los cerezos antes de que empiece la subida a
  Fushimi. Los tramos crecen cuando una página les pone tarjetas.
- **Lo que hay a los lados del camino se declara en `journey.ts`**
  (`environment.decor`, Fase 4): objetos sueltos (`torii`, `arbusto`) y
  macizos (`bambu`), en coordenadas del camino —`d` desde la estación, `u` desde
  el eje—, con otra colocación opcional para pantallas verticales
  (`portrait`). **La decoración de una estación incluye su tramo de salida.**
  `scene/decor/placement.ts` la lleva al mundo y `footprints.ts` publica sus
  huellas: nada pisa las piedras, la cámara nunca pasa a menos de 1,5 u y la
  fauna no atraviesa pilares ni cañas (el reparto prueba otro sitio). Todo lo
  comprueba `check:path` (`scripts/check-decor.ts`).
- **La posición de la cámara decide qué se ve y qué se oye**, no la ruta. Vive
  en `PATH` (`scene/path/journeyPath.ts`), con un único escritor, `CameraRig`;
  el store guarda sólo `zone`, que leen el ambiente, el audio y la fauna. La
  cámara está siempre en *objetivo del scroll + desfase de viaje*: un salto del
  objetivo se absorbe en el desfase (`animation/travel.ts`).
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
- **La navegación lee la cámara, no la ruta.** `JourneyNav` vive en el layout
  y no se desmonta; la estación actual sale de la URL (`stationFromPathname`)
  para que `aria-current` sea correcto en el HTML estático, y la marca del
  riel la mueve un callback de `gsap.ticker` que lee `PATH.d` (con
  `PATH.live` falso, sin WebGL, se queda en la estación de la URL).

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
  horizontal** (rotación identidad, eje −Z), no hacia el suelo. `CameraRig`
  hace `lookAt` en cada frame al punto de interés del camino (~6° de
  inclinación, acotada a 3,5°–8,7°). El encuadre local entero (posición,
  objetivo y fov) vive en `CAMERA_BASE`, en `scene/camera/framing.ts`, y
  `pathRig.ts` lo lleva a cualquier punto del camino: el `<Canvas>` lo importa
  en vez de tener su propia copia.
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
- **Ni `tsc` ni el build compilan el GLSL.** Los shaders son template strings:
  para TypeScript son texto. Un `float rest` que tapaba al `vec3 rest` del
  shader de la fauna pasó el typecheck y el build, y en el navegador el
  programa no compiló — y como todos los animales con modelo comparten
  programa, desapareció la fauna entera. Todo cambio en GLSL se compila en un
  contexto WebGL2 real antes de darlo por bueno (`gl.compileShader` y
  `getShaderInfoLog`; funciona aunque la pestaña esté oculta) y se mira la
  consola en busca de «Shader Error». En GLSL no hay que reutilizar nombres de
  variables de un ámbito exterior.
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
- **Un material creado por individuo es una fuga… salvo que se libere.** La
  fauna monta y desmonta actos cada veinte segundos, y una bandada son nueve
  gorriones. Cada animal con deformación necesita su propio material (lleva su
  propia zancada en uniforms), así que se crea al entrar y **se libera con
  `dispose()` al terminar el acto**; todos comparten el mismo programa de GPU
  gracias a `customProgramCacheKey`.
- **`normals()` de gltf-transform genera normales planas y desuelda la malla.**
  El resultado es justo lo que la revisión rechazó: un animal facetado, y
  archivos con el triple de vértices. El pipeline calcula normales suaves,
  promediadas por área, sobre la malla soldada (`smoothNormals` en
  `scripts/optimize-models.ts`).
- **Un punto negro que la profundidad de campo vuelve cuadrado es un NaN.** El
  simplificador deja «aletas»: pares de triángulos con los mismos tres vértices
  y caras opuestas, láminas de grosor cero que sobresalen del cuerpo. En el
  vértice de la punta las dos normales se anulan al promediarse; una normal de
  longitud cero da NaN en el shader, el píxel sale negro y el desenfoque lo
  esparce en un cuadrado. Eran los «puntos negros» del gato (72 aletas; la garza
  y la ardilla también tenían). El pipeline las quita (`dropFins`) y
  `smoothNormals` nunca deja una normal a cero.
- **Las posiciones de un modelo que se deforma en el shader no se cuantizan.**
  Cuantizar las guarda como enteros y mueve la escala al nodo: el shader recibe
  otras coordenadas y las regiones —«la cola empieza en x = −0,14»— caen donde
  no toca. Normales y color sí se comprimen.
- **La caja de una malla con esqueleto no es la de su nodo.** glTF ignora la
  transformación del nodo de una malla con huesos y la coloca con las
  articulaciones (articulación × matriz de enlace inversa). Medir el nodo dio
  mariposas de un milímetro; `restBounds()` mide la pose de reposo de verdad.
- **Que un modelo traiga animación no significa que anime lo que parece.** El
  clip de la libélula sólo desplazaba el esqueleto entero: las alas no batían
  nunca y el insecto cruzaba la pantalla «como una foto». Antes de apoyarse en
  un clip, listar sus canales y comprobar que mueven los huesos que importan (la
  mariposa sí: 51 canales de rotación en las alas). La libélula pasó a modelo
  estático con las alas batiendo en el shader.
- **Un modelo puede venir esculpido mirando de lado.** El bobtail tenía la
  cabeza girada 105° hacia el espectador: andando, miraba siempre de costado,
  y ninguna deformación en tiempo real lo arregla sin torcer el cuello en cada
  frame. Se endereza al preparar el modelo (`headTurn` en el manifiesto de
  `scripts/optimize-models.ts`): giro sobre el **centro de la cabeza** —sobre
  el cuello la desplazaba y estiraba— y selección por **cilindro vertical**
  —en una esfera las orejas caían en la franja de transición y giraban a
  medias—.
- **En el reparto, cada conducta suma el peso de su especie.** Dar tres
  conductas a una especie triplica sus apariciones. Por eso el gato tiene una
  sola, `callejear`, con cuatro planes que salen de la duración del acto (y
  por eso el reparto sortea la duración antes que el número de individuos:
  jugar es de dos).
- **Un giro se ve plano cuando el animal se da la vuelta en el sitio.** Si la
  trayectoria invierte la marcha con la velocidad a cero, el rumbo salta media
  vuelta y el cuerpo gira sobre sí mismo como un recorte. Para que un giro se
  lea en 3D el animal tiene que **describir la curva** sin pararse, pasando
  por el tres cuartos, la espalda y el frente. Los bucles del juego de los
  gatos se escriben por curvatura y se integran (`playPath`).
- **Un vaivén que depende del reloj hace girar al animal parado.** La garza y
  el tanuki serpenteaban con `sin(tiempo)`: al pararse, seguían deslizándose de
  lado, el rumbo —que sale del movimiento— apuntaba a la cámara y el animal
  «intentaba girarse» a media parada. El vaivén lateral de quien camina y se
  para depende de **lo recorrido**, no del tiempo; y el rumbo y el alabeo sólo
  siguen al movimiento cuando hay movimiento de verdad. El rumbo inicial sale
  del primer paso (`aheadHeading`): un pose recién creado miraba a +X y quien
  entraba por la derecha empezaba girando 180°.
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
  color de fondo (`GROUND_TINT` en `systems/Terrain.tsx`, por vértice y por
  zona): recibe sombra y niebla, pero no compite por espacio con lo que se
  construya encima.
- **ScrollTrigger repone `history.scrollRestoration` en cada `refresh()`.** Al
  registrarse guarda el valor que había (`auto`) y lo vuelve a escribir en cada
  refresh, que el motor pide en cada cambio de ruta. Con `auto`, al volver con
  «atrás» el navegador devolvía la página al fondo de su tramo **después** de
  que la página lo pusiera a cero: la URL decía Home y la cámara estaba en
  Ubicación. Asignar `history.scrollRestoration = 'manual'` a mano no dura ni
  una navegación; hay que decírselo a ScrollTrigger:
  `ScrollTrigger.clearScrollMemory('manual')` (en `useJourneyScroll`).
- **Un `template.tsx` sólo se vuelve a montar cuando cambia su propio
  segmento hijo.** Entre `/lugares/fushimi-inari` y `/lugares/gion` el hijo de
  `[locale]` es `lugares` en los dos casos, así que un fundido en
  `[locale]/template.tsx` no se vería entre lugares. El fundido del contenido va
  en `ContentArrival`, un componente cliente con `key={slug}` en cada página.
- **Lo que se mueve con la cámara tiene que decidir si está anclado al mundo o
  a ella.** Terreno y piedras, al mundo. Pétalos: sus cajas viajan con el
  encuadre, pero fluyen hacia la cámara con el avance integrado (`uAdvance`),
  y como ese borde en profundidad está en cuadro, se desvanecen en él. Fauna:
  anclada al mundo, un ancla por acto (3B); lo que vuela, con un ancla que se
  desliza (ver la trampa siguiente a la del viaje).
  Sol y caja de sombras: siguen al encuadre, o las sombras desaparecen al
  avanzar.
- **Un viaje no puede ir más deprisa de lo que el encuadre puede seguir.** Al
  doblar el camino a 800 u con las mismas duraciones, el viaje de punta a punta
  pasó a 200 u/s de media y el punto de interés se salía 12 u del eje: filtrar
  más el encuadre lo empeora (va más retrasado) y filtrarlo menos lo zarandea.
  Se resolvió en dos partes: un **tope de velocidad media** del viaje (160 u/s,
  `travel.ts`) y **dos filtros distintos** en `pathRig.ts` —el giro muy
  amortiguado, porque girar es lo que marea; el desplazamiento lateral más
  ágil, porque deslizarse de lado se lee como la ventanilla de un tren—. Si el
  camino vuelve a crecer, `check:path` lo dirá antes que la revisión.
- **Lo que vuela no se puede anclar al mundo sin más.** Lo que anda sale por el
  borde inferior a ~10 u de la cámara: anclarlo es gratis. La franja alta, en
  cambio, vista de cerca baja hasta la altura de la cámara: el gorrión más bajo
  de una bandada nacida a 18–27 u no sale de cuadro hasta estar a 0–5 u, y el
  milano en lo más bajo de su térmica, a 5 u. Anclados, la cámara acabaría entre
  ellos. Por eso lo que vuela tiene un **ancla que se desliza** (`SLIDE` en
  `fauna/anchoring.ts`): se deja alcanzar hasta un mínimo y después avanza con
  la cámara. Lo que anda **nunca** se desliza: deslizarlo es hacerlo patinar.
- **Ningún animal se retira a la vista.** Un acto sólo sale de escena cuando
  ninguno de sus individuos está en cuadro, comprobado cada frame con la
  cámara real (`retirement`). «En cuadro» es en el frustum **y antes de que
  termine la niebla** (`seen`): el frustum llega a 400 u, y sin la niebla lo que
  quedaba lejos al retroceder seguía «a la vista» para siempre y acababa
  encogiéndose en la red de seguridad. Por eso nada se encoge al terminar: si
  se le acaba el tiempo a la vista, sigue su camino (`placeAt` extrapola,
  conservando su altura sobre el suelo —con la altitud fija, un ave se metía en
  una colina lateral— y animándose poco a poco, para salir también de un cuadro
  que visto de lejos mide decenas de unidades) hasta salir. Una conducta nueva tiene que **empezar y terminar fuera
  de cuadro** —o, si es una luz, encenderse y apagarse—; `check:path` lo
  comprueba con cuatro aspectos de pantalla y simula el recorrido entero.
- **El suelo de la fauna no es sólo el terreno.** Las piedras sobresalen hasta
  ~0,3 u y la ardilla mide 0,3: apoyada sólo en el terreno, cruzaba el camino
  **por dentro** de las piedras. `groundAt` toma lo más alto entre el terreno y
  `stoneTopY` (`scene/path/stoneSurface.ts`), un mapa de alturas medido sobre
  la geometría real de cada forma, **ensanchado** por la pisada (si no, la pata
  de delante entra en la piedra antes que el centro) y **suavizado** después
  (si no, subir un canto es un salto de 0,2 u en un frame). Se ensancha más de
  lo que se suaviza, para que nunca quede por debajo de la piedra. Todo objeto
  sólido que se plante donde anda la fauna tendrá que entrar en ese suelo.
- **Cambiar de idioma es una navegación completa, no un `<Link>`.** Cambiar
  `[locale]` monta de nuevo su layout y con él el `<Canvas>`, y R3F tarda
  500 ms en liberar el contexto WebGL del canvas desmontado: con una
  navegación de cliente el viejo y el nuevo convivían medio segundo (regla
  dura 3), aunque en el DOM sólo se viera un `<canvas>`. `LanguageToggle` usa
  un `<a>` normal (`localeHref`), y la página entera se descarta.
- **`clearProps: 'all'` vacía el `style` entero.** Se lleva también las
  variables que pone React en línea (`--halo`, `--accent`), y React no las
  vuelve a escribir porque para él no cambiaron: el abanico móvil perdía sus
  colores en cada carga. Se limpian sólo las propiedades que animó GSAP
  (`clearProps: 'opacity,transform'`).
- **La consulta de móvil vive dos veces.** `(max-width: 767px), (hover: none)
  and (pointer: coarse)` está en `globals.css` (qué se ve) y en
  `components/nav/navQuery.ts` (qué se enciende). Si cambia en uno y no en el
  otro, queda encendida la navegación que no se ve.
- **Un acto de fauna fija su aspecto al nacer.** Si se gira el móvil a mitad de
  un acto, el cuadro se ensancha y un animal puede verse en el margen por el
  que iba a entrar. Recalcularlo al girar lo teletransportaría, que es peor.
- **Salir de cuadro es en cualquier dirección.** El milano sale por arriba,
  subiendo en la térmica; en vertical, con los círculos estrechados
  (`kiteFit`), apenas se mueve en el plano. Por eso `check:path` mide la
  velocidad de salida en 3D: medida sólo en XZ daba 0,25 u/s a un animal que
  sube a 1,4.
- **Una franja de decoración entera le cierra el paso a toda la fauna.** Los
  actos cruzan el cuadro de lado a lado y entran desde fuera: con el macizo de
  bambú como obstáculo único, en el tramo de la Home no salía ni uno. Para la
  fauna cuenta **cada caña** (margen de un cuarto del cuerpo); la franja la
  miran sólo la cámara y las piedras. Las hojas son blandas: los gorriones
  pueden cruzarlas.
- **El viaje de vuelta recorta las curvas por dentro.** Al volver de Ubicación
  a la Home, el filtro de viaje lleva la cámara hasta 2,8 u a la izquierda del
  eje: un macizo cercano por ese lado quedaba a 0,3 u de la cámara. Por eso en
  vertical la Home no tiene bambú cercano (`portrait: null`), y `check:path`
  simula los viajes, no sólo el caminar.
- **Lo que se mece se dobla después de la matriz de instancia** (`windSway`):
  la flexión va en ejes del objeto, que para los macizos son los del mundo. Un
  objeto que se mece **no se gira** (el `<Shrub>` va sin rotación) o la ráfaga
  lo doblaría en otra dirección. Y su sombra necesita el mismo viento en un
  `customDepthMaterial`, o sería la de la planta quieta.
- **StrictMode monta, desmonta y vuelve a montar cada efecto en desarrollo.**
  La entrada de la Home se mataba en ese desmontaje simulado y en `bun run dev`
  no se veía nunca. Lo que dura más que un render y no debe repetirse vive a
  nivel de módulo, y la limpieza se aplaza un tick (`HomeIntro`).
- **En el export, las precargas RSC de Next 16 dan 404 con `serve`.** El
  cliente pide `__next.$d$locale.__PAGE__.txt` y el export escribe
  `__next.$d$locale/__PAGE__.txt`. No rompe nada —la navegación cae a la
  petición completa—, pero el hosting de la Fase 9 tendrá que servirlas o
  reescribirlas.

---

## Composición del cuadro (regla de tercios)

El encuadre de la escena está calibrado a esta división, y **todo lo que se
añada en las fases siguientes tiene que respetarla**. Desde la Fase 3A los
números son del **encuadre local** de la cámara (`PATH.frame`): la cámara viaja,
pero respecto de ella el cuadro es siempre el mismo. La vista de cada estación
es frontal porque la tangente del camino es nula en ella:

| Franja | Desde arriba | Qué vive ahí |
|---|---|---|
| Tercio superior | 0–30 % | Copas de cerezo, hojas al viento, nubes, garzas. **Se deja libre.** |
| Tercio medio | 30–65 % | Texto, y la base de los objetos: troncos, pies de torii, faroles |
| Tercio inferior | 65–100 % | El camino de piedras y, en la Fase 2, el musgo |

Números concretos del encuadre local (`CAMERA_BASE`, en `camera/framing.ts`): cámara en
`(0, 4.2, 13)` mirando a `(0, 1.9, −9)` con `fov: 34`. Eso da una inclinación de
~6° y deja el horizonte al **32 % desde arriba**.

De ahí sale un presupuesto útil: un objeto plantado en el camino (z ≈ −6) puede
medir hasta **~8,5 unidades de alto** antes de que su copa toque el borde
superior. Un cerezo de 7 unidades queda con su copa al 17 % desde arriba, con
aire de sobra. Si algún objeto necesita ser más alto, se sube la cámara — no se
inclina.

### El relieve nunca invade el centro

Las colinas son **relieve del propio terreno**, no meshes puestos a ojo, y salen
de `station.environment` (`journey.ts`). En `scene/systems/elevation.ts` el
relieve se mide desde el **eje del camino** (`u = x − pathX(d)`) y vale 0 en el
pasillo central (|u| < 7, `CENTER_CLEAR`), así que es **imposible por
construcción** que una colina aparezca donde va el sujeto, también en las
curvas (`bun run check:path` lo recorre entero). Si hace falta cambiar el ancho
del pasillo, se cambia ahí y se aplica a todas las estaciones a la vez. Entre
estaciones, la amplitud de cada costado se mezcla por pesos de zona.

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
| 2C | Vida: rigs de fauna + `FaunaDirector` + audio sintetizado + controles | ✅ |
| 3 | El Camino, en tres bloques: | ✅ |
| 3A | · El mundo: sendero, terreno continuo, cámara con scroll, tramo y llegada | ✅ |
| 3B | · La fauna en el camino (anclada al mundo, cercanía por estación) | ✅ |
| 3C | · La navegación (sidebar radial, íconos por código, móvil, teclado) | ✅ |
| 4 | Home 京都: torii, bambú, arbusto, cartel, entrada y tramo hacia Ubicación | 🔍 en revisión |
| 5 | Ubicación 位置 | ⏸ |
| 6 | Lugares | ⏸ |
| 7 | Eventos 桜 | ⏸ |
| 8 | Gastronomía 京料理 | ⏸ |
| 9 | Pulido, rendimiento, a11y, deploy | ⏸ |

## Decisiones abiertas de la Fase 1

- **Fuente de kanji**: Zen Old Mincho (propuesta) vs Yuji Syuku. Comparar en
  `/es/tipografia/`.

Decidido en la Fase 3: los **slugs se quedan en español** (`/en/ubicacion`). El
export estático no tiene middleware que reescriba rutas traducidas; se
reconsidera en la Fase 9.

Ya decididas: titulares con **One Jinja** y párrafos/texto de lectura con
**Gaze Nozarashi** — son las dos fuentes de partida, no hubo comparación que
hacer. Si algún texto necesita negrita, se resuelve con `font-weight` en CSS
(el navegador la sintetiza; no hay un archivo Bold que subsetear).
