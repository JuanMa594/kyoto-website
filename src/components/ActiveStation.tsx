'use client';

import { useEffect } from 'react';

import type { StationSlug } from '@/config/journey';
import { useKyotoStore } from '@/store/useKyotoStore';

/**
 * El contrato entre una ruta y la escena: la página no dibuja nada en 3D, sólo
 * declara "estoy en la estación X". La escena decide cómo llegar hasta allí.
 *
 * En la Fase 1 eso significa cambiar la niebla y el color del suelo. En la
 * Fase 3 significará que la cámara viaje por el spline hasta esa estación.
 */
export function ActiveStation({ slug }: { slug: StationSlug }) {
  useEffect(() => {
    useKyotoStore.getState().setActiveStation(slug);
  }, [slug]);

  return null;
}
