# Licencias de las fuentes

Los archivos de `source/` son los originales. `bun run fonts` los subsetea a
`.woff2` en `src/styles/generated/`, y son esos los que se publican.

| Archivo | Familia | Licencia | Estado |
|---|---|---|---|
| `OneJinja-Demo.otf` | One Jinja (Denustudios) | ⚠️ «All Rights Reserved», versión **Demo** | Revisar antes de publicar |
| `GazeNozarashi-Demo.ttf` | Gaze Nozarashi (Allouse.Studio) | ⚠️ «All Rights Reserved», versión **Demo** | Revisar antes de publicar |
| `ZenOldMincho-Regular.ttf` | Zen Old Mincho | SIL OFL 1.1 (`ZenOldMincho-OFL.txt`) | Libre, incluida redistribución web |
| `YujiSyuku-Regular.ttf` | Yuji Syuku | SIL OFL 1.1 (`YujiSyuku-OFL.txt`) | Libre, incluida redistribución web |

## Lo que hay que verificar de las dos fuentes Demo

Las dos que aportó el usuario declaran `fsType = 0` (*Installable Embedding*),
que técnicamente permite incrustarlas en una web. Pero eso es un permiso
**técnico**, no legal: la tabla `name` dice literalmente «All Rights Reserved» y
ambas son versiones *Demo*, que en este tipo de tipografías suele significar
«gratis sólo para uso personal, la licencia comercial se compra».

Mientras el sitio sea un proyecto personal no hay problema práctico. Si en algún
momento se publica con ánimo comercial, hay dos salidas:

1. comprar la licencia web en <https://denustudios.com/> y
   <https://allousestudio.com/>, o
2. sustituirlas — están aisladas en `src/styles/fonts.ts`, así que cambiarlas es
   cambiar dos archivos de `source/` y volver a correr `bun run fonts`.

## Cobertura real de glifos

Comprobado leyendo la tabla `cmap` de cada archivo:

- **One Jinja**: 266 puntos de código. Latín completo, acentos del español
  incluidos. **Cero kanji, cero kana.**
- **Gaze Nozarashi**: 233 puntos de código. Mismo caso. **Cero kanji, cero kana.**

Por eso el proyecto necesita una tercera familia sólo para los kanji decorativos
(京都, 桜, 伏見稲荷大社…). Sin ella, esos títulos caerían en la fuente del sistema,
que cambia de un equipo a otro y arruina la composición.
