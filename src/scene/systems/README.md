# `scene/systems` — sistemas de ambiente

Vacío hasta la **Fase 2**.

- `PetalSystem` — pétalos y hojas en `InstancedMesh`, posición calculada en el
  shader (coste CPU ≈ 0). Varias capas en Z: por delante y por detrás del sujeto.
- `WindField` — viento direccional variable, con ráfagas. Alimenta al bambú y a
  las partículas.
- `FaunaDirector` — elige y lanza la fauna de `station.ambient.fauna` cada
  20–40 s, y también tras ~20 s sin scroll.
- `StonePath` — **Fase 3**: instancia las piedras a lo largo del spline.

Todos leen la densidad efectiva de `selectParticleScale()` del store, que ya
combina el tier de calidad, `prefers-reduced-motion` y el modo 静.
