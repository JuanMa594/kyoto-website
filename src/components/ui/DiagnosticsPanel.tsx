'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import type { QualitySetting } from '@/scene/quality/tiers';
import {
  selectAudioAudible,
  selectMotionAllowed,
  selectParticleScale,
  selectProfile,
  selectTier,
  useKyotoStore,
} from '@/store/useKyotoStore';

/**
 * Panel de diagnóstico. No es una página del sitio: es el instrumento con el
 * que se comprueba que los cimientos de la Fase 1 están vivos — detección de
 * tier, override manual, reduced-motion, modo 静, estado del audio y estación
 * activa. En la Fase 9 se recicla como panel de preferencias real.
 */

const SETTINGS: QualitySetting[] = ['auto', 'high', 'medium', 'low'];

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-[color:var(--border-hairline)] py-2">
      <dt className="text-sm opacity-65">{label}</dt>
      <dd className="text-right font-mono text-sm">{value}</dd>
    </div>
  );
}

export function DiagnosticsPanel() {
  const t = useTranslations('ui');

  // El store se rehidrata en un efecto, así que el primer render del cliente
  // debe coincidir con el HTML estático. Hasta que no esté montado, no se
  // pinta nada del store.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const detectedTier = useKyotoStore((s) => s.detectedTier);
  const qualitySetting = useKyotoStore((s) => s.qualitySetting);
  const setQualitySetting = useKyotoStore((s) => s.setQualitySetting);
  const tier = useKyotoStore(selectTier);
  const profile = useKyotoStore(selectProfile);
  const systemReducedMotion = useKyotoStore((s) => s.systemReducedMotion);
  const stillMode = useKyotoStore((s) => s.stillMode);
  const setStillMode = useKyotoStore((s) => s.setStillMode);
  const audioEnabled = useKyotoStore((s) => s.audioEnabled);
  const setAudioEnabled = useKyotoStore((s) => s.setAudioEnabled);
  const audioUnlocked = useKyotoStore((s) => s.audioUnlocked);
  const motionAllowed = useKyotoStore(selectMotionAllowed);
  const audible = useKyotoStore(selectAudioAudible);
  const particleScale = useKyotoStore(selectParticleScale);
  const activeStation = useKyotoStore((s) => s.activeStation);

  if (!mounted) {
    return <p className="paper px-5 py-4 text-sm opacity-70">{t('loading')}</p>;
  }

  return (
    <div className="grid gap-6">
      <section className="paper px-5 py-4">
        <h2 className="mb-2 text-lg">Escena</h2>
        <dl>
          <Row label="Estación activa" value={activeStation} />
          <Row label="Tier detectado" value={detectedTier ?? '—'} />
          <Row label="Tier efectivo" value={tier} />
          <Row label="DPR" value={`${profile.dpr[0]} – ${profile.dpr[1]}`} />
          <Row label="Antialias" value={String(profile.antialias)} />
          <Row label="Sombras" value={String(profile.shadows)} />
          <Row label="Postproceso" value={String(profile.postprocessing)} />
          <Row label="Escala de partículas" value={particleScale.toFixed(2)} />
          <Row label="Bucle de render" value={motionAllowed ? 'always' : 'demand'} />
        </dl>
      </section>

      <section className="paper px-5 py-4">
        <h2 className="mb-3 text-lg">{t('quality')}</h2>
        <div className="flex flex-wrap gap-2">
          {SETTINGS.map((setting) => (
            <button
              key={setting}
              type="button"
              onClick={() => setQualitySetting(setting)}
              aria-pressed={qualitySetting === setting}
              className="rounded-lg border border-[color:var(--border-hairline)] px-3 py-1.5 text-sm transition-colors aria-pressed:bg-[color:var(--color-sumi)] aria-pressed:text-[color:var(--color-washi)]"
            >
              {setting === 'auto'
                ? t('qualityAuto')
                : setting === 'high'
                  ? t('qualityHigh')
                  : setting === 'medium'
                    ? t('qualityMedium')
                    : t('qualityLow')}
            </button>
          ))}
        </div>
      </section>

      <section className="paper px-5 py-4">
        <h2 className="mb-2 text-lg">Accesibilidad y sonido</h2>
        <dl>
          <Row label="prefers-reduced-motion" value={String(systemReducedMotion)} />
          <Row label="Audio desbloqueado (gesto)" value={String(audioUnlocked)} />
          <Row label="Suena ahora mismo" value={String(audible)} />
        </dl>

        <div className="mt-4 flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={stillMode}
              onChange={(event) => setStillMode(event.target.checked)}
            />
            {t('stillMode')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={audioEnabled}
              onChange={(event) => setAudioEnabled(event.target.checked)}
            />
            {t('audio')}
          </label>
        </div>
        <p className="mt-3 text-xs opacity-55">{t('stillModeHint')}</p>
      </section>
    </div>
  );
}
