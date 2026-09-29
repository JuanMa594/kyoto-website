import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { StationSlug } from '@/config/journey';
import {
  QUALITY_PROFILES,
  resolveTier,
  type QualityProfile,
  type QualitySetting,
  type QualityTier,
} from '@/scene/quality/tiers';

/**
 * Estado global del viaje. Un único store: el camino, la calidad, el audio y la
 * accesibilidad están demasiado acoplados como para vivir separados (el modo 静
 * apaga ambiente *y* sonido, el tier bajo recorta partículas *y* postproceso).
 *
 * Sólo se persisten las preferencias explícitas de la persona, nunca el estado
 * del recorrido: al volver, el camino empieza donde diga la URL.
 */

interface KyotoState {
  /* ── Viaje ─────────────────────────────────────────────────────────── */
  /** La estación de la ruta: adónde va la cámara. La declara cada página. */
  activeStation: StationSlug;
  /**
   * La estación en cuyo tramo está la cámara: lo que se ve y se oye. Cambia a
   * ritmo humano, así que sí vive aquí; el avance fino vive en `PATH`
   * (`scene/path/journeyPath.ts`), que cambia a 60 fps.
   */
  zone: StationSlug;
  /**
   * Cuántas veces una página ha declarado su estación. La primera es el
   * aterrizaje —la cámara aparece allí, sin viaje—; las demás son viajes.
   */
  arrivals: number;
  setActiveStation: (slug: StationSlug) => void;
  setZone: (slug: StationSlug) => void;

  /* ── Calidad ───────────────────────────────────────────────────────── */
  detectedTier: QualityTier | null;
  /** Preferencia de la persona: 'auto' delega en la detección. */
  qualitySetting: QualitySetting;
  setDetectedTier: (tier: QualityTier) => void;
  setQualitySetting: (setting: QualitySetting) => void;

  /* ── Accesibilidad ─────────────────────────────────────────────────── */
  /** Lo que dice el sistema operativo (`prefers-reduced-motion`). */
  systemReducedMotion: boolean;
  /** Modo 静: decisión manual, independiente del sistema. */
  stillMode: boolean;
  setSystemReducedMotion: (value: boolean) => void;
  setStillMode: (value: boolean) => void;

  /* ── Audio ─────────────────────────────────────────────────────────── */
  /** Preferencia guardada. No implica que ya esté sonando. */
  audioEnabled: boolean;
  /** Los navegadores exigen un gesto antes de dejar sonar nada. */
  audioUnlocked: boolean;
  volume: number;
  setAudioEnabled: (value: boolean) => void;
  setAudioUnlocked: (value: boolean) => void;
  setVolume: (value: number) => void;

  /* ── Entrada ───────────────────────────────────────────────────────── */
  /** Última posición del cursor normalizada a −1…1. La lee el rig de cámara. */
  pointer: { x: number; y: number };
  setPointer: (x: number, y: number) => void;
  /** Marca de tiempo del último scroll: el director de fauna la usa para el modo inactivo. */
  lastScrollAt: number;
  markScroll: () => void;
}

type PersistedPrefs = Pick<
  KyotoState,
  'qualitySetting' | 'stillMode' | 'audioEnabled' | 'volume'
>;

export const useKyotoStore = create<KyotoState>()(
  persist(
    (set) => ({
      activeStation: 'inicio',
      zone: 'inicio',
      arrivals: 0,
      // La primera estación de la visita también fija la zona: así el ambiente
      // es el correcto antes incluso de que el canvas haya cargado.
      setActiveStation: (slug) =>
        set((s) => ({
          activeStation: slug,
          arrivals: s.arrivals + 1,
          zone: s.arrivals === 0 ? slug : s.zone,
        })),
      setZone: (slug) => set({ zone: slug }),

      detectedTier: null,
      qualitySetting: 'auto',
      setDetectedTier: (tier) => set({ detectedTier: tier }),
      setQualitySetting: (setting) => set({ qualitySetting: setting }),

      systemReducedMotion: false,
      stillMode: false,
      setSystemReducedMotion: (value) => set({ systemReducedMotion: value }),
      setStillMode: (value) => set({ stillMode: value }),

      // Por defecto el ambiente sonoro está armado, pero no suena hasta el
      // primer gesto: es lo máximo que permiten los navegadores y evita el
      // autoplay agresivo. Ver §9 del PLAN.
      audioEnabled: true,
      audioUnlocked: false,
      volume: 0.35,
      setAudioEnabled: (value) => set({ audioEnabled: value }),
      setAudioUnlocked: (value) => set({ audioUnlocked: value }),
      setVolume: (value) => set({ volume: Math.min(1, Math.max(0, value)) }),

      pointer: { x: 0, y: 0 },
      setPointer: (x, y) => set({ pointer: { x, y } }),
      lastScrollAt: 0,
      markScroll: () => set({ lastScrollAt: Date.now() }),
    }),
    {
      name: 'kyoto:prefs',
      version: 1,
      // Rehidratamos a mano desde <EnvironmentProbe> para que el HTML estático
      // y el primer render del cliente coincidan siempre.
      skipHydration: true,
      partialize: (state): PersistedPrefs => ({
        qualitySetting: state.qualitySetting,
        stillMode: state.stillMode,
        audioEnabled: state.audioEnabled,
        volume: state.volume,
      }),
    },
  ),
);

/* ── Selectores derivados ───────────────────────────────────────────────
   Se exportan como funciones puras para poder usarlos con `useKyotoStore(sel)`
   sin recrear objetos en cada render.                                      */

export const selectTier = (s: KyotoState): QualityTier =>
  resolveTier(s.qualitySetting, s.detectedTier);

export const selectProfile = (s: KyotoState): QualityProfile => QUALITY_PROFILES[selectTier(s)];

/**
 * La pregunta que se hace toda la escena: ¿puedo animar?
 * Falso si el sistema pide menos movimiento o si la persona activó el modo 静.
 */
export const selectMotionAllowed = (s: KyotoState): boolean =>
  !s.systemReducedMotion && !s.stillMode;

/** ¿Debe sonar algo ahora mismo? */
export const selectAudioAudible = (s: KyotoState): boolean =>
  s.audioEnabled && s.audioUnlocked && !s.stillMode;

/** Densidad efectiva de partículas: ambiente de la zona × tier × modo 静. */
export function selectParticleScale(s: KyotoState): number {
  if (s.stillMode) return 0;
  if (s.systemReducedMotion) return 0.15;
  return selectProfile(s).particleScale;
}
