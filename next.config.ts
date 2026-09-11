import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // El sitio es 100 % estático: no hay servidor, no hay middleware.
  // Por eso el idioma se resuelve por ruta (/es, /en) y no por cabeceras.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,

  // Los shaders GLSL se escriben inline como template strings (ver src/scene),
  // así que no hace falta loader extra. Si algún día se externalizan a .glsl,
  // el loader entra aquí.
};

export default withNextIntl(nextConfig);
