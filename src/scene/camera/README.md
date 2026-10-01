# `scene/camera` — rig de cámara

`CameraRig.tsx`, desde la **Fase 2A**.

Contiene dos cosas que son la misma decisión y por eso no viven separadas:

- **el encuadre base** (`CAMERA_BASE`): posición, punto al que mira y fov. Antes
  estaba repartido entre `<Canvas>` y un `CameraAim` suelto;
- **el parallax de cursor**: amortiguado, acotado al 3,5 % del cuadro visible y
  a 2° de giro, con los tres límites en `tokens.css`. El desplazamiento se
  calcula desde el fov y la distancia al punto de interés, no en unidades
  fijas, así que es igual de discreto en un móvil que en un monitor ancho.

En un móvil el puntero lo alimenta el giroscopio (ver `EnvironmentProbe`): el
rig no distingue una fuente de la otra.

Desde la **Fase 3A** la cámara viaja por el camino:

- `framing.ts` — `CAMERA_BASE` es el **encuadre local** (22 u detrás del punto
  de interés, 2,3 por encima, ~6°) y la matemática de la regla de tercios, en
  coordenadas de ese encuadre. `VIEW.aspect` es el aspecto real de la pantalla.
- `pathRig.ts` — puro. Lleva el encuadre local a cualquier profundidad `d` del
  camino, con topes anti-mareo: rumbo ±15° y 12°/s, inclinación 3,5°–8,7° (si
  una cuesta la saca de la banda, sube o baja la cámara, no la inclina), y dos
  filtros de paso bajo en los viajes rápidos: el giro muy amortiguado y el
  desplazamiento lateral más ágil, que recortan las curvas sin perder el camino
  de vista. `bun run check:path` lo recorre entero.
- `CameraRig.tsx` — el **único escritor de `PATH`**. La cámara está en
  *objetivo del scroll + desfase de viaje* (`animation/travel.ts`); la primera
  estación de la visita es un aterrizaje y con modo 静 no hay viaje. El
  parallax se suma encima, en los ejes locales.

La cámara es siempre **observadora**: nunca entra en la escena.
