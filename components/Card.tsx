import { ReactNode } from "react";
import { Text, View, ViewProps } from "react-native";

import { Glass } from "@/components/Glass";

/**
 * La superficie sobre la que va casi todo: el versículo, el tema, una petición,
 * un plan compartido.
 *
 * Es vidrio legible —blanco al 58 %— y no vidrio de contenedor, porque una
 * tarjeta siempre lleva texto dentro y sobre el durazno del home el 42 % baja
 * el contraste por debajo de lo medido.
 *
 * El `label` va en la itálica editorial y en `ember.ink`. En el diseño ese
 * label es del naranja de acento, pero ese naranja da 2,85:1 sobre crema y
 * "Versículo del día" es texto que se lee: se queda la forma, cambia el tono.
 */
export const Card = ({
  label,
  children,
  className,
  flat = false,
  ...viewProps
}: ViewProps & {
  label?: string;
  children: ReactNode;
  /** Dentro de una lista virtualizada: translucidez sin desenfoque. */
  flat?: boolean;
}) => (
  <Glass
    readable
    flat={flat}
    className={`rounded-card p-5 shadow-card ${className ?? ""}`}
    {...viewProps}
  >
    {label ? (
      <Text className="mb-2 font-editorial text-lg text-ember-ink">
        {label}
      </Text>
    ) : null}
    {children}
  </Glass>
);

/** La variante oscura: el día de hoy en la portada, y poco más. */
export const CardDark = ({
  children,
  className,
  ...viewProps
}: ViewProps & { children: ReactNode }) => (
  <View
    className={`rounded-card bg-plum-chip p-5 shadow-card ${className ?? ""}`}
    {...viewProps}
  >
    {children}
  </View>
);
