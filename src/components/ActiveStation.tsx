'use client';

import { useEffect } from 'react';

import type { StationSlug } from '@/config/journey';
import { useKyotoStore } from '@/store/useKyotoStore';

/**
 * El contrato entre una ruta y la escena: la página no dibuja nada en 3D, sólo
 * declara "estoy en la estación X". La escena decide cómo llegar: la primera
 * vez la cámara aparece allí; después, viaja por el camino hasta ella
 * (`scene/camera/CameraRig.tsx`).
 */
export function ActiveStation({ slug }: { slug: StationSlug }) {
  useEffect(() => {
    useKyotoStore.getState().setActiveStation(slug);
  }, [slug]);

  return null;
}
