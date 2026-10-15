'use client';

import { DepthOfField, EffectComposer } from '@react-three/postprocessing';

import { CAMERA_BASE } from '@/scene/camera/framing';

/**
 * Profundidad de campo. **Sólo en tier alto** (`profile.postprocessing`), y por
 * eso este archivo se carga aparte: una máquina modesta no debería ni
 * descargarse el efecto.
 *
 * El foco no se pone a ojo: se calcula la distancia real de la cámara al punto
 * de interés, el mismo al que apunta el `lookAt` del rig. Así el sujeto y el
 * camino quedan nítidos, el relieve del fondo se ablanda y —sobre todo— los
 * pétalos de la capa delantera, que pasan a tres unidades del objetivo, se
 * convierten en manchas suaves. Ése es el bokeh que pide el §5.1 del PLAN, y es
 * también la razón de que el desenfoque llegue en el mismo bloque que los
 * pétalos: antes de tener algo cruzando por delante, no tenía nada que hacer.
 *
 * `resolutionScale` baja la resolución del desenfoque a la mitad. Es el truco
 * de siempre con la profundidad de campo: el resultado está borroso por
 * definición, así que nadie nota que se calculó a menos resolución, y cuesta
 * cuatro veces menos.
 */

const FOCUS_DISTANCE = Math.hypot(
  CAMERA_BASE.position[0] - CAMERA_BASE.target[0],
  CAMERA_BASE.position[1] - CAMERA_BASE.target[1],
  CAMERA_BASE.position[2] - CAMERA_BASE.target[2],
);

export default function PostProcessing() {
  return (
    <EffectComposer multisampling={4}>
      <DepthOfField
        worldFocusDistance={FOCUS_DISTANCE}
        // Margen nítido a cada lado del foco. Cubre el camino entero de piedras
        // sin llegar a las colinas ni a la capa delantera de pétalos.
        worldFocusRange={16}
        bokehScale={2.4}
        resolutionScale={0.5}
      />
    </EffectComposer>
  );
}
