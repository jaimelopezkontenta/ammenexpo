import { ScrollViewStyleReset } from "expo-router/html";

import { fallbackLng } from "@/translation";

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
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1,viewport-fit=cover"
        />
        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>{children}</body>
    </html>
  );
}

// El papel cálido del tema, y no el blanco del scaffold: en web el `body`
// asoma por los bordes y en el arranque, así que dejarlo en #fff dejaba una
// costura blanca alrededor de una app que ya no es blanca.
//
// Sin rama de modo oscuro: la app todavía no lo tiene, y pintar el fondo de
// negro debajo de pantallas claras da un destello negro al cargar, que es peor
// que no tenerlo.
const responsiveBackground = `
body {
  background-color: #FBF8F4;
}`;
