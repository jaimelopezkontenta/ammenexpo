import { BlurTargetView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { cssInterop } from "nativewind";
import { createContext, ReactNode, RefObject, useContext, useRef } from "react";
import { StyleSheet, View, ViewProps } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

// `LinearGradient` es un componente de fuera de React Native, así que sin esto
// NativeWind no sabe que su `className` se traduce a estilo.
cssInterop(LinearGradient, { className: "style" });

/**
 * El amanecer. Uno, y el mismo en toda la app.
 *
 * **Este componente no tiene opciones a propósito.** Hubo seis fondos, uno por
 * flujo, que es lo que dice el montaje de diseño — y un montaje se mira
 * pantalla a pantalla, pero una app se recorre: cambiar de pestaña cambiaba el
 * fondo, y entrar en un capítulo o en un chat lo volvía a cambiar. Recorrida
 * no se leía como un sistema sino como seis.
 *
 * El durazno del diseño no desapareció: vive donde tiene sentido, dentro de
 * `VerseStory`, que no es el fondo de una pantalla sino una fotografía que se
 * manda por WhatsApp.
 *
 * Un componente sin prop no se puede usar mal. Si algún día hace falta otro
 * fondo, la conversación es esa y no un parámetro más.
 */

/** El periwinkle de base, que se abre un poco por el centro. */
const BASE = ["#C7D6F2", "#D2DEF4", "#C7D6F2"] as const;

// El `Glass` que va encima del fondo necesita en Android un `blurTarget`: un ref
// a la vista que se desenfoca (expo-blur 56). El fondo y los `Glass` no se
// conocen por prop —`Glass` vive dentro de `children`—, así que el ref viaja por
// contexto y ningún call site cambia.
const DawnBlurTargetContext = createContext<RefObject<View | null> | null>(
  null,
);

export const useDawnBlurTarget = () => useContext(DawnBlurTargetContext);

export const DawnBackground = ({
  children,
  style,
  className,
  ...viewProps
}: ViewProps & { children?: ReactNode }) => {
  // Apunta SOLO al fondo (degradado + halo), no a `children`: el `blurTarget`
  // es lo que queda detrás del `Glass`, y el `Glass` es parte de `children`.
  // Si el target incluyera al propio Glass habría un ciclo visual.
  const targetRef = useRef<View | null>(null);

  // `className` se desestructura y se escribe a mano abajo, en vez de viajar
  // dentro del `...viewProps`: NativeWind compila la clase donde ve el atributo
  // escrito en el JSX, y si llega por un spread la cadena se pasa tal cual. En
  // web colaba de milagro y en iOS y Android no habría hecho nada.
  return (
    <View {...viewProps} className={className} style={[styles.fill, style]}>
      <DawnBlurTargetContext.Provider value={targetRef}>
        <BlurTargetView ref={targetRef} style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={BASE}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/*
            El halo crema. `expo-linear-gradient` no hace radiales, así que va en SVG,
            y es una elipse ancha y baja como en el diseño: un círculo deja el centro
            con forma de foco.

            **Con `viewBox` y unidades absolutas, no con porcentajes.** Un SVG sin
            `viewBox` resuelve los porcentajes contra un lienzo por defecto y no
            contra su tamaño real: el halo se quedaba pequeño y pegado a la esquina
            superior izquierda. `preserveAspectRatio="none"` es lo que deja que el
            cuadrado de 100×100 se estire a la forma de la pantalla.
          */}
          <Svg
            style={StyleSheet.absoluteFill}
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            pointerEvents="none"
          >
            <Defs>
              <RadialGradient id="dawnGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#FFF1DD" stopOpacity="1" />
                <Stop offset="0.45" stopColor="#FFF1DD" stopOpacity="0.55" />
                <Stop offset="0.72" stopColor="#FFF1DD" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Ellipse cx="50" cy="47" rx="90" ry="55" fill="url(#dawnGlow)" />
          </Svg>
        </BlurTargetView>
        {children}
      </DawnBlurTargetContext.Provider>
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
