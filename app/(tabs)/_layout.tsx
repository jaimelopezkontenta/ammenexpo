import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";

import { Glass } from "../../components/Glass";
import { TabBarIcon } from "../../components/TabBarIcon";
import { useSession } from "@/core/auth/SessionProvider";
import { useUnreadCounts } from "@/core/circles/queries";

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
        // Transparente para que se vea el vidrio de `tabBarBackground`, que va
        // detrás. La barra **no** es absoluta: en el diseño ocupa su sitio y no
        // flota sobre el contenido, así que ninguna pantalla necesita reservar
        // hueco abajo — y ninguna lista acaba con la última fila tapada.
        tabBarStyle: {
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () => (
          <Glass
            style={[
              StyleSheet.absoluteFill,
              {
                borderWidth: 0,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: "rgba(255,255,255,0.65)",
              },
            ]}
            intensity={28}
            readable
          />
        ),
        // Sin barra de navegación: pintaba una franja sólida encima del
        // degradado, que sobre un amanecer es una costura horizontal justo en
        // la parte de la pantalla que más se mira. La cabecera la pone cada
        // pestaña por dentro, con `TabHeader`.
        headerShown: false,
        // Transparente: cada pantalla pone su propio degradado, y un color
        // sólido aquí se vería como una costura en el borde.
        sceneStyle: { backgroundColor: "transparent" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.today"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="home" color={color} focused={focused} />
          ),
        }}
      />
      {/* Second, next to Hoy: it is the tab most closely tied to the day's
          verse, and with five tabs the order starts to matter. */}
      <Tabs.Screen
        name="biblia"
        options={{
          title: t("tabs.bible"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="book" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="orar"
        options={{
          title: t("tabs.pray"),
          // El isotipo, no un corazón: es la pestaña del centro y el centro
          // del producto.
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="orb" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="circulos"
        options={{
          title: t("tabs.circles"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="users" color={color} focused={focused} />
          ),
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
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="user" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
