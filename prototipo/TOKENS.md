# Tokens "Amanecer" — CONGELADO (2026-08-03)

Contrato del rediseño. Los valores salen del muestreo de `diseno/MONTAJE FINAL/JPG/` con
dos revisiones aprobadas: los fondos despastelados ~40 % y el naranja **Melocotón suave**.
A partir de aquí, el prototipo se ajusta a este fichero y la app se ajusta al prototipo —
no al revés.

## Color

| Token | Hex | Uso |
|---|---|---|
| dawn.sky | #C7D6F2 | La base del fondo (periwinkle claro) |
| dawn.cream | #FFF1DD | El halo del centro del fondo, y el relleno de los editores |
| dawn.cream-bg | #FFF6EA | Crema pálida: rellenos, `app.json` y el `body` de la web |
| dawn.peach | #F9DBBF | Rubor durazno: la imagen que se comparte |
| dawn.peach-mid | #FCEBD8 | Paso intermedio de esa imagen, y el versículo subrayado |
| ember | #F2A578 | CTA, inicio del degradado |
| ember.pale | #FBDFC2 | CTA, fin del degradado |
| ember.accent | #E2703F | **Solo decoración**: labels editoriales ≥18px, indicador de tab activa, iconos, relleno del progress |
| ember.ink | #B24A22 | **Texto naranja que hay que leer**: enlaces, "Saltar", "¿Olvidaste tu contraseña?" |
| plum | #413653 | Texto principal |
| plum.chip | #4D405C | Pills y tabs activas, badges, chips de acción |
| mist | #8A8494 | **Solo decoración**: iconos, separadores, bordes |
| mist.ink | #6F6879 | Texto secundario y placeholders |
| surface | #FFFFFF | Cards, inputs, pills |
| danger | #C0392B | Errores (hoy `red-400/500` sueltos) |

### Contraste — medido, no estimado

La app ya traía sus grises medidos y su público tira a mayor: lo que hace es *leer*.
Bajar de AA sería una regresión, así que los dos tokens del diseño que no llegaban
tienen pareja legible.

Cada texto contra cada fondo del sistema (✅ AA a cualquier tamaño · ⚠️ solo ≥18px ·
❌ solo decoración):

Las tres columnas que importan son las del fondo —**sky** en las franjas de arriba y
abajo, **cream** en el centro— y **surface**, que es lo que hay bajo el texto de una
tarjeta. `peach` se queda por la imagen que se comparte.

| | surface | cream | cream-bg | peach | sky |
|---|---|---|---|---|---|
| **plum** | ✅ 11,19 | ✅ 10,06 | ✅ 10,45 | ✅ 8,48 | ✅ 7,63 |
| **mist.ink** | ✅ 5,34 | ✅ 4,80 | ✅ 4,99 | ⚠️ 4,05 | ⚠️ 3,64 |
| **mist** | ⚠️ 3,62 | ⚠️ 3,25 | ⚠️ 3,38 | ❌ 2,74 | ❌ 2,47 |
| **ember.ink** | ✅ 5,39 | ✅ 4,85 | ✅ 5,04 | ⚠️ 4,08 | ⚠️ 3,68 |
| **ember.accent** | ⚠️ 3,17 | ❌ 2,85 | ❌ 2,96 | ❌ 2,40 | ❌ 2,16 |
| **danger** | ✅ 5,44 | ✅ 4,89 | ✅ 5,08 | ⚠️ 4,12 | ⚠️ 3,71 |

Blanco sobre plum.chip: ✅ 9,53 — las pills activas y la burbuja propia del chat.

**El CTA.** Label plum: 5,56 en el extremo oscuro del degradado y 8,75 en el claro.
El blanco que pedía el montaje daba 2,01 y 1,28.

**Dos reglas que salen de la tabla:**

1. **En las dos franjas de periwinkle** —el crema del halo llega del 7 % al 87 % de la
   altura, así que arriba y abajo queda sky puro— el texto secundario pequeño va en
   **plum**, no en mist.ink. En medio y dentro de una tarjeta no hace falta: el vidrio del
   58 % deja un fondo efectivo casi blanco y mist.ink vuelve a pasar AA. En las pestañas
   esas dos franjas ya están ocupadas por `TabHeader`, que es plum, y por la barra, que es
   vidrio.
2. Texto sobre vidrio se mide contra la parada **más oscura** del degradado que hay
   debajo, y vive sobre el vidrio del 58 % o más, nunca sobre el del 42 %.

## Orbe (isotipo)

- Colores: durazno #F8E2D1 (arriba) · lavanda #D4D0EF (izq) · lila #D3CEF0 (der) ·
  celeste #CFECF9 (abajo) · base #EDE6F6→#BFC3EF.
- Animación: escala 1→1.055, 4,2 s ease-in-out infinito; halo crema opacidad .7→1 en fase.
- **En la app: SVG** (`react-native-svg`) con la misma pila de degradados radiales, más
  Reanimated para la respiración. Sin resolución fija y sin asset que se desincronice.
  El PNG solo se rasteriza para los iconos de tienda.
- **Regla: el isotipo es uno solo.** Todo lo que lo simule —splash, marca de agua del
  story, **la pestaña Orar**, estados vacíos, icono de la app— usa exactamente estos
  colores y esta respiración, a la escala que toque. **El isotipo nunca es naranja**, y no
  cambia con la paleta: en el prototipo `.orb` y `.orb-tab` comparten una sola declaración
  en `styles.css` y ninguna lee `--ember`; en la app, `components/Orb.tsx` es el único
  sitio donde viven esos colores.
- La pestaña Orar es el orbe a 26 px con anillo de vidrio; lo que marca que está activa es
  la barra de acento de arriba, no el color del orbe.

## El fondo

**Uno solo, y el mismo en toda la app.** Hubo seis —uno por flujo, que es lo que asigna el
montaje— y recorriendo la app no se leían como un sistema sino como seis: cambiar de
pestaña cambiaba el fondo, y entrar en un capítulo o en un chat lo volvía a cambiar. Un
montaje se mira pantalla a pantalla; una app se recorre.

```
radial-gradient(ellipse 90% 55% at 50% 47%, cream 0%, cream 55% al 45%, transparente al 72%)
sobre linear-gradient(180deg, sky 0%, #D2DEF4 50%, sky 100%)
```

Halo crema al centro sobre periwinkle. En la app vive en `components/DawnBackground.tsx`,
que **no tiene prop**: un componente sin opciones no se puede usar mal, y si algún día
hace falta otro fondo, la conversación es esa y no un parámetro más.

Revisión "light" del 2026-08-03: los valores del JPG estaban más saturados y en pantalla,
sostenidos durante una lectura larga, cansaban. Originales por si alguna vez se quiere
volver: sky #ABC5EE, cream #FFE7C3, peach #FEB780.

**El durazno no desapareció**: vive en la imagen 9:16 que se comparte
(`components/VerseStory.tsx`), que no es el fondo de una pantalla sino una fotografía que
se manda por WhatsApp.

```
story: cream → peach-mid 60 % → peach
```

El naranja pleno vive SOLO en: CTA, acento, relleno del progress e indicador de tab
activa. **Nunca en el isotipo.**

## Tipografía

- **Sans UI: General Sans** (Fontshare, licencia gratuita para uso comercial). Títulos
  bold 28-34, body 17-19.
- **Serif editorial: Cormorant Garamond itálica** — wordmark "ammen", labels
  ("Versículo del día", "Tema central"), referencias bíblicas. Nunca párrafos.
- **Lora se queda** para la lectura larga: versículo, oración, testimonio y el lector
  bíblico, con `lineHeight.reading`. Cormorant Light es preciosa y demasiado fina para un
  capítulo entero.

## Material Liquid Glass (iOS 26)

- Todo el UI es vidrio sobre los degradados; el **CTA naranja se queda sólido** para que
  la jerarquía siga leyéndose.
- Vidrio claro: `rgba(255,255,255,0.42)` en contenedores · `0.58` en superficies con
  texto + `blur(22px) saturate(1.7)` + borde `1px rgba(255,255,255,0.65)` + especular
  `inset 0 1px 0 rgba(255,255,255,0.78)` + sombra `0 8px 24px rgba(65,54,83,0.14)`.
- Vidrio oscuro (chips y pills activas, burbuja propia): `rgba(77,64,92,0.60)` + blur 14px
  + borde `rgba(255,255,255,0.28)`.
- Tab bar: blanco 55 % + blur 28px · sheet: crema `rgba(255,236,205,0.72)` + blur 30px ·
  paneles de lectura: blanco 62 % + blur 26px.
- En la app: `expo-blur`. iOS nativo, web `backdrop-filter`, Android
  `experimentalBlurMethod`. **Regla de rendimiento**: vidrio estático sí; dentro de una
  lista virtualizada se degrada a translucidez sin blur.

## Forma y sombra

- Radios: cards 20px · inputs 16px · CTA 15px · chips 9px · pills 999px
- shadow-soft: `0 8px 24px rgba(65,54,83,.10)`
- shadow-card: `0 10px 30px rgba(65,54,83,.12)`
