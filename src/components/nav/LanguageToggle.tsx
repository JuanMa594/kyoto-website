'use client';

import { useLocale, useTranslations } from 'next-intl';

import { LOCALES, localeHref } from '@/config/journey';
import { usePathname } from '@/i18n/navigation';

/**
 * ES ⇄ EN. Lleva a la misma estación en el otro idioma: los slugs son iguales
 * en los dos (decidido en la Fase 3), así que la ruta no se traduce.
 *
 * Es la única navegación interna que **no** usa el `<Link>` de
 * `@/i18n/navigation`, a propósito: cambiar de idioma monta de nuevo el layout
 * de `[locale]`, y con él el `<Canvas>`. R3F tarda 500 ms en liberar el
 * contexto WebGL de un canvas desmontado, así que con una navegación de cliente
 * el viejo y el nuevo convivían medio segundo (regla dura 3). Con un `<a>`
 * normal la página entera se descarta y el contexto muere con ella. Se aterriza
 * en la misma estación, sin viaje.
 *
 * Se etiqueta en su propio idioma («English», `lang="en"`), como piden las
 * pautas de accesibilidad: quien no lee el idioma actual tiene que poder
 * encontrar el suyo.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations('ui');
  const other = LOCALES.find((candidate) => candidate !== locale) ?? locale;
  const label = other === 'es' ? t('languageEs') : t('languageEn');

  return (
    <a
      href={localeHref(pathname, other)}
      hrefLang={other}
      lang={other}
      aria-label={label}
      title={label}
      className={className}
    >
      <span className="nav-latin" aria-hidden="true">
        {other.toUpperCase()}
      </span>
    </a>
  );
}
