# `animation` — orquestación

Vacío hasta la **Fase 2**.

- `gsap.ts` — singleton, `registerPlugin(ScrollTrigger, MotionPathPlugin)` e
  integración con Lenis (un único `requestAnimationFrame` para los dos).
- `useScrollScene.ts` — puente entre `ScrollTrigger` y la escena R3F.
- `presets.ts` — easings y duraciones como tokens, leídos de `tokens.css`
  (`--ease-washi`, `--ease-viento`, `--ease-piedra`, `--ease-spring`).

GSAP es el orquestador único del scroll y de la escena. `Motion` (ex Framer
Motion), si entra, se queda sólo en UI del DOM.
