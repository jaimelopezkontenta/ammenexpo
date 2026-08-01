import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Link, Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import { TabBarIcon } from "../../components/TabBarIcon";
import { useSession } from "@/core/auth/SessionProvider";
import { useUnreadNotifications } from "@/core/notifications/queries";

/**
 * Los dos accesos que no son pestaña: los avisos y la comunidad.
 *
 * Van aquí arriba y no abajo porque en móvil seis iconos en la barra van muy
 * justos, y porque las dos son cosas a las que se entra, no sitios donde se
 * está. Las dos son rutas completas: ascender cualquiera a pestaña, si resulta
 * que es lo que trae de vuelta a la gente, es cambiar dos líneas de aquí.
 */
const TodayHeaderIcons = () => {
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
          <FontAwesome name="bell-o" size={20} color="#1C1917" />
          {unread ? (
            <View className="absolute right-2 top-0 h-2.5 w-2.5 rounded-full bg-clay" />
          ) : null}
        </Pressable>
      </Link>

      <Link href="/comunidad" asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t("community.title")}
          className="pl-3 pr-5"
        >
          <FontAwesome name="users" size={20} color="#1C1917" />
        </Pressable>
      </Link>
    </View>
  );
};

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        // Los mismos valores que el tema, escritos a mano porque las opciones
        // de navegación no pasan por NativeWind.
        tabBarActiveTintColor: "#1C1917",
        tabBarInactiveTintColor: "#726A62",
        tabBarStyle: {
          backgroundColor: "#FBF8F4",
          borderTopColor: "#E6DFD5",
        },
        headerStyle: { backgroundColor: "#FBF8F4" },
        headerShadowVisible: false,
        headerTintColor: "#1C1917",
        sceneStyle: { backgroundColor: "#FBF8F4" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.today"),
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          // La comunidad vive detrás de un icono y no en una sexta pestaña: en
          // móvil seis iconos van muy justos, y esto deja el bucle diario
          // intacto. Va como ruta completa a propósito — si resulta que la
          // comunidad es lo que trae de vuelta a la gente, ascenderla a pestaña
          // es cambiar dos líneas de este archivo.
          headerRight: () => <TodayHeaderIcons />,
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
