import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";

/** Teclado en iOS: el resto de plataformas no empujan el layout igual. */
export const KeyboardScreen = ({ children }: { children: ReactNode }) => (
  <KeyboardAvoidingView
    className="flex-1"
    behavior={Platform.OS === "ios" ? "padding" : undefined}
  >
    {children}
  </KeyboardAvoidingView>
);
