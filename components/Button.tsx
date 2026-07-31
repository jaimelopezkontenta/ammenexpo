import { forwardRef } from "react";
import {
  ActivityIndicator,
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

const CONTAINER: Record<ButtonVariant, string> = {
  primary: "bg-ink",
  secondary: "bg-paper-sunken",
  ghost: "bg-transparent",
};

const LABEL: Record<ButtonVariant, string> = {
  primary: "text-paper",
  secondary: "text-ink",
  ghost: "text-ink-muted",
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
        className={`w-full flex-row items-center justify-center rounded-2xl px-5 py-4 ${
          CONTAINER[variant]
        } ${isDisabled ? "opacity-50" : ""} ${touchableProps.className ?? ""}`}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === "primary" ? "#FBF8F4" : "#1C1917"}
          />
        ) : (
          <Text className={`text-base font-semibold ${LABEL[variant]}`}>
            {title}
          </Text>
        )}
      </TouchableOpacity>
    );
  },
);

Button.displayName = "Button";
