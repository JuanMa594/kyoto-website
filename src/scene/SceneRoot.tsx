'use client';

import dynamic from 'next/dynamic';
import type { CSSProperties } from 'react';

/**
 * El mundo. Vive en `app/[locale]/layout.tsx` y **nunca se desmonta**: cambiar
 * de sección no recarga el 3D, sólo le dice "llévame a la estación X".
 *
 * Va detrás del DOM y sin capturar el puntero. Todo el contenido real (texto,
 * enlaces, encabezados) existe como DOM de verdad encima del canvas: es lo que
 * leen los buscadores y los lectores de pantalla, y por eso el canvas se marca
 * `aria-hidden`.
 */

const SceneCanvas = dynamic(() => import('@/scene/SceneCanvas'), {
  ssr: false,
  // El fondo washi ya está pintado por el CSS, así que mientras carga el 3D no
  // se ve un hueco: se ve el mismo color, sólo que plano.
  loading: () => null,
});

/**
 * La geometría (posición, tamaño, z-index) va en `style` inline y no en clases
 * de Tailwind a propósito: un `style` se aplica al DOM en el mismo instante en
 * que el nodo existe, sin depender de que cargue una hoja de estilos. En dev,
 * Turbopack inyecta el CSS de Tailwind vía un chunk de JS aparte; si el
 * `ResizeObserver` interno de R3F llega a medir este contenedor antes de que
 * ese chunk se aplique, lo ve sin `fixed inset-0` — es decir, sin tamaño — y
 * el `<canvas>` se queda clavado en 300×150 (su tamaño por defecto) hasta el
 * próximo reflow real de la página. Con estilo inline no hay carrera posible.
 */
const FIXED_FULLSCREEN: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: -10,
};

export function SceneRoot() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none"
      style={FIXED_FULLSCREEN}
      data-scene-root=""
    >
      <SceneCanvas />
    </div>
  );
}
