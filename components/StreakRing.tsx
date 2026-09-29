import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { Txt } from "@/components/ui/Text";
import { useThemeColors } from "@/theme";
import { DURATION } from "@/theme/motion";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 64;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * La racha como arco, no como chip: el número en el centro, el avance en el
 * anillo. El objetivo de 7 días llena el círculo; por encima se queda lleno.
 */
export function StreakRing({
  days,
  goal = 7,
  accessibilityLabel,
}: {
  days: number;
  goal?: number;
  accessibilityLabel: string;
}) {
  const colors = useThemeColors();
  const reduce = useReducedMotion();
  const fill = Math.min(days / Math.max(goal, 1), 1);
  const progress = useSharedValue(reduce ? fill : 0);

  useEffect(() => {
    progress.value = withTiming(fill, {
      duration: reduce ? 0 : DURATION.enter,
    });
  }, [fill, progress, reduce]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <View
      className="h-16 w-16 items-center justify-center"
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={colors.plum.chip}
          strokeWidth={STROKE}
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={colors.ember.ink}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          animatedProps={animatedProps}
          rotation={-90}
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <Txt variant="subheading" className="tabular-nums">
          {days}
        </Txt>
      </View>
    </View>
  );
}
