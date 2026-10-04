# `scene/systems` — sistemas de ambiente

- `elevation.ts` — **Fase 1**, global desde la **3A**. Altura del terreno como
  función pura: la del camino a esa profundidad más las colinas, medidas desde
  el eje del camino y mezcladas entre estaciones. La usan el suelo, las
  piedras, la cámara y todo lo que camine.
- `Terrain.tsx` — una sola malla para todo el camino, calculada al montar, con
  el tinte de suelo de cada zona por vértice.
- `StonePath.tsx` — las ~310 piedras del recorrido en doce `InstancedMesh`;
  dónde va cada una lo decide `scene/path/stones.ts`.
- `Atmosphere.tsx` — **Fase 3A**. Niebla, fondo y sol, mezclados por la zona en
  la que está la cámara; el sol y su caja de sombras siguen al encuadre.
- `WindField.ts` — **Fase 2A**. Un solo viento para todo el sitio, con máquina
  de ráfagas (espera → sube → sostiene → baja) y tiempos en `tokens.css`. No es
  un hook ni vive en el store: cambia sesenta veces por segundo y eso serían
  sesenta renders. Es un objeto de módulo que sólo escribe `WindDriver`.
- `WindDriver.tsx` — **Fase 2A**. Lo hace avanzar dentro del `<Canvas>`, para
  que comparta reloj con el frame que se está dibujando.
- `PetalSystem.tsx` + `petals.ts` — **Fase 2B**. Pétalos y hojas en
  `InstancedMesh` con **toda la posición calculada en el vertex shader**: la CPU
  sólo sube cinco uniforms por capa, así que cuesta lo mismo mover setenta que
  trescientos. Tres capas de Z — la de delante cruza entre la cámara y el
  sujeto. Lo único que la CPU aporta es la **integral del viento**, porque el
  shader conoce la ráfaga de este frame pero no su historia.
  `petals.ts` es puro y sin React a propósito: la cuenta de pétalos la comparten
  el sistema y el panel de `/diagnostico`, y si cada uno la calculara por su
  cuenta acabarían diciendo cosas distintas.
  Desde la **Fase 3A** exporta `PetalZones`: un sistema por estación con
  pétalos, reservado al cargar, que sólo dibuja cuando su zona pesa algo donde
  está la cámara. Las cajas viajan con el encuadre y fluyen hacia la cámara con
  el avance (`uAdvance`), desvaneciéndose en los bordes de profundidad.
- `fauna/` — **Fase 2C**, anclada al mundo en la **3B**. Cinco piezas, cuatro de
  ellas puras y comprobables sin navegador:
  - `bestiary.ts` — qué es cada especie: modelo, tamaño, **regiones que se
    doblan** (cola, patas, cuello, alas), marcha (paso, trote, galope o
    brinco), repertorio.
  - `behaviors.ts` — el repertorio, como funciones puras del tiempo a una
    posición. Rumbo, alabeo, esfuerzo y si está en el aire **se deducen** de la
    propia trayectoria.
  - `casting.ts` — las reglas del director: cadencia, aforo, variedad.
  - `anchoring.ts` — dónde vive cada acto en el mundo: dónde y cuándo nace
    (ventaja al caminar, cercanía por estación), el ancla que se desliza de lo
    que vuela, la prueba de cuadro con la cámara real y la regla de retirada:
    nunca a la vista.
  - `FaunaDirector.tsx` — la parte que React necesita: reloj, estado, precarga
    de modelos y el reparto a los cuerpos de `objects/fauna/` (modelo con
    deformación, modelo animado o punto de luz).

  Ver §5.6 del PLAN.

Todos leen la densidad efectiva de `selectParticleScale()` del store, que ya
combina el tier de calidad, `prefers-reduced-motion` y el modo 静.
