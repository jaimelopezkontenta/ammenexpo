import { ScrollViewStyleReset } from "expo-router/html";

import { colors, colorsDark } from "@/theme";
import { fallbackLng } from "@/translation";

/**
 * Esto corre en Node en tiempo de build, así que no puede leer el idioma de
 * quien visita ni la sesión: usa el idioma del producto, que es el español.
 */
const SOCIAL_TITLE = "Ammen — orar cada día, y no hacerlo sola";
const SOCIAL_DESCRIPTION =
  "Un plan de oración escrito para lo que estás viviendo, y gente que ora contigo. Cuando alguien ora por tu día, te enteras.";

/**
 * El dominio tiene que ser absoluto: una araña que lee `/og.png` no sabe de
 * dónde colgarlo. Sin `EXPO_PUBLIC_APP_URL` cae al dominio de producción, que
 * es lo correcto aquí — en local nadie va a desplegar una vista previa.
 */
const SOCIAL_URL = (
  process.env.EXPO_PUBLIC_APP_URL ?? "https://ammen.app"
).replace(/\/$/, "");
const IS_STAGING = process.env.EXPO_PUBLIC_DEPLOY_ENV === "staging";

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    // The scaffold hardcoded "en", so the whole Spanish product shipped
    // declaring itself English: screen readers pronounced it with English
    // phonemes and Chrome offered to translate Spanish into Spanish. This runs
    // in Node at build time, so it cannot know the visitor's choice — it uses
    // the product's own language, and core/i18n keeps it in sync afterwards
    // when someone switches.
    <html lang={fallbackLng}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/*
          El scaffold traía `maximum-scale=1.00001` para que la web se sintiera
          más como una app nativa, con un comentario que ya avisaba de que eso
          reduce la accesibilidad. En una app de oración —cuyo público tira a
          mayor, y donde lo que se hace es *leer*— quitarle a alguien la
          posibilidad de acercar el texto con dos dedos es un precio que no
          compensa parecerse a nada.
        */}
        {/*
          `viewport-fit=cover` deja que el notch exista. El hueco lo pone
          TabHeader / useScreenPadding leyendo insets: react-native-safe-area-context
          en web ya mide `env(safe-area-inset-*)`. Un padding en `html` se
          sumaría a ese inset y el título quedaría dos veces más abajo.
        */}
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1,viewport-fit=cover"
        />
        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        {/*
          Cómo se ve un enlace de Ammen cuando alguien lo pega en WhatsApp.

          Hasta aquí no había **ni una** etiqueta social en el proyecto: un
          enlace compartido llegaba como una URL gris, y en un grupo de familia
          una tarjeta con título e imagen se pulsa muchísimo más que un texto
          azul. Es el bucle de adquisición entero pasando por aquí.

          **Van en el HTML y no con `<Head>` por pantalla**: las arañas de
          WhatsApp, Twitter y Facebook no ejecutan JavaScript, así que solo leen
          lo que llega en los primeros bytes. Por el mismo motivo la tarjeta no
          puede decir «Marta te pide oración»: personalizar por enlace exige
          renderizar `/p/[token]` en un servidor, y el export estático no puede
          pre-renderizar un token que no existe en tiempo de build.

          `summary` y no `summary_large_image` a propósito: la imagen que hay es
          cuadrada, y pedir una tarjeta ancha con una imagen cuadrada la deja
          recortada por los lados.
        */}
        <meta property="og:site_name" content="Ammen" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="es_ES" />
        <meta property="og:title" content={SOCIAL_TITLE} />
        <meta property="og:description" content={SOCIAL_DESCRIPTION} />
        <meta property="og:image" content={`${SOCIAL_URL}/og.png`} />
        <meta property="og:url" content={SOCIAL_URL} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={SOCIAL_TITLE} />
        <meta name="twitter:description" content={SOCIAL_DESCRIPTION} />
        <meta name="twitter:image" content={`${SOCIAL_URL}/og.png`} />
        <meta name="description" content={SOCIAL_DESCRIPTION} />
        {IS_STAGING ? (
          <meta name="robots" content="noindex,nofollow,noarchive" />
        ) : null}
        {/*
          El marco del navegador sigue al sistema, como la app: dos metas con
          `media` en vez de una fija — la araña que no entiende `media` se
          queda con la primera (clara), que es el caso seguro.
        */}
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content={colors.dawn.sky}
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content={colorsDark.dawn.sky}
        />
        <title>{SOCIAL_TITLE}</title>

        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>{children}</body>
    </html>
  );
}

// El periwinkle del fondo, que es lo que hay en los bordes del degradado: en
// web el `body` asoma alrededor y en el arranque, así que dejarlo en blanco
// —o en crema, que es el centro y no el borde— dejaba una costura alrededor de
// una app que ya no es ni lo uno ni lo otro.
//
// La rama oscura es CSS puro a propósito: llega en los primeros bytes, así
// que con el sistema en oscuro el body es violeta desde el primer frame — sin
// fogonazo claro durante la carga. (Los degradados JS, DawnBackground y
// compañía, sí hidratan después; ese parpadeo menor es la limitación aceptada
// del anochecer web v1 — ver AGENTS.md.)
const responsiveBackground = `
body {
  background-color: ${colors.dawn.sky};
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: ${colorsDark.dawn.sky};
  }
}`;
