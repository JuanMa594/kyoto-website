# `audio` — ambiente sonoro

Implementado en la **Fase 2C**. Sin un solo archivo de audio: todo se sintetiza
con la Web Audio API.

- `engine.ts` — el motor. Dos familias:
  - **lechos** (viento, arroyo, ciudad, bambú): ruido marrón en bucle visto por
    un filtro distinto cada uno. El del viento **sigue a `WIND`** en volumen y en
    frecuencia, así que la ráfaga que arrastra los pétalos es la que se oye
    crecer; el del bambú sólo suena cuando algo mueve las hojas.
  - **eventos** (fūrin, grillos, pájaros, fuego): sonidos sueltos cada 3–40 s.
    La campanilla son tres parciales inarmónicos con decaimiento; los pájaros,
    barridos de frecuencia — y uno de cada tres es el **uguisu**, la única
    especie del bestiario que no se ve nunca.
  - `playFauna()` da voz a la fauna que entra en cuadro, por el lado por el que
    entra.
- `AmbientAudio.tsx` — puente con el store. Nunca suena antes de un gesto (ningún
  navegador lo permite), se apaga entero con el modo 静 y se suspende con la
  pestaña de fondo.

Qué capas tiene cada zona sale de `station.ambient.sounds`, en `journey.ts`.
El interruptor visible es `components/ui/AmbientControls.tsx`.
