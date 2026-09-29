# 0003 · La regresión visual corre sobre el export estático

**Estado:** aceptada · 2026-09-29

## Contexto

La suite visual tenía una tolerancia del 2 % (`maxDiffPixelRatio: 0.02`), unos
6.600 píxeles en 390×844: una palabra entera cabía dentro. Las baselines de Hoy
decían «Buenas tardes» (con el reloj fijado a las 10:00) y las de Orar
«Círculos» (la pestaña se llama «Juntos») y la suite pasaba. Medido con
tolerancia cero: cambiar esa etiqueta son 132 píxeles y el único ruido entre
corridas son 59–66 (el punto de avisos sin leer). Además, servida por Metro
(desarrollo), a ratos aparecía un botón ⚡ de Expo abajo a la izquierda que no
existe en producción, y las capturas fallaban sin que la app cambiara.

## Decisión

- `maxDiffPixels: 30` común a los tres specs (`e2e/helpers/visual.ts`), con el
  punto de avisos oculto por CSS (`visual.css`, no con `mask`: una máscara solo
  existe si el elemento existe).
- `npm run e2e:visual` corre contra el **export estático** (`scripts/e2eStatic.mjs`),
  el mismo que usa CI: sin overlays de desarrollo, sin compilar rutas a la
  primera visita y con el CSS de producción.
- El estado que no controla el reloj se fija a mano antes de capturar (la
  posición de lectura del usuario del seed).
- Las baselines se regeneran a propósito, con el diff revisado, nunca «hasta
  que pase».

## Consecuencias

- Hay dos juegos de baselines: `-win32.png` (quien corre `npm run e2e:visual` en
  Windows) y `-linux.png` (CI). Estas últimas las genera el workflow manual
  `visual-baselines` (2026-09-29: 58 capturas, con una segunda pasada estable) y
  desde entonces el paso visual de `verify` es bloqueante. Tras un cambio visual
  deliberado hay que regenerar AMBOS juegos: `npm run e2e:visual:update` en local y
  `gh workflow run visual-baselines.yml` para Linux (`docs/runbooks/ci.md`).
- Lo que depende del día real NO puede verse en una captura: la hora se fija a las
  10:00 pero el día no (congelarlo descuadraría los datos del seed), así que las
  fechas (cabecera de Hoy, fecha de cada aviso, «este día se abre el …») llevan
  `testID` y `visual.css` las oculta. Una fecha nueva en una pantalla capturada
  necesita lo mismo.
- Un cambio visual deliberado exige `npm run e2e:visual:update` y revisar cada
  captura tocada.
- El color de un `Txt` va siempre por `tone`: en web una clase de color por
  `className` perdía contra el tono según el orden del CSS, y el CTA de Hoy salía
  casi blanco en oscuro.
