import type { StationIcon } from '@/config/journey';

/**
 * Los íconos del sidebar (Fase 3C) son geometría calculada, no dibujos: cada
 * uno es una función pura que devuelve sus capas en el viewBox −1…1, con la y
 * hacia abajo, como el propio SVG. `StationIcon` las vuelca en un `<svg>`.
 */
export interface IconLayer {
  /** Path calculado, con 3 decimales. */
  readonly d: string;
  /** Siempre `var(--color-…)` de `tokens.css`: la paleta no se duplica en TS. */
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  /** `stroke-dasharray`, en unidades del viewBox. */
  readonly dash?: string;
  readonly opacity?: number;
  /**
   * Gancho de su microanimación: se vuelca como `data-part`. Puede llevar
   * varias palabras («lantern glow»); se buscan con `[data-part~="…"]`.
   */
  readonly part?: string;
}

export type IconShape = readonly IconLayer[];

/** Los seis íconos con dibujo. `kanji` —la Home— es texto: 京都. */
export type IconName = Exclude<StationIcon, 'kanji'>;
