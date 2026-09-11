import { DEFAULT_LOCALE } from '@/config/journey';

/**
 * 404 global. Vive fuera de `[locale]`, así que —como el portero de idioma—
 * se pinta su propio documento y no puede usar traducciones del servidor:
 * a esta altura del árbol todavía no se sabe en qué idioma está la persona.
 */
export default function NotFound() {
  return (
    <html lang={DEFAULT_LOCALE}>
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeContent: 'center',
          gap: '0.75rem',
          textAlign: 'center',
          background: '#fffacd',
          color: '#300500',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <p style={{ fontSize: '3rem', margin: 0 }}>迷</p>
        <p style={{ margin: 0, opacity: 0.75 }}>
          Te saliste del camino. · You stepped off the path.
        </p>
        <p style={{ margin: 0 }}>
          <a href={`/${DEFAULT_LOCALE}/`} style={{ color: '#d82609' }}>
            Volver al inicio
          </a>
        </p>
      </body>
    </html>
  );
}
