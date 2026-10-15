'use client';

import { useEffect, useState } from 'react';

import { stoneOutline } from '@/components/nav/icons/stone';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

/**
 * La invitación a caminar: tres piedrecitas —las del riel— que aparecen una
 * tras otra hacia abajo, en un bucle lento, junto a «Desliza para caminar».
 * Se desvanece en cuanto se empieza a caminar. Con 静 o movimiento reducido
 * se queda quieta.
 */
export function WalkHint({ label }: { label: string }) {
  const motionAllowed = useKyotoStore(selectMotionAllowed);
  const [walking, setWalking] = useState(false);

  useEffect(() => {
    const update = () => setWalking(window.scrollY > 48);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <p
      className="walk-hint brush"
      data-cartel-late=""
      data-walking={walking ? '' : undefined}
      data-motion={motionAllowed ? 'on' : 'off'}
    >
      <span className="walk-hint__stones" aria-hidden="true">
        {[3, 5, 8].map((seed, i) => (
          <svg key={seed} viewBox="-1 -1 2 2" className="walk-hint__stone" style={{ animationDelay: `${i * 0.45}s` }}>
            <path d={stoneOutline(seed)} />
          </svg>
        ))}
      </span>
      <span>{label}</span>
    </p>
  );
}
