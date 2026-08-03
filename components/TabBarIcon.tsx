import { BookOpen, House, LucideIcon, User, Users } from "lucide-react-native";
import { ColorValue, View } from "react-native";

import { Orb } from "@/components/Orb";

/**
 * Los iconos de la barra, en Lucide.
 *
 * El trazo fino de Lucide es el del montaje de diseño; FontAwesome tenía el
 * peso de otra época y el relleno sólido peleaba con el vidrio. Solo dos
 * ficheros dependían de él, así que el cambio no se extendió.
 *
 * **La pestaña Orar no lleva icono: lleva el isotipo.** Es el centro de la
 * barra y el centro del producto, y el orbe es lo que la app es. Lo que marca
 * que está activa es la barra de acento de arriba, igual que en las demás — el
 * orbe no cambia de color nunca.
 */

const ICONS: Record<string, LucideIcon> = {
  home: House,
  book: BookOpen,
  users: Users,
  user: User,
};

export const TabBarIcon = ({
  name,
  color,
  focused,
}: {
  name: keyof typeof ICONS | "orb";
  // Lo que da react-navigation es `ColorValue`, no `string`: en iOS puede ser
  // un color del sistema, que es un objeto opaco. Lucide solo entiende cadenas.
  color: ColorValue;
  focused: boolean;
}) => {
  const Icon = name === "orb" ? null : ICONS[name];

  return (
    <View className="items-center">
      {/* El indicador de activa: una barra corta encima del icono, como en el
          diseño. Va aquí y no en las opciones de la pestaña porque
          react-navigation no tiene ese adorno. */}
      <View
        className={`mb-1.5 h-[3px] w-[34px] rounded-sm ${
          focused ? "bg-ember-accent" : "bg-transparent"
        }`}
      />
      {Icon ? (
        <Icon
          size={24}
          color={typeof color === "string" ? color : "#413653"}
          strokeWidth={1.7}
        />
      ) : (
        <Orb size={26} />
      )}
    </View>
  );
};
