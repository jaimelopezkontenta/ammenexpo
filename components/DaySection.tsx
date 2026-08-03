import { Text, View } from "react-native";

import { Card } from "@/components/Card";

type Tone = "plain" | "scripture" | "action";

interface DaySectionProps {
  label: string;
  tone?: Tone;
  children: React.ReactNode;
}

/**
 * Una de las partes del día: el versículo, lo que significa, la acción, la
 * oración.
 *
 * Los rótulos pasaron de mayúsculas pequeñas con tracking a la itálica
 * editorial del diseño. Es el mismo papel —decir qué es lo que viene— con la
 * voz del sistema nuevo, y de paso se leen mejor: las versalitas con letra
 * espaciada son de lo que peor envejece cuando alguien sube el tamaño del
 * texto del sistema.
 */
export const DaySection = ({
  label,
  tone = "plain",
  children,
}: DaySectionProps) => {
  if (tone === "plain") {
    return (
      <View className="gap-2">
        <Text className="font-editorial text-lg text-ember-ink">{label}</Text>
        {children}
      </View>
    );
  }

  // La acción es la única parte del día que sale del teléfono, así que es el
  // único bloque que pide algo — y el único sitio donde se gasta el cálido.
  return (
    <Card
      label={label}
      className={`gap-3 ${tone === "action" ? "bg-ember-pale/60" : ""}`}
    >
      {children}
    </Card>
  );
};
