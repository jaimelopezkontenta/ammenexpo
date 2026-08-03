import { LinearGradient } from "expo-linear-gradient";
import { forwardRef } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
} from "react-native";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
}

/**
 * El CTA del sistema: degradado melocotón de izquierda a derecha.
 *
 * **El label es plum y no blanco**, que es lo que pedía el montaje de diseño.
 * Sobre este degradado el blanco daba 2,0:1 en el extremo oscuro y 1,3:1 en el
 * claro — ilegible, y este botón sale en treinta y cinco sitios. Plum da 5,6:1
 * y 8,8:1, y de paso el botón se lee más editorial y menos genérico.
 */
const GRADIENT = ["#F2A578", "#FBDFC2"] as const;

const CONTAINER: Record<ButtonVariant, string> = {
  primary: "",
  secondary: "bg-surface shadow-soft",
  ghost: "bg-transparent",
};

const LABEL: Record<ButtonVariant, string> = {
  primary: "text-plum",
  secondary: "text-plum",
  ghost: "text-ember-ink",
};

/** El del indicador de carga: el mismo tono que el label que sustituye. */
const SPINNER: Record<ButtonVariant, string> = {
  primary: "#413653",
  secondary: "#413653",
  ghost: "#B24A22",
};

export const Button = forwardRef<View, ButtonProps>(
  (
    {
      title,
      variant = "primary",
      loading = false,
      disabled,
      ...touchableProps
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    const content = loading ? (
      <ActivityIndicator color={SPINNER[variant]} />
    ) : (
      <Text className={`font-sans-semibold text-base ${LABEL[variant]}`}>
        {title}
      </Text>
    );

    return (
      <TouchableOpacity
        ref={ref}
        accessibilityRole="button"
        // The title is the only accessible name, and it is unmounted while
        // loading — so without this the button announced as "button, busy" with
        // no indication of *which* button, on every confirmation in the app.
        accessibilityLabel={title}
        accessibilityState={{ disabled: Boolean(isDisabled), busy: loading }}
        aria-busy={loading}
        {...touchableProps}
        disabled={isDisabled}
        className={`w-full overflow-hidden rounded-cta ${
          CONTAINER[variant]
        } ${isDisabled ? "opacity-50" : ""} ${touchableProps.className ?? ""}`}
      >
        {variant === "primary" ? (
          <LinearGradient
            colors={GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.inner}
          >
            {content}
          </LinearGradient>
        ) : (
          <View style={styles.inner}>{content}</View>
        )}
      </TouchableOpacity>
    );
  },
);

Button.displayName = "Button";

// El relleno vive aquí y no en la clase del `TouchableOpacity` porque el
// degradado es un hijo: si el padre llevara el padding, el color no llegaría
// hasta el borde.
const styles = StyleSheet.create({
  inner: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
});
