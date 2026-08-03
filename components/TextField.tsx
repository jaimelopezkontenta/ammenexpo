import { forwardRef, useId } from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(
  ({ label, error, ...inputProps }, ref) => {
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
          placeholderTextColor="#6F6879"
          {...inputProps}
          // Blanco casi opaco y no vidrio: el campo es donde se escribe, y el
          // texto que se escribe tiene que ganarle al degradado que hay detrás
          // sin depender de qué pantalla sea.
          className={`w-full rounded-input border bg-surface px-4 py-3.5 font-sans text-base text-plum shadow-soft ${
            error ? "border-danger" : "border-white/70"
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
