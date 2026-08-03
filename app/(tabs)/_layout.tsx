import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Link, Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { TabBarIcon } from "../../components/TabBarIcon";
import { useSession } from "@/core/auth/SessionProvider";
import { useUnreadCounts } from "@/core/circles/queries";
import { useUnreadNotifications } from "@/core/notifications/queries";

/**
 * Los dos accesos que no son pestaña: los avisos y la comunidad.
 *
 * Van arriba y no abajo porque en móvil seis iconos en la barra van muy justos,
 * y porque las dos son cosas a las que se entra, no sitios donde se está. Las
 * dos son rutas completas: ascender cualquiera a pestaña, si resulta que es lo
 * que trae de vuelta a la gente, es cambiar dos líneas de aquí.
 */
const HeaderIcons = () => {
  const { t } = useTranslation();
  const { session } = useSession();
  const { data: unread } = useUnreadNotifications(session?.user.id);

  return (
    <View className="flex-row items-center">
      <Link href="/avisos" asChild>
        <Pressable
          accessibilityRole="link"
          // El número en el nombre accesible, no solo en el punto: un punto de
          // color no se anuncia, y el aviso es justo lo que trae a alguien de
          // vuelta.
          accessibilityLabel={
            unread
              ? `${t("notifications.title")}, ${t("community.unread", { count: unread })}`
              : t("notifications.title")
          }
          className="pl-5 pr-3"
        >
          <FontAwesome name="bell-o" size={20} color="#413653" />
          {unread ? (
            <View className="absolute right-2 top-0 h-2.5 w-2.5 rounded-full bg-ember-accent" />
          ) : null}
        </Pressable>
      </Link>

      <Link href="/comunidad" asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t("community.title")}
          className="pl-3 pr-5"
        >
          <FontAwesome name="users" size={20} color="#413653" />
        </Pressable>
      </Link>
    </View>
  );
};

export default function TabLayout() {
  const { t } = useTranslation();
  const { session } = useSession();
  const { data: unreadByCircle } = useUnreadCounts(session?.user.id);

  const unreadTotal = Object.values(unreadByCircle ?? {}).reduce(
    (sum, n) => sum + n,
    0,
  );

  return (
    <Tabs
      screenOptions={{
        // Los mismos valores que el tema, escritos a mano porque las opciones
        // de navegación no pasan por NativeWind.
        tabBarActiveTintColor: "#E2703F",
        tabBarInactiveTintColor: "#413653",
        tabBarStyle: {
          backgroundColor: "#FFF6EA",
          borderTopColor: "rgba(255,255,255,0.65)",
        },
        headerStyle: { backgroundColor: "#FFF6EA" },
        headerShadowVisible: false,
        headerTintColor: "#413653",
        sceneStyle: { backgroundColor: "#FFF6EA" },
        // En **todas** las pestañas, no solo en Hoy. Vivían en la cabecera de
        // Hoy, así que quien abría la app en Orar o en Círculos no se enteraba
        // nunca de que alguien había orado por él: el mecanismo de retorno del
        // producto, escondido en el único sitio donde ya estabas.
        headerRight: () => <HeaderIcons />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.today"),
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      {/* Second, next to Hoy: it is the tab most closely tied to the day's
          verse, and with five tabs the order starts to matter. */}
      <Tabs.Screen
        name="biblia"
        options={{
          title: t("tabs.bible"),
          tabBarIcon: ({ color }) => <TabBarIcon name="book" color={color} />,
        }}
      />
      <Tabs.Screen
        name="orar"
        options={{
          title: t("tabs.pray"),
          tabBarIcon: ({ color }) => <TabBarIcon name="heart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="circulos"
        options={{
          title: t("tabs.circles"),
          tabBarIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
          // El punto de mensajes sin leer se pintaba **dentro** de la pantalla,
          // así que había que entrar para saber que había algo que ver.
          tabBarBadge: unreadTotal || undefined,
          tabBarBadgeStyle: { backgroundColor: "#E2703F" },
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}
