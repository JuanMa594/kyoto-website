# `scene/systems` — sistemas de ambiente

- `elevation.ts` — **Fase 1**. Altura del terreno como función pura. La usan el
  suelo, las piedras y (Fase 2C) todo lo que camine.
- `Terrain.tsx`, `StonePath.tsx` — **Fase 1**.
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
- `fauna/` — **Fase 2C**. Cuatro piezas, tres de ellas puras y comprobables sin
  navegador:
  - `bestiary.ts` — qué es cada especie: rig, proporciones, colores, repertorio.
  - `behaviors.ts` — el repertorio, como funciones puras del tiempo a una
    posición. Rumbo, alabeo, esfuerzo y si está en el aire **se deducen** de la
    propia trayectoria.
  - `casting.ts` — las reglas del director: cadencia, aforo, variedad.
  - `FaunaDirector.tsx` — la parte que React necesita: reloj, estado y mallas.

  Ver §5.6 del PLAN.

Todos leen la densidad efectiva de `selectParticleScale()` del store, que ya
combina el tier de calidad, `prefers-reduced-motion` y el modo 静.
