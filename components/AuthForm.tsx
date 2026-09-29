import { type ReactNode, useEffect, useRef } from "react";
import { Platform, View } from "react-native";

/**
 * Los campos de acceso dentro de un `<form>` — solo en web.
 *
 * Chrome avisa «Password field is not contained in a form» en cada pantalla de
 * acceso, y los gestores de contraseñas se apoyan en el formulario para saber
 * qué guardar y qué rellenar. En react-native-web una `View` con
 * `role="form"` se pinta como `<form>` (verificado con el render de
 * `react-native-web` 0.21: `<form role="form">` con los `<input>` dentro).
 *
 * **Un `<form>` real envía por defecto**, y aquí se envía con `onSubmitEditing`
 * y el botón. Tres cosas lo tienen a raya:
 *
 * - Los botones de la app salen como `<button type="button">` (RNW lo pone
 *   solo), así que pulsarlos no envía el formulario.
 * - Un campo con `onSubmitEditing` ya cancela el Enter (lo hace RNW: «prevent
 *   Enter from inserting a newline or submitting a form»).
 * - Y para el que no lo tenga —un formulario con un solo campo envía con Enter
 *   aunque no haya botón de envío—, este componente cancela el evento
 *   `submit`: nunca hay una recarga de página ni una petición GET con la
 *   contraseña en la URL.
 *
 * En nativo es una `View` normal: el rol solo existe en web.
 */
export const AuthForm = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => {
  const ref = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    // En web la ref de una `View` es el propio elemento del DOM.
    const form = ref.current as unknown as HTMLElement | null;
    if (!form) return;

    const cancel = (event: Event) => event.preventDefault();
    form.addEventListener("submit", cancel);

    return () => form.removeEventListener("submit", cancel);
  }, []);

  return (
    <View
      ref={ref}
      role={Platform.OS === "web" ? "form" : undefined}
      className={className}
    >
      {children}
    </View>
  );
};
