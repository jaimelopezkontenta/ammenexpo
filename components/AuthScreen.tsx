import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";

import { DawnBackground } from "@/components/DawnBackground";
import { useScreenPadding } from "@/components/useScreenPadding";
import { Wordmark } from "@/components/Wordmark";

/**
 * El molde de las cuatro pantallas de acceso.
 *
 * Las cuatro son lo mismo con distinto contenido —degradado radial, título
 * centrado, un par de campos, el CTA y el nombre abajo—, así que la forma vive
 * aquí y no copiada cuatro veces. Eso además evita el fallo clásico de este
 * tipo de pantalla: que una de ellas se quede sin `KeyboardAvoidingView` y el
 * teclado tape el botón justo en la que hay que escribir dos contraseñas.
 *
 * El nombre va abajo y no arriba porque arriba está el título, que es lo que
 * hay que leer; la marca se firma al pie.
 */
export const AuthScreen = ({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
  /** La letra pequeña de los términos, solo en la pantalla de entrar. */
  footer?: string;
}) => {
  const { top, scrollBottom } = useScreenPadding();

  return (
    <DawnBackground>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          // `md:max-w-md`, no la medida de lectura: un formulario de dos campos
          // a 672px es una pradera; a 448 se lee como una puerta. En desktop
          // los inputs llegaban a ocupar el monitor entero.
          contentContainerClassName="flex-grow justify-center px-7 py-12 md:w-full md:max-w-md md:self-center"
          contentContainerStyle={{ paddingTop: top }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center gap-2">
            <Text
              className="text-center font-sans-bold text-3xl leading-9 text-plum"
              accessibilityRole="header"
            >
              {title}
            </Text>
            {intro ? (
              // Plum y no el gris secundario, como en el prototipo: es una sola
              // línea bajo el título, no texto de apoyo, y sobre el periwinkle
              // de los bordes del radial el gris se queda en 3,64.
              <Text className="text-center font-sans text-base text-plum">
                {intro}
              </Text>
            ) : null}
          </View>

          {children}
        </ScrollView>

        <View
          className="items-center px-7"
          style={{ paddingBottom: scrollBottom }}
        >
          <Wordmark />
          {footer ? (
            <Text className="mt-1 text-center font-sans text-xs leading-4 text-mist-ink">
              {footer}
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </DawnBackground>
  );
};
