import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { Card } from "@/components/Card";
import { Txt } from "@/components/ui/Text";
import { gradients, useIsDark } from "@/theme";

type Tone = "plain" | "scripture" | "action";

interface DaySectionProps {
  label: string;
  tone?: Tone;
  children: React.ReactNode;
}

/**
 * Una de las partes del día: la palabra, qué significa, la acción, la oración.
 *
 * **Las cuatro son tarjeta.** Antes solo lo eran dos, y las otras dos iban
 * sueltas sobre el fondo: el día se leía como dos bloques y dos párrafos
 * huérfanos en vez de como cuatro pasos. En el montaje las cuatro tienen la
 * misma caja.
 *
 * Los rótulos pasaron de mayúsculas pequeñas con tracking a la itálica
 * editorial. Es el mismo papel —decir qué es lo que viene— con la voz del
 * sistema nuevo, y de paso se leen mejor: las versalitas con letra espaciada
 * son de lo que peor envejece cuando alguien sube el tamaño del texto del
 * sistema.
 */
export const DaySection = ({
  label,
  tone = "plain",
  children,
}: DaySectionProps) => {
  const isDark = useIsDark();
  // La acción es la única parte del día que sale del teléfono, así que es la
  // única que se calienta. Un degradado en diagonal, como en el montaje, y no
  // un color plano: con lo pálido que es el sistema, un relleno liso más no se
  // distinguiría de una tarjeta normal.
  if (tone === "action") {
    return (
      <View className="overflow-hidden rounded-card shadow-card">
        <LinearGradient
          colors={isDark ? gradients.dayActionDark : gradients.dayAction}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.warm}
        >
          <Txt variant="editorialSm" className="mb-2">
            {label}
          </Txt>
          {children}
        </LinearGradient>
      </View>
    );
  }

  return (
    <Card label={label} labelVariant="editorialSm" className="gap-2">
      {children}
    </Card>
  );
};

const styles = StyleSheet.create({
  warm: { padding: 20 },
});
