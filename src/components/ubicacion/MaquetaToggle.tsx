'use client';

import { useKyotoStore } from '@/store/useKyotoStore';

/**
 * El botón del zoom a Kyoto (Fase 5A): la vía del teclado y del lector de
 * pantalla, y la única sin WebGL. **Aislado a propósito**: sólo llama a
 * `setMapZoom`. Escape, el toque en Kyoto y el deshacer al caminar los lleva
 * `MaquetaInput`, así que quitarlo es borrar una línea de la página. Si algún
 * día molesta a la vista, mejor dejarlo `sr-only` que borrarlo: es la única
 * forma de hacer el zoom con el teclado.
 */
export function MaquetaToggle({ zoomIn, zoomOut }: { zoomIn: string; zoomOut: string }) {
  const zoom = useKyotoStore((state) => state.mapZoom);
  const setMapZoom = useKyotoStore((state) => state.setMapZoom);
  const zoomed = zoom === 'kyoto';

  return (
    <button
      type="button"
      className="paper cartel-button"
      aria-pressed={zoomed}
      onClick={() => setMapZoom(zoomed ? 'japon' : 'kyoto')}
    >
      {zoomed ? zoomOut : zoomIn}
    </button>
  );
}
