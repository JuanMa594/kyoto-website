# Fase 4 — Home 京都: diseño

> Primera página «de contenido» del sitio. La Fase 3 dejó el camino, la fauna y
> la navegación; la Fase 4 pone el **cartel de `1.png`** en la primera estación
> y, de paso, estrena el sistema de **decoración declarada en `journey.ts`** que
> usarán las fases 5–8. Cubre la estación de la Home y **su tramo de salida**,
> hasta Ubicación. Las demás estaciones se diseñan al llegar a ellas.

## 1. Qué se busca

Que al abrir el sitio se vea el cartel de `1.png` —KYOTO / 京都 a la izquierda,
el torii a la derecha cortado por el borde, bambú en la esquina y un arbusto al
pie del torii— **con volumen y vida**: el bambú se mece con la misma ráfaga que
suelta las hojas que ya caen en la Home, el torii tiene parallax y profundidad,
y al hacer scroll se camina hacia Ubicación sin cortes.

**Criterio de éxito (revisión visual del usuario):**

- La Home se reconoce como `1.png` en 16:9 y conserva su lectura (texto arriba,
  torii cortado a la derecha) en 9:16.
- El bambú y el arbusto se mueven de forma natural: se arquean con el viento,
  rebotan al amainar, nunca se mueven como un bloque.
- La primera carga tiene su momento («el cartel se compone») y nunca estorba: se
  salta con cualquier gesto y no existe con 静 o movimiento reducido.
- El riel de navegación se lee también cuando pasa por delante del torii.
- El camino hacia Ubicación se siente como salir de un bosquecillo de bambú a un
  valle abierto, y tiene su tarjeta de bienvenida.

## 2. Decisiones ya tomadas

| Tema | Decisión | Origen |
|---|---|---|
| Composición | **Cartel fiel a `1.png`**: torii grande a la derecha del camino, cortado por el borde derecho y el superior | Usuario |
| Riel sobre el torii | Una **bruma de papel** detrás del riel plegado (§3.4) | Preocupación del usuario, propuesta aceptada |
| Técnica de los tres objetos | **Todo procedural**: torii, bambú y arbusto | Usuario |
| Entrada | **«El cartel se compone»**, sólo en la primera carga de la visita | Usuario |
| Título KYOTO | **No un deletreo**: un solo gesto sutil, tinta que empapa el papel | Usuario |
| Kanji 京都 | **Dibujado trazo a trazo** con los trazos de KanjiVG como máscara del glifo real | Propuesta aceptada |
| Tinta en los kanji de otras estaciones | **Sí, pero en sus fases.** El componente queda reutilizable; aquí sólo lo usa la Home | Usuario |
| Contenido | **Cartel + tarjeta de bienvenida** en el tramo hacia Ubicación | Usuario |
| Frase | «Caminata por el corazón de Japón.» / «A walk through the heart of Japan.» | Usuario |
| Arquitectura | **Enfoque A**: decoración declarada en `journey.ts`, con la puerta abierta a reglas (enfoque C) cuando llegue Fushimi | Usuario |
| Alcance de la decoración | La de una estación **incluye su tramo de salida**. El tramo Home → Ubicación es de esta fase | Usuario |
| Movimiento del bambú | **Muelle amortiguado**: se arquea al arreciar, rebota al amainar, se queda arqueado si el viento es parejo (§5.3) | Usuario |
| Faroles de piedra y más decoración | **Pendiente dentro de la Fase 4**: se decide al ver la Home y el tramo construidos (§11) | Usuario |

## 3. Composición y encuadre

Las metas están en **fracciones de pantalla** (desde la izquierda y desde arriba),
que es lo que se compara con `1.png`. El plan las convierte a `d`/`u` con
`camera/framing.ts` y `check:path` las comprueba en 16:9 y en 9:16.

### 3.1 Horizontal (16:9)

Las capas de §5.1 del PLAN, de delante hacia atrás:

| Capa | Qué | Dónde en el cuadro |
|---|---|---|
| Delante | Macizo de bambú **entre la cámara y la estación**, a la izquierda, cortado por la esquina inferior izquierda. En el tier alto la profundidad de campo lo desenfoca | 0–14 % del ancho, 45–100 % del alto |
| Sujeto | Torii ryōbu a la derecha del camino. Pilar principal al **76–80 %** del ancho y su base al **85–93 %** del alto. El kasagi sale por el borde derecho entre el **8 y el 20 %** del alto y el nuki, algo más abajo. Delante, su pilar de apoyo con tejadillo; al pie, el arbusto | Tercio derecho |
| Media | Un segundo macizo de bambú más al fondo a la izquierda (detrás del texto, ya con niebla) y otro lejano a la derecha, detrás del torii | Bordes, tercio medio |
| Fondo | Lo que ya hay: colina suave a la izquierda, niebla y cielo | — |

- **Texto** (DOM): a la izquierda, centrado en ~28 % del ancho, dentro del tercio
  medio (35–65 % del alto). KYOTO en One Jinja bermellón; 京都 en Zen Old Mincho,
  centrado debajo; después la frase y la invitación a caminar (§7.1).
- **Tercio inferior**: sigue siendo del camino. **Tercio superior**: libre salvo
  el kasagi, que entra por la esquina como en la referencia.

### 3.2 Vertical (9:16)

En 9:16, a la distancia del cartel, el cuadro mide unas 4 u de ancho y el torii
de 16:9 quedaría fuera. Por eso la decoración admite **otra colocación en
vertical** (§4.1, campo `portrait`):

- **Texto** arriba, en la parte alta del tercio medio (28–48 % del alto), centrado.
- **Torii** más al fondo: pilar al **84–92 %** del ancho; el kasagi sigue saliendo
  por el borde derecho. Más pequeño, con el mismo corte.
- **Bambú** cercano en el borde izquierdo, más estrecho.
- La píldora de la navegación móvil puede quedar sobre el arbusto: es aceptable,
  tiene su propio fondo.

### 3.3 La salida

Al caminar, el torii pasa por la derecha y sale por el borde. **La cámara nunca
pasa bajo las vigas**: se extienden hacia fuera del camino. El bambú de delante
queda atrás por la izquierda.

### 3.4 El riel sobre el torii

Medido contra `globals.css`: el pilar queda lejos del riel (~300 px del borde
frente a los 100–150 px que ocupa el arco desplegado), pero **el kasagi y el
nuki cruzan el riel** por su parte alta, donde están 京都 y Ubicación. Plegado,
las piedrecitas (`sumi-faint`) y la marca «tú» (aro bermellón) se pierden sobre
el bermellón.

Solución, en CSS puro: una **franja vertical de washi** muy suave, desvanecida a
los lados, de ~3rem de ancho, detrás del riel plegado. Sobre el crema de las
demás estaciones apenas se nota; delante de las vigas aclara el rojo lo justo.
Al desplegarse, los círculos tienen su propia cara y la franja se desvanece. Es
el único cambio en la navegación de la 3C.

## 4. El modelo de decoración

### 4.1 En `journey.ts`

`StationEnvironment` gana `decor: readonly DecorItem[]`. Dos formas:

```ts
// Objeto suelto: torii, arbusto (y en el futuro faroles, linternas…)
{ kind: 'torii', variant: 'ryobu', at: { d, u }, yaw?, scale?, portrait?: { d, u } }
{ kind: 'arbusto', at: { d, u }, scale?, seed?, portrait?: { d, u } }

// Macizo: una franja a un lado del camino, llenada con semilla determinista
{ kind: 'bambu', area: { from, to, side, inner, outer }, density, seed?, portrait?: {…} }
```

- **`d`**: profundidad relativa a la estación (positiva = hacia la siguiente).
  **`u`**: distancia al eje del camino, la misma `u` de `elevation.ts`.
- **Pertenencia**: lo que cae entre una estación y la siguiente lo declara la
  estación de la que sale el tramo.
- **`portrait`**: colocación alternativa cuando la pantalla es más alta que
  ancha. Se resuelve al montar y al girar; es decoración quieta y al girar cambia
  el cuadro entero, así que no hay teletransporte perceptible (a diferencia de
  la fauna, cuyo acto fija su aspecto al nacer).
- El macizo es la puerta al **enfoque C**: el mismo descriptor servirá para los
  cerezos de Eventos, y Fushimi podrá añadir reglas («túnel de toriis cada
  1,2 u») sin cambiar el contrato.

### 4.2 Colocación

Un módulo puro (`scene/decor/placement.ts`) traduce cada descriptor a mundo con
`pathX`, `pathY` y `terrainHeight`: los objetos se apoyan en el suelo también en
curvas y cuestas, y miran según la tangente del camino más `yaw`. Los macizos
reparten sus cañas con el PRNG de `lib/procedural.ts`, con un muestreo con
distancia mínima (que no se toquen dos cañas) y la densidad del descriptor
escalada por el tier.

### 4.3 Montaje

`<StationDecor>`, dentro de `FoundationScene`, monta la decoración de la
**estación de la zona y sus dos vecinas** y desmonta el resto, liberando
geometrías y materiales con `dispose()`. La geometría pura se **cachea** por
variante y semilla. Si generarla al entrar en la ventana tarda más de un frame,
se reparte con `requestIdleCallback`.

### 4.4 Garantías por construcción

Las tres las comprueba `check:path` (§10):

1. **Nada pisa las piedras.** Cada huella se compara con las posiciones reales
   de `scene/path/stones.ts` (que serpentean ±3 u).
2. **La cámara nunca entra.** Se recorre la cámara a lo largo de todo el camino
   y la distancia mínima a cualquier objeto supera un margen.
3. **La fauna no atraviesa nada** (§8).

## 5. Los tres objetos

### 5.1 Mirada común: `cartelLook`

Los tres comparten **la mirada de cartel de la fauna**: un 5 % de washi en el
color y un filo de tinta en la silueta. Hoy vive dentro de
`scene/objects/fauna/deform.ts`; se extrae a un chunk común
(`scene/shaders/cartelLook.ts`) y la fauna lo importa de ahí **sin cambiar de
aspecto**. Los colores salen de `tokens.css` vía `scenePalette()`.

### 5.2 Torii ryōbu (`scene/objects/torii/`)

Generador puro y paramétrico. Hoy hace la variante `ryobu` de `1.png`; la Fase 6
le añadirá `inari`.

- **Hashira**: ligeramente cónicos e inclinados hacia dentro ~1,5°
  (*uchikorobi*); collar arriba (*daiwa*) y base negra (*kamebara*).
- **Kasagi + shimaki**: viga superior lofteada sobre una curva con las puntas
  levantadas (*sorimashi*); arriba negra (sumi), debajo el shimaki bermellón.
- **Nuki**: atraviesa los pilares y asoma por los lados, con sus cuñas
  (*kusabi*).
- **Gakuzuka y placa**: puntal central con placa oscura de marco claro, **sin
  texto**.
- **Sode-bashira**: los pilares de apoyo delante y detrás de cada pilar
  principal, con su tejadillo a dos aguas y una viga baja que los une. Es lo que
  hace ryōbu al torii y lo que se ve en primer plano en `1.png`.
- **Aristas biseladas**: el borde atrapa la luz rasante; evita el aspecto de
  cajas ensambladas que se rechazó en la 2C.
- Se fusiona en **tres geometrías, una por material** (bermellón, sumi, placa):
  tres draw calls. Proyecta sombra en el tier alto.
- **No se mueve con el viento**: es el ancla visual del cuadro.

### 5.3 Bambú (`scene/systems/BambooGrove.tsx`)

- **Cañas**: geometría instanciada con nudos (un anillo leve por entrenudo),
  cónica y algo curvada. Atributos por instancia: altura, grosor, inclinación,
  tono (de `--color-bambu` a un verde más amarillento, el de las cañas viejas),
  fase, clase de rigidez y retardo.
- **Hojas**: el **mismo contorno lanceolado de la hoja de bambú que ya cae**
  (`PetalGeometry` / `lib/petalOutlines.ts`): las de la planta y las que vuelan
  son la misma hoja. En ramilletes instanciados en el tercio alto de cada caña.
- **El muelle.** La flexión de una caña **no es una función del viento**: es un
  oscilador amortiguado al que el viento empuja.
  - Si el viento **arrecia**, la caña se arquea más y se pasa un poco antes de
    asentarse en la nueva curva.
  - Si **afloja o para**, rebota hacia su sitio, cruza un poco al otro lado y se
    asienta en dos o tres vaivenes cada vez más cortos.
  - Si sopla **parejo**, se queda arqueada y oscila alrededor de esa curva.

  El muelle se integra **en la CPU** para unas pocas clases de rigidez (altas y
  delgadas: blandas y lentas; bajas: rígidas). Cada caña aplica su retardo y su
  fase, así que el macizo nunca se mueve como un bloque. Al shader le llega la
  flexión ya integrada —continua por construcción, la lección de los pétalos— y
  encima van el balanceo fino y el aleteo de las hojas.
- **Shader**: la caña se dobla como una ménsula (desplazamiento ∝ altura²); las
  hojas aletean más rápido. Todo en un chunk **`windSway`**
  (`scene/shaders/windSway.ts`) compartido con el arbusto. Lee `WIND` (fuerza,
  dirección, ráfaga); con niebla (`UniformsLib.fog`) y `colorspace_fragment`.

### 5.4 Arbusto (`scene/objects/Shrub`): un *o-karikomi*

La azalea podada en nube de los jardines japoneses.

- **Masa**: 2–4 esferas solapadas y deformadas con ruido: interior oscuro (que no
  se vea a través) y superficie de apoyo.
- **Hojas**: 600–1.500 hojitas instanciadas sobre esa superficie, orientadas por
  la normal, en dos verdes.
- **Viento**: el mismo muelle, más rígido y con menos recorrido; susurro de hojas
  y leve balanceo de la masa.
- **Color**: el verde de `1.png` no está en la paleta. Se **mide con
  `bun run palette`** y entra como token nuevo, `--color-koke`, en `tokens.css`.

### 5.5 Calidad

| Tier | Bambú | Hojas del arbusto | Aleteo |
|---|---|---|---|
| Alto | Densidad completa | Completas | Sí |
| Medio | ~60 % de cañas | ~60 % | Sí |
| Bajo | ~35 % | Sin hojas instanciadas: la masa con un sombreado de hojas | No (sólo el muelle) |

## 6. La entrada: «el cartel se compone»

### 6.1 Cuándo

Sólo si se cumplen las tres:

1. Es la **primera carga de la visita** (marca en `sessionStorage`, con
   try/catch; sin almacenamiento, se trata como primera carga).
2. Se **aterriza** en la Home, no se llega viajando desde otra estación.
3. Hay **movimiento permitido**: ni modo 静, ni movimiento reducido, y WebGL vivo.

En cualquier otro caso se ve el cartel ya compuesto.

### 6.2 La coreografía (~4 s)

GSAP, con las curvas de `tokens.css`. Un componente cliente (`HomeIntro`) la
dirige.

| Tiempo | Qué pasa |
|---|---|
| 0–1,6 s | **La bruma se abre.** Empieza cerrada (sólo washi) y se abre hasta la de la zona: primero el bambú cercano, luego el torii, al final el fondo |
| 0,9–2 s | **KYOTO se empapa** (§6.3) |
| 1,6–3,6 s | **京都 se dibuja**, trazo a trazo (§6.4) |
| ~3,5 s | **La ráfaga**, justo al posarse el último trazo: `requestGust()` lanza una ráfaga real del `WindField`; el bambú se arquea, cruzan hojas por delante del título y suena el viento **si el audio ya está desbloqueado** (en la primera carga normalmente no: el navegador exige un gesto) |
| 3,4–4 s | Entran la frase y la invitación a caminar |

Los tiempos son de partida y se calibran en la revisión.

**La bruma**: un objeto de módulo **`INTRO`** (`scene/systems/intro.ts`) con un
único escritor, `HomeIntro`; la `Atmosphere` multiplica su factor sobre la niebla
de la zona. Como `WIND` y `PATH`, fuera del store.

**La ráfaga**: `WindField` gana `requestGust()`, que entra en la fase «sube» desde
el valor actual —empalmando en el valor, como exige la trampa de las envolventes
por tramos—. Si ya hay una ráfaga en curso, no hace nada.

### 6.3 KYOTO: tinta que empapa el papel

**Un solo gesto, no un deletreo.** Una máscara de borde muy difuminado barre la
palabra de izquierda a derecha; cada letra pasa de un desenfoque leve (~6 px) a
nítida y el interletrado se cierra de ~0,12em a su valor. Las letras se solapan
casi por completo en el tiempo: se lee como una palabra que se asienta en el
washi. GSAP anima variables CSS; sin canvas.

### 6.4 京都: dibujado trazo a trazo

- **Trazos**: de **KanjiVG** (orden y forma de cada trazo). Es un asset del
  ecosistema (paso 2 de la regla de assets), como Natural Earth para el Japón del
  ícono. Licencia **CC BY-SA 3.0**: crédito obligatorio (va a la sección de
  créditos de la Fase 9) y el «compartir igual» afecta sólo al archivo de trazos
  derivado.
- **Técnica**: los trazos **no se ven**; son la **máscara** a través de la cual
  aparece el glifo real de Zen Old Mincho. Cada trazo, engrosado, se pinta en
  orden con `stroke-dashoffset`: lo que se ve es la letra mincho apareciendo
  pincelada a pincelada, con su grosor y sus remates. Al terminar **se quita la
  máscara** y queda el texto exacto, así que no hace falta que cuadre al píxel.
- **Pipeline**: `bun run kanji` (`scripts/build-kanji.ts`) lee los SVG de KanjiVG
  de `assets/kanji/source/` y genera los trazos de los kanji que pide
  `requiredKanji()` en `src/components/kanji/strokes.generated.ts`. Sale del
  propio `journey.ts`, como el subset de fuentes.
- **Componente**: `<InkKanji>` (`src/components/kanji/`), reutilizable. Hoy sólo
  lo usa la Home; las demás estaciones lo adoptarán en sus fases (se anota en el
  PLAN).

### 6.5 Saltarla

Cualquier rueda, toque, tecla o clic lleva la coreografía a su final al
instante. La ráfaga se lanza igualmente: es parte del mundo, no del espectáculo.

### 6.6 Sin parpadeos y sin JS

El HTML estático trae el cartel **visible** (buscadores, lectores, sin JS). Para
que no se vea, desaparezca y se anime:

- un script mínimo en línea, antes de pintar (como el portero de idioma de `/`),
  marca `<html data-intro>` **sólo si se va a ver la entrada** (mismas
  condiciones de §6.1 que se puedan saber antes de hidratar: marca de sesión y
  `prefers-reduced-motion`; el modo 静 persistido también, si está guardado);
- el CSS esconde el cartel bajo esa marca;
- una animación CSS de respaldo lo muestra a los 4 s si el JS fallara;
- si al hidratar resulta que no hay WebGL, `HomeIntro` quita la marca y muestra el
  cartel compuesto.

### 6.7 Coordinación

- En la Home con entrada, la coreografía **sustituye** el fundido de
  `ContentArrival`; no se suman.
- El **director de fauna** no lanza actos mientras dura la entrada.
- La **cámara no se mueve**: es un aterrizaje.

## 7. El contenido

### 7.1 La Home

Todo DOM real:

- **Fuera**: la nota de «Fase 1» (`scaffold`) y la entradilla «Una experiencia
  continua».
- **`<h1>`**: KYOTO y 京都. Las letras animadas y el SVG de la tinta van
  `aria-hidden`; al lado, el texto real oculto visualmente: el lector dice
  «Kyoto», no «K, Y, O, T, O».
- **Frase**, en Gaze Nozarashi (≥ 1,2rem): «Caminata por el corazón de Japón.» /
  «A walk through the heart of Japan.»
- **Invitación a caminar**: tres piedrecitas con el contorno de las del riel
  (`components/nav/icons/stone.ts`) que aparecen una tras otra hacia abajo en un
  bucle lento, junto a «Desliza para caminar» / «Scroll to walk». Se desvanece al
  empezar a caminar; con movimiento reducido, quieta.

### 7.2 La tarjeta de bienvenida

El tramo de la Home pasa de `NO_CARDS` a
`cards: [{ id: 'bienvenida', side: 'izquierda', kind: 'texto' }]` y gana su
parada de 80vh. A la izquierda porque el torii queda a la derecha. Estilo de
siempre: marco algo translúcido, letra de lectura grande.

> **Cómo se recorre**
> Este sitio es un camino. Al bajar avanzas por él, y cada lugar de Kyoto aparece
> cuando llegas. Para saltar a otra sección usa el riel de piedras de la derecha
> (en el móvil, la barra de abajo). 音 enciende el sonido del ambiente y 静
> aquieta la escena.

Con su versión en inglés en `messages/en.json` (`tramos.inicio.bienvenida`).

### 7.3 El tramo Home → Ubicación

64 u que curvan de `lateral` 0 a −8. El bambú de la Home sigue a ambos lados en
varios macizos que **se van aclarando** hasta abrirse al valle de Ubicación, con
algún arbusto suelto. Con eso se cuenta el paso del bosquecillo al valle; si
hace falta más, ver §11.

## 8. Fauna y decoración

La Home tiene garza y gorrión.

- **Huellas en 3D.** Cada objeto publica las suyas con altura: pilares y
  sode-bashira del torii como cilindros; cada macizo de bambú como su franja d/u
  hasta la altura de las copas. **El arbusto no publica huella dura**: es bajo y
  blando, se puede pasar por delante o por detrás.
- **Lo terrestre** (garza que vadea, gorriones que bajan a picotear): el reparto
  muestrea la trayectoria del acto (`poseFor`); si entra en una huella, prueba
  otra semilla y, si no encuentra hueco, el acto no sale.
- **Lo que vuela**: una bandada que cruza a la altura de las copas de un macizo
  cuenta como choque; por encima, no.
- **Que no se quede vacía**: `check:path` mide **qué fracción de actos sigue
  siendo viable** en la estación y en el tramo y exige un mínimo (de partida,
  50 % por especie). Si no llega, se ajustan los macizos, no la fauna.

Es la sonda que el PLAN (§5.6, «Para las fases 4–8») pedía extender a cada
objeto nuevo.

## 9. Rendimiento

| Partida | Presupuesto (tier alto, lo que añade la Home) |
|---|---|
| Draw calls nuevos | ≤ 12 |
| Triángulos nuevos | ≤ ~150 k |
| Sombras | Sólo torii y cañas, sólo tier alto. Las hojas no proyectan |
| Montaje | Generación cacheada; si pasa de un frame, `requestIdleCallback` |
| Profundidad de campo | Se revisa el foco: bambú de delante desenfocado, torii nítido |

Se mide en `/diagnostico` y los números quedan en el PLAN.

## 10. Verificación

1. `bun run typecheck` y `bun run build`.
2. **`check:path` ampliado**:
   - nada de la decoración sobre las piedras;
   - distancia mínima cámara ↔ decoración a lo largo de todo el camino;
   - huellas frente a fauna y fracción de actos viables (§8);
   - metas de composición de §3 en 16:9 y 9:16;
   - textos de la tarjeta de bienvenida en los dos idiomas (ya lo hace para
     todas las tarjetas).
3. **GLSL compilado en un contexto WebGL2 real** (`cartelLook` extraído,
   `windSway`, bambú, arbusto) y consola sin «Shader Error».
4. **Revisión visual en el navegador**: capturas en 16:9 y 9:16 frente a
   `1.png`; el riel sobre el kasagi, plegado y desplegado; un GIF de la entrada;
   el bambú en una ráfaga y al amainar.
5. **Accesibilidad**: HTML estático con el `<h1>` legible; sin JS (respaldo CSS a
   los 4 s); con 静; con movimiento reducido; sin WebGL.

## 11. Pendiente dentro de la Fase 4

**Faroles de piedra (*ishidōrō*) y otros elementos decorativos.** El usuario
quiere al menos un par de faroles de piedra, y quizá algún otro elemento, pero
**se decide después de ver construidos la Home y el tramo**: si con el torii, el
bambú y los arbustos el cuadro y el camino ya están completos, no se añaden; si
falta, se diseñan como objetos sueltos del mismo modelo de decoración (§4), con
su huella para la fauna. No forman parte del plan de implementación inicial.

## 12. Mapa de archivos

**Nuevos**

- `src/scene/decor/types.ts` — `DecorItem` y sus formas.
- `src/scene/decor/placement.ts` — descriptor → mundo; reparto de macizos (puro).
- `src/scene/decor/footprints.ts` — huellas 3D de la decoración (puro).
- `src/scene/decor/StationDecor.tsx` — montaje por ventana de zonas.
- `src/scene/objects/torii/toriiGeometry.ts` — generador puro, variante `ryobu`.
- `src/scene/objects/torii/Torii.tsx`
- `src/scene/objects/Shrub.tsx` (+ su geometría pura)
- `src/scene/systems/BambooGrove.tsx`
- `src/scene/systems/sway.ts` — el muelle del viento, integrado en CPU (puro).
- `src/scene/shaders/cartelLook.ts`, `src/scene/shaders/windSway.ts`
- `src/scene/systems/intro.ts` — `INTRO`.
- `src/components/home/HomeIntro.tsx`, `src/components/home/WalkHint.tsx`
- `src/components/kanji/InkKanji.tsx`, `src/components/kanji/strokes.generated.ts`
- `scripts/build-kanji.ts`, `assets/kanji/source/*.svg`, `assets/kanji/LICENSES.md`

**Modificados**

- `src/config/journey.ts` — `environment.decor`; decoración y tarjeta de la Home.
- `src/scene/FoundationScene.tsx` — monta `<StationDecor>`.
- `src/scene/systems/Atmosphere.tsx` — factor de `INTRO` sobre la niebla.
- `src/scene/systems/WindField.ts` — `requestGust()`.
- `src/scene/objects/fauna/deform.ts` — importa `cartelLook`.
- `src/scene/systems/fauna/casting.ts` (o `FaunaDirector.tsx`) — descarte por
  huellas y pausa durante la entrada.
- `src/app/[locale]/page.tsx` — el cartel nuevo.
- `src/app/[locale]/layout.tsx` — script en línea de `data-intro`.
- `src/styles/tokens.css` — `--color-koke`.
- `src/styles/globals.css` — cartel, entrada, respaldo CSS, bruma del riel.
- `src/messages/{es,en}.json` — frase, invitación, tarjeta; fuera `home.eyebrow`.
- `scripts/check-path.ts` — las comprobaciones de §10.
- `package.json` — script `kanji`.

**Documentación**

- `CLAUDE.md`: árbol (`scene/decor/`, `scene/shaders/`, `components/kanji/`,
  `components/home/`), comando `bun run kanji`, la fase en el estado.
- `docs/PLAN.md`: §5 con la Home; §6 con `--color-koke`; §7 con torii, bambú,
  arbusto y KanjiVG; §11 con el crédito de KanjiVG; la tinta en los kanji
  anotada en las fases 5–8; la Fase 4 en el plan de fases.

## 13. Fuera de alcance (Fase 4)

- La decoración de otras estaciones y de sus tramos.
- Texto en la placa del torii.
- La tinta en los kanji de las demás estaciones (en sus fases).
- La variante `inari` del torii (Fase 6).
- La noche, el bloom y los faroles encendidos.
- Los créditos visibles (Fase 9).

## 14. Riesgos y a calibrar en la revisión

| Tema | Qué vigilar |
|---|---|
| Fauna en la Home | Que las huellas no dejen la estación sin actos: si la fracción viable no llega, se aclaran o mueven los macizos |
| Máscara de KanjiVG | Que los trazos engrosados cubran el glifo de Zen Old Mincho durante el dibujo; si queda algún remate sin cubrir, se engrosa ese trazo. Al final la máscara se quita |
| Ritmo de la entrada | 4 s de partida; si se siente larga, se acorta el dibujo del kanji antes que la bruma |
| Muelle del bambú | Rigidez y amortiguación de partida; que el rebote se vea natural y no gelatinoso |
| Vertical | Que el torii lejano siga leyéndose como sujeto; si no, se acerca y se acepta un corte mayor |
| Bruma del riel | Que aclare lo justo sobre las vigas y no se note en las demás estaciones |
| Generación al montar | Si la ventana zona ± 1 tarda más de un frame al entrar, repartir en `requestIdleCallback` |
