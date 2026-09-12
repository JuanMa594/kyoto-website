@AGENTS.md

# Kyoto — guía del proyecto

Sitio/blog sobre Kyoto construido como **una experiencia continua**, no como una
sucesión de páginas. El eje narrativo es un **camino de piedras**: navegar no es
saltar entre páginas, es avanzar por ese camino.

El documento de referencia es **[`docs/PLAN.md`](docs/PLAN.md)**. Si algo de
aquí y algo de allá se contradicen, manda el PLAN y hay que actualizar este
archivo. **Lee el PLAN antes de empezar una fase nueva.**

El idioma de trabajo es el **español**: comentarios, commits, documentación y
conversación. Los identificadores del código van en inglés.

---

## Cómo se trabaja aquí

- **Por fases, con parada al final de cada una.** Al terminar una fase o una
  página, hay que detenerse y reportar. No encadenar fases en una sola tanda: el
  usuario quiere revisar visualmente cada pieza antes de que se construya
  encima.
- **Plan antes que código.** Ante una petición de alcance amplio, primero la
  propuesta (stack, arquitectura, dudas resueltas) y sólo después implementar.
- **Proponer, no sólo ejecutar.** Evaluar críticamente el material de partida y
  aportar criterio propio en lugar de implementarlo tal cual.

## Comandos

```bash
bun install          # dependencias
bun run dev          # servidor de desarrollo → http://localhost:3000
bun run build        # export estático a out/
bun run preview      # sirve out/ como lo haría el hosting
bun run typecheck    # tsc --noEmit
bun run fonts        # regenera los .woff2 subseteados
bun run palette      # muestrea los colores de docs/referencias/*.png
```

> **En este equipo no hay Node instalado — el runtime y el gestor de paquetes es
> `bun`.** No uses `npm`/`npx`: usa `bun` / `bunx`.

---

## Las cinco reglas duras

1. **Los assets se generan por código.** Geometría procedural con
   Three/R3F/shaders → si no, un asset libre del ecosistema (Lottie, modelo CC0)
   → y sólo como último recurso dibujar un SVG a mano, **preguntando y
   justificando antes**. El motivo es funcional: la geometría procedural se
   anima por vértices, se instancia miles de veces y reacciona al input.
2. **La cámara nunca entra en la escena.** La inmersión se consigue con
   profundidad, capas en Z, parallax sutil y atmósfera — nunca con una cámara en
   primera persona. Ante una petición de «más inmersión», la respuesta es sumar
   vida al cuadro, no meter la cámara dentro.
3. **Nunca dos contextos WebGL vivos a la vez.** Si la página de gastronomía
   acaba siendo PIXI, tendrá que desmontar antes el canvas de R3F.
4. **`src/config/journey.ts` es la fuente única de verdad.** Rutas, sidebar,
   posición en el camino, paleta de zona, ambiente y hasta el set de kanji que
   se subsetea salen de ese array. Añadir una sección es añadir una entrada, no
   crear carpetas sueltas.
5. **El contenido existe siempre como DOM real.** El canvas va detrás,
   `aria-hidden`, sin capturar el puntero. Es lo que leen los buscadores y los
   lectores de pantalla.

---

## Arquitectura

```
src/
├─ app/
│   ├─ layout.tsx              ← layout raíz vacío (el <html> lo pone [locale])
│   ├─ page.tsx                ← portero de idioma en «/» (script, sin middleware)
│   ├─ not-found.tsx           ← 404.html del export
│   └─ [locale]/
│       ├─ layout.tsx          ← <html>, fuentes, providers, <SceneRoot> persistente
│       ├─ page.tsx            ← Home 京都
│       ├─ ubicacion/ eventos/ gastronomia/
│       ├─ lugares/[slug]/     ← fushimi-inari · kiyomizu-dera · gion
│       ├─ tipografia/         ← muestrario (herramienta, se borra tras decidir)
│       └─ diagnostico/        ← panel de instrumentos (se recicla en Fase 9)
├─ config/journey.ts           ← ★ fuente única de verdad
├─ scene/                      ← el mundo R3F
│   ├─ SceneRoot.tsx           ← se monta en el layout y NUNCA se desmonta
│   ├─ SceneCanvas.tsx         ← el único <Canvas>
│   ├─ FoundationScene.tsx     ← escena de calibración de la Fase 1
│   ├─ objects/Stone.tsx       ← piedra procedural
│   ├─ quality/tiers.ts        ← detección de tier + perfiles
│   ├─ camera/ systems/        ← Fases 2–3 (ver sus README)
├─ store/useKyotoStore.ts      ← Zustand: viaje, calidad, a11y, audio, cursor
├─ i18n/                       ← routing, request, navigation, params
├─ messages/{es,en}.json       ← textos
├─ styles/
│   ├─ tokens.css              ← ★ paleta y ritmo (@theme de Tailwind v4)
│   ├─ globals.css
│   ├─ fonts.ts                ← next/font/local sobre los .woff2 generados
│   └─ generated/*.woff2       ← los produce `bun run fonts`; sí se versionan
├─ lib/css-vars.ts             ← puente tokens CSS → colores de Three
└─ lib/procedural.ts           ← PRNG, ruido direccional, damping
```

### Cómo se conectan las piezas

- Una ruta **no dibuja 3D**. Renderiza `<ActiveStation slug="…" />` y con eso le
  dice a la escena dónde está. La escena decide cómo llegar (Fase 1: cambia
  niebla y suelo; Fase 3: la cámara viaja por el spline).
- La **paleta vive una sola vez**, en `tokens.css`. La escena 3D la lee en
  caliente con `scenePalette()` (`src/lib/css-vars.ts`). No dupliques colores en
  TypeScript; los acentos *por estación* sí van en `journey.ts`.
- Toda página bajo `[locale]` empieza con `const locale = await
  staticLocale(params)` (`src/i18n/params.ts`): valida el idioma, llama a
  `setRequestLocale` y devuelve el tipo `Locale`. **Sin eso el export estático
  falla.**
- Los enlaces internos usan el `<Link>` de `@/i18n/navigation` con rutas **sin
  idioma** (`stationPath(station)`). El de `next/link` saca a la persona del
  idioma activo.

---

## Trampas que ya nos mordieron

- **React está clavado en 19.2.8 a propósito.** `@react-three/fiber@9.7` declara
  `react: >=19 <19.3`. Subir a 19.3 rompe la resolución de peers.
- **`three` va en 0.185.1** para que case con `@types/three@0.185.4`, que aún no
  publica la 0.186.
- **Ni One Jinja ni Gaze Nozarashi tienen un solo kanji** — son latinas puras
  (266 y 233 glifos). Los kanji los pone Zen Old Mincho. Ver
  `assets/fonts/LICENSES.md`, que además documenta que ambas son versiones
  *Demo* con «All Rights Reserved».
- **No uses `next/font/google` con familias que cubran japonés.** Google las
  sirve troceadas por `unicode-range` y next/font precarga *todos* los trozos:
  probamos M PLUS Rounded 1c como candidata a texto de lectura y metía **230
  `<link rel=preload>`** en cada página. Se descartó (ver más abajo) y con el
  pipeline local de `bun run fonts` las tres familias que sí se sirven pesan
  ~78 KB en total (Yuji Syuku suma otros ~22 KB sólo en `/es/tipografia/`).
- **`next dev` reescribe `AGENTS.md`** y crea `CLAUDE.md` si falta. Por eso este
  archivo empieza con `@AGENTS.md`: así el bloque de Next sigue vigente y esta
  guía no se pisa.
- Los **postinstall de `@parcel/watcher` y `@swc/core` están bloqueados** por
  bun y no hacen falta. No los desbloquees sin motivo.
- **La geometría del `<SceneRoot>` va en `style` inline, nunca en clases de
  Tailwind.** En dev, Turbopack inyecta el CSS vía un chunk de JS aparte del
  documento. Si el `ResizeObserver` interno de `@react-three/fiber` mide el
  contenedor antes de que ese chunk se aplique, lo ve sin `fixed inset-0` — es
  decir, sin tamaño — y el `<canvas>` queda clavado en 300×150 px (su tamaño
  por defecto) hasta el próximo reflow real de la página entera. Un `style={{
  position: 'fixed', inset: 0, ... }}` inline se aplica en el mismo commit que
  crea el nodo, sin depender de ninguna hoja de estilos, así que no hay carrera
  posible. Si el canvas alguna vez vuelve a verse en blanco al cargar, es lo
  primero que hay que revisar.
- **Sin un `lookAt` explícito, la cámara del `<Canvas>` mira perfectamente
  horizontal** (rotación identidad, eje −Z), no hacia el suelo. Eso centraba el
  horizonte a media pantalla y hacía que las piedras se vieran "flotando" en el
  medio del cuadro. `CameraAim` en `SceneCanvas.tsx` aplica un `camera.lookAt`
  fijo (~8° hacia abajo) para la escena de calibración; el rig de scroll de la
  Fase 3 hereda el mismo criterio.

---

## Estado de las fases

| # | Fase | Estado |
|---|---|---|
| 0 | Definiciones (`docs/PLAN.md`) | ✅ |
| 1 | Fundación: scaffold, tokens, fuentes, `journey.ts`, store, i18n, `<SceneRoot>` | ✅ pendiente de revisión |
| 2 | Motor de movimiento y ambiente (Lenis + GSAP, pétalos, viento, fauna, parallax, audio) | ⏸ |
| 3 | El Camino (piedras sobre spline, cámara con scroll, sidebar radial) | ⏸ |
| 4 | Home 京都 | ⏸ |
| 5 | Ubicación 位置 | ⏸ |
| 6 | Lugares | ⏸ |
| 7 | Eventos 桜 | ⏸ |
| 8 | Gastronomía 京料理 | ⏸ |
| 9 | Pulido, rendimiento, a11y, deploy | ⏸ |

## Decisiones abiertas de la Fase 1

- **Fuente de kanji**: Zen Old Mincho (propuesta) vs Yuji Syuku. Comparar en
  `/es/tipografia/`.
- **Slugs por idioma**: hoy `/en/ubicacion` usa el slug español. Si se quieren
  slugs traducidos, se decide en la Fase 3 con `pathnames` de next-intl.

Ya decididas: titulares con **One Jinja** y párrafos/texto de lectura con
**Gaze Nozarashi** — son las dos fuentes de partida, no hubo comparación que
hacer. Si algún texto necesita negrita, se resuelve con `font-weight` en CSS
(el navegador la sintetiza; no hay un archivo Bold que subsetear).
