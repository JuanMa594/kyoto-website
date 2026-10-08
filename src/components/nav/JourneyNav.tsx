'use client';

import { stationFromPathname } from '@/config/journey';
import { usePathname } from '@/i18n/navigation';

import { MobileNav } from './MobileNav';
import { useNavLayout } from './navQuery';
import { RadialSidebar } from './RadialSidebar';

/**
 * La navegación del camino (Fase 3C). Vive en el layout de `[locale]`, como la
 * escena, y **no se desmonta** al cambiar de ruta: la marca de progreso sigue
 * viva durante el viaje.
 *
 * La estación actual sale de la URL, no del store: así `aria-current` ya es
 * correcto en el HTML estático de cada página. Las dos presentaciones se
 * renderizan siempre y el CSS decide cuál se ve; `active` sólo enciende la que
 * está a la vista (sus listeners, su ticker, sus timelines).
 */
export function JourneyNav() {
  const pathname = usePathname();
  const current = stationFromPathname(pathname)?.slug ?? null;
  const layout = useNavLayout();

  return (
    <>
      <RadialSidebar current={current} active={layout === 'desktop'} />
      <MobileNav current={current} active={layout === 'mobile'} />
    </>
  );
}
