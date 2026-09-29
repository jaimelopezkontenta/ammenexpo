// El bottom-tabs que usa expo-router es su copia vendorizada, no el paquete
// del registro (que no está instalado): el tipo sale de la misma copia que
// tipa la prop `tabBar` de `<Tabs>`.
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import { StyleSheet, View } from "react-native";

import { Glass } from "@/components/Glass";
import { Tap } from "@/components/ui/Tap";
import { Txt } from "@/components/ui/Text";
import { useThemeColors, withAlpha } from "@/theme";

/** El ancho del raíl; las escenas reservan este hueco en `sceneStyle`. */
export const RAIL_WIDTH = 92;

/**
 * La navegación de escritorio: un raíl lateral, no cinco iconos repartidos
 * por dos mil píxeles de barra inferior. Mismo árbol de rutas, mismos iconos,
 * mismo vidrio — solo cambia dónde se sienta.
 *
 * Va absoluto sobre el navigator (alto completo, pegado a la izquierda) y las
 * escenas le hacen sitio con `paddingLeft`; así el navigator no reserva una
 * barra inferior fantasma.
 */
export const NavRail = ({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) => {
  const colors = useThemeColors();

  return (
    <Glass
      intensity={28}
      fill={0.55}
      style={[
        styles.rail,
        {
          borderWidth: 0,
          borderRightWidth: StyleSheet.hairlineWidth,
          borderRightColor: withAlpha(colors.glassedge, 0.65),
        },
      ]}
    >
      <View className="flex-1 items-center justify-center gap-2 py-6">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? colors.ember.ink : colors.plum.DEFAULT;
          const label =
            typeof options.title === "string" ? options.title : route.name;
          const badge =
            typeof options.tabBarBadge === "number"
              ? options.tabBarBadge
              : undefined;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Tap
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={onPress}
              className="relative w-full items-center gap-1 rounded-input py-3"
            >
              {options.tabBarIcon?.({ focused, color, size: 24 })}
              <Txt
                variant="label"
                numberOfLines={1}
                // La tinta acompaña al icono (ember al enfocar). El raíl
                // pedía además 11,5 px con `text-[11.5px]`, pero esa clase
                // nunca ganó al `text-sm` de label (va antes en la hoja): el
                // raíl siempre se vio a 14 px, y así sigue.
                style={{ color }}
              >
                {label}
              </Txt>
              {badge ? (
                <View className="absolute right-4 top-1 min-w-5 items-center justify-center rounded-full bg-ember-accent px-1.5 py-0.5">
                  <Txt variant="subheading" tone="onDark" className="text-xs">
                    {badge}
                  </Txt>
                </View>
              ) : null}
            </Tap>
          );
        })}
      </View>
    </Glass>
  );
};

const styles = StyleSheet.create({
  rail: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: RAIL_WIDTH,
  },
});
