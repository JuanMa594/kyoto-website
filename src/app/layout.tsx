import type { ReactNode } from 'react';

/**
 * Layout raíz deliberadamente vacío.
 *
 * El `<html>` de verdad lo pone `app/[locale]/layout.tsx`, porque sólo ahí se
 * conoce el idioma y se puede escribir `lang` correctamente. La única ruta que
 * vive fuera del idioma es `/`, y esa se pinta su propio documento.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
