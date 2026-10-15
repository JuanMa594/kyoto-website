'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { LanguageToggle } from '@/components/nav/LanguageToggle';
import { selectAudioAudible, useKyotoStore } from '@/store/useKyotoStore';

/** El botón redondo de papel de los tres mandos. */
const BUTTON =
  'paper pointer-events-auto relative grid h-11 w-11 place-items-center rounded-full transition-[opacity,transform] duration-200 hover:-translate-y-0.5';

/**
 * Los tres mandos: el sonido, el modo 静 y el idioma.
 *
 * Discretos a propósito —tres glifos—, pero **siempre visibles**: el PLAN exige
 * que no haya sonido sin un mando a la vista, y que el modo quieto esté al
 * alcance sin entrar en ningún menú.
 *
 * Dos variantes, que se renderizan las dos y el CSS decide cuál se ve
 * (Fase 3C): `corner`, en la esquina inferior derecha del escritorio, y `bar`,
 * dentro de la barra de la navegación móvil (`MobileNav`).
 *
 * Los iconos de sonido y quietud son los propios kanji, 音 y 静, que ya viajan
 * en la fuente subseteada. Es DOM real, con botones de verdad: se llega por
 * teclado, se anuncia su estado con `aria-pressed` y funciona igual con el
 * canvas apagado.
 */
export function AmbientControls({ variant }: { variant: 'corner' | 'bar' }) {
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

  const buttons = (
    <>
      <button
        type="button"
        onClick={() => setAudioEnabled(!audioEnabled)}
        aria-pressed={audioEnabled}
        aria-label={audioEnabled ? t('audioOff') : t('audioOn')}
        title={`${t('audio')} — ${audible ? t('audioOff') : t('audioOn')}`}
        className={BUTTON}
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
        className={BUTTON}
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

      <LanguageToggle className={BUTTON} />
    </>
  );

  if (variant === 'bar') return <div className="flex shrink-0 gap-1.5">{buttons}</div>;

  return (
    // El canvas vive detrás de todo el DOM; esta isla sí recibe el puntero,
    // pero sólo ella.
    <div className="ambient-corner pointer-events-none fixed right-4 bottom-4 z-40 flex gap-2">{buttons}</div>
  );
}
