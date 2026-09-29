import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, useWindowDimensions } from "react-native";

import { Glass } from "../../components/Glass";
import { NavRail, RAIL_WIDTH } from "../../components/NavRail";
import { TabBarIcon } from "../../components/TabBarIcon";
import { triggerHaptic } from "@/components/ui/Tap";
import { useUserId } from "@/core/auth/useUserId";
import { useUnreadCounts } from "@/core/circles/queries";

import { useThemeColors, withAlpha } from "@/theme";
import { remFromPx } from "@/theme/typography";

// La etiqueta de la barra, en px con la letra por defecto.
const TAB_LABEL_PX = 11.5;
// El alto de la barra en web con la letra por defecto: el suelo, no el techo.
const TAB_BAR_WEB_MIN_HEIGHT = 62;

export default function TabLayout() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const userId = useUserId();
  const { data: unreadByCircle } = useUnreadCounts(userId);
  // El mismo umbral que `md:` de NativeWind: en escritorio la navegación es
  // un raíl lateral; en el teléfono, la barra de abajo de siempre.
  const isDesktop = useWindowDimensions().width >= 768;

  const unreadTotal = Object.values(unreadByCircle ?? {}).reduce(
    (sum, n) => sum + n,
    0,
  );

  return (
    <Tabs
      // El cambio de pestaña responde al dedo como todo lo demás. En web el
      // disparador es un no-op.
      screenListeners={{ tabPress: () => triggerHaptic("selection") }}
      // Con el raíl, el navigator no pinta barra inferior; las escenas le
      // hacen sitio con `paddingLeft` (el raíl va absoluto a la izquierda).
      tabBar={isDesktop ? (props) => <NavRail {...props} /> : undefined}
      screenOptions={{
        // Cambiar de pestaña funde el contenido en vez de cortarlo. Es el
        // bottom-tabs v7 (Animated JS): idéntico en web y nativo, y por
        // debajo de los 300 ms del contrato de motion.
        animation: "fade",
        transitionSpec: {
          animation: "timing",
          config: { duration: 180 },
        },
        // Los mismos valores que el tema, escritos a mano porque las opciones
        // de navegación no pasan por NativeWind.
        // `ember.ink` y no el acento decorativo: la etiqueta de la pestaña
        // activa son once píxeles y medio, y el acento da 3,17:1 sobre el
        // vidrio de la barra. El naranja pleno se queda donde no lleva texto:
        // la barrita de encima del icono.
        tabBarActiveTintColor: colors.ember.ink,
        tabBarInactiveTintColor: colors.plum.DEFAULT,
        // Transparente para que se vea el vidrio de `tabBarBackground`, que va
        // detrás. La barra **no** es absoluta: en el diseño ocupa su sitio y no
        // flota sobre el contenido, así que ninguna pantalla necesita reservar
        // hueco abajo — y ninguna lista acaba con la última fila tapada.
        // Las etiquetas de la barra no pasan por NativeWind, así que salían en
        // la tipografía del sistema: cinco palabras en otra letra, en la parte
        // de la app que siempre está a la vista.
        //
        // En web va en `rem`, como todo lo que pasa por NativeWind, para que
        // crezca con la letra del navegador; con la de por defecto (16 px)
        // mide los mismos 11,5 px. En nativo la escala la pone el sistema.
        tabBarLabelStyle: {
          fontFamily: "GeneralSans-Medium",
          fontSize:
            Platform.OS === "web"
              ? // react-native-web pasa la cadena tal cual al CSS; el tipo
                // de React Native solo conoce números.
                (remFromPx(TAB_LABEL_PX) as unknown as number)
              : TAB_LABEL_PX,
        },
        tabBarStyle: {
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          // Solo web: con el alto por defecto las descendentes de "Círculos"
          // y "Perfil" salían recortadas. Los 62 son un mínimo y no un alto
          // fijo: con la letra del navegador más grande la etiqueta crece y
          // la barra con ella, en vez de cortarla. `height: "auto"` pisa el
          // alto numérico que react-navigation pone por su cuenta. En nativo
          // el alto lo decide la plataforma (incluye el safe-area) y no se
          // toca.
          ...(Platform.OS === "web"
            ? {
                height: "auto",
                minHeight: TAB_BAR_WEB_MIN_HEIGHT,
                paddingBottom: 6,
              }
            : null),
        },
        tabBarBackground: () => (
          <Glass
            style={[
              StyleSheet.absoluteFill,
              {
                borderWidth: 0,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: withAlpha(colors.glassedge, 0.65),
              },
            ]}
            intensity={28}
            fill={0.55}
          />
        ),
        // Sin barra de navegación: pintaba una franja sólida encima del
        // degradado, que sobre un amanecer es una costura horizontal justo en
        // la parte de la pantalla que más se mira. La cabecera la pone cada
        // pestaña por dentro, con `TabHeader`.
        headerShown: false,
        // Transparente: cada pantalla pone su propio degradado, y un color
        // sólido aquí se vería como una costura en el borde.
        sceneStyle: {
          backgroundColor: "transparent",
          ...(isDesktop ? { paddingLeft: RAIL_WIDTH } : null),
        },
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
          title: t("tabs.together"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="users" color={color} focused={focused} />
          ),
          // El punto de mensajes sin leer se pintaba **dentro** de la pantalla,
          // así que había que entrar para saber que había algo que ver.
          tabBarBadge: unreadTotal || undefined,
          tabBarBadgeStyle: { backgroundColor: colors.ember.accent },
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
