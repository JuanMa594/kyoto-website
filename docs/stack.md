# Stack

Lo que el proyecto usa de verdad. Las versiones salen de `package.json`; las
razones de cada decisión, de [`PLAN.md`](PLAN.md) §4.

## Lenguaje, framework y runtime

| Capa | Elección | Notas |
|---|---|---|
| Lenguaje | **TypeScript 5.9** | Todo el código, incluidos `scripts/`. Identificadores en inglés. |
| Framework | **Next.js 16** (App Router) | `output: 'export'` → sitio 100 % estático, sin servidor ni middleware. `trailingSlash: true`, imágenes sin optimizar. |
| UI | **React 19.2.8** | Clavado: `@react-three/fiber@9.7` declara `react: >=19 <19.3`. |
| i18n | **next-intl 4** | Idioma por ruta (`/es`, `/en`); slugs en español. |
| Estado | **Zustand 5** | Sólo lo que cambia a ritmo humano (estación, zona, calidad, a11y, audio). Viento y parallax son objetos mutables de módulo. |
| Estilos | **Tailwind CSS 4** (`@tailwindcss/postcss`) | Paleta y ritmo en `src/styles/tokens.css` (`@theme`); la escena 3D los lee en caliente. |
| Runtime y gestor de paquetes | **Bun** | En este equipo no hay Node: `bun` / `bunx`, nunca `npm` / `npx`. Lockfile: `bun.lock`. |

Next y React son los únicos candidatos del `stack.md` original que se
quedaron: Astro y Remix se descartaron.

## Escena 3D

| Librería | Versión | Para qué |
|---|---|---|
| **three** | 0.185.1 | Motor 3D. Casa con `@types/three@0.185.4`. |
| **@react-three/fiber** | 9.7.0 | Un único `<Canvas>` persistente en el layout (`SceneRoot`). |
| **@react-three/drei** | 10.7.8 | Utilidades de R3F. |
| **@react-three/postprocessing** + **postprocessing** | 3.1.1 / 6.39.5 | Profundidad de campo (sólo tier alto). |
| **GLSL** (a mano) | — | Shaders inline como template strings: viento, pétalos, cartel de washi, musgo, maqueta, fauna. Ni `tsc` ni el build los compilan: se validan en un WebGL2 real. |

Los visuales se generan por código (geometría procedural, shaders). Los
modelos de fauna son `.glb` CC0 optimizados por pipeline (`public/models/`).

## Animación y scroll

| Librería | Versión | Para qué |
|---|---|---|
| **GSAP** + **ScrollTrigger** | 3.15.0 | Orquestador único: scroll del camino, viaje de cámara, microanimaciones, trazos de los kanji. |
| **Lenis** | 1.3.26 | Smooth scroll. Sin bucle propio (`autoRaf: false`): lo hace avanzar `gsap.ticker`, un solo `requestAnimationFrame`. |
| **Web Audio API** | nativa | Ambiente sonoro sintetizado (lechos, eventos, voces de fauna). Sin archivos de audio. |

**Anime.js, PIXI.js, Motion y Lottie no están instalados.** Anime.js se
solapa con GSAP; PIXI queda como candidata acotada a gastronomía (Fase 8) y, de
entrar, exige desmontar antes el canvas de R3F; Lottie se descartó en la
Fase 2 (la fauna es procedural).

## Pipelines de assets (`scripts/`, en devDependencies)

| Comando | Herramientas | Salida |
|---|---|---|
| `bun run fonts` | `subset-fonts` (`subset-font`) | `.woff2` subseteados en `src/styles/generated/` |
| `bun run models` | `@gltf-transform/*` 4.3, `meshoptimizer` 1.3 | `assets/models/source` → `public/models` |
| `bun run geo` | `topojson-client` / `-server` / `-simplify`, `clipper-lib` | Japón y prefecturas de la maqueta de Ubicación |
| `bun run maps` | `sharp` | Mapas antiguos → `public/maps/{japon,heian}.{svg,webp}` |
| `bun run kanji` | KanjiVG (CC BY-SA 3.0) | `components/kanji/strokes.generated.ts` |
| `bun run palette` | `sharp` | Colores muestreados de `docs/referencias/*.png` |

## Tipografía

Tres familias servidas en local con `next/font/local` (sin Google Fonts):
**One Jinja** (titulares), **Gaze Nozarashi** (lectura) y **Zen Old Mincho**
(kanji). Licencias en `assets/fonts/LICENSES.md`.

## Comandos

```bash
bun install          # dependencias
bun run dev          # desarrollo → http://localhost:3000
bun run build        # export estático a out/
bun run preview      # sirve out/ (bunx --bun serve out)
bun run typecheck    # tsc --noEmit
bun run check:path   # comprobaciones puras: camino, fauna, navegación, decoración, valle
```

## Despliegue

Export estático (`out/`) servible desde cualquier hosting de ficheros. El
destino concreto se decide en la Fase 9.
