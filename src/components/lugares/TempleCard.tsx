'use client';

import { useEffect, useRef, useState } from 'react';

import { gsap, getLenis } from '@/animation/gsap';
import { CaminoFace, useCaminoHover } from '@/components/ui/CaminoButton';
import type { Side, StationSlug } from '@/config/journey';
import { PAN } from '@/scene/camera/pan';
import { ROMON_LIGHTS } from '@/scene/objects/romon/lights';
import { ROMON_SCREEN } from '@/scene/objects/romon/screen';
import { PATH, stationDepth } from '@/scene/path/journeyPath';
import { selectMotionAllowed, useKyotoStore } from '@/store/useKyotoStore';

import { GRECA_SIZE, grecaPath } from './greca';

export interface TempleTexts {
  readonly behold: string;
  readonly beholdLabel: string;
  readonly close: string;
  readonly kicker: string;
  readonly title: string;
  readonly body: string;
  readonly fichaLabel: string;
  readonly ficha: readonly { readonly label: string; readonly value: string }[];
  readonly greca: string;
}

/**
 * El monumento de un lugar, en el DOM (Fase 6A): el botón «Contemplar el
 * rōmon» del cartel, la zona que se toca sobre la puerta en la escena y la
 * tarjeta del templo. Comparten un único estado: abierta o cerrada.
 *
 * Al abrirla, la cámara se vuelve un poco hacia el monumento (`PAN`, sólo con
 * movimiento y la cámara asentada en la estación) y los chōchin se encienden
 * (`ROMON_LIGHTS`); al cerrarla, todo vuelve. La tarjeta es un `<dialog>` que
 * **está siempre en el HTML** —cerrado— con su texto y su ficha: la leen los
 * buscadores y los lectores de pantalla. Sin WebGL, el botón y la tarjeta
 * funcionan igual; la zona que se toca no aparece.
 */
export function TempleCard({ station, side, accent, texts }: { station: StationSlug; side: Side; accent: string; texts: TempleTexts }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const hit = useRef<HTMLButtonElement>(null);
  const hover = useCaminoHover(accent);

  // Abrir y cerrar el <dialog>, el paneo y los faroles.
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
      getLenis()?.stop();
    } else if (!open && node.open) {
      node.close();
    }
    const motion = selectMotionAllowed(useKyotoStore.getState());
    PAN.wanted = open && motion ? (side === 'izquierda' ? -1 : 1) : 0;
    ROMON_LIGHTS.lit = open;
    ROMON_LIGHTS.wake();
  }, [open, side]);

  // Cerrar con Escape, con el botón o tocando fuera: el evento `close` del dialog.
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const closed = () => {
      getLenis()?.start();
      setOpen(false);
    };
    node.addEventListener('close', closed);
    return () => {
      node.removeEventListener('close', closed);
      if (node.open) node.close();
      getLenis()?.start();
      PAN.wanted = 0;
      ROMON_LIGHTS.lit = false;
      ROMON_LIGHTS.wake();
    };
  }, []);

  // La zona que se toca: sobre el monumento proyectado, sólo con la cámara en la estación.
  useEffect(() => {
    const node = hit.current;
    if (!node) return;
    let last = '';
    const tick = () => {
      const here = PATH.live && Math.abs(PATH.d - stationDepth(station)) < 2 && ROMON_SCREEN.on;
      const rect = ROMON_SCREEN;
      const key = here ? `${rect.x.toFixed(0)},${rect.y.toFixed(0)},${rect.w.toFixed(0)},${rect.h.toFixed(0)}` : 'off';
      if (key === last) return;
      last = key;
      node.dataset.on = here ? 'on' : 'off';
      if (!here) return;
      node.style.transform = `translate3d(${rect.x.toFixed(0)}px, ${rect.y.toFixed(0)}px, 0)`;
      node.style.width = `${rect.w.toFixed(0)}px`;
      node.style.height = `${rect.h.toFixed(0)}px`;
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [station]);

  return (
    <>
      <button type="button" className="paper camino-button cartel-button" onClick={() => setOpen(true)} {...hover.props}>
        <CaminoFace icon="torii" label={texts.behold} active={hover.active} />
      </button>

      {/* Sobre la puerta, en la escena: el mismo gesto que el botón. */}
      <button
        ref={hit}
        type="button"
        className="landmark-hit"
        data-on="off"
        tabIndex={-1}
        aria-label={texts.beholdLabel}
        onClick={() => setOpen(true)}
      />

      <dialog
        ref={dialog}
        className="kosatsu-reader temple-reader"
        aria-labelledby={`temple-${station}-title`}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="kosatsu-reader__sheet paper" data-map="off" style={{ '--greca': accent } as React.CSSProperties}>
          <svg className="temple-reader__greca" viewBox={`0 0 ${GRECA_SIZE} ${GRECA_SIZE}`} role="img" aria-label={texts.greca}>
            <path d={grecaPath()} />
          </svg>
          <div className="kosatsu-reader__text">
            <p className="temple-reader__kicker">{texts.kicker}</p>
            <h2 id={`temple-${station}-title`} className="kosatsu-reader__title">
              {texts.title}
            </h2>
            <p className="kosatsu-reader__body">{texts.body}</p>
            <dl className="temple-ficha" aria-label={texts.fichaLabel}>
              {texts.ficha.map((item) => (
                <div key={item.label} className="temple-ficha__row">
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <button type="button" className="kosatsu-reader__close" onClick={() => dialog.current?.close()}>
            {texts.close}
          </button>
        </div>
      </dialog>
    </>
  );
}
