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
  primary: "bg-slate-900",
  secondary: "bg-slate-100",
  ghost: "bg-transparent",
};

const LABEL: Record<ButtonVariant, string> = {
  primary: "text-white",
  secondary: "text-slate-900",
  ghost: "text-slate-600",
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
        accessibilityState={{ disabled: Boolean(isDisabled), busy: loading }}
        {...touchableProps}
        disabled={isDisabled}
        className={`w-full flex-row items-center justify-center rounded-2xl px-5 py-4 ${
          CONTAINER[variant]
        } ${isDisabled ? "opacity-50" : ""} ${touchableProps.className ?? ""}`}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === "primary" ? "#ffffff" : "#0f172a"}
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
