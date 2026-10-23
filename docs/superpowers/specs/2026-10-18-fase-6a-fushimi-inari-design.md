# Fase 6A — Fushimi Inari 伏見稲荷大社: diseño

> La Fase 6 se parte en tres bloques con parada propia, uno por lugar. **6A es
> Fushimi Inari**: la plantilla de los lugares, la **subida escalonada entre
> toriis** que llega desde Eventos, la **explanada** de arriba con el **rōmon**
> de `6.png`, y el **kitsune** dos veces —en piedra, guardando la escalinata, y
> vivo, cruzando entre los toriis—. 6B (Kiyomizu-dera) y 6C (Gion) se diseñan
> al llegar a ellos.

## 1. Qué se busca

Que llegar a Fushimi Inari **se sienta como subir el monte**: al salir del
llano de los cerezos el camino empieza a escalar en gradas, entra en galerías
de toriis bermellón apretados —`5.png`, vistos desde dentro— y, entre galería y
galería, en los rellanos, cuelgan **ema** con los mitos del lugar. A veces un
zorro cruza entre los pilares. Arriba, el camino se abre en una **explanada**
de losas y aparece el **rōmon**, la gran puerta de dos tejados, a la izquierda,
con sus dos zorros de piedra. Ahí se lee el cartel; y si la persona toca la
puerta, la cámara se vuelve un poco hacia ella, los faroles se encienden y se
abre su tarjeta.

**Criterio de éxito (revisión visual del usuario):**

- La subida se lee como **subida por gradas**, no como rampa, y la cámara
  sube sin saltos ni mareo.
- Dentro de una galería se tiene la sensación de `5.png`: toriis que se
  repiten en profundidad, pasando **por debajo**. En las **densas** casi se
  tocan y se nota el bambú de arriba (luz que se cuela, sombra de hojas); las
  **abiertas** dejan ver el ritmo y cruzar a la fauna.
- Las ema se leen sobre la madera (como los kōsatsu) y se tocan para leer.
- La llegada es una **revelación**: la galería termina y se abre la plaza con
  el rōmon a la izquierda y el título a la derecha, como `6.png`.
- El kitsune vivo aparece en una subida normal sin forzarlo, y nunca nace ni
  se va a la vista.
- El paneo al tocar el rōmon es suave, corto y vuelve solo; no marea.
- `check:path` sigue verde, con todo lo nuevo dentro de sus comprobaciones.

## 2. Decisiones ya tomadas

| Tema | Decisión | Origen |
|---|---|---|
| Bloques | La Fase 6 en **tres bloques** (6A Fushimi, 6B Kiyomizu-dera, 6C Gion); el kitsune entra en 6A | Usuario |
| Orden de la llegada | **Primero la subida entre toriis, arriba la revelación** del templo (en el santuario real el rōmon está abajo; licencia narrativa consciente) | Usuario |
| El edificio | El **rōmon** de `6.png`, a la **izquierda** de la explanada; el título a la derecha | Usuario + `6.png` |
| El suelo de la plaza | **Losas grandes y sueltas** (ishidatami) que se funden con el fondo, no un pavimento gris continuo: el suelo no debe leerse como un piso | Propuesta aceptada |
| Toriis | Del tamaño necesario para que la cámara **pase por debajo** (más grandes que los reales, como en `5.png`), instanciados | Propuesta aceptada |
| Galerías | **Unas densas** (toriis apeñuscados, sin fauna, con la luz y la sombra del bambú de arriba) **y otras abiertas** con huecos por donde cruza la fauna | Usuario (2026-10-22) |
| Kitsune | **Los dos**: estatuas de piedra con **babero rojo** a los lados de la escalinata del rōmon, y el **zorro vivo** (`fox_realistic.glb`) cruzando por la senda de toriis | Usuario |
| Tocar el rōmon | **Híbrido**: paneo de cámara **muy suave y corto** + tarjeta de lectura + **los faroles del templo se encienden** | Usuario |
| Ema | Las tarjetas del tramo de subida son **ema** colgadas de un ema-kake, con el texto encajado sobre la madera (el mecanismo de los kōsatsu); se tocan para leer | Propuesta aceptada |
| Contenidos | Las **ema**: historias, mitos y la razón de los toriis. La **tarjeta del templo**: los datos (fundación en 711, deidad de la cosecha, número de toriis…) | Usuario |
| La greca de `6.png` | **No va en el DOM del cartel.** En la escena, sobre un objeto que la sostenga; en el DOM, sólo como adorno de las tarjetas de lectura | Usuario |
| Fushimi → Kiyomizu | El giro a la derecha, el bosque cerrado, el puente y el arroyo son de **6B** (anotado en el PLAN) | Usuario |

Decisiones mías dentro de ese marco, a revisar al leer: §4.3 (cómo se reparten
las galerías), §6.3 (la greca va en unos **nobori**), §5.3 (las estatuas,
sentadas si la deformación lo permite), §7.2 (cifras del paneo), §4.5 (los
haces de luz, sólo tier alto) y los textos de §9.

## 3. El recorrido

Eventos está en d = 192 y Fushimi en d = 386: el tramo de Eventos mide 194 u.
Sus primeros 50 (`flat`) son el llano de los cerezos —de la Fase 7, aquí no se
toca—; la subida va de **d ≈ 242 a 386**, de altitud 0 a 14, con el
`smoothstep` de `pathY` (pendiente máxima ~15 %, ~8°). La decoración de la
subida es la **del tramo de Eventos** (`environment.decor` de Eventos: «la
decoración de una estación incluye su tramo de salida»); la de la explanada, la
de Fushimi.

| d (aprox.) | Qué hay |
|---|---|
| 192–242 | El llano de los cerezos (Fase 7). Al fondo, la primera galería anuncia la subida |
| ~242 | Empiezan las gradas; bambú denso a los dos lados |
| — | **Galería 1**, abierta (la entrada) |
| rellano | **Ema 1** |
| — | **Galería 2**, densa |
| rellano | **Ema 2** |
| — | **Galería 3**, abierta |
| rellano | **Ema 3** |
| — | **Galería 4**, densa y la última: termina poco antes de la plaza |
| ~366–400 | **La explanada**: losas, nobori, faroles; el rōmon a la izquierda con sus dos zorros |
| 386 | Fushimi: el cartel |

Las d de las paradas no se escriben a mano: salen de `cardStopD` (§4.4), y las
galerías se colocan **entre** ellas. Los números finales salen de calibrar con
`check:path` y capturas.

## 4. La subida

### 4.1 Las gradas

- Las gradas son **del terreno**, no un objeto aparte: en el pasillo del
  camino (|u| ≲ 4,5) la altura de `elevation.ts` se **cuantiza en escalones**
  (contrahuella de partida ~0,35 u: unas cuarenta gradas) y fuera de él se
  funde con la pendiente lisa. Sólo en la subida de Eventos a Fushimi: una
  declaración del tramo (p. ej. `tramo.stairs`), no un caso especial en el
  código del terreno.
- **Las piedras del camino se ordenan con las gradas**: una por huella, nunca
  sobre el canto de una contrahuella (en la subida, la piedra hace de peldaño).
  `stoneTopY` sigue siendo la verdad para lo que pisa.
- **La cámara sigue `pathY`, que es lisa**, nunca los escalones: sube sin
  saltos. Comprobado.
- La fauna que anda pisa los escalones de verdad (`groundAt` ya toma el
  terreno): sube la cuesta saltando las gradas.
- Al tener escalones, los rellanos de las ema son **huellas más largas**
  (llanos de varias unidades), donde la cámara se detiene.

### 4.2 El torii inari

Una segunda variante del generador de `scene/objects/torii/`, `inari`, con sus
medidas puras en `inari.ts` junto a `ryobu.ts`:

- **Myōjin con daiwa**: el anillo donde el pilar se junta con el *shimaki*,
  que es lo que distingue al Inari torii. Sin *sode-bashira*.
- *Kasagi* curvado con la cara de arriba **negra**, *shimaki*, *gakuzuka* al
  centro, *nuki* que atraviesa los pilares y **pie negro** (*nemaki*), como en
  `5.png`.
- **Tamaño por la cámara, no por el original**: la cámara va a 5,2 u sobre el
  suelo. La cara de abajo del *nuki* queda a **≥ 1,5 u por encima de la
  cámara** en toda la subida (de partida ~6,8 u), y los pilares a **≥ 1,5 u de
  la cámara**, también en los viajes, que recortan las curvas (de partida, luz
  de ~7 u). Se calibra con `check:path`.
- **Instanciado**: una `InstancedMesh` por material (bermellón, negro), con
  pequeñas variaciones por instancia —el bermellón más nuevo o más
  apagado, un poco de ruido de escala—, para que la galería no sea una
  fotocopia.
- El torii de la Home sigue siendo el `ryobu` de siempre.

### 4.3 Las galerías

- **Cuatro galerías, de dos tipos**, **separadas por rellanos abiertos**: así
  hay ritmo (dentro / fuera / dentro), la fauna encuentra por dónde cruzar y
  las ema tienen un cuadro despejado. Una galería continua de 144 u sería un
  túnel sin respiro y le cerraría el paso a toda la fauna.
  - **Densa** (*apeñuscada*): los toriis casi se tocan, como en los tramos
    más famosos del monte. Con pilares de ~0,7 u de diámetro, van a
    **~1,0 u entre sí** (hueco de ~0,3 u): desde la cámara los pilares se
    solapan y la galería se lee como un túnel bermellón continuo, de `5.png`.
    **Aquí no se pide fauna**: nada cruza una pared de pilares, y está bien.
    Lo que se nota en su lugar es el **bambú de arriba** (§4.5): la luz que se
    cuela entre los dinteles y la sombra de las hojas sobre el suelo y los
    pilares. De partida 20–28 toriis.
  - **Abierta**: toriis a **~3,2 u entre sí** (hueco de ~2,5 u, de partida
    6–9 toriis): el ritmo se ve, la luz entra a franjas y **los animales
    pueden cruzar por los huecos**.
  - Reparto de partida: **1 abierta** (la entrada: anuncia la subida y deja
    ver fauna), **2 densa**, **3 abierta**, **4 densa** (la última y la más
    larga, que termina de golpe en la plaza: el contraste con la explanada es
    la revelación). Cada galería declara su tipo; no se infiere.
  - Dentro de una galería el paso de un tipo a otro no es brusco: los
    primeros y últimos toriis de una densa se separan en 3–4 pasos hasta el
    ritmo abierto, para que no se lea como un corte.
- Las galerías se colocan solas a partir de las paradas (como los kōsatsu): si
  cambia el largo del tramo o el número de ema, se mueven con ellas (el
  número de toriis de una galería sale de su largo y su tipo).
- Cada torii sigue el rumbo del camino en su d.
- Para la fauna, cada pilar es un obstáculo (como cada caña); la cámara y las
  piedras ven la galería entera como franja.
- Musgo y sombra de contacto al pie de los pilares; piedras de río en
  algunos (`environment.pebbles`).

### 4.4 Las paradas en la subida, no en el llano

Hoy `cardStopD` y `tramoFraction` reparten las paradas a lo largo de **todo**
el tramo. Con el `flat` de Eventos, la primera ema caería en el llano de los
cerezos. Las dos funciones pasan a repartirlas **sobre lo que queda después del
`flat`**. El tramo de Ubicación (sin `flat`) no cambia; `check:path` lo
comprueba.

### 4.5 A los lados

- **Bambú denso** a los dos lados, fuera de las galerías: macizos `bambu` como
  los de la Home, más cerrados. El fondo, en bosquetes con claros
  (`backdropBamboo`), para no cerrarle el paso a la fauna.
- **Juncos lejanos**, piedras de río en las bases y tierra oscura al pie de lo
  de madera, como en cada estación (acabado orgánico).
- **La luz de la subida**: el cielo y la niebla se calientan hacia Fushimi
  (`skyTint`).
- **El bambú sobre las galerías (*komorebi*, 木漏れ日)**. En las densas, el
  tercio de arriba lo ocupan los dinteles y no se ve fauna; lo que cuenta la
  escena es el bambú que se asoma por encima. Tres capas, de más barata a
  más cara:
  1. **Dosel**: macizos de `bambu` a los lados de las galerías **más altos que
     los toriis** (hasta ~12 u) y *inclinados hacia el eje*, con las hojas
     colgando sobre los dinteles. Se ven por encima del último dintel y por
     los huecos de las abiertas. Es la misma decoración de siempre, sólo que
     colocada para cubrir; las hojas se mecen con `WIND`.
  2. **Sombra proyectada**: el sol ya proyecta sombra (la caja de sombras
     sigue al encuadre): con el dosel como emisor, las hojas dejan manchas
     sobre el suelo y los pilares, y los propios toriis dejan franjas de luz
     entre dinteles. Es la parte gratuita: sólo hay que **colocar el dosel
     del lado del que viene el sol**.
  3. **Moteado y haces** (sólo tier alto): un moteado de luz —manchas de hoja
     que se desplazan despacio con el viento— en el shader del suelo y de los
     pilares **dentro de los tramos de galería** (un peso por d, con
     fundido en los extremos), y unos pocos **haces de luz** —planos
     aditivos, muy tenues, entre los pilares de las densas y el bambú de los
     rellanos—.
  Si la capa 3 no aporta en la revisión, se quita; las capas 1 y 2 se quedan.

## 5. Las ema (絵馬)

### 5.1 El objeto

En `scene/objects/ema/` (medidas puras, geometría, componente):

- **El ema-kake**: el bastidor donde se cuelgan, dos postes con travesaños y
  un tejadillo, de madera oscura.
- **Muchas ema pequeñas** instanciadas, con la cara de **zorro** que se dibuja
  en Fushimi (triangulares, blancas, con los ojos y la boca en rojo y negro,
  pintados en el shader). Se mecen un poco con el viento, cada una con su fase.
- **Una ema grande** delante, pentagonal, de madera clara, colgada con su
  cordón rojo: es **la zona de escritura**. Tan grande como haga falta para
  leer (como el kōsatsu, más que una real).
- Como todo lo plantado: cierra el paso a la fauna (los postes), musgo al pie,
  sombra de contacto, huellas de cámara y piedras.

### 5.2 Declaradas en la tarjeta

`TramoCard.sign` deja de ser sólo el kōsatsu: gana el tablero.

```ts
readonly sign?: { readonly board?: 'kosatsu' | 'ema'; readonly map?: OldMap };
```

Sin `board`, `kosatsu` (Ubicación no cambia). El tramo de Eventos queda:

```ts
const TRAMO_EVENTOS: StationTramo = {
  flat: 50,
  cards: [
    { id: 'inari', side: 'izquierda', kind: 'texto', sign: { board: 'ema' } },
    { id: 'kitsune', side: 'derecha', kind: 'texto', sign: { board: 'ema' } },
    { id: 'toriis', side: 'izquierda', kind: 'texto', sign: { board: 'ema' } },
  ],
};
```

(Los lados, a calibrar como en la 5B.) La ema se planta delante de la cámara de
su parada, en su rellano y su lado, **paralela al plano de la imagen** de esa
cámara (la trampa del trapecio).

### 5.3 El texto sobre la madera

**Todo el mecanismo de los kōsatsu se reutiliza, generalizado a tableros**: el
rectángulo proyectado en `KOSATSU.rects` (con la decisión tomada con la cámara
de la parada), `useKosatsuFit`, la colocación desde el `useFrame` que proyecta,
la tarjeta de lectura al tocar (`KosatsuReader`) y la vuelta a la tarjeta de
papel en vertical o si el cuerpo bajaría de 14 px. Si el nombre `kosatsu` se
queda corto para algo que ya no es sólo kōsatsu, se renombra en el plan.

## 6. La explanada

### 6.1 Las losas

- Las piedras del camino **se ensanchan en losas grandes y planas** al
  terminar la última galería: un campo de ishidatami en |u| ≲ 6, denso cerca
  del eje y más suelto hacia los bordes, con huecos por los que se ve el
  suelo. El suelo mantiene su mezcla con el fondo (`GROUND_TINT`).
- Mismo origen procedural que las piedras (`stoneGeometry`, más planas y más
  grandes), instanciadas, en `stoneTopY` para lo que pisa.
- En la explanada el camino es llano (lo es en cada estación).

### 6.2 El rōmon (楼門)

En `scene/objects/romon/` (medidas puras, geometría, componente), procedural:

- **Base de piedra** (*kidan*) con una escalinata de pocos peldaños delante.
- **Dos pisos**: abajo, pilares bermellón con el paso central y paños
  blancos; arriba, el balcón con su barandilla. Ménsulas (*tokyō*)
  simplificadas en bloques.
- **Dos tejados** de corteza oscura con los aleros curvados (la *sori* del
  torii) y el de arriba a cuatro aguas con hastial (*irimoya*).
- **Dos chōchin grandes** colgando bajo el alero, como en `6.png`: papel
  cálido, con material emisivo (sin luces reales). **Apagados** —papel con un
  brillo mínimo— hasta que se toca la puerta (§7).
- Composición de la estación como `6.png`: a la **izquierda**, en tres
  cuartos (girado hacia el camino), ocupando la mitad izquierda del cuadro y
  con aire arriba. Medidas de partida ~10 u de ancho y ~9–10 u de alto, más
  lejos que el torii de la Home para caber; a calibrar con capturas.
- Cierra el paso a la fauna (pilares y base), musgo y sombra de contacto al
  pie, en las huellas de cámara y piedras.

### 6.3 Los zorros de piedra

- **Dos estatuas** a los lados de la escalinata del rōmon, una frente a la
  otra (o las dos hacia el camino, según lea mejor en la captura).
- El cuerpo es el **mismo modelo** del kitsune vivo, con un **material de
  piedra** (granito gris, con musgo en lo hondo) y sin animar. **Sentadas**,
  como las de verdad, si la postura sentada de la deformación de la fauna
  (`postures.sit*`, la del gato) da una figura convincente con el zorro; si
  no, **de pie** (también las hay así).
- Sobre un **pedestal** de piedra procedural.
- El **yodarekake**: un babero rojo, tela generada alrededor del cuello.
- En la boca, una **llave** (la del granero de arroz) en una y una **joya**
  (*tama*) en la otra: piezas pequeñas procedurales.
- Sombra de contacto y musgo en el pedestal; obstáculo para la fauna.

### 6.4 Los nobori: donde va la greca

Unos **nobori** (幟) —estandartes altos y estrechos en su mástil, típicos de
los santuarios de Inari— flanquean la plaza, en un lado o los dos, sin tapar
el rōmon ni el título:

- Tela roja con el borde blanco y **la greca de `6.png` impresa a lo largo
  del borde**, dibujada en el shader (patrón repetido, sin textura).
- Se mecen con el viento de siempre (`WIND`), como tela: la flexión crece
  hacia el borde libre y cada uno lleva su fase; su sombra, con el mismo
  viento (`customDepthMaterial`).
- Objeto nuevo de `decor`, `kind: 'nobori'`, reutilizable en 6B y 6C.
- **Faroles kasuga y yukimi** completan la plaza (los de siempre, a veces
  juntos, según la regla de los faroles).

## 7. Tocar el rōmon

### 7.1 Qué pasa

1. **La cámara se vuelve un poco** hacia la puerta (§7.2).
2. **Los faroles se encienden**: los chōchin del rōmon y los de la plaza
   pasan de apagados a una luz cálida, en ~1 s, y siguen encendidos mientras
   la tarjeta esté abierta. Al cerrarla, se apagan despacio.
3. **Se abre la tarjeta del templo**: la tarjeta de lectura (el mismo
   `<dialog>` de los kōsatsu) con los datos del lugar (§9.2) y la greca como
   adorno.
4. Al cerrarla (Escape, botón o fuera), la cámara vuelve sola.

### 7.2 El paneo

- Un desvío **acotado** del encuadre: como mucho **~6° de giro** y un
  desplazamiento lateral pequeño del punto de interés hacia la puerta; entra
  en ~1,6 s y sale en ~1,2 s, con las curvas de `presets.ts`, y respeta
  `RIG_LIMITS` (incluido `maxYawRate`).
- Lo escribe un objeto de módulo con un único escritor (como `PARALLAX`); lo
  suma `CameraRig`, que sigue siendo el único escritor de `PATH`.
- **Sólo con la cámara asentada en la estación**: si se viaja o se camina, no
  hay paneo (la tarjeta sí se abre).
- **Con 静 o movimiento reducido no hay paneo**: tarjeta y faroles, nada más
  (con `invalidate()` en `frameloop="demand"`).

### 7.3 Cómo se toca

- El canvas no captura el puntero: sobre la puerta proyectada va una **zona
  DOM** que se puede tocar (como la tabla de los kōsatsu), con el cursor de
  mano y `aria-label`.
- Para teclado, lectores de pantalla y sin WebGL, el cartel lleva un **botón
  real** («Contemplar el rōmon» / «Behold the Rōmon») que hace lo mismo.

## 8. El kitsune vivo

- **El modelo**: `fox_realistic.glb` (locvin, Sketchfab Standard; 12,8 MB) al
  pipeline de `bun run models`. Antes de decidir cómo se anima: **listar sus
  canales** (la trampa de la libélula) y medir su pose de reposo. Lo esperado
  es `rig: 'modelo'` con la deformación por regiones, como el gato (al trote).
  Normales suaves, sin aletas, posiciones sin cuantizar. El optimizado, en
  `public/models/`, con su crédito en `assets/models/LICENSES.md`.
- **La conducta, `senda`**: el zorro **entra desde un costado por un
  rellano**, fuera de cuadro, sale al camino, **sube unas gradas por delante
  de la cámara**, se para un instante a mirar atrás y **se va por el otro
  lado** en el siguiente claro, o **subiendo por el eje de una galería**
  (en las densas es la única forma: el eje está libre) hasta perderse en la
  niebla.
  Empieza y termina fuera de cuadro (o tras la niebla), como toda conducta.
  Una sola conducta (cada conducta suma el peso de la especie).
- **Dónde**: en la zona de Fushimi (su `ambient.fauna` gana `kitsune`), es
  decir, en la segunda mitad de la subida y en la explanada, donde también
  puede cruzar la plaza. El peso, para que salga en una subida normal sin ser
  constante.
- Entra en `bestiary.ts` (hoy `kitsune: null`), y `?fauna=kitsune` lo fuerza en
  desarrollo.

## 9. Los textos

En `messages/{es,en}.json`. Las ema, bajo `tramos.eventos.<id>`; la estación,
bajo `lugares.fushimi-inari` (o donde lo pida la plantilla, §10). Cada ema
≤ ~60 palabras.

### 9.1 Las ema

**1 · `inari` — el origen**

- *ES* — **El arroz que se hizo pájaro.** Cuenta la crónica de Yamashiro que
  **Hata no Irogu**, rico en arroz, usó un pastel de mochi como diana. Al herirlo,
  el pastel se volvió un ave blanca que voló a este monte, y donde se posó
  brotó el arroz: *ine-nari*, «el arroz crece». En 711 su clan levantó aquí el
  santuario de Inari.
- *EN* — **The rice that became a bird.** The Yamashiro chronicle tells how
  Hata no Irogu, rich in rice, used a mochi cake as a target. When struck, the
  cake turned into a white bird that flew to this mountain, and where it landed
  rice sprang up: *ine-nari*, "the rice grows". In 711 his clan raised the
  Inari shrine here.

**2 · `kitsune` — los mensajeros**

- *ES* — **Los mensajeros.** Los zorros no son Inari: son sus mensajeros. Por
  eso los guardianes de piedra llevan algo en la boca —la llave del granero de
  arroz, una joya, una espiga— y un babero rojo que les ponen los fieles. Las
  ema de aquí tienen forma de zorro: cada visitante le dibuja la cara y escribe
  detrás su deseo.
- *EN* — **The messengers.** The foxes are not Inari: they are Inari's
  messengers. That is why the stone guardians hold something in their mouths
  —the key to the rice granary, a jewel, an ear of rice— and wear a red bib
  placed by the faithful. The ema here are fox-shaped: each visitor draws its
  face and writes a wish on the back.

**3 · `toriis` — por qué tantos**

- *ES* — **Senbon torii, uno por promesa.** Desde la época Edo, quien ve
  cumplido un deseo —o quiere pedirlo— dona un torii. Su nombre y la fecha van
  escritos en el pilar, por detrás, y por eso sólo se leen al bajar. Los
  llaman «los mil toriis», pero son unos diez mil hasta la cima, a 233 metros.
  El bermellón ahuyenta el mal y protege la madera.
- *EN* — **Senbon torii, one per promise.** Since the Edo period, anyone whose
  wish comes true —or who hopes it will— donates a torii. Their name and the
  date are written on the back of a pillar, so they can only be read on the
  way down. They are called "the thousand torii", but some ten thousand line
  the trail to the summit at 233 metres. The vermilion wards off evil and
  protects the wood.

### 9.2 La estación y la tarjeta del templo

- **El cartel**: *Fushimi Inari Taisha* (One Jinja) y 伏見稲荷大社 dibujado
  con `<InkKanji>`, una línea de tagline y un resumen breve (lo que hoy es
  `stations.fushimi-inari.tagline/summary`, revisado), y el botón del rōmon.
- **La tarjeta del templo** (楼門 · el rōmon), un párrafo corto y la ficha:

| Dato | ES | EN |
|---|---|---|
| Fundación | 711, por el clan Hata | 711, by the Hata clan |
| Deidad | Inari Ōkami: el arroz, la cosecha, la prosperidad y el comercio | Inari Ōkami: rice, harvest, prosperity and commerce |
| Toriis | Unos 10 000 | Some 10,000 |
| Santuarios | Cabecera de unos 30 000 santuarios de Inari en Japón | Head shrine of some 30,000 Inari shrines in Japan |
| El rōmon | Donado por Toyotomi Hideyoshi en 1589 | Donated by Toyotomi Hideyoshi in 1589 |
| El monte | Inari-san, 233 m | Mount Inari, 233 m |

- *ES* (párrafo) — **El rōmon.** La puerta de dos pisos que guarda la entrada
  la mandó levantar Toyotomi Hideyoshi en 1589, como ofrenda por la curación de
  su madre. Detrás empieza el santuario que encabeza a todos los de Inari del
  país.
- *EN* — **The Rōmon.** The two-storey gate that guards the entrance was
  raised by Toyotomi Hideyoshi in 1589, as an offering for his mother's
  recovery. Behind it begins the shrine that heads every Inari shrine in the
  country.

Los textos se revisan en la revisión; las cifras redondas («unos») a
propósito.

## 10. La plantilla de los lugares

- `lugares/[slug]/page.tsx` pasa de `StationShell` a un **cartel de lugar**
  (`components/lugares/PlaceCartel.tsx`) con la estructura de `6.png`: el
  edificio en la escena a un lado y, al otro, `CartelTitle` (romaji +
  `<InkKanji>`), tagline, resumen, el botón del monumento y la tarjeta de
  lectura con su ficha. Los mismos pasos que el cartel de Ubicación
  (`ContentArrival`, `PathTramo`, halo de papel). En vertical, título arriba y
  el resto debajo.
- **Qué monumento y qué ficha** se declara en `journey.ts` (por ejemplo,
  `station.place = { landmark: 'romon', side: 'izquierda' }`), y los textos en
  `messages`: añadir 6B y 6C es rellenar su entrada.
- **Kiyomizu-dera y Gion siguen con el andamio** (`StationShell`) hasta sus
  bloques: la página elige la plantilla sólo si la estación declara `place`.
- **La greca, en el DOM sólo en las tarjetas de lectura** (la del templo y la
  de las ema), como adorno de esquina **generado por código** (un trazo
  calculado en TS, no un SVG dibujado), en el acento de la estación.
- La tarjeta del templo existe **siempre en el DOM** (el `<dialog>` cerrado
  está en el HTML del export): la leen buscadores y lectores de pantalla.

## 11. Vertical, 静 y movimiento reducido

- **En vertical**: rōmon, estatuas y nobori en su colocación `portrait`,
  enteros en el cuadro; las ema vuelven a la tarjeta de papel (la regla de los
  kōsatsu); el título del cartel arriba.
- **Con 静 o movimiento reducido**: el tramo es la lista de lectura de
  siempre (con las tres ema), sin paneo, y los faroles se encienden igual.
- **Sin WebGL**: el cartel, el botón y la tarjeta funcionan; las ema, como
  tarjetas de papel.

## 12. Calidad y rendimiento

- Presupuesto de partida: **~+15 draw calls** en la subida (toriis y ema
  pequeñas instanciados por material, ema-kake, bambú) y en la plaza (rōmon,
  estatuas, nobori, losas). Lo nuevo se instancia desde el principio (la 5B
  se pasó del presupuesto por no hacerlo con los kōsatsu).
- Los toriis de las densas son la mayor parte del recuento (~50 de ~80), pero
  van instanciados: el coste es de vértices, no de draw calls. Las sombras de
  contacto, el musgo y las piedras de río al pie de cada pilar se limitan en
  las densas a **uno de cada dos** pilares (apenas se ven entre ellos).
- Tier bajo: las densas pasan a ~1,4 u entre toriis (la mitad de toriis), menos
  ema pequeñas y sin moteado ni haces de luz (quedan el dosel y la sombra del
  sol); el rōmon, las estatuas y las ema grandes no cambian.
- El zorro optimizado, ≤ ~1 MB.
- La decoración se monta con `StationDecor` (la estación y sus vecinas): lo
  pesado, en diferido, fuera del primer JS de la página.
- Los materiales por instancia o por acto se liberan al desmontar.

## 13. Verificación

**`check:path`** añade:

- Las **gradas**: monótonas en la subida, contrahuella constante, el pasillo
  escalonado y fuera de él liso; nada fuera de la subida cambia.
- **La cámara sube lisa**: su altura sigue `pathY` sin escalones.
- **Las piedras** caen sobre las huellas, nunca sobre un canto.
- **Los toriis**: el *nuki* ≥ 1,5 u sobre la cámara y los pilares ≥ 1,5 u de
  ella en toda la subida, **caminando y en los viajes** (ida y vuelta).
- **Las galerías por tipo**: la separación de las densas y de las abiertas cae
  en su rango (con el hueco entre pilares mínimo de ~0,25 u, para que no se
  fundan en una pared de geometría que parpadee); las densas se separan en los
  extremos sin saltos de más de un paso; ninguna galería pisa un rellano ni
  una parada de ema.
- **El dosel**: los macizos de bambú de las galerías son más altos que el
  dintel, nunca a menos de 1,5 u de la cámara ni sobre las piedras.
- **Las paradas en la subida**: con `flat`, ninguna parada cae en el llano;
  sin `flat` (Ubicación), las paradas no cambian.
- **Las ema**: delante de su parada, en un rellano, sin galería ni bambú entre
  la cámara y la tabla; el cuerpo de letra con la regla de los kōsatsu.
- **El rōmon y los zorros**: en la vista de la estación, en la mitad
  izquierda, enteros, sin tapar la zona del título.
- **El paneo**: dentro de sus topes y de `RIG_LIMITS`; vuelve a cero.
- **El kitsune**: `senda` empieza y termina fuera de cuadro con los cuatro
  aspectos; la fauna sigue saliendo en la subida y en la plaza. Con dos
  galerías densas, el mínimo del reparto se mide **sobre toda la subida**
  (de partida ≥ 20 % de los sorteos, contra el 31 % de la Home); dentro de
  una densa, que no salga fauna que cruce no es un fallo (sí lo es que
  atraviese un pilar).
- Los textos existen en los dos idiomas y caben.

**Shaders:** el torii inari (si tiene uno propio), las ema de zorro, el
material de piedra de las estatuas, los nobori y los haces de luz se compilan
en un WebGL2 real antes de darlos por buenos.

**En el navegador** (por CDP): la entrada a la primera galería, una ema en su
parada (horizontal y vertical), la llegada a la plaza, el cartel de Fushimi,
el rōmon tocado (paneo + faroles + tarjeta), el kitsune con `?fauna=kitsune`, y
la lista con 静.

**Documentación:** PLAN (6A en revisión al terminar; los objetos nuevos) y
`CLAUDE.md` (arquitectura, trampas nuevas, estado de las fases).

## 14. Mapa de archivos

Nuevos:

- `src/scene/objects/torii/inari.ts` — medidas del torii inari (puro).
- `src/scene/systems/ToriiGallery.tsx` (y su colocación pura en
  `scene/decor/`) — las galerías instanciadas, con su tipo (`densa` /
  `abierta`) y el peso de «dentro de una galería» por d, que lee el moteado.
- `src/scene/objects/ema/` — el ema-kake, las ema de zorro y la ema grande.
- `src/scene/objects/romon/` — el rōmon: medidas (puro), geometría,
  componente, los chōchin.
- `src/scene/objects/kitsune/` — la estatua: pedestal, material de piedra,
  babero, llave y joya.
- `src/scene/objects/nobori/` — el estandarte y su tela en el shader.
- `src/components/lugares/PlaceCartel.tsx` — la plantilla de los lugares.
- `src/components/lugares/LandmarkInput.tsx` — la zona que se toca sobre el
  monumento.
- El objeto de módulo del paneo (junto a `CameraRig`) y el estado de los
  faroles (lo enciende la tarjeta, lo lee la escena).
- `public/models/kitsune.glb` — generado, versionado.

Cambian:

- `src/config/journey.ts` — `TramoCard.sign.board`, `tramo.stairs`,
  `Station.place`, `DecorNobori`, `DecorRomon`, `DecorKitsune` (estatuas), el
  tramo y la decoración de Eventos (subida) y de Fushimi (plaza); `kitsune` en
  la fauna de Fushimi.
- `src/scene/systems/elevation.ts` — las gradas.
- `src/scene/path/stones.ts`, `stoneSurface.ts` — piedras en las huellas,
  losas de la plaza.
- `src/animation/journeyScroll.ts` — `cardStopD` y `tramoFraction` con `flat`.
- `src/scene/objects/torii/` — la variante `inari`.
- `src/scene/objects/kosatsu/`, `useKosatsuFit`, `KosatsuReader`,
  `PathTramo.tsx` — generalizados a tableros; la greca en la tarjeta.
- `src/scene/camera/CameraRig.tsx`, `pathRig.ts` — el paneo acotado.
- `src/scene/systems/fauna/bestiary.ts`, `behaviors.ts` — el kitsune y `senda`.
- `src/scene/decor/placement.ts`, `footprints.ts`, `moss.ts`, `contact.ts`,
  `pebbles.ts`, `StationDecor.tsx` — los objetos nuevos.
- `src/scene/shaders/windSway.ts` — la tela de los nobori.
- `src/app/[locale]/lugares/[slug]/page.tsx` — la plantilla.
- `src/messages/{es,en}.json`, `src/styles/globals.css`.
- `scripts/optimize-models.ts` (el zorro), `scripts/check-decor.ts`,
  `scripts/check-path.ts`.
- `assets/models/LICENSES.md`, `docs/PLAN.md`, `CLAUDE.md`.

## 15. Orden de construcción

Para el plan; cada bloque se puede revisar por separado:

1. Los datos: `sign.board`, `tramo.stairs`, `Station.place`, paradas con
   `flat`, los textos, y sus comprobaciones.
2. Las gradas en el terreno y las piedras en las huellas.
3. El torii inari y las galerías.
4. Las ema (el tablero nuevo sobre el mecanismo de los kōsatsu).
5. La plaza: losas, faroles, nobori con la greca.
6. El rōmon y los zorros de piedra.
7. La plantilla del lugar: cartel, botón, tarjeta del templo, la zona que se
   toca, el paneo y los faroles que se encienden.
8. El kitsune vivo: modelo, deformación y `senda`.
9. La subida a los lados (bambú, juncos, luz) y la calibración con capturas.
10. Documentación.

## 16. Fuera de alcance (6A)

- La estación de Eventos y el bosque de cerezos del llano (Fase 7).
- El tramo de Fushimi a Kiyomizu-dera (6B): el giro, el bosque cerrado, el
  puente y el arroyo.
- Los nombres de los donantes escritos en los toriis, la noche, sonidos
  nuevos (campana, *suzu*).
- Kanji en los nobori.

## 17. Riesgos y a calibrar en la revisión

| Tema | Qué vigilar |
|---|---|
| La cámara en la cuesta | La inclinación está acotada a 3,5°–8,7° hacia abajo: mirando cuesta arriba, las gradas pueden llenar la mitad de arriba del cuadro. Si pasa, subir la cámara en la subida antes que inclinarla |
| La galería y el tercio superior | Dentro de una galería los dinteles ocupan el tercio de arriba, que es la excepción buscada (`5.png`); en los rellanos, el tercio superior vuelve a quedar libre |
| El tamaño de los toriis | Con ~7 u de luz y ~7 de alto son monumentales: que la galería no parezca de gigantes. Se compensa con el ritmo apretado y el bambú alto |
| Fauna y galerías | Las densas la apartan por diseño; que la fauna siga encontrando líneas en los rellanos y las abiertas. Si el reparto cae por debajo del mínimo, se acorta una densa antes que abrir sus huecos |
| Las densas | A ~1,0 u los pilares de un torii vecino se solapan casi del todo en perspectiva: vigilar el z-fighting entre dinteles, el moiré de las franjas de sombra y el recuento de vértices. Si se ven como una pared plana, subir la separación a ~1,2 u |
| El bambú de arriba | Que el dosel se lea como bambú y no como una mancha verde sobre los dinteles; que no tape el cielo del tercio superior en los rellanos (donde debe quedar libre) |
| El zorro | 12,8 MB y sin conocer su esqueleto: puede necesitar `headTurn` o retoques como el gato. Si la postura sentada no convence, estatuas de pie |
| El paneo | Aunque esté acotado, es el primer movimiento de cámara que no pide el scroll: medirlo en la revisión y bajarlo si se nota |
| El rōmon en el cuadro | Que quepa en la mitad izquierda con aire arriba sin quedar pequeño: alejarlo antes que achicarlo |
| El moteado y los haces de luz (capa 3) | Lo más prescindible: fuera si no aportan; el dosel y la sombra del sol son la base |
| 伏見稲荷大社 | Seis kanji con `<InkKanji>`: que el título no se haga largo de dibujar ni de ancho |

## 18. Correcciones al planificar e implementar

Del plan (`docs/superpowers/plans/2026-10-22-fase-6a-fushimi-inari.md`) y de
la calibración con capturas:

| Spec | Corrección | Por qué |
|---|---|---|
| §4.1 «las gradas son del terreno» | Malla aparte (`systems/Stairs.tsx`) sobre el terreno liso; `groundY` las incluye, la cámara sigue `terrainY` y la fauna `walkY` (cada contrahuella con una rampa de 0,3 u) | La rejilla del terreno es de 2 u: un escalón de 0,35 se dibujaba como una rampa |
| §4.1 rellanos «huellas más largas» | Mesetas en `pathY` en cada parada con cartel (de 6 u antes a 2 u después, bordes de 2,5 u); las paradas, en un módulo aparte (`path/tramoStops.ts`) | Una meseta del camino es un rellano de verdad. La subida llega a 11,3° |
| §4.2 *nuki* a ~6,8 u | Alzada por torii: los pilares se estiran en el shader lo justo para que el nuki quede 1,5 u sobre la cámara, con una envolvente de pendiente ≤ 0,12 u/u | Cuesta arriba el tope de inclinación sube la cámara hasta ~8 u sobre la ladera. En lo empinado los toriis miden hasta ~3,5 u más |
| §4.2 luz «~7 u» | Pilares a |u| = 4 (luz de 8 u), diámetro 0,64 | Caminando, la cámara se aparta del eje hasta ~1 u en las curvas |
| §4.3 «la cámara y las piedras ven la galería entera como franja» | Una franja por hilera de pilares | La cámara pasa por dentro |
| §4.3 zona libre de cada parada | `[parada − 16, parada + 3]` | Los pilares entre ~9 y 20 u delante de la cámara de la parada tapan la ema; y la cámara llega desde atrás |
| — (nuevo) | En un viaje rápido, lo que queda a < 1,8 u de la cámara se disuelve en un tramado (`uNearFade`, de 30 a 60 u/s) | En los viajes el encuadre recorta las curvas (topes anti-mareo) y puede pasar a ~5 u del eje: rozaría pilares un fotograma |
| §4.5 haces de luz | **No se hicieron**: el dosel inclinado, la sombra de sus hojas (tier alto) y el moteado (tiers alto y medio) dan la luz. Si en la revisión falta, se añaden | Eran lo más prescindible (§17) |
| §4.5 moteado sólo en tier alto | También en tier medio, y sólo bajo el dosel (|u| < 9–13 del eje) | Es una cuenta en el fragmento; sin él, el tier medio (sin sombras) no tendría luz en las densas |
| §5.3 «si el nombre `kosatsu` se queda corto, se renombra» | Se queda: `KOSATSU` es el puente de todos los tableros del tramo; la proyección, común en `useBoardProjection` | Renombrar tocaba la 5B entera sin ganar nada |
| §6.3 estatuas | Sentadas, con la postura de la deformación del gato calibrada para el zorro, en granito con musgo al pie | La postura sentada sale bien con el modelo |
| §6.4 nobori en la plaza | Dos, en los bordes del cuadro (no tapan ni el rōmon ni la columna del título); faroles abajo a la izquierda | Calibrado con capturas |
| §8 conducta `senda` | Sube por el eje de la galería cuando no puede salir de lado | En las densas el eje está libre |
| Fushimi `fog` | 22 / 110 (antes 12 / 95) | El rōmon, a ~40 u de la cámara, no se leía en el cartel |
