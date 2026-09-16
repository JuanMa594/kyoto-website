'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';

import { readCssNumber } from '@/lib/css-vars';
import { clamp, damp } from '@/lib/procedural';
import { CAMERA_BASE } from '@/scene/camera/framing';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

/**
 * El encuadre, y el parallax de cursor que lo reencuadra.
 *
 * **El encuadre base vive en `framing.ts`**, junto a la matemática que traduce
 * la regla de tercios a unidades de mundo: la posición, el punto al que mira y
 * el campo de visión son un mismo ajuste, y repartirlos entre archivos es cómo
 * se acaba con una cámara que mira a un sitio distinto del que dice el
 * comentario. En la Fase 3 ese encuadre dejará de ser constante y lo escribirá
 * el spline del camino; el parallax seguirá sumándose encima igual.
 *
 * Sin un `lookAt` explícito la cámara miraría perfectamente horizontal
 * (rotación identidad, eje −Z) y el horizonte quedaría a media pantalla. Con
 * `y = 4.2` mirando a `(0, 1.9, −9)` la inclinación es de ~6° y el horizonte
 * cae al 32 % desde arriba: el tercio superior libre para copas, hojas y aves;
 * el medio para el texto; el inferior para el camino.
 *
 * Dos mandos que no hay que confundir: **la altura** decide dónde cae el camino
 * en el cuadro; **la inclinación**, dónde cae el horizonte. Para bajar el
 * camino sin perder cielo se sube la cámara, no se inclina.
 *
 * **El parallax es deliberadamente sutil** — es lo que separa "elegante" de
 * "efecto barato". Tres límites, los tres en `tokens.css`:
 *
 *   · `--parallax-max` acota el desplazamiento al 3,5 % del cuadro *visible*,
 *     no a un número fijo de unidades: se calcula desde el fov y la distancia
 *     al punto de interés, así que se mantiene igual de discreto en un móvil
 *     vertical que en un monitor ancho;
 *   · `--parallax-tilt` acota el giro a 2°. Como el `lookAt` queda clavado en
 *     el punto de interés, mover la cámara ya produce el giro — y a esta
 *     distancia el 3,5 % equivale justo a esos ~2°. El tope está igualmente,
 *     porque en la Fase 3 la distancia cambiará con el camino;
 *   · `--parallax-damping` hace que la cámara persiga al cursor con inercia y
 *     nunca 1:1. El token es el factor por frame a 60 fps, que aquí se
 *     convierte a la constante de una exponencial para que la amortiguación no
 *     dependa del framerate real.
 */

/**
 * Desplazamiento actual del parallax, en unidades de mundo. Mismo criterio que
 * `WIND`: cambia cada frame, así que no puede vivir en el store sin provocar un
 * render por frame. Sólo lo escribe el rig; `/diagnostico` lo lee.
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

  const base = useMemo(() => new Vector3(...CAMERA_BASE.position), []);
  const target = useMemo(() => new Vector3(...CAMERA_BASE.target), []);
  const config = useMemo(readParallaxConfig, []);

  useEffect(() => {
    camera.position.copy(base);
    camera.lookAt(target);
  }, [camera, base, target]);

  // Sin movimiento el bucle pasa a `demand` y `useFrame` deja de correr, así
  // que la cámara se quedaría con el último desplazamiento puesto. Se devuelve
  // al encuadre limpio y se pide un último frame para que se vea.
  useEffect(() => {
    if (motionAllowed) return;

    PARALLAX.x = 0;
    PARALLAX.y = 0;
    camera.position.copy(base);
    camera.lookAt(target);
    invalidate();
  }, [motionAllowed, camera, base, target, invalidate]);

  useFrame((state, delta) => {
    const perspective = state.camera as PerspectiveCamera;
    const { pointer } = useKyotoStore.getState();
    const dt = Math.min(delta, 0.1);

    // Tamaño del cuadro a la distancia del punto de interés: es la referencia
    // honesta para un desplazamiento "del 3,5 %".
    const distance = base.distanceTo(target);
    const viewHeight = 2 * Math.tan((perspective.fov * Math.PI) / 360) * distance;
    const viewWidth = viewHeight * perspective.aspect;
    const limit = Math.tan(config.tilt) * distance;

    const wantedX = clamp(pointer.x * viewWidth * config.max, -limit, limit);
    // El cursor cuenta la Y hacia abajo; la escena, hacia arriba.
    const wantedY = clamp(-pointer.y * viewHeight * config.max, -limit, limit);

    PARALLAX.x = damp(PARALLAX.x, wantedX, config.lambda, dt);
    PARALLAX.y = damp(PARALLAX.y, wantedY, config.lambda, dt);

    perspective.position.set(base.x + PARALLAX.x, base.y + PARALLAX.y, base.z);
    perspective.lookAt(target);
  });

  return null;
}
