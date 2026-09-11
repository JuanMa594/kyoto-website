/** Tailwind v4 se integra como plugin de PostCSS; no hay tailwind.config.js:
 *  los tokens viven en CSS (`src/styles/tokens.css`, bloque `@theme`). */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
