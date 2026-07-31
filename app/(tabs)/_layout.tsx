import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

import { TabBarIcon } from "../../components/TabBarIcon";

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
