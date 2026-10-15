'use client';

import { gsap } from 'gsap';
import { useEffect, useRef } from 'react';

import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

import { ICON_SHAPES } from './icons';
import { iconMotion, type IconMotion } from './icons/hover';
import type { IconName } from './icons/types';

/**
 * Un ícono de estación: vuelca su geometría calculada (`icons/`) en un `<svg>`
 * decorativo —el nombre accesible lo pone el enlace que lo contiene— y, con
 * `active`, reproduce su microanimación. Sin movimiento permitido (modo 静,
 * `prefers-reduced-motion`) no se crea ninguna.
 */
export function StationIcon({
  icon,
  active,
  className,
}: {
  icon: IconName;
  active: boolean;
  className?: string;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const motion = useRef<IconMotion | null>(null);
  const wasActive = useRef(false);
  const motionAllowed = useKyotoStore(selectMotionAllowed);

  useEffect(() => {
    const node = svg.current;
    if (!node || !motionAllowed) return;
    const created = iconMotion(icon, node);
    motion.current = created;
    return () => {
      created.kill();
      motion.current = null;
      wasActive.current = false;
      gsap.set(node.querySelectorAll('[data-part]'), { clearProps: 'all' });
    };
  }, [icon, motionAllowed]);

  useEffect(() => {
    if (active === wasActive.current) return;
    wasActive.current = active;
    if (active) motion.current?.enter();
    else motion.current?.leave();
  }, [active]);

  return (
    <svg ref={svg} viewBox="-1 -1 2 2" aria-hidden="true" focusable="false" className={className}>
      {ICON_SHAPES[icon].map((layer, i) => (
        <path
          key={i}
          d={layer.d}
          fill={layer.fill ?? 'none'}
          stroke={layer.stroke}
          strokeWidth={layer.strokeWidth}
          strokeDasharray={layer.dash}
          strokeDashoffset={layer.dash ? 0 : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={layer.opacity}
          data-part={layer.part}
        />
      ))}
    </svg>
  );
}
