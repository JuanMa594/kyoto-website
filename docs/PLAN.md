# Kyoto — Plan técnico y de producto

> Documento de referencia del proyecto. Consolida las decisiones tomadas en la fase de
> definición. Si algo cambia, se actualiza aquí y no en la memoria de nadie.
>
> Estado: **Fase 3 en curso** — 3A (el mundo) y 3B (la fauna en el camino) implementadas,
> pendientes de revisión; 3C se diseña al llegar a ella. La Fase 2 está completa (2A motor, 2B ambiente, 2C vida).
> El estado vivo de las fases y las convenciones del repo están en `CLAUDE.md`.

---

## 1. Visión

Un sitio/blog informativo sobre Kyoto que funcione como una **experiencia continua** y no
como una sucesión de páginas: dónde queda la ciudad, sus lugares emblemáticos, sus eventos
a lo largo del año (empezando por la temporada de sakura) y su gastronomía.

El eje narrativo es **un camino de piedras** que lleva a la persona de una sección a otra.
Navegar no es saltar entre páginas: es avanzar por ese camino.

### El principio rector: inmersión por profundidad

La meta es que se sienta inmersivo, "como si estuviera adentro de la pantalla" — pero
**no** de forma literal. No hay cámara en primera persona ni recorrido subjetivo.

La composición sigue siendo **frontal, tipo cartel** (título tipográfico grande a un lado,
objeto protagonista al otro), tal como las imágenes de referencia (`1.png`, `2.png`, `3.png`, `4.png`, `5.png`, `6.png`, `7.png`, `8.png`, `9.png`, `10.png`, `11.png`, `12.png`, `13.png`). Lo que crea la inmersión es que ese cuadro tenga **volumen, capas y vida propia**:

- objetos 3D reales en cuadro,
- partículas que cruzan por delante *y* por detrás de esos objetos,
- parallax real al mover el cursor,
- niebla, profundidad de campo y sonido ambiental,
- transiciones que son desplazamientos por el camino, nunca cortes.
- Viento que de un momento a otro sopla, y hace llevar hojas en el aire, y hace que las hojas de los árboles y el bambú se muevan.

> **Regla derivada:** ante una petición de "más inmersión", la respuesta es sumar
> profundidad, atmósfera y vida ambiental al cuadro. Nunca meter la cámara dentro de la
> escena.

---

## 2. Referencias visuales

Las 13 imágenes de `docs/referencias/` son la guía de dirección de arte. Son exports de Canva
**con marca de agua**: sirven como referencia, jamás como assets de producción.

| Imagen | Contenido | Rol |
|---|---|---|
| `1.png` | KYOTO / 京都 + torii + bambú | Hero / portada |
| `2.png` | Mapa de Japón + pin + Ichi / 位置 | Sección Ubicación |
| `3, 7, 9, 11.png` | Camino de piedras + decoración | **Transiciones entre secciones, la idea es ir incluyendo en el camino carteles o mensajes con datos referentes a cada sección** |
| `4.png` | Sakura / 桜 | Sección Eventos |
| `5.png` | Torii frontal + bambú + camino | Portal a Lugares, **La idea de esta imagen es hacer la ilusión de que la persona está escalando por el camino lleno de toris hasta llegar al Fushimi Inari Taisha** |
| `6.png` | Fushimi Inari Taisha / 伏見稲荷大社 | Lugar |
| `8.png` | Kiyomizu-dera / 清水寺 | Lugar |
| `10.png` | Gion chiku / 祇園地区 | Lugar |
| `12.png` | Kyo-ryori / 京料理 | Gastronomía |
| `13.png` | 6 íconos circulares | Navegación entre secciones |

Observación clave: **el camino de piedras aparece en 4 de las 13 imágenes**. Es el esqueleto
del sitio, no un adorno. Y los 6 círculos de `13.png` mapean 1:1 con las secciones (La idea es que sirvan para que si la persona quiere saltar directamente a una sección cliquee allí y la remita directamente a esa sección)

---

## 3. Decisiones cerradas

| Área | Decisión |
|---|---|
| Lenguaje | TypeScript |
| Framework | **Next.js 16 (App Router)** + React 19, export estático |
| Render 3D | Three JS principalmente y WebGL, React Three Fiber sobre una **escena persistente** en el layout |
| Nivel 3D | 3D real en el cuadro cercano, billboards 2.5D al fondo |
| Cámara | **Observadora en perspectiva**, no primera persona |
| Animación | **GSAP + ScrollTrigger** como orquestador único (`MotionPath` no hizo falta: la curva del camino vive en 3D, ver §5.3) |
| Scroll | Lenis (smooth scroll) integrado con ScrollTrigger |
| Estilos | Tailwind v4 + design tokens en CSS custom properties |
| Estado | Zustand |
| Idiomas | **Español e inglés** (`next-intl`). El japonés es decorativo |
| Assets | **Procedurales por código**. Ver §7 |
| Deploy | Vercel o Cloudflare Pages (a definir en Fase 9) |

### Por qué Next.js y no Astro

El `TechProposal.md` original recomendaba Astro "por ser un sitio de contenido". No lo es:
es una experiencia continua con una escena WebGL persistente y una cámara que viaja entre
secciones. En Astro casi todo sería una island — se pierde la ventaja de 0 KB — y mantener
un canvas vivo entre navegaciones es notablemente más difícil.

### Librerías descartadas o acotadas, y por qué

| Librería | Estado | Razón |
|---|---|---|
| **Spline** | En reserva | Runtime >1 MB, no versionable en git, no optimizable. Sólo si algo resulta imposible por código, y previa consulta |
| **Anime.js** | Opcional | Se solapa casi por completo con GSAP y no tiene equivalente a ScrollTrigger ni MotionPath. Dos librerías = dos convenciones para lo mismo. Puede entrar para micro-interacciones puntuales si su API convence |
| **PIXI.js** | Acotado | Sólo para páginas 2D puras (candidata: gastronomía). **Regla dura: nunca dos contextos WebGL vivos a la vez** |
| **Motion** (ex Framer Motion) | Acotado | Sólo UI en DOM (sidebar, cards, enter/exit). GSAP manda en scroll y escena |
| **canvas-confetti** | Sí | Para estallidos de pétalos al click vía `confetti.shapeFromPath()` |
| **Lottie** | **Descartada en Fase 2** | Era la propuesta para la fauna. Un clip cerrado no puede caminar, posarse, detenerse ni perseguir a otro individuo — y eso es justo lo que pide §5.5. Además obliga a subir un `CanvasTexture` por individuo y por frame, y no existen animaciones libres de garza + ardilla + milano en un mismo estilo. La fauna se genera con geometría procedural (§7) |
| **Howler** | **Descartada** | No tenemos ni un archivo de audio y la regla de assets aplica también al sonido: el ambiente se **sintetiza con la Web Audio API** (§7). Sin descargas, sin licencias, y reactivo — la ráfaga que mueve los pétalos es literalmente la que se oye |
| **maath** | No entra | `damp()` y el PRNG ya viven en `src/lib/procedural.ts`, y el ruido de los pétalos se calcula en GLSL. Una dependencia menos |

---

## 4. Stack

```
Next.js 16 (App Router, static export) + React 19.2 + TypeScript 5.9
Tailwind v4 + design tokens (CSS vars)
next-intl                              → rutas /es y /en

lenis 1.3                              → smooth scroll
gsap 3.15 (ScrollTrigger)              → scroll del camino, viaje de cámara, animaciones
Motion                                 → UI en DOM únicamente

Three JS                               → Animaciones, interacciones 3D
@react-three/fiber + @react-three/drei → escena persistente
@react-three/postprocessing            → bloom, profundidad de campo, god rays
@react-three/rapier                    → física puntual (faroles que se balancean)
three (SVGLoader, ExtrudeGeometry)     → mapa extruido, geometría desde paths

Zustand                                → estado del viaje, calidad, audio, a11y
Web Audio API (nativa, sin librería)   → ambiente sonoro sintetizado por código
canvas-confetti                        → micro-celebraciones
```

> `postprocessing@6.39` exige `three >= 0.168 < 0.187`. Es la segunda razón —
> junto a `@types/three` — por la que `three` está clavado en 0.185.1.

---

## 5. Diseño e interacción

### 5.1 Composición y capas de profundidad

La cámara es **de perspectiva** aunque sea observadora — es lo que permite parallax real
entre capas en Z:

| Capa | Contenido | Función |
|---|---|---|
| **Delante** | Hojas y pétalos cruzando frente al sujeto, ramas entrando por las esquinas, bokeh, brisa (con algo de sonido) que hace que las hojas de los árboles o bambú se muevan llevandose algunas hojas, algunas hojas de árboles que se caen por la brisa | Lo que más vende la profundidad |
| **Sujeto** | Torii, pagoda, farol — 3D real | Protagonista del cuadro |
| **Media** | Bambú, casas, faroles colgando | Se desplaza distinto al mover el cursor |
| **Fondo** | Montañas, cielo, siluetas — billboards 2.5D con niebla y desenfoque | Escala y atmósfera, barato |

### 5.2 Parallax de cursor

Debe ser **sutil**. Es lo que separa "elegante" de "efecto barato":

- Desplazamiento máximo: **2–4 % del viewport**
- **Damping ≈ 0.06** — la cámara persigue al cursor con inercia, nunca 1:1
- Rotación máxima **≈ 2°**, con `lookAt` fijo al centro de interés → se siente como un
  reencuadre suave, no como girar la cabeza
- En móvil: giroscopio, con la misma amortiguación
- Se desactiva con `prefers-reduced-motion`

### 5.3 El camino

El scroll mueve la cámara como un **travelling de cine que sigue el sendero** — un dolly
lateral/diagonal sobre el sendero. `ScrollTrigger` ata el scroll al recorrido; la curva la
define `scene/path/journeyPath.ts` a partir de `journey.ts`.

Cambiar de sección **no** es un fundido: la cámara viaja por el camino hasta la siguiente
estación. La escena nunca se desmonta. En el camino se van encontrado cosas relacionadas con la sección, y algunos mensajes, información o datos curiosos sobre ello.

La idea del camino no es que siempre de la impresión de ir siempre adelante, también hacer cambios de dirección, o como en la imagen `5.png`, dar la impresión que se esta subiendo por escaleras rodeadas de Toris, hasta llegar al Fushimi Inari Taisha.

**Cómo está hecho (Fase 3A).** El camino es un mundo continuo de 786 unidades que avanza
siempre hacia el fondo, con medio tramo (64 u) de la Home a Ubicación, unas 128–144 entre las demás y 50 de llano entre los cerezos al salir de Eventos, antes de la subida (`tramo.flat`): sitio para caminar y para leer lo que
hay a los lados. Entre estaciones tiene curvas laterales (`lateral`) y sube o baja hacia la
altura de la siguiente (`altitude`): `scene/path/journeyPath.ts`. En cada estación el camino es
recto y llano,
así que su vista sigue siendo frontal, de cartel; las curvas y las cuestas —la subida a Fushimi
Inari, la bajada a Gion— ocurren en los tramos. La cámara está en *objetivo del scroll + desfase
de viaje*: cada página termina en un **tramo** cuyo scroll lleva la cámara a la siguiente
estación, y al terminarlo se llega sola (`PathTramo`). **El tramo se camina y se lee**: mide
un caminar proporcional a su distancia (~3,3vh por unidad: 211vh el de la Home, unos 420–475vh los demás) más 80vh por cada tarjeta que declare la estación (`tramo.cards` en
`journey.ts`); la cámara anda entre tarjeta y tarjeta con la curva `power2.inOut` (arranca con
peso y frena), casi se detiene en cada una mientras aparece a su lado del camino, y al final se
ve la siguiente estación. **Estilo de las tarjetas de texto**, para todas las páginas: el marco
es un poco translúcido —lo justo para que el texto se lea bien y la tarjeta se mezcle con el
ambiente— y la letra de lectura es algo más grande que el texto base. Una sección puede pedir
otra forma (los mapas de Ubicación serán carteles de madera en el camino, Fase 5). Los saltos —enlaces, «atrás»— se absorben en el desfase y GSAP lo lleva a cero con la
curva `piedra` (1,8 s por estación, nunca más de 160 u/s de media: 4,9 s el camino entero). Contra el
mareo, el rumbo está acotado a ±15° y 12°/s, y en los viajes rápidos el encuadre recorta las
curvas sin perder el camino de vista. El ambiente —niebla, cielo, viento, pétalos, sonido y
elenco de fauna— lo decide la posición de la cámara, no la ruta: al viajar se ven pasar los
paisajes intermedios. Con modo 静 o movimiento reducido no hay viaje ni llegada automática: la
cámara salta y el tramo se reduce a su contenido.

**`MotionPath` no se usa**: la curva vive en 3D y la de three da tangentes y longitudes. GSAP
sigue siendo el orquestador de las transiciones del viaje y de ScrollTrigger.

### 5.4 Navegación (basada en `13.png`)

Panel lateral con los 6 íconos circulares, que se despliega al acercar el cursor al borde.
Al hover, cada círculo hace un pulso *spring* y revela su kanji. En móvil se convierte en
una barra inferior o un gesto.

### 5.5 Ambiente

- **Pétalos y hojas** en varias capas de profundidad, con viento direccional variable.
  La densidad **no es la misma en todas las zonas ni constante en el tiempo**: en
  reposo, la sakura de eventos está al 100 % del presupuesto —es el único momento
  del año en que la ciudad está de verdad cubierta—, la home al 35 % y los tres
  lugares al 20 %, que es un fondo pasivo para que el aire no esté muerto mientras
  se lee. **Cada ráfaga de viento dobla esa densidad** y la devuelve despacio a la
  calma: la zona respira en vez de mantener un goteo plano. El tope en el 100 %
  hace que en eventos la ráfaga no cambie la cantidad, sólo la velocidad y la
  dirección. En las zonas pasivas, además, la capa más cercana a la cámara lleva un
  20 % menos, porque es la que se cruza con el título y el texto
- **Fauna**: cada 20–40 s una silueta o varias de garzas cruzan el encuadre, pueden ser volando o inclusive caminando por donde se encuentra el usuario. No solamente tiene que ser una garza, también puede ser una ardilla, o que de un momento a otro una ardilla está persiguiendo (jugando) a otra (Estas animaciones de fauna también pueden ser con otros animales, y cada 20s de inactividad de scroll). **Cómo se construye eso: §5.6**
- **Bambú** que se mece con shader de viento
- **Sonido ambiental** con toggle discreto (nunca autoplay): viento, agua, *fūrin*, un arroyo corriendo.
  Panning posicional según dónde esté el objeto en pantalla
- **Modo 静 (quieto)**: reduce el ambiente al mínimo para quien lo prefiera

### 5.6 La fauna: criatura y conducta son cosas separadas

La fauna **no son clips**. Una especie aporta su cuerpo; el repertorio de
conductas es común y se combina con cualquiera que lo admita. Por eso una garza
no hace *una* cosa: el director puede encadenarle
`cruzarVolando → posarse → caminar → picotear → alzarElVuelo` en un solo acto de
quince segundos, y por eso dos ardillas pueden **perseguirse jugando** — la
persecución no es una animación, es una ardilla siguiendo a otra con retardo y
error.

**Los cuerpos son modelos reales; el movimiento, código.** La primera versión
ensamblaba cada animal con primitivas de three.js (esferas, conos, cilindros) y
se descartó en la revisión: se veía «rústico, poligonal y abstracto». Ahora cada
especie es un `.glb` de verdad, preparado por `bun run models` (ver §7), y hay
tres maneras de darle vida:

| Cuerpo | Cómo se mueve | Especies |
|---|---|---|
| `modelo` | Malla sin esqueleto. **El shader dobla regiones** —cola desde la grupa, cada pata desde la cadera, cuello desde el pecho, alas desde el hombro— con los ángulos que ya calcula la conducta | garza, milano, gorrión, ardilla, gato, tanuki, libélula |
| `animado` | Esqueleto y vuelo propios del modelo; la conducta marca el ritmo del aleteo | mariposa |
| `luz` | Un punto que late con halo: a ocho píxeles, la forma no se ve | luciérnaga |

Casi ningún modelo traía esqueleto, así que la opción de «vincular alas, cola y
patas a los nodos» no existía: no hay nodos. La deformación por regiones es la
técnica estándar para animar mallas sin huesos, y las regiones de cada especie se
calibraron sobre una rejilla del modelo normalizado (`bestiary.ts`).

**Cada especie tiene su marcha**, porque a veinte píxeles lo que distingue a un
animal de otro es cómo mueve las patas:

| Marcha | Cómo se mueven las patas | Cuerpo | Especies |
|---|---|---|---|
| `paso` | Izquierda y derecha alternas | Leve sube y baja | garza |
| `trote` | Diagonales a la vez (delantera izquierda con trasera derecha) | Firme | gato, tanuki |
| `galope` | Las dos delanteras juntas, las dos traseras juntas, a contratiempo | **Despega** media zancada y cabecea | ardilla |
| `brinco` | Todas a la vez | Saltito a cada zancada | gorrión |

La zancada se integra con la velocidad (`fase += velocidad · dt / largo de
zancada`), así que los pies no patinan: acelera la conducta y aceleran las
patas. Y la amplitud es grande a propósito —hasta ±50° en la ardilla—: con
ángulos realistas, un gato a veinte píxeles no mueve las patas a ojos de nadie.

**La cola de la ardilla cambia de forma, no sólo de ángulo.** Parada la lleva
enroscada en «?» sobre el lomo; corriendo, estirada detrás, ondeando con cada
salto. Girarla entera desde la base no la estira nunca —sólo la sube o la
baja—, así que tiene una segunda articulación a media cola (`tail.curl`): la
base va hacia atrás y la mitad final se dobla al revés. Se estira al arrancar y
se enrosca en cada frenazo.

**El galope de la ardilla es bajo y continuo.** El salto se quedó en un 62 %
de su altura inicial —la parábola era alta para lo que avanzaba y se leía como
rebote—, la zancada se acorta un 15 % a velocidad de persecución (más saltos
por segundo, más pegados al suelo), el vuelo es medio seno con la cúspide suave,
el cabeceo es un balanceo de peso de 0,07 rad y, al aterrizar, el cuerpo se
aplasta un 9 % sobre los pies antes de volver a impulsarse.

**El gato tiene cuatro planes**, que salen de la duración del acto
(`callejear`): dos gatos jugando a perseguirse (19–25 s), el paseo de siempre
(32–42 s), sentarse a mirar y desperezarse (44–52 s) o echarse la siesta
(54–62 s). En la siesta se echa, duerme con la cabeza sobre las manos y
respirando, despierta, se levanta, se despereza en dos tiempos —manos al frente
con el pecho al suelo, luego las patas atrás— y se va. Es una sola conducta a
propósito: el reparto pesa cada conducta por separado, y cuatro le habrían
dado al gato el cuádruple de apariciones.

Jugando, los gatos **dan vueltas de verdad**: el recorrido se define por su
curvatura —dos bucles completos, uno que se aleja de la cámara y otro que se le
acerca, con radio mínimo de un gato y medio— y nunca se paran, así que cada
giro se ve entero: de costado, de espaldas, del otro costado, de frente. El
perseguidor es el mismo recorrido 0,75 s antes. Al paso trotan; corriendo
galopan, y el cambio desliza el desfase de las patas en unos pasos, sin salto. Las posturas viven en el perfil
(`deform.postures`) y se calibraron con pies y grupa a ras de suelo.

**El milano monta el viento.** Planea casi siempre, pero el aire no es parejo:
gana y pierde altura en oleajes de 7 y 15 s —con el pico arriba al subir y
abajo al bajar, que sale solo de la trayectoria—, y **la misma ráfaga que
arrastra los pétalos lo levanta** (`ridesWind`) y lo mece de ala a ala. Cada
nueve segundos y medio da una tanda de tres o cuatro aletazos lentos y vuelve a
planear. Todo cabe en el tercio superior: entre el 3 y el 22 % desde arriba en
el peor caso.

**La libélula bate con el shader, no con su clip.** El modelo traía esqueleto y
una animación, pero la animación sólo desplazaba el esqueleto entero: las alas no
se movían nunca y el insecto cruzaba la pantalla «como una foto». Ahora es un
modelo estático; sus cuatro alas baten en V rígida desde el hombro a 14 ciclos
por segundo, y el cuerpo se pinta con el rojo de la paleta (akatombo) y las alas
con un washi translúcido.

**La garza no vuela: vadea.** El modelo está de pie y con las alas plegadas. En
vez de un vuelo que no puede hacer, entra andando por la orilla, se para dos
veces a pescar —espera con el cuello tenso y golpea— y sigue su camino, que es lo
que hace una garza casi todo el día. El vuelo se lo queda el milano, cuyo modelo
viene con las alas abiertas. Queda previsto el hueco para una garza en vuelo
(`flightModel` en el bestiario).

**Bestiario.** El criterio es geográfico, no «japonés genérico»: el ciervo, por
ejemplo, queda fuera porque es de Nara.

| Especie | Por qué es de Kyoto | Dónde vive en el cuadro |
|---|---|---|
| **Garza** (aosagi) | Las del río Kamo, quietas en la orilla | Tercio inferior: **vadea y pesca**. Sin vuelo hasta que haya modelo en vuelo |
| **Milano** (tobi) | Planean en círculo sobre las colinas del este | Sólo tercio superior, lejos; no aterriza nunca |
| **Gorrión** (suzume) | En bandadas por los tejados | Bandada de 5–9, o de 3 a 5 bajando juntos a picotear |
| **Ardilla japonesa** (*Sciurus lis*) | Bosques de Higashiyama y Arashiyama | Suelo del tercio inferior; **es la que persigue a otra** |
| **Gato** | Callejones de Gion y Pontochō. Es un bobtail calicó, el del maneki-neko | Suelo. Pasea con pausas; o se sienta a mirar la calle y se despereza; o se echa la siesta, despierta, se despereza y se va; o **son dos, persiguiéndose en círculos** |
| **Luciérnaga** (Genji-botaru) | Junio en el Shirakawa y el Kamo | Sólo en Gion, al anochecer |
| **Mariposa / libélula** (ageha *Papilio xuthus* / akatombo) | Jardines y campo abierto | Capa delantera, cruzan cerca de la cámara |
| **Tanuki** | Nocturno, en las colinas | Raro, sólo Gion |
| **Uguisu** (ruiseñor japonés) | *El* sonido de la primavera en Kyoto | **No se ve: sólo existe como capa de audio** |
| **Kitsune** | Mensajero de Inari | Aplazado a la **Fase 6**, entre los toriis |
| **Carpa koi** | Estanques de templo | Aplazada hasta que haya **agua** en escena |

**El director de fauna** (`scene/systems/fauna/FaunaDirector.tsx`) trabaja como
un director de casting, no como un reproductor:

- elige entre las especies que declara `station.ambient.fauna` en `journey.ts`
  — la estación dice **qué especies**, nunca qué hacen;
- lanza un acto cada **20–40 s** (`--fauna-min-gap` / `--fauna-max-gap`) y uno
  extra a los **20 s sin scroll** (`--idle-before-fauna`);
- mantiene como mucho **un acto aéreo y uno terrestre a la vez** en tier alto,
  uno en medio, cero o uno en bajo, y nunca repite especie dos veces seguidas;
- **respeta la regla de tercios**: lo aéreo arriba, lo terrestre abajo, y el
  tercio medio sólo se cruza por detrás del sujeto (z < −8) para no tapar el
  texto;
- todo lo que pisa el suelo muestrea `terrainHeight()` — la misma función pura
  que dibuja el terreno y apoya las piedras —, así que nada flota ni se hunde y
  en Fushimi Inari los animales suben la cuesta de verdad;
- las aves **derivan con la ráfaga** del `WindField`, y cada acto puede disparar
  su capa de sonido (el graznido de la garza al cruzar);
- con modo 静 o `prefers-reduced-motion`: **cero actos**.

**En el camino (Fase 3B).** La fauna vive en el mundo, como las piedras
(`scene/systems/fauna/anchoring.ts`; diseño en
`docs/superpowers/specs/2026-10-01-fase-3b-la-fauna-en-el-camino-design.md`):

- cada acto nace con un **ancla**, una copia del encuadre de la cámara: al
  avanzar, uno se acerca a los animales, los ve crecer y los deja atrás (lo que
  anda sale por abajo a ~10 u);
- **lo que vuela se adelanta**: su ancla se deja alcanzar hasta un mínimo
  (mariposas 8 u, bandadas 10, milano 22) y después avanza con la cámara; los
  gorriones que bajan a posarse, sólo mientras están en el aire;
- al caminar, los actos **nacen por delante**, con una ventaja según la
  velocidad; caminando rápido o retrocediendo no nace nada, y dejar atrás un
  acto adelanta el siguiente;
- cada estación declara su **cercanía** (`ambient.faunaDistance`): Gion íntimo,
  Ubicación lejano;
- **ningún animal se retira a la vista**: sólo fuera de cuadro, comprobado cada
  frame con la cámara real. Si se le acaba el tiempo a la vista, sigue su
  camino hasta salir; el milano llega bajando en espiral desde arriba y se va
  subiendo en la térmica hasta perderse (nunca pasa de ~3 u/s), y las
  luciérnagas se encienden y se apagan;
- **lo que cruza el camino pasa por encima de las piedras**: el suelo de la
  fauna es lo más alto entre el terreno y las piedras
  (`scene/path/stoneSurface.ts`), ensanchado por la pisada y suavizado en una
  rampa para que subir a una piedra no sea un salto.

> **Para las fases 4–8:** todo objeto sólido que se plante donde anda la fauna
> (troncos, pies de torii, faroles, linternas de piedra) tiene que entrar en ese
> suelo o quedar fuera de las trayectorias; si no, un animal lo atravesará como
> atravesaba las piedras. `check:path` tiene ya la sonda (rayo vertical contra
> la geometría real) que habría que extender a cada objeto nuevo.

---

## 6. Sistema de diseño

### Paleta

Calibrada en la Fase 1 muestreando las referencias con `bun run palette`. Los
valores ya no son estimaciones: son medidas.

| Rol | Token | Valor medido | Dónde se midió |
|---|---|---|---|
| Fondo base | `--color-washi` | `#FFFACD` | 85,7 % de los píxeles de `1.png` |
| Primario | `--color-shu` | `#D82609` | El torii de `1.png` (7,6 %) |
| Primario oscuro | `--color-shu-deep` | `#942D2D` | Farol de `13.png` |
| Tinta | `--color-sumi` | `#300500` | El trazo de `1.png` — es tinta cálida, no negro |
| Sakura | `--color-sakura` | `#EB81A5` | Las flores de `4.png` |
| Sakura pálido | `--color-sakura-pale` | `#FFDDE8` | Pétalos claros de `4.png` |
| Rubor | `--color-sakura-blush` | `#FFCCBC` | Círculos 2 y 4 de `13.png` |
| Ámbar | `--color-kohaku` | `#FFD699` | Círculo del farol, `13.png` |
| Matcha suave | `--color-matcha-soft` | `#B4CCAD` | Círculo de gastronomía, `13.png` |
| Bambú | `--color-bambu` | `#A3B58E` | Hojas de bambú de `1.png` |
| Piedra | `--color-ishi` | `#EDE6DD` | Círculo del torii, `13.png` |

Las tres estimaciones del documento original estaban cerca pero ninguna era
exacta: el fondo real es `#FFFACD` (no `#FBF8CD`), el rojo es `#D82609` (no
`#D9381E`) y la tinta es un marrón muy oscuro, `#300500`, no un gris neutro. La
diferencia se nota sobre todo en el fondo, que ocupa el 85 % del cuadro.

Los colores viven **sólo** en `src/styles/tokens.css`; la escena 3D los lee de
ahí en tiempo de ejecución para que no exista una segunda copia en TypeScript.

### Tipografía

- **One Jinja** → títulos
- **Gaze Nozarashi** → párrafos, texto de lectura, pinceladas y frases sueltas
- **Zen Old Mincho** → kanji decorativo *(propuesta; alternativa: Yuji Syuku)*

Titulares y lectura eran las dos familias de partida, no había nada que comparar
ahí: One Jinja para títulos y Gaze Nozarashi para todo lo demás, negrita incluida
vía `font-weight` en CSS si algún texto la necesita (no hay un archivo Bold que
subsetear). Lo único que se compara en `/es/tipografia/` con "KYOTO · Sakura ·
Kiyomizu-dera" es el kanji decorativo, entre Zen Old Mincho y Yuji Syuku.

**Hallazgo de la Fase 1:** leyendo la tabla `cmap` de los dos archivos que aportó el
usuario resultó que **ninguno de los dos tiene un solo carácter japonés**. One Jinja
son 266 puntos de código y Gaze Nozarashi 233, y en ambos casos es latín puro —
son tipografías latinas *de estilo* japonés, no tipografías japonesas. Es decir: la
familia japonesa no era un añadido opcional, era obligatoria para que 京都 no cayera
en la fuente del sistema.

Además las dos son versiones **Demo** con "All Rights Reserved" en la tabla `name`
(aunque su `fsType` sí permite incrustarlas). Ver `assets/fonts/LICENSES.md`.

**Pipeline de fuentes:** los `.otf`/`.ttf` viven en `assets/fonts/source/` →
`bun run fonts` los subsetea con `subset-font` (harfbuzz sobre wasm, sin depender de
Python ni de `glyphhanger`) → `.woff2` en `src/styles/generated/` → `next/font/local`.

El set de kanji **no está escrito a mano**: `requiredKanji()` lo deduce de `journey.ts`,
así que añadir una estación con un kanji nuevo sólo obliga a volver a correr el script.

Resultado medido: **20,5 MB de originales → 124 KB**. La japonesa concreta pasa de
5,3 MB a **10,9 KB** con sus 43 glifos. Lo que el PLAN estimaba en ~15 KB.

> ⚠️ Lección aprendida, ya anotada en `CLAUDE.md`: **no usar `next/font/google` con
> familias que cubran japonés.** Google las sirve troceadas por `unicode-range` y
> next/font precarga todos los trozos — M PLUS Rounded 1c metía **230
> `<link rel=preload>`** en cada página. Con el pipeline local son 5 peticiones.

---

## 7. Estrategia de assets

**Regla de prioridad, en orden estricto:**

1. **Generar el visual proceduralmente** con las librerías del stack, o generarlo con alguna de estas librerías (Three JS).
2. **Buscar un asset ya hecho** en el ecosistema (Lottie libre, modelo CC0).
3. **Dibujar un SVG a mano** — sólo como último recurso, y **siempre preguntando y
   justificando antes** por qué las dos opciones anteriores no sirven.

El motivo es funcional, no estético: la geometría procedural se anima por vértices, se
instancia miles de veces y reacciona al input. Un dibujo estático no.

### Mapeo elemento → técnica

| Elemento | Cómo se genera | Librería |
|---|---|---|
| **Piedras del camino** | Icosaedro deformado con ruido simplex + flat shading. Cada piedra con seed distinto = todas únicas | R3F + `maath` |
| **Torii** | Cajas para los pilares + `ExtrudeGeometry` sobre `CatmullRomCurve3` para el *kasagi* curvado | three / R3F |
| **Bambú** | `CylinderGeometry` instanciado + vertex shader de viento (seno + ruido) | R3F `<Instances>` + GLSL |
| **Pétalos / hojas** | `InstancedMesh` con posición calculada **en el shader** → coste CPU ≈ 0, miles de partículas a 60 fps | R3F + shader |
| **Faroles** | `LatheGeometry` para la acanaladura + material emisivo + bloom. Se balancean con física | R3F + postprocessing + rapier |
| **Fauna** | Modelos `.glb` reales pasados por `bun run models`: el color de la textura se **hornea en los vértices** y la textura se tira (el 80 % del peso, y un realismo fotográfico que chocaba con el cartel), la malla se simplifica y se normaliza (morro a +X, pies en y = 0, largo 1). De 177 MB a ~1 MB. Se animan deformando regiones en el vertex shader, con un 20 % más de saturación (sin tocar el brillo), un 5 % de washi y un filo de tinta en la silueta (§5.6) | gltf-transform + meshoptimizer + sharp; R3F + GLSL |
| **Luciérnagas** | Puntos con material emisivo y pulso propio | R3F |
| **Ambiente sonoro** | Sintetizado con la Web Audio API: ruido rosa filtrado para el viento (la frecuencia sigue al `WindField`), parciales con decaimiento para el *fūrin*, ráfagas cortas para los grillos, envolvente sobre oscilador ruidoso para el graznido | Web Audio nativa |
| **Pétalos y hojas** | Densidad por zona con pico en cada ráfaga. Contorno paramétrico triangulado en abanico (pétalo de cerezo con su muesca, arce de cinco lóbulos por el valor absoluto de cos(2.5θ), hoja lanceolada de bambú) + `InstancedMesh` con la posición calculada **en el vertex shader** | R3F + GLSL |
| **Estallido de pétalos al click** | `confetti.shapeFromPath()` con la silueta de un pétalo | canvas-confetti |
| **Mapa de Japón** | GeoJSON de prefecturas → `SVGLoader` → `ExtrudeGeometry` = mapa 3D extruido, Kyoto se eleva al hover | three + `d3-geo` |
| **Agua / estanque** | `MeshReflectorMaterial` con distorsión | drei |
| **Niebla y atmósfera** | `fog` + `<Cloud>` + god rays | drei + postprocessing |
| **Títulos kanji 3D** | `Text3D` con la fuente subseteada, extruido con luz rasante | drei |
| **Página de gastronomía** | Candidata a escena PIXI 2D pura (sprites + filtros), sin cargar el 3D | PIXI.js |

### Dónde esto se pone difícil

La pagoda de Kiyomizu-dera (`8.png`), las casas de Gion (`10, 11.png`) y los platos
(`12.png`) tienen demasiado detalle ilustrado para geometría procedural elegante. Para esos
tres, cuando lleguemos a su fase, se propondrán modelos `.glb` CC0 low-poly o Lottie — y si
ninguno sirve, se consulta antes de dibujar.

---

## 8. Arquitectura

### La idea central: `journey.ts` como fuente única de verdad

```ts
// una estación = un punto del camino
{ slug, kanji, romaji, icon, pathT: 0.34, palette, ambient: { … },
  environment: { hills, hillSides, altitude, lateral, skyTint },
  tramo: { cards: [{ id, side, kind }] } }
```

Su profundidad en el mundo es `pathT × PATH_LENGTH` (400 unidades). El avance fino de la
cámara no vive en el store: cambia a 60 fps y está en el objeto de módulo `PATH`
(`scene/path/journeyPath.ts`), con un único escritor, el rig de cámara. El store guarda sólo
`zone`, la estación en cuyo tramo está la cámara, que es lo que leen el ambiente, el audio y
la fauna.

De ese único array se derivan **al mismo tiempo**:

- el sidebar radial de navegación,
- las piedras del camino y su posición en el spline,
- la posición objetivo de la cámara,
- las rutas de Next,
- el ambiente de cada zona (pétalos, fauna, color, sonido).

Cambiar el orden ahí reordena el sitio entero. Esto es lo que hace que "el camino" sea real
y no una animación decorativa.

### Escena persistente

`<SceneRoot>` vive en `app/[locale]/layout.tsx` y **nunca se desmonta**. Cada ruta sólo
declara "llévame a la estación X" y la cámara viaja por el spline hasta allá. Sin flashes,
sin recargar el 3D, sin cortes entre páginas. También hace que se vea como un cámino real, por lo que no siempre dará la impresión de ir adelante, sino de subir, bajar, ir a la derecha, ir a la izquiera, subir por el camino de Toris como en la imagen `5.png`

### Estructura de carpetas

```
src/
├─ app/
│   └─ [locales]/
│       ├─ layout.tsx            ← fuentes, providers, <SceneRoot> persistente
│       ├─ page.tsx              ← Home 京都
│       ├─ ubicacion/            ← 位置
│       ├─ lugares/[slug]/       ← fushimi-inari, kiyomizu-dera, gion
│       ├─ eventos/              ← 桜 y calendario del año
│       └─ gastronomia/          ← 京料理
├─ scene/                        ← el mundo R3F
│   ├─ SceneRoot.tsx
│   ├─ camera/                   ← rig de scroll + parallax de cursor
│   ├─ objects/                  ← Torii, Farol, Pagoda, Bambu, Garza, Piedra
│   ├─ systems/                  ← PetalSystem, WindField, FaunaDirector, StonePath
│   └─ quality/                  ← detección de tier + LOD
├─ animation/
│   ├─ gsap.ts                   ← singleton, registerPlugin, integración con Lenis
│   ├─ useScrollScene.ts
│   └─ presets.ts                ← easings y duraciones como tokens
├─ components/
│   ├─ ui/                       ← primitivas estilo papel washi
│   ├─ nav/                      ← RadialSidebar, PathProgress, MobileNav
│   └─ sections/
├─ content/                      ← textos es/en por sección
├─ store/                        ← Zustand
├─ styles/                       ← tokens.css
├─ config/
│   └─ journey.ts                ← ★ fuente única de verdad
└─ lib/
```

---

## 9. Rendimiento y accesibilidad

### Tiers de calidad

Detección automática al arrancar (GPU, memoria, tamaño de pantalla), con override manual:

| Tier | Ajustes |
|---|---|
| **Alto** | Postprocessing completo, densidad máxima de instancias, sombras, fog largo |
| **Medio** | Sin god rays ni sombras, densidad de partículas a la mitad |
| **Bajo** | Sin postprocessing, fog corto, partículas mínimas, billboards en vez de geometría media |

La cámara observadora abarata mucho esto: no hace falta geometría creíble en 360°, sólo lo
que entra en cuadro.

### Accesibilidad

- `prefers-reduced-motion` desactiva el parallax de cursor y el ambiente, y suaviza las
  transiciones
- Modo **静 (quieto)** manual, independiente del sistema
- El contenido existe siempre como **DOM real** (SEO y lectores de pantalla), aunque
  visualmente se integre a la escena
- Navegación por teclado funcional en el sidebar
- Audio ambiental **armado por defecto**, pero nunca sonando de golpe al cargar: los
  navegadores (Chrome, Safari, Firefox) bloquean el `AudioContext` hasta que hay un
  gesto de la persona, así que técnicamente no existe forma de arrancar sonido en el
  primer píxel. La solución implementada es la única honesta: la preferencia queda en
  «sí» desde el principio y el ambiente entra solo en cuanto hay el primer scroll,
  clic o tecla. Nada de sonido continuo — sólo capas puntuales (una ráfaga de viento,
  un arroyo cercano, las garzas al cruzar) y siempre con un interruptor visible.
  El estado real se puede comprobar en `/es/diagnostico/`.

---

## 10. Plan de fases

El proyecto se construye **página por página, con una parada explícita al final de cada
fase** para revisión antes de seguir.

| # | Fase | Entregable | Stop |
|---|---|---|---|
| **0** | Definiciones | Este documento | ✅ |
| **1** | Fundación | Scaffold Next+TS+Tailwind · tokens de diseño · pipeline de fuentes · `journey.ts` · Zustand + tiers + reduced-motion · i18n `/es` `/en` · `<SceneRoot>` con cámara en perspectiva y niebla | ✅ |
| **2** | Motor de movimiento y ambiente | Se parte en tres bloques con parada propia, ver abajo | ✅ |
| **2A** | · Motor | Lenis + GSAP en un solo RAF · easings leídos de `tokens.css` · `WindField` con ráfagas · parallax de cursor · lectura en `/diagnostico` | ✅ |
| **2B** | · Ambiente | `PetalSystem` en `InstancedMesh` con la posición calculada en el shader, en tres capas de profundidad · profundidad de campo en tier alto | ✅ |
| **2C** | · Vida | Los tres rigs de fauna · repertorio de conductas · `FaunaDirector` · motor de audio sintetizado · controles de sonido y modo 静 | ✅ |
| **3** | **El Camino** | Se parte en tres bloques con parada propia, ver abajo | ⏳ |
| **3A** | · El mundo | Sendero desde `journey.ts` · terreno continuo · piedras en todo el recorrido · cámara sobre el camino con scroll · tramo y llegada automática · viaje entre estaciones | ✅ pendiente de revisión |
| **3B** | · La fauna en el camino | Actos anclados al mundo · lo que vuela se adelanta (ancla que se desliza) · nace por delante al caminar · cercanía por estación · márgenes con la cámara real · nunca desaparece a la vista | ✅ pendiente de revisión |
| **3C** | · La navegación | Sidebar radial (`13.png`) con íconos generados por código · progreso del camino · nav móvil · teclado · transiciones | ⏸ |
| **4** | Home 京都 | Torii 3D, bambú, título tipográfico, composición del hero | ⏸ |
| **5** | Ubicación 位置 | Mapa de Japón extruido e interactivo, zoom a Kyoto · **tramo hacia Eventos**: los dos mapas antiguos, desplegables, **no como tarjetas sino como carteles de madera insertados en el camino** (en 3A son tarjetas provisionales, con el hueco del mapa), junto a la reseña breve de Kyoto | ⏸ |
| **6** | Lugares | Plantilla + Fushimi Inari, Kiyomizu-dera, Gion · **tramos**: de Eventos a Fushimi, paso por los costados del santuario y subida escalonada —gradas en la malla del terreno— con toriis (`5.png`); de Fushimi a Kiyomizu-dera, un bosque denso de bambú y un puente de madera sobre una pequeña vaguada antes de la plataforma del templo; de Kiyomizu-dera a Gion, la bajada termina en calzadas tradicionales y faroles | ⏸ |
| **7** | Eventos | Sakura + rueda de estaciones / calendario del año · **tramo de llegada**: el bosque de cerezos al acercarse a la sakura (el aumento progresivo de pétalos ya lo hace 3A) | ⏸ |
| **8** | Gastronomía 京料理 | Platos interactivos · **tramo final**: llano, culmina en el espacio gastronómico | ⏸ |
| **9** | Pulido | Presupuesto de rendimiento · Lighthouse · auditoría a11y · móvil real · SEO/OG · deploy | ⏸ |

**Las fases 1–3 son la inversión clave.** Si el camino queda bien, las páginas 4–8 son en
buena medida rellenar contenido sobre una plantilla que ya funciona.

---

## 11. Pendientes y riesgos abiertos

| Tema | Estado |
|---|---|
| Licencia de One Jinja y Gaze Nozarashi | ⚠️ Ambas son versiones **Demo** con "All Rights Reserved". `fsType = 0` permite incrustarlas técnicamente, pero si el sitio se publica con ánimo comercial hay que comprar licencia o sustituirlas. Detalle en `assets/fonts/LICENSES.md` |
| Fuente de kanji | ⏳ Zen Old Mincho vs Yuji Syuku — comparar en `/es/tipografia/` |
| Slugs por idioma | ✅ Decidido en la Fase 3: se quedan en español. El export estático no tiene middleware que reescriba `/en/location` → `ubicacion`; traducirlos obligaría a una ruta comodín generada desde `journey.ts`. Se reconsidera en la Fase 9 |
| Pagoda, casas de Gion y platos | ⏳ Se resuelve en sus fases (ver §7) |
| Kitsune | ⏳ Aplazado a la Fase 6, entre los toriis. El modelo está en `assets/models/source/` |
| Carpa koi | ⏳ Aplazada hasta que haya agua: un estanque en alguno de los templos o en la home. El koi que había es un asset de Animal Crossing y **no se puede publicar**; se hará uno propio (los peces son el caso de libro de la deformación en el shader) |
| **Créditos de los modelos** | ⚠️ Garza y gorrión son CC BY: **antes de publicar tiene que existir una sección de créditos visible**. Detalle en `assets/models/LICENSES.md` (Fase 9) |
| Peso de la fauna | ⏳ ~0,96 MB en total; cada estación sólo carga su elenco. La mariposa se lleva 620 KB (esqueleto de 192 huesos que el simplificador no consigue bajar de 16.000 triángulos), y las posiciones de los modelos estáticos van sin cuantizar para que el shader vea coordenadas reales. Las dos cosas son candidatas a recorte en la Fase 9 |
| Bloom | ⏳ Aplazado de 2B a **2C**. Sobre un fondo washi (`#FFFACD`, luminancia ~0,97) un bloom por umbral ilumina el fondo entero. Entra con las luciérnagas y los faroles, que son lo que de verdad tiene que brillar |
| Giroscopio en iOS | ⚠️ `DeviceOrientationEvent.requestPermission()` exige un gesto y abre un diálogo del sistema. No se pide al vuelo: el parallax por giro queda listo pero apagado en iOS hasta que haya un interruptor explícito (Fase 2C / 9) |
| Profundidad del contenido | ⏳ ¿Tarjetas cortas o artículos largos? Define si se usa MDX o datos en TS |
| Fauna en vertical | ⏳ Fase 3C (móvil). En 9:16 el cuadro es estrecho y los círculos del milano (hasta 8,5 u de radio, más su deriva) se salen por los lados: se le ve el ~36 % de su acto, frente al ~75 % en horizontal (`check:path` lo mide). Habrá que escalar sus círculos —y revisar los márgenes laterales del resto— con el aspecto real |
| Dominio y hosting | ⏳ Fase 9 |
| Assets de Canva | ⚠️ Con marca de agua. Sólo referencia, nunca producción |
