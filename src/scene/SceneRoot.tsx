'use client';

import dynamic from 'next/dynamic';

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

export function SceneRoot() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 select-none"
      data-scene-root=""
    >
      <SceneCanvas />
    </div>
  );
}
