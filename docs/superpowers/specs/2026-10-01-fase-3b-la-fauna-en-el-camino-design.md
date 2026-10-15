# Fase 3B — La fauna en el camino: diseño

> Bloque 3B de la Fase 3 («El Camino»). 3A dejó un mundo continuo por el que
> la cámara avanza con el scroll, pero la fauna siguió viajando con el encuadre
> de la cámara: al hacer scroll, los animales de suelo patinan. Este documento
> cubre **sólo 3B**; 3C (la navegación) se diseña cuando se vaya a implementar.

## 1. Qué se busca

Que la fauna viva **en el mundo**, como las piedras: al avanzar por el camino uno
se acerca a los animales, los ve crecer y en algún momento **los deja atrás**.
La cámara nunca entra en la escena: pasa por encima de lo que anda, y lo que
vuela se le adelanta.

**Criterio de éxito (revisión visual del usuario):**

- Caminando por un tramo, un animal que está por delante se ve cada vez más
  grande y queda atrás, sin patinar.
- **Ningún animal desaparece estando a la vista.** Sale de cuadro —por abajo,
  por arriba o por un costado— y sólo entonces se retira. Lo que más le importa
  al usuario es que no haya un «estaba ahí y de golpe ya no».
- Nada visible queda nunca a menos de una distancia mínima de la cámara.

## 2. Decisiones ya tomadas

| Tema | Decisión | Origen |
|---|---|---|
| Qué es «acercarse» | **Anclada + cercanía**: los actos quedan anclados en su sitio del mundo; los de suelo salen por el borde inferior; lo que vuela, al llegar a una distancia mínima, avanza con la cámara; cada estación declara cuán cerca nacen sus actos | Usuario (Fase 3) |
| Cómo se ancla | **Enfoque A: un ancla por acto.** Las conductas no se reescriben: siguen en coordenadas locales, relativas a una copia del encuadre de la cámara | Usuario |
| Fauna al caminar | **Nace por delante**, con una ventaja según la velocidad; dejar atrás un acto adelanta el siguiente; caminando rápido no nace nada | Usuario |
| Distancia a la que se deja atrás | La que sale del encuadre: **~10–12,6 u** para lo que anda en llano | Usuario («una buena distancia») |
| Desaparecer | **Nunca a la vista.** Se retira sólo fuera de cuadro | Usuario — requisito duro |
| Qué vuela «a media altura» | **Todo lo que sólo vuela** (mariposas, libélulas, bandadas, milano) y los gorriones que bajan a posarse mientras están en el aire: su ancla **se desliza** (§3.3) | Hallazgo al planificar (§3.1), pendiente de visto bueno del usuario |

## 3. Anclaje

### 3.1 Dónde sale de cuadro cada cosa

Medido con el encuadre real (`framing.ts`, suelo llano, inclinación ~6°):

| Qué | Sale de cuadro a… |
|---|---|
| Algo a ras de suelo | 12,6 u de la cámara, por abajo |
| Un animal de 0,35 / 0,6 / 1 u de alto | 11,8 / 11,2 / 10,2 u, por abajo |
| Un ave en el centro de la franja alta, nacida a 19–26 u | 10,4–14,1 u, por arriba |
| **El gorrión más bajo de una bandada**, nacida a 18–27 u | **0–4,8 u**: vuela a la altura de la cámara |
| **El milano en lo más bajo de su térmica**, nacido a 39 u | **5,2 u** |

Lo que **anda** sale de cuadro antes de estar a ~10 u: anclarlo no mete la
cámara en la escena. Lo que **vuela** no: la franja alta, vista de cerca, baja
hasta la altura de la cámara, y una bandada anclada acabaría cruzando a 1–5 u
del objetivo. Por eso lo que vuela no se ancla sin más: **se desliza** (§3.3).

En bajadas (inclinación hasta 8,7°) el borde inferior está más cerca: lo más
bajo (las luciérnagas a ~1,5 u del suelo) puede seguir a la vista hasta ~7,5 u.
El mínimo que exige `check:path` es por eso **7 u** (§7).

### 3.2 Un ancla por acto

- Al nacer, el acto guarda **`origin`**: una copia de `PATH.frame` (el encuadre
  local de la cámara en ese instante). Sus conductas siguen escritas en
  coordenadas locales —la cámara en `(0, 4.2, 13)`—, relativas a su ancla: las
  franjas de la regla de tercios y los márgenes se calculan **con la cámara real
  del momento en que nace**.
- **`anchor`** es donde está el acto ahora: igual a `origin` salvo que se haya
  deslizado (§3.3). Es el único campo mutable de un acto y tiene **un solo
  escritor**, el seguimiento de `anchoring.ts`.
- El acto se dibuja en un grupo propio con la transformación de su `anchor`.
  **Desaparece el grupo común que hoy sigue a la cámara.**
- `groundAt(act, x, z)` lee el suelo desde el `anchor` del acto (local → mundo →
  `groundY`), no desde `PATH.frame`. Todo lo que pisa sigue pisando el terreno
  real, también en las cuestas y también después de deslizarse.
- `FaunaAct` gana `origin`, `anchor`, `spawnD` (la profundidad de la cámara al
  nacer) y `aspect` (el de los márgenes, §4.4).
- Si se retrocede, lo anclado se aleja. Es el mismo mundo.

### 3.3 El ancla que se desliza

Lo que vuela se deja alcanzar hasta una distancia mínima y **a partir de ahí
avanza con la cámara**: su ancla se desliza por el camino, hacia el fondo.

| Conducta | Se desliza | Mínimo (u, al punto base) |
|---|---|---|
| `revolotear` (mariposa, libélula) | siempre | 8 |
| `bandada` (gorriones) | siempre | 10 |
| `cruzarVolando` (hoy sin especie) | siempre | 10 |
| `planearEnCirculos` (milano) | siempre | 22 |
| `visitaAlSuelo` (gorriones que se posan) | **sólo en el aire**: al llegar (t < 0,3) y al irse (t > 0,84), y sólo si aún está por delante | 12 |
| `vadear`, `correrYParar`, `perseguir`, `deambular`, `callejear`, `titilar` | nunca | — |

- Cómo se desliza, cada frame (`slideStep`):
  - **seguir**: si la cámara avanza `a` u, el ancla avanza `a · w`, con
    `w = smoothstep(mínimo + 3, mínimo, distancia)`. Lejos no se mueve; al
    llegar a su mínimo avanza lo mismo que la cámara. La velocidad no da saltos
    y, con la cámara quieta, no se mueve.
  - **apartarse**: si arranca a volar ya más cerca que su mínimo (unos
    gorriones que alzan el vuelo), se aleja suave hasta él (λ = 3/s).
  - nunca retrocede: si la cámara vuelve atrás, se queda donde llegó y se aleja.
- El ancla se desliza en la dirección de la mirada de su `origin` y sube o baja
  lo que sube o baja el camino. `groundAt` lee el terreno bajo el ancla
  deslizada: unos gorriones que se posan después de deslizarse pisan el suelo
  real.
- Los gorriones que se posan, mientras están en el suelo, son anclados: se les
  deja atrás como a la ardilla.

### 3.4 `PATH.velocity`

Avance de la cámara con signo, suavizado (la misma amortiguación que
`rig.speed`, λ = 8), en u/s; 0 en un salto seco. Lo escribe **sólo**
`CameraRig`, como el resto de `PATH`.

## 4. Nacimiento

### 4.1 Cuándo

Se mantiene la cadencia de 20–40 s, la recompensa por quedarse quieto, dos
actos a la vez en tier alto, nada durante un viaje, el reparto por zona y el
`?fauna=` de desarrollo. Lo nuevo depende de `PATH.velocity`:

| Situación | Qué hace el director |
|---|---|
| Quieto o leyendo (velocidad absoluta < `SPAWN_STILL`, 1 u/s) | Nace como hoy |
| Caminando hacia delante (1–12 u/s) | Nace **por delante**, con ventaja (§4.2) |
| Caminando rápido (> `SPAWN_MAX_SPEED`, 12 u/s ≈ 40vh/s) | No nace: lo pasaría antes de que entrara en cuadro |
| Retrocediendo (v < −1 u/s) | No nace: el cuadro se ensancha y su entrada quedaría a la vista |
| Se acaba de retirar un acto **dejado atrás** (§5.2) | El siguiente se adelanta: `nextAt = min(nextAt, ahora + 4–8 s)` |
| Acaba de terminar un viaje y la cámara aún frena | No nace hasta que se para (añadido tras la revisión final: la curva `piedra` termina a ~11 u/s y el acto nacía con la ventaja máxima) |

### 4.2 La ventaja al caminar

- `ventaja = min(v · LEAD_TIME, LEAD_MAX)`, con `LEAD_TIME` = 2,5 s y
  `LEAD_MAX` = 18 u. Sólo lo que **no se desliza siempre** (lo que anda y los
  gorriones que se posan) y sólo hacia delante; lo que vuela nace a su
  distancia de siempre, porque se le adelanta a la cámara.
- La ventaja se suma a la distancia de nacimiento: el acto nace más al fondo
  **en el encuadre de la cámara real**, así que sus márgenes y su franja se
  calculan a la profundidad a la que de verdad nace.
- **Tope por niebla**: con ventaja, nada nace más lejos que
  `max(distancia sin ventaja, FOG_CAP · niebla lejana)`, con `FOG_CAP` = 0,5 y la
  niebla lejana mezclada por zona (en Gion, ~27 u).
- Ejemplo: una ardilla que hoy nace a 16,5–22 u, caminando a 6 u/s, nace a
  31,5–37 u y se la ve acercarse unos 4 s antes de dejarla atrás.

### 4.3 Cercanía por estación

Nuevo campo **`ambient.faunaDistance`** en `journey.ts`: multiplica la distancia
de la cámara a la que nace cada acto (1 = la de hoy; 0,8 = un 20 % más cerca).
Se mezcla por los pesos de zona en la profundidad de la cámara
(`blendByZone`), como la niebla y el viento.

| Estación | `faunaDistance` | Por qué |
|---|---|---|
| inicio | 1 | Referencia |
| ubicacion | 1,2 | Mirador, panorama: lejano |
| eventos | 0,9 | Bajo los cerezos: mariposas cerca |
| fushimi-inari | 1 | |
| kiyomizu-dera | 1,1 | Terraza con vista abierta |
| gion | 0,8 | Callejón: íntimo |
| gastronomia | 0,9 | |

**Suelo de distancia**: la cercanía no acerca nada por debajo de su suelo —
**15 u** para lo que no se desliza siempre, **su mínimo + 1** para lo que sí
(mariposa 9, bandada 11, milano 23)—. Si el rango de la propia especie ya era
más cercano (así se revisó en la Fase 2C), se respeta el de la especie:

```
D   = distancia sorteada en el rango de la especie (como hoy)
D'  = max(D · faunaDistance, min(D, suelo))
D'' = D' + ventaja, con el tope por niebla
profundidad local = 13 − D''
```

### 4.4 Márgenes con la cámara real

- `offscreenX(act, z, size)` usa el aspecto guardado en el acto: **el mayor
  entre el real y 16:9**.
  - En pantallas más anchas que 16:9 (21:9), hoy un animal puede asomar ya
    dentro de cuadro; con el aspecto real entra desde fuera. Cruza hasta un
    30 % más rápido, porque recorre más ancho en el mismo tiempo.
  - En móvil y pantallas estrechas **no se reduce**: la velocidad de casi todas
    las conductas sale del ancho y los animales cruzarían a cámara lenta.
- `VIEW.aspect` (lo escribe `CameraRig` desde 3A) es la fuente del aspecto.

## 5. Retirada: nunca a la vista

### 5.1 La regla

Un acto sólo se retira cuando **ninguno de sus individuos está en cuadro**,
comprobado cada frame con la **cámara real** (la de three, con parallax): la
esfera de cada individuo —radio `0,6 · size + 0,3`— no toca el frustum **o está
más allá de la niebla que se dibuja** (`scene.fog.far`, con el factor del tier:
pasado ese punto todo es color de niebla). Una luz apagada (una luciérnaga al
terminar su acto) no cuenta como vista.

*Añadido tras la revisión final:* sin la niebla, lo que quedaba lejos al
retroceder 60–100 u (o con «atrás» a la estación anterior) seguía «en cuadro» —el
frustum llega a 400 u— y acababa en la red de seguridad. Lo que sigue a la
vista dentro de la niebla ocupa su hueco hasta salir de cuadro: retirarlo antes
sería hacerlo desaparecer, aunque tenue.

### 5.2 Los motivos

Además de estar fuera de cuadro, tiene que cumplirse uno de estos. El **punto
base** de un acto es el centro de su escena: `x = 0` a su profundidad, en su
`anchor`; las distancias se miden en horizontal, a lo largo de la mirada de la
cámara.

| Motivo | Cuándo |
|---|---|
| **Terminó su tiempo** | `segundos ≥ duración` |
| **Lo dejaste atrás** | Su punto base está a menos de `PASSED_DISTANCE` (**10 u**) por delante de la cámara —o detrás—, y lleva fuera de cuadro `PASSED_ADVANCE` (**6 u**) de avance. Si en ese margen se retrocede o vuelve a verse, el contador se reinicia. No aplica a lo que se desliza siempre. A los gorriones posados se les retira **en cuanto** salen de cuadro: si no, al alzar el vuelo pasarían junto a la cámara |
| **Quedó muy lejos** | Retrocediendo, su punto base quedó más lejos que `max(su distancia al nacer, FOG_CAP · niebla lejana) + 10 u` |

Las 6 u se miden **en avance de la cámara, no en tiempo**: parado leyendo, un
animal que aún está entrando por un costado no se retira antes de entrar.

### 5.3 Salir de cuadro en vez de desaparecer

1. **Si se acaba el tiempo y aún se le ve** (sobre todo tras retroceder),
   **sigue su camino**: la posición más allá de la duración se extrapola con la
   velocidad media del último 15 % del acto, re-acelerando suave desde su
   parada final (`x(τ) = v · (τ − T₀ · (1 − e^(−τ/T₀)))`, `T₀` = 0,6 s: derivada
   nula al empezar). Conserva su **altura sobre el suelo**: quien camina sigue
   pegado a él (`standingY`) y quien vuela no se mete en una colina que suba por
   el costado. Y **se va animando**: gana velocidad en la misma dirección
   (0,4 u/s² durante 10 s, hasta 4 u/s más, sin tirón), para que también salga
   de un cuadro que, visto de muy lejos, mide decenas de unidades. Lo hace
   `placeAt`, que también usa `poseFor`.
2. **Se elimina el encogimiento final** (el último 3 % de la escala) de todo lo
   que tiene cuerpo. El crecimiento inicial se queda como red de seguridad:
   la entrada ya ocurre fuera de cuadro.
3. **Las dos conductas que nunca salían de cuadro**:
   - **Milano** (`planearEnCirculos`): **entra y sale por arriba, en la
     térmica**. Llega bajando en espiral desde fuera de cuadro y se va subiendo
     en espiral hasta perderse, a 1,4 u/s, con una deriva lateral lenta del
     viento. *(Revisión tras la implementación: la primera versión lo hacía
     entrar y salir por un costado, y cruzar las ~40 u del cuadro en un quinto
     del acto le daba 11 u/s —20 u/s con la extrapolación—: se le veía salir
     disparado.)* La subida sigue después de su tiempo, así que no se
     extrapola; el cabeceo no cuenta lo que lo sube la térmica. Dura 30–42 s.
   - **Luciérnagas** (`titilar`): son luces. Su presencia sube de 0 a 1 en los
     primeros 2 s y vuelve a 0 en los últimos 2 s: se encienden y se apagan, no
     se encogen. No se extrapolan.

### 5.4 Red de seguridad

Si un acto siguiera a la vista `OVERTIME_LIMIT` (30 s) después de su fin, se
retira con un fundido de escala de 1 s. No debería ocurrir nunca: `check:path`
exige que en la simulación no salte ni una vez.

### 5.5 Al apagar el movimiento

Con 静 o movimiento reducido el director se vacía de golpe, como hoy: el canvas
deja de animarse y no hay nada que ver salir. No cambia.

## 6. Diagnóstico

`/diagnostico` lista cada acto vivo con su distancia a la cámara y su estado:
**entrando**, **en cuadro**, **fuera de cuadro**, **dejado atrás** (contando el
avance) o **saliendo** (tiempo cumplido, extrapolando). Es la misma lista de
texto de hoy (`FAUNA_STAGE.live`), ahora con distancia y estado; el panel no
cambia.

## 7. Verificación

`bun run check:path` corre, además de `scripts/check-path.ts`, un archivo nuevo,
**`scripts/check-fauna.ts`** («La fauna en el camino»; los dos comparten
`scripts/check-kit.ts`). Usa la `PerspectiveCamera` de three (matemática pura,
sin DOM) colocada con el mismo rig del camino:

- **Nacimiento** — para cada especie, conducta y estación, a 0, 6 y 12 u/s, y
  con aspectos 9:16, 4:3, 16:9 y 21:9:
  - el primer instante de todo individuo está fuera de cuadro (las luciérnagas,
    con presencia 0);
  - el final de su tiempo, con la cámara quieta, también;
  - se respetan el suelo de distancia, la ventaja y el tope por niebla;
  - no nace nada retrocediendo, por encima de 12 u/s ni durante un viaje.
- **Recorrido simulado** — de la Home a Gastronomía con el director real
  (`advanceCasting`), con semilla fija, a 16:9 y a 9:16: caminar, paradas de
  tarjeta, retrocesos y un viaje por enlace:
  - **ningún individuo desaparece estando en cuadro**: en el frame en que un
    acto se retira, ninguno de sus individuos estaba en cuadro;
  - ningún acto empieza ya a la vista;
  - **nada visible a menos de 7 u** de la cámara (medido al centro de cada
    individuo). Se informa, además, de la distancia mínima por conducta;
  - lo que pisa, pisa el terreno del mundo, también en las cuestas;
  - el ancla que se desliza no da saltos: entre frames no avanza más que la
    cámara más un margen pequeño;
  - los actos dejados atrás se retiran, y ninguno queda vivo muy por detrás;
  - la red de seguridad no salta nunca.
- **Puras** — la tabla de deslizamiento sólo desliza conductas que vuelan;
  continuidad de `faunaDistance` a lo largo del camino; velocidad de salida
  > 0,3 u/s en toda conducta que se extrapola.
- `bun run typecheck` y `bun run build`.
- **GLSL**: no se espera ningún cambio (las luciérnagas se apagan con la
  opacidad de sus materiales). Si alguno lo toca, se compila en un contexto
  WebGL2 real antes de darlo por bueno.
- **Navegador**: la revisión visual es del usuario. El servidor de desarrollo
  no se arranca sin su permiso (se detuvo por memoria).

## 8. Mapa de archivos

**Nuevos**
- `src/scene/systems/fauna/anchoring.ts` (puro) — dónde nace cada acto
  (ventaja, cercanía, suelos, tope), el ancla que se desliza, la prueba de
  cuadro con una cámara de three, el seguimiento de cada acto y las reglas de
  retirada.
- `scripts/check-fauna.ts`, `scripts/check-kit.ts`.

**Cambian**
- `src/scene/systems/fauna/behaviors.ts` — `origin`/`anchor`/`spawnD`/`aspect`
  en el acto; `groundAt` y `offscreenX` con el acto; `placeAt` con la salida
  extrapolada; sin encogimiento final; milano que entra y sale; luciérnagas
  que se encienden y se apagan (`pose.fade`).
- `src/scene/systems/fauna/casting.ts` — el estado de la cámara entra al
  director; nacimiento con ventaja y cercanía; retirada; el siguiente que se
  adelanta; `createAct` y `describeAct`.
- `src/scene/systems/fauna/FaunaDirector.tsx` — un grupo por acto con su
  `anchor`, el seguimiento con la cámara real; fuera el grupo que seguía a la
  cámara.
- `src/scene/objects/fauna/FireflyRig.tsx` — la presencia de la luz.
- `src/scene/path/journeyPath.ts`, `src/scene/camera/CameraRig.tsx` —
  `PATH.velocity`.
- `src/config/journey.ts` — `ambient.faunaDistance`.
- `scripts/check-path.ts`, `package.json` — `check:path` corre los dos.
- `docs/PLAN.md`, `CLAUDE.md`, READMEs de `scene/systems/` y `scene/camera/`.

## 9. Fuera de alcance (3B)

- Especies o conductas nuevas, y cambios en cómo se mueve cada animal (más allá
  de la entrada y salida del milano y de la presencia de las luciérnagas).
- Que los animales reaccionen a la cámara (un susto que los haga volar).
- Decoración por estación (fases 4–8).
- Sidebar, íconos, navegación móvil y teclado → **3C**.

## 10. A calibrar en la revisión del usuario

`faunaDistance` de cada estación; `LEAD_TIME` y `LEAD_MAX`; `SPAWN_MAX_SPEED`;
`PASSED_ADVANCE`; el adelanto del siguiente acto (4–8 s); los mínimos de
deslizamiento; la velocidad con que el milano entra y sale.
