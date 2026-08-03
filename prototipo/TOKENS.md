# Tokens "Amanecer" — CONGELADO (2026-08-03)

Contrato del rediseño. Los valores salen del muestreo de `diseno/MONTAJE FINAL/JPG/` con
dos revisiones aprobadas: los fondos despastelados ~40 % y el naranja **Melocotón suave**.
A partir de aquí, el prototipo se ajusta a este fichero y la app se ajusta al prototipo —
no al revés.

## Color

| Token | Hex | Uso |
|---|---|---|
| dawn.sky | #C7D6F2 | Fondos fríos (periwinkle claro) |
| dawn.sky-soft | #D8E1F1 | Periwinkle pálido, fin del degradado cálido |
| dawn.cream | #FFF1DD | Fondos cálidos |
| dawn.cream-bg | #FFF6EA | Crema de fondo del home |
| dawn.peach | #F9DBBF | Rubor durazno, fondo inferior de home/story |
| dawn.peach-mid | #FCEBD8 | Paso intermedio de home/story |
| dawn.comm | #FDF3E9 | Fondo plano de círculos y comunidad |
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
Bajar de AA sería una regresión, así que los dos tokens que no llegaban tienen pareja.

| Par | Ratio | Veredicto |
|---|---|---|
| plum sobre cream | 10,1:1 | ✅ cualquier tamaño |
| plum sobre surface | 11,2:1 | ✅ cualquier tamaño |
| ember.accent sobre cream | **2,85:1** | ❌ ni siquiera llega al 3:1 de elemento no textual — nunca lleva texto |
| ember.ink sobre cream | 4,85:1 | ✅ AA para texto pequeño |
| mist sobre surface | **3,61:1** | ❌ no vale para texto |
| mist.ink sobre surface | 5,34:1 | ✅ AA |
| mist.ink sobre cream | 4,80:1 | ✅ AA |
| danger sobre surface / cream | 5,44:1 / 4,89:1 | ✅ AA en los dos |

Texto sobre vidrio: se mide contra la parada **más oscura** del degradado que hay debajo,
y vive sobre el vidrio del 58 % o más, nunca sobre el del 42 %.

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

## Degradados

Revisión "light" del 2026-08-03: el home saturado del JPG era demasiado naranja; la
referencia de tono aprobada es la pantalla de Círculos (#FDF3E9). Valores saturados
originales, por si alguna vez se quiere volver: sky #ABC5EE, cream #FFE7C3, peach #FEB780.

- **radial** (splash, auth, perfil): crema pálida al centro → sky claro en los bordes
- **warm** (onboarding): cream → #F8EDDE 55 % → sky-soft · **cool** = el inverso
- **home**: cream-bg → peach-mid 55 % → peach (rubor, no naranja pleno)
- **story**: cream → peach-mid 60 % → peach
- **comm** (círculos, comunidad): plano #FDF3E9
- El naranja pleno vive SOLO en: CTA, acento, relleno del progress e indicador de tab
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
