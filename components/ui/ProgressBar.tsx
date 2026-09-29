import { View } from "react-native";

/**
 * Barra de progreso del sistema: riel de vidrio, relleno ember.
 * El porcentaje se reserva en layout (altura fija) para no mover CLS.
 */
export function ProgressBar({
  value,
  max,
  accessibilityLabel,
}: {
  value: number;
  max: number;
  accessibilityLabel: string;
}) {
  const safeMax = Math.max(max, 0);
  const safeValue = Math.min(Math.max(value, 0), safeMax);
  const pct = safeMax > 0 ? (safeValue / safeMax) * 100 : 0;

  return (
    <View
      className="h-2 overflow-hidden rounded-full bg-glass/70"
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: safeMax, now: safeValue }}
    >
      <View
        className="h-full rounded-full bg-ember-accent"
        style={{ width: `${pct}%` }}
      />
    </View>
  );
}
