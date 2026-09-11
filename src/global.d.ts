import type messages from './messages/es.json';
import type { routing } from './i18n/routing';

/**
 * Mensajes tipados: `t('nav.goTo')` autocompleta y una clave inexistente es un
 * error de compilación, no una cadena rara en pantalla. El español es la
 * referencia; si `en.json` se desfasa, se nota al tipar.
 */
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
