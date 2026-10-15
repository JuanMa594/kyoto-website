# Fase 5B — Ubicación 位置, el tramo hacia Eventos: diseño

> La Fase 5 se parte en dos bloques con parada propia. 5A, el cartel (la
> maqueta de Japón, el zoom a Kyoto e *Ichi / 位置*), está cerrada. **5B es el
> tramo**: los 128 u de valle entre Ubicación y Eventos, donde las tres
> tarjetas provisionales de la Fase 3A se vuelven **kōsatsu** —los tablones de
> avisos de Edo— con dos **mapas antiguos que se despliegan**, una **roca
> pintada** con la esquina de `2.png` y la decoración del valle, que termina
> anunciando los cerezos de Eventos.

## 1. Qué se busca

Que el tramo hacia Eventos **se camine como un valle con historia**: al andar,
el camino pasa junto a tres tablones de madera plantados a su lado; en cada
parada se desenrolla un mapa antiguo y en la tabla se lee, escrito como si
fuera en la madera, un trozo de la historia de la ciudad —la capital de mil
años, Heian-kyō, el paso a Kyoto—. Entre medias, una roca grande pintada con el
sol, el Fuji y el torii; susuki meciéndose con el viento; faroles; y, al final,
los primeros cerezos.

**Criterio de éxito (revisión visual del usuario):**

- Los textos del tramo se leen **sobre la tabla** de cada kōsatsu, no en una
  tarjeta flotante, y se leen cómodos (a la escala de la tarjeta de hoy).
- El mapa **baja como un rollo** al acercarse a la parada y vuelve a subir al
  alejarse, sin saltos.
- Los dos mapas se reconocen como mapas antiguos: Japón a la manera de Edo y el
  plano de Heian-kyō.
- La vista inicial de Ubicación **no se carga**: como en la Home, la
  decoración se ve detrás —la roca, difusa por la niebla—, pero el cartel
  manda.
- El valle no se ve vacío ni repetido, y el final anuncia Eventos.
- `check:path` sigue verde, con todo lo nuevo dentro de sus comprobaciones.

## 2. Decisiones ya tomadas

| Tema | Decisión | Origen |
|---|---|---|
| Cartel y texto | **El texto va sobre la tabla**: un kōsatsu 3D al lado del camino y el DOM del texto encajado cada frame en su zona de escritura | Usuario |
| Técnica del encaje | **translate + scale** (sin perspectiva): el kōsatsu mira a la cámara de su parada y el DOM se encaja en el rectángulo proyectado | Usuario |
| Los mapas | **Japón a la Edo** (el dato de Natural Earth) y **Heian-kyō en 794** (la cuadrícula) | Usuario |
| «Desplegable» | **Rollo (kakejiku) que baja con el scroll**, reversible; con 静 / movimiento reducido, ya desplegado | Usuario |
| La reseña | **Otro kōsatsu, sin rollo**: un solo objeto nuevo para las tres paradas | Usuario |
| La roca | **Tateishi grande**: 2,5–3 u de alto y **3,5–4 u de ancho**, pintada en el shader con el sol, el Fuji y el torii | Usuario |
| Dónde va la roca | **~50 u de la cámara inicial**, difusa por la niebla; tras el primer kōsatsu, del lado opuesto | Usuario |
| El valle | **Susuki** (macizo nuevo) + lo que ya existe (arbustos, faroles, musgo) | Usuario |
| Cerezos | **2–3 al final del tramo**, no pegados al camino pero a la vista: anuncian Eventos. Son el **asset base de la Fase 7** | Usuario |
| Faroles | **A veces los dos tipos juntos** (kasuga + yukimi) en un mismo lado, para que la decoración no se vea siempre igual. Regla para todo el camino | Usuario |
| Textos | Cuentan la **historia** (no repiten la ficha de 5A); el segundo aclara entre paréntesis que Heian-kyō es el nombre antiguo de Kyoto | Usuario |
| Susuki y cerezos | La susuki con espiga es de otoño, los cerezos de primavera: **la susuki se aclara** antes de los cerezos y no comparten cuadro | Propuesta aceptada |
| Etiquetas de los mapas | Sólo kanji, **trazos de KanjiVG** (no una fuente): un SVG en `<img>` no carga fuentes web | Propuesta aceptada |

## 3. El recorrido

El tramo mide 128 u (de d = 0 en Ubicación a d = 128 en Eventos) y lleva tres
tarjetas, así que la cámara se detiene en tres puntos: con `STOP_DRIFT` 0,008,
el encuadre está en **d ≈ 31, 63,5 y 96** en cada parada
(`tramoFraction`). La vista de la cámara en cada una es casi frontal: el
camino gira poco entre Ubicación (lateral −8) y Eventos (lateral 4).

| d (aprox.) | Qué hay |
|---|---|
| −5 | La maqueta (5A) |
| 0 | Ubicación: la vista inicial. Al fondo, difusa, la roca |
| ~29 | **Kōsatsu 1**, a la izquierda: Japón a la Edo, «La capital de mil años» |
| ~36–40 | **La roca pintada**, a la derecha |
| ~61 | **Kōsatsu 2**, a la derecha: Heian-kyō, «Una ciudad trazada a cordel» |
| ~93 | **Kōsatsu 3**, a la izquierda: sin mapa, «De Heian-kyō a Kyoto» |
| ~100–125 | Los **cerezos**, a |u| 7–14; la susuki ya se ha aclarado |
| 128 | Eventos |

La susuki crece en manchas por los dos costados entre d ≈ 10 y d ≈ 95; los
arbustos, los faroles y el musgo rellenan los huecos entre paradas. Los
números finales salen de calibrar con `check:path` y capturas; las posiciones
de los kōsatsu **no se escriben a mano** (§4.2).

## 4. El kōsatsu (高札)

### 4.1 El objeto

El tablón de avisos de Edo, procedural como el torii y los faroles, en
`scene/objects/kosatsu/` (medidas puras, geometría, componente):

- **Dos postes** clavados en el suelo, de sección cuadrada, con la base algo
  más oscura (la humedad).
- **Una tabla ancha**, horizontal, de madera pálida y envejecida (tonos de la
  paleta; vetas y desgaste en el shader del cartel, `cartelLook`), con un
  marco de listón.
- **Un tejadillo a dos aguas** (kirizuma) de madera oscura, que sobresale.
- **La tabla se parte en dos**: del lado **lejos del camino** cuelga el
  **kakejiku** con el mapa (vara de arriba, papel, vara de abajo); del lado
  **del camino** queda la **zona de escritura**, donde se encaja el DOM. En el
  kōsatsu sin mapa, toda la tabla es zona de escritura.

Medidas de partida (a calibrar): tabla ~4 × 2 u, postes ~3,6 u, alto total
~4,4 u — dentro del presupuesto de 8,5 u del cuadro.

Como el resto de lo plantado: le cierra el paso a la fauna (cada poste), lleva
musgo al pie y su sombra de contacto, y entra en las huellas de la cámara y de
las piedras.

### 4.2 Declarado en la tarjeta, no como decoración suelta

`TramoCard` (en `journey.ts`) gana un campo opcional:

```ts
export interface TramoCard {
  readonly id: string;
  readonly side: Side;
  readonly kind: 'texto' | 'mapa';
  /** Va escrita en un kōsatsu plantado junto a su parada (Fase 5B). */
  readonly sign?: { readonly map?: OldMap };
}
export type OldMap = 'japon' | 'heian';
```

Una tarjeta con `sign` es un kōsatsu; sin él, sigue siendo la tarjeta de papel
de siempre (la bienvenida de la Home no cambia). El tramo de Ubicación queda:

```ts
const TRAMO_UBICACION: StationTramo = {
  cards: [
    { id: 'capital', side: 'izquierda', kind: 'mapa', sign: { map: 'japon' } },
    { id: 'heian', side: 'derecha', kind: 'mapa', sign: { map: 'heian' } },
    { id: 'kyoto', side: 'izquierda', kind: 'texto', sign: {} },
  ],
};
```

Una función pura nueva, `cardStopD(station, index)` (en
`animation/journeyScroll.ts`), da la d del encuadre en cada parada; y
`scene/decor/placement.ts` deriva de ella dónde va cada kōsatsu: **delante de
la cámara de su parada**, en su lado, girado hacia ella. Si el tramo cambia de
largo o de tarjetas, los kōsatsu se mueven solos. En vertical hay otra
derivación (más lejos y más cerca del eje, entero en el cuadro).

### 4.3 El DOM sobre la tabla

- Cada frame, la escena proyecta las cuatro esquinas de la zona de escritura
  de cada kōsatsu y deja el rectángulo en un objeto de módulo (`KOSATSU`, con
  un único escritor, como `MAQUETA`).
- Un callback de `gsap.ticker` en el tramo lo lee y encaja el bloque DOM con
  `translate3d` + `scale`: el bloque tiene un tamaño fijo en CSS (con la
  proporción de la zona de escritura) y se escala para cubrirla.
- La opacidad es la de hoy (`tramoCardOpacity`): el texto aparece en la tabla
  cuando la cámara frena y se va al alejarse. Al andar, la tabla se ve con su
  madera y su mapa, sin texto.
- Sobre la tabla, el texto va sin el papel de la tarjeta: tinta sumi sobre la
  madera, en Gaze Nozarashi, con el título en One Jinja.
- **Sin escena viva** (`PATH.live` falso, sin WebGL) el texto vuelve a ser la
  tarjeta de papel en su sitio de siempre.

**Legibilidad:** distancia y tamaño de la tabla se calibran para que la escala
en la parada sea **≥ 0,9 a 1600×900 y ≥ 0,85 a 1366×657**. Cada texto cabe en
su zona: ≤ ~60 palabras.

### 4.4 El rollo que baja

- El largo visible del papel del kakejiku es un valor 0–1 por tarjeta que sale
  del progreso del scroll: una función pura nueva, `tramoUnroll(progress,
  cards, index, walkVh)`, que **empieza a bajar ~60 vh antes** de la parada y
  termina ~10 vh antes (el texto, con su curva de siempre, aparece después), y
  vuelve a subir al salir.
- El tramo lo escribe en `KOSATSU` y la escena lo lee en `useFrame`: el
  shader recorta el papel (se ve la parte de arriba del mapa, como en un rollo
  que se desenrolla) y la vara de abajo baja con él.
- Con 静 o movimiento reducido el rollo está desplegado. Con `frameloop =
  "demand"` el cambio pide su frame (`invalidate`).

### 4.5 Vertical, 静 y movimiento reducido

- **En vertical** no hay sitio para una tabla legible junto al camino: el
  kōsatsu sigue en la escena con su mapa y el texto vuelve a la tarjeta de
  arriba, como hoy.
- **Con 静 o movimiento reducido** el tramo es la lista de lectura de siempre;
  las tarjetas con mapa muestran el mapa en un `<img>` (el SVG de §5) con su
  `alt`. Lo mismo lee un buscador.

## 5. Los dos mapas antiguos

### 5.1 Generados al construir

Un script nuevo, `scripts/build-maps.ts` (`bun run maps`), dibuja los dos
mapas como **SVG** y los rasteriza con sharp a **WebP**:

- `public/maps/japon.svg` · `japon.webp`
- `public/maps/heian.svg` · `heian.webp`

Se versionan, como los modelos. El WebP es la textura del kakejiku (se carga en
diferido, junto con la decoración); el SVG es el `<img>` de la lista estática.
Una fuente, dos salidas.

**Las etiquetas son trazos de KanjiVG**, la misma pincelada que `<InkKanji>`:
el script reutiliza la descarga de `bun run kanji` (`assets/kanji/source/`).
Sólo kanji, como en un mapa antiguo; la traducción va en el `alt` y en el
texto de la tabla. Licencia CC BY-SA 3.0: se anota en
`assets/kanji/LICENSES.md` y en los créditos de la Fase 9.

**El envejecido no va en el SVG.** El SVG lleva tinta y colores planos; en el
kakejiku, el shader añade el grano de washi y los bordes amarillentos (la idea
de `cartelLook`); en el DOM, un fondo de papel en CSS. Así el SVG queda limpio
y ligero.

### 5.2 Japón, a la manera de Edo

Al estilo de los mapas de Nagakubo Sekisui (1779), con el dato de Natural Earth
que ya usa `bun run geo`:

- Costa en sumi gruesa, fronteras de las prefecturas finas.
- Las regiones en los mismos tonos pálidos que la maqueta (`regions.ts`): los
  dos mapas del valle hablan el mismo idioma que el cartel.
- El mar del papel, con unas pocas olas a pinceladas (las formas de `waves.ts`).
- Kyoto con un sello shu y 京.
- Un cartucho de título en una esquina: **大日本國圖**.

### 5.3 Heian-kyō, 794

El plano bien documentado de la capital (unos 4,5 km de este a oeste por 5,2
de norte a sur), escrito como dato en el script:

- La cuadrícula de avenidas, con **一条** a **九条** en el margen y las dos
  mitades, **左京** y **右京**.
- **朱雀大路** por el centro, más ancha.
- **大内裏** (el recinto del palacio) al norte, entre Ichijō y Nijō.
- **羅城門** al sur, entre **東寺** y **西寺**.
- Los ríos **鴨川** y **桂川** en índigo (`--color-ai`).
- El mismo cartucho: **平安京圖**.

## 6. La roca pintada

### 6.1 El objeto

Un **tateishi** (立石) grande, más ancho que alto: **2,5–3 u de alto por
3,5–4 u de ancho** (de partida 2,8 × 3,8, con ~1,1 de fondo), con la cara
delantera bastante plana. Procedural, por el mismo camino que las piedras
(`stoneGeometry`: ruido sobre un sólido deformado) con otra forma, en
`scene/objects/roca/` (medidas puras, geometría, componente). Es `decor`
(`kind: 'roca'`).

### 6.2 La pintura, en el shader

En la cara delantera, en coordenadas planas, la esquina de `2.png` con
funciones de distancia: el **sol rojo** (shu) detrás, el **Fuji** de base sumi
con la nieve blanca y su borde dentado, y la silueta del **torii** delante, con
su dintel largo. Para que sea pintura sobre piedra y no una pegatina:

- **Bordes de pincel seco**, con el ruido que deshilacha las olas de la maqueta.
- **La pintura cede en lo alto del relieve y en las grietas**: donde la normal
  se aparta de la cara, asoma la piedra.
- **Pintura mate**, sin el brillo del papel.

Es un `MeshStandardMaterial` con sus chunks ampliados: luz, sombras y niebla
gratis. El GLSL se compila en un WebGL2 real antes de darlo por bueno.

### 6.3 Dónde va

- **Desde la vista inicial de Ubicación**, a **~50 u de la cámara** (d ≈
  36–40, u ≈ 4,5): la niebla del valle la vela y la profundidad de campo la
  desenfoca. Es una silueta suave a la derecha, que no compite con la maqueta
  ni con *Ichi / 位置*.
- **Ni al principio ni al final**: se llega a ella tras el primer kōsatsu, del
  lado opuesto. En la primera parada equilibra el cuadro (la tabla a la
  izquierda, la roca a la derecha).
- En vertical, en otra colocación (`portrait`), entera en el cuadro.
- Sin interacción y sin texto: es ambiente, se lee de un vistazo.

## 7. El valle

### 7.1 Susuki (すすき)

Un macizo nuevo, `kind: 'susuki'`, declarado por área como el bambú (`area`,
`density`, `taper`, `height`, `seed`):

- **Matas** instanciadas: cada una, un haz de hojas finas y curvadas con unas
  pocas **espigas** arriba. Alto 0,9–1,6 u.
- Se mece con el viento de siempre (`windSway`): las espigas oscilan más que
  las hojas, con fase propia (la trampa de «las mariposas»: nada bate a la vez).
  Su sombra, con el mismo viento (`customDepthMaterial`).
- Color: verde en la base, paja hacia las puntas, espigas plateadas que cogen
  la luz.
- **Para la fauna es blanda**, como las hojas: la cruzan las libélulas y la
  garza. Sólo la cámara y las piedras la tratan como franja.
- Manchas por los dos costados, con claros. **Nunca entre la cámara de una
  parada y su kōsatsu** (comprobado).
- **Se aclara** al final (`taper`) y no llega a los cerezos.

### 7.2 El cerezo (桜)

Un objeto nuevo, `kind: 'cerezo'`, pensado como **asset base de la Fase 7**
(su bosque será este árbol con otras semillas). En `scene/objects/cerezo/`:

- **Tronco y ramas** por crecimiento procedural con semilla (ramificación
  recursiva con ruido, tubos fusionados en una geometría), en forma de
  somei-yoshino: ancho y abierto, como `3.png`. Alto 5–7 u.
- **La copa**: racimos de flores instanciadas (tarjetas pequeñas con los
  pétalos dibujados en el shader), en los rosas de la paleta de Eventos. La
  copa se mece despacio con el viento, y su sombra con el mismo viento.
- **2–3 árboles en los últimos ~25 u** (d ≈ 100–125), a |u| 7–14, a
  distancias distintas. Se ven detrás del tercer kōsatsu, anunciando Eventos,
  sin taparlo (comprobado).
- El tronco cierra el paso a lo que anda; la copa es blanda. Musgo al pie y
  sombra de contacto.
- Los pétalos de sakura ya crecen al acercarse a Eventos: parecerá que caen de
  estos árboles sin hacer nada más.

### 7.3 Lo que ya existe

Arbustos, faroles y musgo rellenan los huecos entre paradas. **Uno o dos
grupos mezclan los dos faroles en un mismo lado** —un kasuga alto junto a un
yukimi bajo, a veces con un arbusto—, nunca el mismo par repetido. Esto pasa
al PLAN como regla de decoración para el resto del camino: los faroles no
aparecen siempre igual (en pareja, mezclados, solos).

## 8. Los textos

No repiten la ficha de 5A (ni población, ni coordenadas, ni distancias). En
`messages/{es,en}.json`, bajo `tramos.ubicacion.<id>`. Los ids cambian:
`japon`/`kansai`/`resena` pasan a `capital`/`heian`/`kyoto`.

**1 · `capital` — kōsatsu con Japón**

- *ES* — **La capital de mil años.** En 794 el emperador Kanmu trasladó la
  corte a este valle y la llamó Heian-kyō, *la capital de la paz y la
  tranquilidad*. Durante más de mil años, hasta 1868, fue el centro del país:
  aquí vivían los emperadores y de aquí partían los caminos hacia todas las
  provincias.
- *EN* — **The thousand-year capital.** In 794 Emperor Kanmu moved the court to
  this valley and named it Heian-kyō, *the capital of peace and tranquility*.
  For more than a thousand years, until 1868, it was the heart of the country:
  the emperors lived here, and from here the roads set out to every province.

**2 · `heian` — kōsatsu con Heian-kyō**

- *ES* — **Una ciudad trazada a cordel.** Heian-kyō (así se llamaba entonces
  Kyoto) se trazó a imagen de Chang'an, la capital de los Tang: una cuadrícula
  de unos 4,5 por 5,2 km, con el palacio al norte y la avenida Suzaku, de unos
  85 metros de ancho, hasta la puerta de Rashōmon. Las calles de hoy aún llevan
  su número: Nijō, Shijō, Gojō.
- *EN* — **A city laid out with a cord.** Heian-kyō (as Kyoto was called back
  then) was laid out in the image of Chang'an, the Tang capital: a grid of
  about 4.5 by 5.2 km, with the palace to the north and Suzaku Avenue, some
  85 metres wide, running down to the Rashōmon gate. Today's streets still
  carry its numbers: Nijō, Shijō, Gojō.

**3 · `kyoto` — kōsatsu sin mapa**

- *ES* — **De Heian-kyō a Kyoto.** Con los siglos, la ciudad pasó a llamarse
  sencillamente Kyoto, 京都, *la capital*. En 1868 el emperador se mudó a
  Tokio, pero la ciudad guardó lo que había reunido: más de 1.600 templos, unos
  400 santuarios y diecisiete monumentos Patrimonio de la Humanidad. Lo
  milenario y lo cotidiano siguen compartiendo la misma calle.
- *EN* — **From Heian-kyō to Kyoto.** Over the centuries the city came to be
  called simply Kyoto, 京都, *the capital*. In 1868 the emperor moved to Tokyo,
  but the city kept what it had gathered: more than 1,600 temples, some 400
  shrines and seventeen World Heritage monuments. The ancient and the everyday
  still share the same street.

**El `alt` de los mapas:**

- *ES* — «Mapa de Japón al estilo de Edo, con Kyoto marcado con un sello rojo.»
  / «Plano de Heian-kyō en 794: la cuadrícula de avenidas, el palacio al norte,
  la avenida Suzaku y la puerta de Rashōmon al sur, entre los ríos Kamo y
  Katsura.»
- *EN* — «Edo-style map of Japan, with Kyoto marked by a red seal.» / «Plan of
  Heian-kyō in 794: the grid of avenues, the palace to the north, Suzaku Avenue
  and the Rashōmon gate to the south, between the Kamo and Katsura rivers.»

La clave `tramo.mapPlaceholder` desaparece.

## 9. Calidad y rendimiento

- Presupuesto: **~+10 draw calls** en el tramo (kōsatsu, kakejiku, roca,
  susuki instanciada, troncos y copas instanciadas), a 60 fps en tier alto.
- Tier bajo: menos matas de susuki y menos flores por copa; los kōsatsu, la
  roca y los mapas no cambian.
- La decoración del tramo se monta con la de Ubicación (`StationDecor`, la
  estación y sus vecinas): las texturas de los mapas se cargan en diferido, no
  van en el primer JS de la página.
- Los materiales por instancia que se creen al montar se liberan al desmontar.

## 10. Verificación

**`check:path`** (`scripts/check-decor.ts` y `check-path.ts`) añade:

- Cada kōsatsu cae delante de su parada, en su lado, sin pisar piedras; la
  cámara pasa a ≥ 1,5 u (también en los viajes).
- La escala del texto en la parada: ≥ 0,9 a 1600×900 y ≥ 0,85 a 1366×657.
- Nada (susuki, cerezo, roca, farol, arbusto) tapa la tabla de un kōsatsu
  desde la cámara de su parada.
- La roca: en la vista inicial, en cuadro, a 45–60 u de la cámara y fuera de
  la zona del título; en la primera parada, sin tapar la tabla.
- La susuki se acaba antes del primer cerezo.
- `tramoUnroll`: 0 lejos de la parada, 1 en ella, continua y monótona en cada
  lado.
- Los textos y los `alt` existen en los dos idiomas y caben (≤ ~60 palabras).
- Las huellas de la fauna, el musgo y las sombras de contacto incluyen los
  objetos nuevos; la fauna sigue saliendo en el valle.

**Shaders:** la roca pintada, el kakejiku, la susuki y la copa del cerezo se
compilan en un contexto WebGL2 real antes de darlos por buenos.

**En el navegador** (por CDP): la vista inicial de Ubicación, las tres paradas
(horizontal y vertical), el rollo a medio bajar, y la lista estática con 静.

**Documentación:** PLAN (5A ✅, 5B en revisión al terminar; los objetos nuevos;
la regla de los faroles) y `CLAUDE.md` (arquitectura, `bun run maps`, estado de
las fases).

## 11. Mapa de archivos

Nuevos:

- `scripts/build-maps.ts` — los dos mapas: SVG + WebP en `public/maps/`.
- `public/maps/{japon,heian}.{svg,webp}` — generados, versionados.
- `src/scene/objects/kosatsu/` — `kosatsu.ts` (medidas, puro),
  `kosatsuGeometry.ts`, `Kosatsu.tsx`, el material del kakejiku y `KOSATSU`
  (el objeto de módulo).
- `src/scene/objects/roca/` — `roca.ts` (medidas, puro), `rocaGeometry.ts`,
  `rocaMaterial.ts` (la pintura), `Roca.tsx`.
- `src/scene/objects/cerezo/` — `cerezo.ts` (crecimiento, puro),
  `cerezoGeometry.ts`, `blossomMaterial.ts`, `Cerezo.tsx`.
- `src/scene/decor/susuki.ts` (puro) y `src/scene/systems/SusukiField.tsx`.
- `src/components/sections/useKosatsuFit.ts` — el callback de `gsap.ticker`
  que encaja el DOM de cada tarjeta sobre su tabla (lo usa `PathTramo`).

Cambian:

- `src/config/journey.ts` — `TramoCard.sign`, `OldMap`, `DecorRoca`,
  `DecorCerezo`, `DecorSusuki`; el tramo y la decoración de Ubicación.
- `src/animation/journeyScroll.ts` — `cardStopD`, `tramoUnroll`.
- `src/animation/useJourneyScroll.ts` — escribe el desenrollado en `KOSATSU`.
- `src/components/sections/PathTramo.tsx` — el texto sobre la tabla, el
  `<img>` del mapa en la lista estática.
- `src/scene/decor/placement.ts`, `footprints.ts`, `moss.ts`, `contact.ts`,
  `StationDecor.tsx` — los objetos nuevos.
- `src/scene/shaders/windSway.ts` — la espiga de la susuki y la copa del cerezo.
- `src/styles/globals.css` — el texto sobre la madera; sin el hueco del mapa.
- `src/messages/{es,en}.json` — los textos y los `alt`.
- `scripts/check-decor.ts`, `scripts/check-path.ts`.
- `assets/kanji/LICENSES.md`, `package.json` (`maps`), `docs/PLAN.md`,
  `CLAUDE.md`.

## 12. Orden de construcción

Para el plan; cada bloque se puede revisar por separado:

1. Los datos: `TramoCard.sign`, `cardStopD`, `tramoUnroll`, los textos nuevos
   y sus comprobaciones.
2. El kōsatsu y el texto sobre la tabla (con el hueco del mapa todavía vacío).
3. Los mapas (`bun run maps`) y el kakejiku que baja.
4. La roca pintada.
5. La susuki.
6. El cerezo.
7. El reparto del valle (faroles mezclados, arbustos, musgo) y la calibración
   con capturas.
8. Documentación.

## 13. Fuera de alcance (5B)

- El bosque de cerezos y la estación de Eventos (Fase 7).
- Interacción con los kōsatsu o la roca (clic, hover).
- Sonido propio del tramo, la noche y los faroles encendidos.

## 14. Riesgos y a calibrar en la revisión

| Tema | Qué vigilar |
|---|---|
| Legibilidad sobre la madera | Contraste de la tinta sobre la tabla pálida; si no llega, un velo de papel en la zona de escritura |
| Escala en pantallas bajas | A 1366×657 la tabla puede quedar justa: acercarla o achicar el bloque antes que bajar la letra |
| El texto al andar | Encajado cada frame se mueve con la tabla; sólo es visible cerca de la parada, pero hay que mirar que no tiemble |
| KanjiVG y las formas antiguas | 國 y 圖 son kyūjitai: si KanjiVG no las tiene, 国 y 図 |
| Tamaño de la roca | Con 3,8 u de ancho es un hito: que en la vista inicial siga siendo fondo |
| Coste del cerezo | Miles de flores instanciadas: medir en tier alto y bajo; la Fase 7 multiplicará los árboles |
| Susuki y fauna | Que las manchas no le cierren el paso a la garza (es blanda, pero el reparto debe seguir encontrando líneas) |

## 15. Correcciones al planificar

Al leer el código para el plan salieron dos errores de cálculo del diseño; la
intención no cambia, cambian los números.

- **La cámara va 22 u por detrás de su punto de interés** (`CAMERA_BACK`), no
  13. Las paradas (puntos de interés) caen a **d ≈ 35, 66 y 97** de Ubicación,
  y la cámara de cada una, 22 u antes. Con eso:
  - Los kōsatsu se plantan a **~20 u por delante de la cámara de su parada**
    (d ≈ 33, 64 y 95), con su canto interior a |u| ≈ 2: para que el texto se
    lea a buen tamaño, la tabla tiene que ocupar en pantalla lo que ocupaba la
    tarjeta, y a esa distancia mide **~8 × 4 u** (con el tejadillo, ~5,3 u de
    alto). Es un tablón grande, del tamaño del torii de la Home.
  - **La roca**, a ~50 u de la cámara inicial, cae a **d ≈ 28–34**: a la
    altura del primer kōsatsu, del otro lado del camino, y no después. En la
    primera parada enmarcan el cuadro juntos, tabla a un lado y roca al otro.
- **La legibilidad no se mide en escala, sino en el cuerpo de letra que
  resulta.** En la escena el campo de visión vertical es fijo, así que lo que
  mide la tabla en px crece y decrece con el alto de la ventana: un umbral de
  escala fijo en 1366×657 era imposible sin una tabla enorme. La regla queda:
  el bloque DOM mide 22 rem con el cuerpo a 1,1 rem; **a 1600×900 el cuerpo
  resultante es ≥ 16 px y la tabla cabe entera en su mitad de la pantalla
  (también a 1440×900)**; y en cualquier pantalla donde el cuerpo bajaría de
  **14 px**, o la tabla no cabe, o la pantalla es vertical o táctil, el texto
  vuelve a la tarjeta de papel. Se decide cada frame.

## 16. Desviaciones al implementar

- **Los lados de las tarjetas, al revés**: `capital` a la derecha, `heian` a la
  izquierda, `kyoto` a la derecha; y **la roca a la izquierda** (d 30, u −5,2).
  Desde la vista inicial, todo lo que queda a la derecha del camino a menos de
  60 u cae bajo el título (la misma regla de la Home), y el único hueco libre —entre
  la maqueta y el título— es para la roca, que es lo que se pidió ver desde allí.
  **Coste, a revisar**: el primer kōsatsu se ve, a ~55 u, detrás de 位置. La
  alternativa es la del diseño (lados izquierda/derecha/izquierda) con la roca
  escondida detrás del primer tablón: entonces la roca no se ve desde el cartel.
- **Medidas del kōsatsu**: tabla de 6,6 u (la de sin mapa, más estrecha), postes
  detrás de la tabla y metidos 1 u (la tabla vuela hacia el camino), la esquina del
  tejadillo a |u| ≥ 2 y los postes apartados de las piedras reales; el kakejiku de
  1,75 u, con los mapas en formato de rollo (900 × 1750); el bloque de texto, de
  19 rem. Paralelo al plano de la imagen de su parada, no girado hacia la cámara.
  Resultado: cuerpo de 17–18 px a 1600×900 y la tabla entera en su mitad también a
  1440×900.
- **El encaje** escala por ancho y por alto (el alto del bloque medido en el DOM)
  y centra: la tabla sin mapa daba 26 px y podía desbordar.
- **La escala** para 1366×657 no se exige: cae a la tarjeta de papel por la regla
  de §15 (cuerpo < 14 px).
- **Fauna (3B)**: el apartarse del ancla deslizante tiene ahora un tope de 4 u/s
  (`SLIDE_RESTORE_MAX_SPEED`): con la decoración nueva, el reparto con semilla de
  `check:path` sacó un gorrión que se apartaba a 10 u/s.
- **Susuki**: sin sombra (cintas finas: ni se leería ni compensa) y sin la mancha
  cercana a la derecha (caía bajo el texto del cartel).
- **Cerezo**: las flores no proyectan sombra (el tronco sí, con el mismo viento),
  sin filo de tinta y con un poco de brillo propio (de canto, la copa salía parda).
  Copa de 8,9–9,5 u de diámetro (la del somei-yoshino es ~1,5 veces su alto).
- **Rendimiento**: medido por CDP, de 41 a 59–81 draw calls en las paradas y de 62 a
  94 en el cartel: por encima del presupuesto de +10. Cada kōsatsu son seis mallas
  más su sombra; instanciarlos como los faroles ahorraría ~18. Queda propuesto para
  si la revisión nota caída de fps (el headless no lo mide: va a 30 fps fijos).
