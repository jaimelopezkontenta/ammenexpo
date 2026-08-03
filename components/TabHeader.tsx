import { Link } from "expo-router";
import { Bell, Users } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Wordmark } from "@/components/Wordmark";
import { useSession } from "@/core/auth/SessionProvider";
import { useUnreadNotifications } from "@/core/notifications/queries";

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
  const { session } = useSession();
  const { data: unread } = useUnreadNotifications(session?.user.id);

  return (
    <View className="flex-row items-center justify-between gap-3 px-7 pb-2 pt-2">
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
        {/* Los dos accesos que no son pestaña, en **todas** ellas. Vivían solo
            en la cabecera de Hoy, así que quien abría la app en Orar o en
            Círculos no se enteraba nunca de que alguien había orado por él: el
            mecanismo de retorno del producto, escondido en el único sitio
            donde ya estabas. */}
        <Link href="/avisos" asChild>
          <Pressable
            accessibilityRole="link"
            // El número en el nombre accesible, no solo en el punto: un punto
            // de color no se anuncia, y el aviso es justo lo que trae a
            // alguien de vuelta.
            accessibilityLabel={
              unread
                ? `${t("notifications.title")}, ${t("community.unread", { count: unread })}`
                : t("notifications.title")
            }
          >
            <Bell size={21} color="#413653" strokeWidth={1.7} />
            {unread ? (
              <View className="absolute -right-1 top-0 h-2.5 w-2.5 rounded-full bg-ember-accent" />
            ) : null}
          </Pressable>
        </Link>

        <Link href="/comunidad" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t("community.title")}
          >
            <Users size={21} color="#413653" strokeWidth={1.7} />
          </Pressable>
        </Link>

        <Wordmark size={23} />
      </View>
    </View>
  );
};
