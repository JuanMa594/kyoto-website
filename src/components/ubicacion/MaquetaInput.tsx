'use client';

import { gsap } from 'gsap';
import { useEffect } from 'react';

import { MAQUETA } from '@/scene/objects/maqueta/input';
import { useKyotoStore } from '@/store/useKyotoStore';

/**
 * Lo que no cuenta como tocar la maqueta: lo que ya es interactivo en el DOM,
 * las tarjetas del tramo y la navegación.
 */
const NOT_THE_MAP =
  'a, button, input, select, textarea, label, summary, [role="button"], [role="dialog"], nav, .mnav, .tramo-card';

/**
 * La mano sobre la maqueta (Fase 5A). El canvas no captura el puntero: aquí
 * se escucha en `window` y se deja en `MAQUETA`, de donde lo lee la escena.
 * El clic —no `pointerdown`: el navegador no dispara `click` cuando un toque
 * era para desplazarse— se encola; Escape deshace el zoom; la mano aparece
 * cuando la escena dice que el cursor está sobre Kyoto.
 *
 * Al desmontarse (al irse de Ubicación) deja todo como estaba: sin zoom, sin
 * mano y sin clics pendientes. No pinta nada.
 */
export function MaquetaInput() {
  useEffect(() => {
    const toNdc = (clientX: number, clientY: number) => ({
      x: (clientX / window.innerWidth) * 2 - 1,
      y: -(clientY / window.innerHeight) * 2 + 1,
    });

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const { x, y } = toNdc(event.clientX, event.clientY);
      MAQUETA.pointer.x = x;
      MAQUETA.pointer.y = y;
      MAQUETA.pointer.present = true;
      MAQUETA.pointer.moved = true;
      MAQUETA.wake();
    };
    const onLeave = (event: MouseEvent) => {
      if (event.relatedTarget) return;
      MAQUETA.pointer.present = false;
      MAQUETA.pointer.moved = true;
      MAQUETA.wake();
    };
    // Safari no pone `pointerType` en el clic: se toma del último pointerdown.
    let lastPointer = 'mouse';
    const onDown = (event: PointerEvent) => {
      lastPointer = event.pointerType;
    };
    const onClick = (event: MouseEvent) => {
      // Sin escena viva (sin WebGL, o aún cargando) no hay nada que tocar.
      if (event.button !== 0 || !MAQUETA.active) return;
      if (event.target instanceof Element && event.target.closest(NOT_THE_MAP)) return;
      const { x, y } = toNdc(event.clientX, event.clientY);
      const pointerType = (event as PointerEvent).pointerType || lastPointer;
      MAQUETA.clicks.push({ x, y, touch: pointerType === 'touch' || pointerType === 'pen' });
      MAQUETA.wake();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') useKyotoStore.getState().setMapZoom('japon');
    };

    let hand = false;
    const tick = () => {
      if (MAQUETA.overKyoto === hand) return;
      hand = MAQUETA.overKyoto;
      document.documentElement.style.cursor = hand ? 'pointer' : '';
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('mouseout', onLeave);
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey);
    gsap.ticker.add(tick);

    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseout', onLeave);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKey);
      gsap.ticker.remove(tick);
      document.documentElement.style.cursor = '';
      MAQUETA.clicks.length = 0;
      MAQUETA.pointer.present = false;
      useKyotoStore.getState().setMapZoom('japon');
    };
  }, []);

  return null;
}
