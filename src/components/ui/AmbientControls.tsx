'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { selectAudioAudible, useKyotoStore } from '@/store/useKyotoStore';

/**
 * Los dos interruptores del ambiente: el sonido y el modo 静.
 *
 * Discreto a propósito —dos glifos en una esquina—, pero **siempre visible**:
 * el PLAN exige que no haya sonido sin un mando a la vista, y que el modo quieto
 * esté al alcance sin entrar en ningún menú.
 *
 * Los iconos son los propios kanji, 音 y 静, que ya viajan en la fuente
 * subseteada porque salen de `journey.ts`. No hace falta ni un SVG.
 *
 * Es DOM real, con botones de verdad: se llega por teclado, se anuncia su
 * estado con `aria-pressed` y funciona igual con el canvas apagado.
 */
export function AmbientControls() {
  const t = useTranslations('ui');

  // El store se rehidrata en un efecto; hasta entonces no se pinta el estado
  // para que el HTML estático y el primer render del cliente coincidan.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const audioEnabled = useKyotoStore((s) => s.audioEnabled);
  const setAudioEnabled = useKyotoStore((s) => s.setAudioEnabled);
  const audible = useKyotoStore(selectAudioAudible);
  const stillMode = useKyotoStore((s) => s.stillMode);
  const setStillMode = useKyotoStore((s) => s.setStillMode);

  if (!mounted) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-40 flex gap-2"
      // El canvas vive detrás de todo el DOM; esta isla sí recibe el puntero,
      // pero sólo ella.
    >
      <button
        type="button"
        onClick={() => setAudioEnabled(!audioEnabled)}
        aria-pressed={audioEnabled}
        aria-label={audioEnabled ? t('audioOff') : t('audioOn')}
        title={`${t('audio')} — ${audible ? t('audioOff') : t('audioOn')}`}
        className="paper pointer-events-auto relative grid h-11 w-11 place-items-center rounded-full transition-[opacity,transform] duration-200 hover:-translate-y-0.5"
        style={{ opacity: audioEnabled ? 1 : 0.55 }}
      >
        <span className="kanji text-[1.2rem] leading-none" aria-hidden="true">
          音
        </span>
        {/* Tachado cuando está apagado: el estado tiene que verse, no sólo
            leerse con un lector de pantalla. */}
        {!audioEnabled && (
          <span
            aria-hidden="true"
            className="absolute h-[1.6rem] w-px rotate-45 bg-[color:var(--color-sumi)] opacity-70"
          />
        )}
      </button>

      <button
        type="button"
        onClick={() => setStillMode(!stillMode)}
        aria-pressed={stillMode}
        aria-label={t('stillMode')}
        title={`${t('stillMode')} — ${t('stillModeHint')}`}
        className="paper pointer-events-auto grid h-11 w-11 place-items-center rounded-full transition-[opacity,transform] duration-200 hover:-translate-y-0.5"
        style={{
          opacity: stillMode ? 1 : 0.55,
          background: stillMode ? 'var(--color-sumi)' : undefined,
          color: stillMode ? 'var(--color-washi)' : undefined,
        }}
      >
        <span className="kanji text-[1.2rem] leading-none" aria-hidden="true">
          静
        </span>
      </button>
    </div>
  );
}
