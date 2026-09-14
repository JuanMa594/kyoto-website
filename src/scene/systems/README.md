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
- `PetalSystem` — **Fase 2B**. Pétalos y hojas en `InstancedMesh` con la
  posición calculada en el shader (coste CPU ≈ 0), en varias capas de Z: por
  delante y por detrás del sujeto. Lee el viento de `WIND`.
- `fauna/` — **Fase 2C**. `FaunaDirector` elige especie y conducta entre las que
  declara `station.ambient.fauna`, cada 20–40 s y tras ~20 s sin scroll. Ver
  §5.6 del PLAN.

Todos leen la densidad efectiva de `selectParticleScale()` del store, que ya
combina el tier de calidad, `prefers-reduced-motion` y el modo 静.
