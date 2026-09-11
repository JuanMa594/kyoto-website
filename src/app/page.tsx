import { DEFAULT_LOCALE, LOCALES } from '@/config/journey';

/**
 * Portero de idioma en `/`.
 *
 * En export estático no hay middleware ni redirecciones de servidor, así que la
 * elección de idioma ocurre aquí, en el cliente, con un script mínimo y
 * síncrono: mira el idioma del navegador y reemplaza la URL antes de pintar
 * nada. Sin JavaScript, el `<noscript>` manda al idioma por defecto.
 *
 * Esta página nunca se ve: es un salto, no una pantalla.
 */

const ALLOWED = LOCALES.join('|');

const REDIRECT_SCRIPT = `
(function () {
  try {
    var supported = ${JSON.stringify(LOCALES)};
    var fallback = ${JSON.stringify(DEFAULT_LOCALE)};
    var prefs = navigator.languages || [navigator.language || fallback];
    var target = fallback;
    for (var i = 0; i < prefs.length; i++) {
      var tag = String(prefs[i]).toLowerCase().split('-')[0];
      if (supported.indexOf(tag) !== -1) { target = tag; break; }
    }
    location.replace('/' + target + '/');
  } catch (e) {
    location.replace('/${DEFAULT_LOCALE}/');
  }
})();
`.trim();

export const metadata = {
  title: 'Kyoto',
  robots: { index: false, follow: true },
};

export default function LocaleGate() {
  return (
    <html lang={DEFAULT_LOCALE} data-locale-gate={ALLOWED}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: REDIRECT_SCRIPT }} />
        <noscript>
          <meta httpEquiv="refresh" content={`0; url=/${DEFAULT_LOCALE}/`} />
        </noscript>
      </head>
      <body style={{ margin: 0, background: '#fffacd' }}>
        <noscript>
          <p style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
            <a href={`/${DEFAULT_LOCALE}/`}>Kyoto — 京都</a>
          </p>
        </noscript>
      </body>
    </html>
  );
}
