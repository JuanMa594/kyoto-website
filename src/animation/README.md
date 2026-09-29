# `animation` — orquestación

Implementado en la **Fase 2A**.

- `gsap.ts` — el motor. `registerPlugin(ScrollTrigger, MotionPathPlugin)` e
  integración con Lenis: **un único `requestAnimationFrame`** para los dos, con
  `autoRaf: false` en Lenis y `lagSmoothing(0)` en GSAP mientras está vivo. Se
  arranca y se destruye entero; no se queda corriendo en vacío.
- `presets.ts` — las cuatro curvas de `tokens.css` parseadas desde
  `cubic-bezier()` y registradas como easings con nombre, más las duraciones.
  Así `ease: 'washi'` en GSAP y `var(--ease-washi)` en CSS son la misma curva.
- `journeyScroll.ts` — **Fase 3A**, puro. Del scroll de una página a la
  profundidad de la cámara: el contenido avanza 4 u, el tramo lleva a la
  siguiente estación. Escribe `SCROLL_PATH` (lo lee el rig de cámara) y decide
  la llegada automática (`passTramo`: armada, una vez, hacia abajo).
- `useJourneyScroll.ts` — **Fase 3A**. Los dos ScrollTrigger de cada página de
  estación (contenido y tramo), con la curva `power2.inOut` en el tramo. Pone
  el scroll a cero al montar y fija `scrollRestoration = 'manual'` a través de
  ScrollTrigger (ver la trampa en `CLAUDE.md`).
- `travel.ts` — **Fase 3A**. El desfase de viaje: cuando el objetivo de la
  cámara salta, el salto se guarda en `TRAVEL.offset` y GSAP lo lleva a cero
  con la curva `piedra` (1,8 s por estación, 4 s el camino entero).
- `MotionEngine.tsx` — componente del layout que enciende y apaga todo lo
  anterior según `selectMotionAllowed`, y vuelve a medir la página al navegar.

GSAP es el orquestador único del scroll y de la escena. `Motion` (ex Framer
Motion), si entra, se queda sólo en UI del DOM.
