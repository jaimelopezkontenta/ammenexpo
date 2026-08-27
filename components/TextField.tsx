import { forwardRef, useId } from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";

import { useThemeColors } from "@/theme";

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(
  ({ label, error, ...inputProps }, ref) => {
    const colors = useThemeColors();
    const errorId = useId();

    return (
      <View className="w-full gap-1.5">
        {/* aria-hidden on web: the visible label would otherwise be read once as
            loose text and again as the input's accessible name. */}
        <Text className="font-sans-medium text-sm text-mist-ink" aria-hidden>
          {label}
        </Text>
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
          // Vidrio, como en el prototipo, pero sin desenfoque: un campo de
          // texto está dentro de un formulario con teclado abierto, y meter un
          // BlurView en cada uno cuesta más de lo que se ve. El blanco al 70 %
          // se parece bastante al 58 % con desenfoque de encima, y plum sobre
          // ese fondo sigue muy por encima de AA.
          //
          // Tres pieles, a propósito: este componente es el de formularios con
          // etiqueta; búsqueda y alta rápida sobre el amanecer usan
          // `bg-dawn-cream-bg`; el compositor del chat y del lector, sentado
          // en cromo, usa `bg-surface`.
          className={`w-full rounded-input border bg-glass/70 px-4 py-4 font-sans text-base text-plum shadow-soft ${
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
