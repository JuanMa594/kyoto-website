import { defineRouting } from 'next-intl/routing';

import { DEFAULT_LOCALE, LOCALES } from '@/config/journey';

/**
 * El sitio es export estático: no hay middleware que negocie el idioma por
 * cabeceras. Por eso `localePrefix: 'always'` — cada idioma es una carpeta real
 * (`/es/`, `/en/`) y la raíz `/` sólo hace de portero (ver `src/app/page.tsx`).
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
});
