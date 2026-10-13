import type { ScenePalette } from '@/lib/css-vars';

import type { Region } from './prefectures.generated';

/**
 * El color de cada región de la maqueta (Fase 5A), como en los mapas de la
 * época Edo, que pintaban cada provincia con un tono suave. Sólo tonos de la
 * paleta (`tokens.css`), aclarados con blanco (`white`, 0–1) para que la
 * maqueta siga siendo de papel. Kinki va en blanco: así Kyoto (shu) y el pin
 * destacan, y en el zoom la región queda limpia. Las vecinas no repiten tono.
 */
export const REGION_TONE: Record<Region, { readonly token: keyof ScenePalette; readonly white: number }> = {
  Hokkaido: { token: 'bambuPale', white: 0.4 },
  Tohoku: { token: 'matchaSoft', white: 0.35 },
  Kanto: { token: 'sakuraPale', white: 0.15 },
  Chubu: { token: 'kohaku', white: 0.5 },
  Kinki: { token: 'kami', white: 0 },
  Chugoku: { token: 'sakuraBlush', white: 0.4 },
  Shikoku: { token: 'washiDeep', white: 0 },
  Kyushu: { token: 'bambuPale', white: 0.4 },
};
