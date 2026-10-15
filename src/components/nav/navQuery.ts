'use client';

import { useEffect, useState } from 'react';

/**
 * Cuándo manda la navegación móvil: pantallas estrechas **y** cualquier
 * pantalla táctil sin hover —un iPad en horizontal—, porque el riel se
 * despliega al acercar el cursor al borde y con el dedo eso no existe.
 *
 * El mismo corte vive en `globals.css` (`.rail`, `.mnav`, `.ambient-corner`):
 * si cambia aquí, cambia allí.
 */
export const NAV_MOBILE_QUERY = '(max-width: 767px), (hover: none) and (pointer: coarse)';

/**
 * Qué navegación está a la vista. `null` antes de montar: el HTML estático
 * trae las dos y el CSS elige, así que nada salta al hidratar.
 */
export function useNavLayout(): 'mobile' | 'desktop' | null {
  const [layout, setLayout] = useState<'mobile' | 'desktop' | null>(null);

  useEffect(() => {
    const query = window.matchMedia(NAV_MOBILE_QUERY);
    const sync = () => setLayout(query.matches ? 'mobile' : 'desktop');
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return layout;
}
