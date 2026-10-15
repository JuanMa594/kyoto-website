import type { StationIcon } from '@/config/journey';

import { buildFarol, FAROL } from './farol';
import { buildMapa, MAPA } from './mapa';
import { buildNaruto, NARUTO } from './naruto';
import { buildPagoda, PAGODA } from './pagoda';
import { buildSakura, SAKURA } from './sakura';
import { buildTorii, TORII } from './torii';
import type { IconName, IconShape } from './types';

/** La geometría de cada ícono, calculada una vez al importar. */
export const ICON_SHAPES: Readonly<Record<IconName, IconShape>> = {
  mapa: MAPA,
  sakura: SAKURA,
  torii: TORII,
  pagoda: PAGODA,
  farol: FAROL,
  naruto: NARUTO,
};

/** Las funciones que la producen: `check-nav.ts` las llama dos veces para comprobar el determinismo. */
export const ICON_BUILDERS: Readonly<Record<IconName, () => IconShape>> = {
  mapa: buildMapa,
  sakura: buildSakura,
  torii: buildTorii,
  pagoda: buildPagoda,
  farol: buildFarol,
  naruto: buildNaruto,
};

export function isIconName(icon: StationIcon): icon is IconName {
  return icon !== 'kanji';
}
