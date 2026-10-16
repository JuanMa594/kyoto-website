'use client';

import { CaminoFace, useCaminoHover } from '@/components/ui/CaminoButton';
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
  const hover = useCaminoHover();

  return (
    <button
      type="button"
      className="paper camino-button cartel-button"
      aria-pressed={zoomed}
      onClick={() => setMapZoom(zoomed ? 'japon' : 'kyoto')}
      {...hover.props}
    >
      {/* El ícono de Ubicación: del punto de Kyoto sale su onda. */}
      <CaminoFace icon="mapa" label={zoomed ? zoomOut : zoomIn} active={hover.active} />
    </button>
  );
}
