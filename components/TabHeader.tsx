import { Link } from "expo-router";
import { Bell } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Wordmark } from "@/components/Wordmark";
import { useUserId } from "@/core/auth/useUserId";
import { useUnreadNotifications } from "@/core/notifications/queries";

import { icon, useThemeColors } from "@/theme";
import { greetingKey } from "@/core/time/greeting";

import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";

/**
 * La cabecera de las cinco pestañas.
 *
 * Va **dentro** de la pantalla y no en la barra de navegación. La barra de
 * react-navigation pinta una franja de un color sólido en la parte de arriba, y
 * sobre un degradado eso es una costura horizontal en el sitio donde más se
 * mira: la pantalla empezaba con una línea recta de crema y luego seguía el
 * amanecer. Aquí el fondo es el de la pantalla y no hay costura.
 *
 * A cambio, la cabecera hay que ponerla a mano en cada pestaña; por eso vive en
 * un componente y no copiada cinco veces.
 *
 * El saludo solo lo lleva Hoy. En las demás sobra: nadie entra en la Biblia
 * para que le den los buenos días.
 */

export const TabHeader = ({
  title,
  name,
  showDate = false,
  wide = false,
}: {
  title: string;
  /** El nombre de quien entra. Sin él no se saluda, en vez de saludar a nadie. */
  name?: string | null;
  /** La fecha local, solo en Hoy: ancla el "hoy" de verdad. */
  showDate?: boolean;
  /**
   * Sigue al contenido hasta `max-w-page` en lg+. Solo para pantallas cuyo
   * contenido también se ensancha (Hoy con su columna de contexto): en las
   * demás el contenido se queda en `max-w-read` y una cabecera más ancha
   * quedaría flotando igual de desconectada, pero al revés.
   */
  wide?: boolean;
}) => {
  const { t, i18n } = useTranslation();
  const colors = useThemeColors();
  const now = new Date();
  // Mayúscula solo en la primera letra: `capitalize` de CSS pone todas las
  // palabras en mayúscula, y en español salía «Martes, 29 De Septiembre».
  const rawDate = now.toLocaleDateString(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const dateLabel =
    rawDate.charAt(0).toLocaleUpperCase(i18n.language) + rawDate.slice(1);
  const userId = useUserId();
  const { data: unread } = useUnreadNotifications(userId);
  const insets = useSafeAreaInsets();

  return (
    // El Provider no aplica padding; sin esto el título y la campana
    // quedan bajo la status bar. NativeWind no conoce el notch: el 8
    // extra va en style, no en una clase pt-*.
    // En md+ la cabecera se alinea con la columna de lectura, no con el filo
    // de la ventana: un título pegado arriba-izquierda a 2000 px del contenido
    // centrado se leía como de otra página. Y en lg+ sigue al contenido hasta
    // `max-w-page` — clavada en `max-w-read` quedaba 240 px hacia dentro del
    // borde real de la página en Hoy, flotando desconectada.
    <View
      className={`w-full flex-row items-center justify-between gap-3 px-7 pb-2 md:max-w-read md:self-center md:px-10 ${
        wide ? "lg:max-w-page" : ""
      }`}
      style={{ paddingTop: insets.top + 8 }}
    >
      <View className="min-w-0 flex-1">
        <Txt variant="display">{title}</Txt>
        {name ? (
          <Txt
            variant="editorial"
            tone="primary"
            numberOfLines={1}
            className="mt-0.5"
          >
            {t(greetingKey(now.getHours()))}, {name}
          </Txt>
        ) : null}
        {showDate ? (
          <Txt variant="caption" className="mt-0.5">
            {dateLabel}
          </Txt>
        ) : null}
      </View>

      <View className="flex-row items-center gap-4">
        {/* El único acceso que no es pestaña, y va en **todas** ellas. Vivía
            solo en la cabecera de Hoy, así que quien abría la app en Orar o en
            Círculos no se enteraba nunca de que alguien había orado por él: el
            mecanismo de retorno del producto, escondido en el único sitio
            donde ya estabas. Comunidad ya no vive en la cabecera: se
            alcanza desde Orar y desde Perfil, no como un icono en cada
            pantalla. */}
        <Link href="/avisos" asChild>
          <Tap
            accessibilityRole="link"
            // El número en el nombre accesible, no solo en el punto: un punto
            // de color no se anuncia, y el aviso es justo lo que trae a
            // alguien de vuelta.
            accessibilityLabel={
              unread
                ? `${t("notifications.title")}, ${t("community.unread", { count: unread })}`
                : t("notifications.title")
            }
            className="relative h-11 w-11 items-center justify-center"
          >
            <Bell
              size={icon.sm}
              color={colors.plum.DEFAULT}
              strokeWidth={icon.strokeWidth}
            />
            {unread ? (
              <View
                testID="unread-dot"
                className="absolute -right-1 top-0 h-2.5 w-2.5 rounded-full bg-ember-accent"
              />
            ) : null}
          </Tap>
        </Link>

        <Wordmark size={icon.md} />
      </View>
    </View>
  );
};
