'use client';

import { useState, type CSSProperties, type FocusEvent, type PointerEvent } from 'react';

import { StationIcon } from '@/components/nav/StationIcon';
import type { IconName } from '@/components/nav/icons/types';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

/**
 * Los botones del camino (5B): el ícono de su estación a la izquierda y el
 * texto. Al pasar por encima o con el foco del teclado, el ícono se desliza al
 * centro, crece y hace su microanimación —la rama de sakura se mece y suelta un
 * pétalo, el farol se enciende—, y el texto se desvanece; al pulsar, el botón
 * se hunde un poco. El color de la estación lo pone el ícono, no un filo, y la
 * tinta que empapa el botón al pasar por encima es la de la estación a la que
 * lleva (`accent` de `journey.ts`: rosa sakura hacia Eventos, bermellón de
 * torii hacia Fushimi). Sólo al pasar: en reposo, el botón es gofun.
 *
 * Sin movimiento (modo 静 o `prefers-reduced-motion`) el ícono se queda en su
 * sitio y el texto no se va (`data-motion` en el CSS de `.camino-button`).
 *
 * `useCaminoHover` da el estado y los manejadores para el `<button>` o el
 * `<Link>` que la lleva; `CaminoFace` es lo de dentro.
 */
export function useCaminoHover(accent?: string) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const motionAllowed = useKyotoStore(selectMotionAllowed);
  return {
    active: hovered || focused,
    props: {
      'data-motion': motionAllowed ? 'on' : 'off',
      // La tinta del hover, del color de la estación de destino (globals.css).
      ...(accent ? { 'data-accent': '', style: { '--camino-tinta': accent } as CSSProperties } : {}),
      onPointerEnter: (event: PointerEvent) => {
        if (event.pointerType === 'mouse') setHovered(true);
      },
      onPointerLeave: () => setHovered(false),
      // Sólo el foco del teclado: el de un clic no debe dejar el ícono en el centro.
      onFocus: (event: FocusEvent<HTMLElement>) => setFocused(event.currentTarget.matches(':focus-visible')),
      onBlur: () => setFocused(false),
    },
  };
}

export function CaminoFace({ icon, label, active }: { icon: IconName; label: string; active: boolean }) {
  return (
    <>
      <span className="camino-button__icon" aria-hidden="true">
        <StationIcon icon={icon} active={active} />
      </span>
      <span className="camino-button__label">{label}</span>
    </>
  );
}
