import { LinearGradient } from "expo-linear-gradient";
import { forwardRef } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Tap, TapProps } from "@/components/ui/Tap";
import { gradients, useThemeColors } from "@/theme";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends TapProps {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
}

const CONTAINER: Record<ButtonVariant, string> = {
  primary: "",
  secondary: "bg-surface shadow-soft",
  ghost: "bg-transparent",
};

const LABEL: Record<ButtonVariant, string> = {
  // `cta-ink` y no `plum`: el degradado melocotón no cambia con el modo, así
  // que su tinta tampoco — en oscuro, `plum` es claro y sería ilegible aquí.
  primary: "text-cta-ink",
  secondary: "text-plum",
  ghost: "text-ember-ink",
};

export const Button = forwardRef<View, ButtonProps>(
  (
    { title, variant = "primary", loading = false, disabled, ...tapProps },
    ref,
  ) => {
    const colors = useThemeColors();
    const isDisabled = disabled || loading;

    // El del indicador de carga: el mismo tono que el label que sustituye.
    const spinner: Record<ButtonVariant, string> = {
      primary: colors["cta-ink"],
      secondary: colors.plum.DEFAULT,
      ghost: colors.ember.ink,
    };

    const content = loading ? (
      <ActivityIndicator color={spinner[variant]} />
    ) : (
      <Text className={`font-sans-semibold text-lg ${LABEL[variant]}`}>
        {title}
      </Text>
    );

    return (
      <Tap
        ref={ref}
        // El CTA se siente un punto más que el resto de la interfaz; el
        // Tap por defecto (selection) queda para lo secundario.
        haptic={variant === "primary" ? "light" : "selection"}
        accessibilityRole="button"
        // The title is the only accessible name, and it is unmounted while
        // loading — so without this the button announced as "button, busy" with
        // no indication of *which* button, on every confirmation in the app.
        accessibilityLabel={title}
        accessibilityState={{ disabled: Boolean(isDisabled), busy: loading }}
        aria-busy={loading}
        {...tapProps}
        disabled={isDisabled}
        className={`w-full overflow-hidden rounded-cta ${
          CONTAINER[variant]
        } ${isDisabled ? "opacity-50" : ""} ${tapProps.className ?? ""}`}
      >
        {variant === "primary" ? (
          <LinearGradient
            colors={gradients.cta}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.inner}
          >
            {content}
          </LinearGradient>
        ) : (
          <View style={styles.inner}>{content}</View>
        )}
      </Tap>
    );
  },
);

Button.displayName = "Button";

// El relleno vive aquí y no en la clase del `Tap` porque el degradado es un
// hijo: si el padre llevara el padding, el color no llegaría hasta el borde.
const styles = StyleSheet.create({
  inner: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
});
