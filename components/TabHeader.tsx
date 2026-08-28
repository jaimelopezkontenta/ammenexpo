import { Link } from "expo-router";
import { Bell } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Wordmark } from "@/components/Wordmark";
import { useSession } from "@/core/auth/SessionProvider";
import { useUnreadNotifications } from "@/core/notifications/queries";

import { icon, useThemeColors } from "@/theme";

import { Tap } from "@/components/ui/Tap";

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

const greetingKey = (hour: number) => {
  if (hour < 12) return "common.greetingMorning";
  if (hour < 20) return "common.greetingAfternoon";
  return "common.greetingEvening";
};

export const TabHeader = ({
  title,
  name,
}: {
  title: string;
  /** El nombre de quien entra. Sin él no se saluda, en vez de saludar a nadie. */
  name?: string | null;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const { session } = useSession();
  const { data: unread } = useUnreadNotifications(session?.user.id);
  const insets = useSafeAreaInsets();

  return (
    // El Provider no aplica padding; sin esto el título y la campana
    // quedan bajo la status bar. NativeWind no conoce el notch: el 8
    // extra va en style, no en una clase pt-*.
    // En md+ la cabecera se alinea con la columna de lectura, no con el filo
    // de la ventana: un título pegado arriba-izquierda a 2000 px del contenido
    // centrado se leía como de otra página.
    <View
      className="w-full flex-row items-center justify-between gap-3 px-7 pb-2 md:max-w-read md:self-center md:px-10"
      style={{ paddingTop: insets.top + 8 }}
    >
      <View className="min-w-0 flex-1">
        <Text className="font-sans-bold text-3xl text-plum">{title}</Text>
        {name ? (
          <Text
            numberOfLines={1}
            className="mt-0.5 font-editorial text-base text-plum"
          >
            {t(greetingKey(new Date().getHours()))}, {name}
          </Text>
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
              <View className="absolute -right-1 top-0 h-2.5 w-2.5 rounded-full bg-ember-accent" />
            ) : null}
          </Tap>
        </Link>

        <Wordmark size={icon.md} />
      </View>
    </View>
  );
};
