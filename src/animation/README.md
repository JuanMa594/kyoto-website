# `animation` — orquestación

Implementado en la **Fase 2A**.

- `gsap.ts` — el motor. `registerPlugin(ScrollTrigger, MotionPathPlugin)` e
  integración con Lenis: **un único `requestAnimationFrame`** para los dos, con
  `autoRaf: false` en Lenis y `lagSmoothing(0)` en GSAP mientras está vivo. Se
  arranca y se destruye entero; no se queda corriendo en vacío.
- `presets.ts` — las cuatro curvas de `tokens.css` parseadas desde
  `cubic-bezier()` y registradas como easings con nombre, más las duraciones.
  Así `ease: 'washi'` en GSAP y `var(--ease-washi)` en CSS son la misma curva.
- `useScrollScene.ts` — puente scroll → store. Un solo ScrollTrigger sobre la
  página escribe `pathProgress`; quien lo interprete es cosa de la escena (en la
  Fase 3, la cámara sobre el spline).
- `MotionEngine.tsx` — componente del layout que enciende y apaga todo lo
  anterior según `selectMotionAllowed`, y vuelve a medir la página al navegar.

GSAP es el orquestador único del scroll y de la escena. `Motion` (ex Framer
Motion), si entra, se queda sólo en UI del DOM.
