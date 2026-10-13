# Datos geográficos

## Natural Earth — `ne_50m_admin_0_countries`

- **Origen:** https://www.naturalearthdata.com/ (copia en
  https://github.com/nvkelso/natural-earth-vector)
- **Licencia:** dominio público. «No permission is needed to use Natural
  Earth. Crediting the authors is unnecessary.» Se cita igual, por cortesía.
- **Uso:** la silueta de Japón del ícono de Ubicación del sidebar (Fase 3C).
  `bun run geo` descarga el archivo en `assets/geo/source/` (no se versiona) y
  escribe `src/components/nav/icons/japan.generated.ts` (sí se versiona).

## Natural Earth — `ne_10m_admin_1_states_provinces` y `ne_10m_lakes`

- **Origen y licencia:** los mismos (dominio público).
- **Uso:** la maqueta de Japón de Ubicación (Fase 5A): las 46 prefecturas de
  Kyushu a Hokkaido (sin Okinawa), con sus nombres en romaji y en kanji
  (`name`, `name_ja`), y el lago Biwa. `bun run geo` las descarga en
  `assets/geo/source/` (no se versionan; la primera pesa ~40 MB) y escribe
  `src/scene/objects/maqueta/prefectures.generated.ts` (sí se versiona).
- **Herramientas** (sólo en desarrollo): `topojson-server`, `topojson-simplify`
  y `topojson-client` (ISC) para simplificar con topología compartida, y
  `clipper-lib` (Boost) para encoger las losas y recortar el lago.
