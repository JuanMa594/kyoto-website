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

En la **Fase 3** `CAMERA_BASE` deja de ser constante y lo escribe el spline del
camino con `ScrollTrigger` + `MotionPath`; el parallax se seguirá sumando
encima igual.

La cámara es siempre **observadora**: nunca entra en la escena.
