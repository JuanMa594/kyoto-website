'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Camera, PerspectiveCamera } from 'three';

import { scrollTargetDepth } from '@/animation/journeyScroll';
import { absorbJump, cancelTravel, JUMP_THRESHOLD, TRAVEL } from '@/animation/travel';
import { JOURNEY, PATH_LENGTH, type StationSlug } from '@/config/journey';
import { readCssNumber } from '@/lib/css-vars';
import { clamp, damp } from '@/lib/procedural';
import { VIEW } from '@/scene/camera/framing';
import { CAMERA_BACK, createRig, snapRig, stepRig } from '@/scene/camera/pathRig';
import { dominantZone, PATH } from '@/scene/path/journeyPath';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

/**
 * La cámara sobre el camino, y el parallax de cursor que la reencuadra.
 *
 * Desde la Fase 3A la cámara **viaja**: su punto de interés está en la
 * profundidad `d = objetivo del scroll + desfase de viaje`, y `pathRig.ts`
 * traduce esa `d` a posición, rumbo e inclinación con sus topes anti-mareo.
 * Este componente es el **único escritor de `PATH`**: todo lo que depende de
 * dónde está la cámara —pétalos, fauna, niebla, sol, viento— lo lee de ahí.
 *
 * Cuándo se viaja y cuándo se salta:
 *
 *   · un salto del objetivo (cambio de estación, «atrás», la tecla Fin) se
 *     absorbe en el desfase y GSAP lo lleva a cero (`travel.ts`);
 *   · **la primera estación de la visita** es un aterrizaje: la cámara aparece
 *     allí sin recorrer el camino desde la Home;
 *   · con modo 静 o `prefers-reduced-motion` no hay viaje: la cámara salta.
 *
 * **El parallax sigue siendo deliberadamente sutil**, con los tres límites de
 * `tokens.css`: el 3,5 % del cuadro visible (medido a la distancia real del
 * punto de interés), 2° de giro y una amortiguación que convierte el token por
 * frame en una exponencial independiente del framerate. Se suma en los ejes
 * locales de la cámara, así que en una curva sigue siendo «a la derecha» de lo
 * que se ve.
 *
 * Sin un `lookAt` explícito la cámara miraría perfectamente horizontal; aquí
 * mira siempre al punto de interés, y es el rig el que decide su altura.
 */

/**
 * Desplazamiento actual del parallax, en unidades de mundo. Mismo criterio que
 * `WIND`: cambia cada frame. Sólo lo escribe el rig; `/diagnostico` lo lee.
 */
export const PARALLAX = { x: 0, y: 0 };

interface ParallaxConfig {
  /** Fracción del cuadro visible que puede desplazarse la cámara. */
  max: number;
  /** Constante de la exponencial de amortiguación. */
  lambda: number;
  /** Giro máximo permitido, en radianes. */
  tilt: number;
}

function readParallaxConfig(): ParallaxConfig {
  const perFrame = clamp(readCssNumber('--parallax-damping', 0.06), 0.001, 0.999);

  return {
    max: readCssNumber('--parallax-max', 0.035),
    // `damp()` usa 1 − e^(−λ·dt). Igualando a la interpolación por frame a
    // 60 fps: λ = −ln(1 − factor) · 60. Con 0.06 da λ ≈ 3.7.
    lambda: -Math.log(1 - perFrame) * 60,
    tilt: (readCssNumber('--parallax-tilt', 2) * Math.PI) / 180,
  };
}

export function CameraRig() {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const motionAllowed = useKyotoStore(selectMotionAllowed);
  const activeStation = useKyotoStore((s) => s.activeStation);

  const config = useMemo(readParallaxConfig, []);
  const rig = useMemo(createRig, []);
  const lastTarget = useRef<number | null>(null);
  const lastStation = useRef<StationSlug | null>(null);

  const advance = useCallback(
    (view: Camera, dt: number) => {
      const perspective = view as PerspectiveCamera;
      const store = useKyotoStore.getState();
      const motion = selectMotionAllowed(store);

      const target = scrollTargetDepth(store.activeStation);
      const previous = lastTarget.current;
      const stationChanged = lastStation.current !== null && lastStation.current !== store.activeStation;
      lastTarget.current = target;
      lastStation.current = store.activeStation;

      let snap = previous === null || !motion;
      if (!snap && previous !== null && Math.abs(target - previous) > JUMP_THRESHOLD) {
        if (stationChanged && store.arrivals <= 1) snap = true;
        else absorbJump(previous, target);
      }
      if (snap) cancelTravel();

      const before = rig.d;
      const wasReady = rig.initialized;
      if (snap) snapRig(rig, target);
      else stepRig(rig, target + TRAVEL.offset, dt);

      // Un salto seco no es avance: los pétalos no deben fluir cuatrocientas
      // unidades de golpe.
      if (wasReady && !snap) PATH.advance += rig.d - before;
      // Con la misma amortiguación que la velocidad del rig. Un salto seco no
      // es caminar: la velocidad vuelve a 0.
      PATH.velocity =
        wasReady && !snap && dt > 0 ? damp(PATH.velocity, (rig.d - before) / dt, 8, dt) : 0;
      PATH.d = rig.d;
      PATH.live = true;
      PATH.progress = clamp(rig.d / PATH_LENGTH, 0, 1);
      PATH.offset = TRAVEL.offset;
      Object.assign(PATH.frame, rig.frame);
      Object.assign(PATH.focus, rig.focus);

      const zone = JOURNEY[dominantZone(rig.d)]!.slug;
      if (zone !== store.zone) store.setZone(zone);

      VIEW.aspect = perspective.aspect;

      // Tamaño del cuadro a la distancia del punto de interés: es la referencia
      // honesta para un desplazamiento "del 3,5 %".
      const distance = Math.hypot(CAMERA_BACK, rig.camera.y - rig.focus.y);
      const viewHeight = 2 * Math.tan((perspective.fov * Math.PI) / 360) * distance;
      const viewWidth = viewHeight * perspective.aspect;
      const limit = Math.tan(config.tilt) * distance;

      if (motion) {
        const { pointer } = store;
        const wantedX = clamp(pointer.x * viewWidth * config.max, -limit, limit);
        // El cursor cuenta la Y hacia abajo; la escena, hacia arriba.
        const wantedY = clamp(-pointer.y * viewHeight * config.max, -limit, limit);
        PARALLAX.x = damp(PARALLAX.x, wantedX, config.lambda, dt);
        PARALLAX.y = damp(PARALLAX.y, wantedY, config.lambda, dt);
      } else {
        PARALLAX.x = 0;
        PARALLAX.y = 0;
      }

      // El eje X local de la cámara, en mundo: (cos, 0, −sen) del rumbo.
      const cos = Math.cos(rig.yaw);
      const sin = Math.sin(rig.yaw);
      perspective.position.set(
        rig.camera.x + PARALLAX.x * cos,
        rig.camera.y + PARALLAX.y,
        rig.camera.z - PARALLAX.x * sin,
      );
      perspective.lookAt(rig.focus.x, rig.focus.y, rig.focus.z);
    },
    [rig, config],
  );

  // Sin movimiento el bucle pasa a `demand` y `useFrame` deja de correr: cada
  // cambio de estación (o de modo) pide su propio frame, con la cámara ya en
  // su sitio.
  useEffect(() => {
    if (motionAllowed) return;
    advance(camera, 0);
    invalidate();
  }, [motionAllowed, activeStation, camera, advance, invalidate]);

  // Prioridad −1: el rig escribe `PATH` antes de que nadie lo lea en el frame.
  // (Una prioridad positiva le quitaría a R3F el render automático.)
  useFrame((state, delta) => advance(state.camera, Math.min(delta, 0.1)), -1);

  return null;
}
