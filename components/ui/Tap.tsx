import * as Haptics from "expo-haptics";
import { cssInterop } from "nativewind";
import { forwardRef, useCallback } from "react";
import {
  GestureResponderEvent,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  AnimatedStyle,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

/**
 * El `Pressable` del sistema. Todo lo tocable de la app pasa por aquí.
 *
 * Hasta ahora solo `Button` respondía al tacto (por el `TouchableOpacity` de
 * dentro) y los otros doscientos `Pressable` estaban muertos: ni se hundían ni
 * vibraban. Una interfaz que no responde al dedo se siente barata aunque cada
 * pantalla esté cuidada — y la respuesta correcta es al **contacto**
 * (`onPressIn`), no al soltar, que es cuando ya se disparó la acción.
 *
 * Escala + opacidad y no `android_ripple`: el ripple es de Material, se ve
 * distinto en cada plataforma, y el hundido leve funciona igual en iOS,
 * Android y web.
 *
 * Quien pidió menos movimiento en el sistema conserva la respuesta, pero solo
 * en opacidad: un cambio de opacidad no marea; un escalado sí puede.
 */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Componente de fuera del vocabulario base de NativeWind: sin esto, el
// `className` que le llega no se compila a estilo (mismo caso que el
// `LinearGradient` de `DawnBackground`).
cssInterop(AnimatedPressable, { className: "style" });

type Haptic = "selection" | "light" | "success" | "warning" | "none";

export type TapProps = Omit<PressableProps, "style"> & {
  /**
   * Sin la variante función-de-estado de `Pressable`: Reanimated no puede
   * inyectar el estilo animado a través de una función, y el estado pressed
   * ya lo cuenta la propia animación. Sí acepta estilos animados del caller
   * (p. ej. el fundido de color de los chips).
   */
  style?: StyleProp<AnimatedStyle<ViewStyle>>;
  /** Qué se siente al tocar. `selection` por defecto; `none` lo apaga. */
  haptic?: Haptic;
  /** Hasta dónde se hunde. 1 desactiva la escala. */
  scaleTo?: number;
  /** Hasta dónde se atenúa. 1 desactiva la opacidad. */
  dimTo?: number;
};

const SPRING = { damping: 20, stiffness: 350 } as const;

/**
 * Dispara la háptica sin pasar por `Tap` — para los controles que no son
 * nuestros (la tab bar de react-navigation) o para la háptica de resultado
 * (el éxito al confirmar algo), que no corresponde a ningún toque.
 */
export const triggerHaptic = (haptic: Haptic) => fireHaptic(haptic);

const fireHaptic = (haptic: Haptic) => {
  // En web el módulo es un no-op, pero el guard hace explícito que la háptica
  // es de teléfono; y `none` existe para los taps que disparan su propia
  // háptica de resultado (p. ej. éxito al confirmar).
  if (Platform.OS === "web" || haptic === "none") return;
  switch (haptic) {
    case "light":
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case "success":
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case "warning":
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      break;
    default:
      void Haptics.selectionAsync();
  }
};

export const Tap = forwardRef<View, TapProps>(
  (
    {
      haptic = "selection",
      scaleTo = 0.97,
      dimTo = 0.92,
      onPressIn,
      onPressOut,
      style,
      disabled,
      ...pressableProps
    },
    ref,
  ) => {
    const pressed = useSharedValue(0);
    const reduceMotion = useReducedMotion();

    const handlePressIn = useCallback(
      (event: GestureResponderEvent) => {
        pressed.value = withSpring(1, SPRING);
        fireHaptic(haptic);
        onPressIn?.(event);
      },
      [haptic, onPressIn, pressed],
    );

    const handlePressOut = useCallback(
      (event: GestureResponderEvent) => {
        pressed.value = withSpring(0, SPRING);
        onPressOut?.(event);
      },
      [onPressOut, pressed],
    );

    const feedbackStyle = useAnimatedStyle(() => ({
      transform: [
        { scale: reduceMotion ? 1 : 1 - pressed.value * (1 - scaleTo) },
      ],
      opacity: 1 - pressed.value * (1 - dimTo),
    }));

    return (
      <AnimatedPressable
        ref={ref}
        {...pressableProps}
        disabled={disabled}
        onPressIn={disabled ? onPressIn : handlePressIn}
        onPressOut={disabled ? onPressOut : handlePressOut}
        // El feedback va después para que la escala no se pise.
        style={[style, feedbackStyle]}
      />
    );
  },
);

Tap.displayName = "Tap";
