import { forwardRef, useId } from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";

import { useThemeColors } from "@/theme";

/**
 * Las tres pieles del campo de texto, que existían de palabra (documentadas
 * aquí mismo) pero no de código: cada búsqueda y cada compositor copiaba sus
 * clases a mano.
 *
 * - `form` — el de formularios con etiqueta: vidrio al 70 %, sin desenfoque
 *   (un BlurView por campo con el teclado abierto cuesta más de lo que se ve).
 * - `dawn` — búsqueda y alta rápida sentadas directamente sobre el amanecer:
 *   crema del sistema, sin sombra de tarjeta.
 * - `chrome` — el compositor del chat y del lector, sentado en cromo blanco.
 */
const SKIN = {
  form: "bg-glass/70 shadow-soft",
  dawn: "bg-dawn-cream-bg",
  chrome: "bg-surface",
} as const;

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  skin?: keyof typeof SKIN;
  /** Oculta el rótulo visible (búsquedas con placeholder que ya lo dice). */
  hideLabel?: boolean;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(
  ({ label, error, skin = "form", hideLabel = false, ...inputProps }, ref) => {
    const colors = useThemeColors();
    const errorId = useId();

    return (
      <View className="w-full gap-1.5">
        {/* aria-hidden on web: the visible label would otherwise be read once as
            loose text and again as the input's accessible name. */}
        {hideLabel ? null : (
          <Text className="font-sans-medium text-sm text-mist-ink" aria-hidden>
            {label}
          </Text>
        )}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          // Without these the error was an orphan: a screen reader user focusing
          // the field was never told it was in error, nor what the message
          // floating below it referred to. React Native has no `invalid`
          // accessibility state, so native gets the message as a hint — read
          // straight after the label — and web gets the ARIA pair.
          accessibilityHint={error ?? undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          placeholderTextColor={colors.mist.ink}
          {...inputProps}
          className={`w-full rounded-input border px-4 py-4 font-sans text-base text-plum ${SKIN[skin]} ${
            error ? "border-danger" : "border-glassedge/70"
          } ${inputProps.className ?? ""}`}
        />
        {error ? (
          <Text
            nativeID={errorId}
            id={errorId}
            className="font-sans text-sm text-danger"
            accessibilityRole="alert"
          >
            {error}
          </Text>
        ) : null}
      </View>
    );
  },
);

TextField.displayName = "TextField";
