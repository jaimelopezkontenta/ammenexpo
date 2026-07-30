import { forwardRef } from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(
  ({ label, error, ...inputProps }, ref) => {
    return (
      <View className="w-full gap-1.5">
        <Text className="text-sm font-medium text-slate-600">{label}</Text>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor="#94a3b8"
          {...inputProps}
          className={`w-full rounded-2xl border bg-white px-4 py-3.5 text-base text-slate-900 ${
            error ? "border-red-400" : "border-slate-200"
          } ${inputProps.className ?? ""}`}
        />
        {error ? <Text className="text-sm text-red-500">{error}</Text> : null}
      </View>
    );
  },
);

TextField.displayName = "TextField";
