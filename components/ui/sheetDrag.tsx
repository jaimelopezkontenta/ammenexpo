import { useEffect } from "react";
import { View } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { SPRING } from "@/theme/motion";

/**
 * El gesto de las hojas: arrastrar hacia abajo para cerrar, como cualquier
 * sheet nativo. El pan vive **solo en el asa** (`SheetGrabHandle`), no en la
 * tarjeta entera: dentro hay scrolls y campos, y un gesto que compite con
 * ellos es peor que ningún gesto.
 *
 * Es control directo del dedo, así que no se apaga con reduced-motion (lo que
 * marea es el movimiento autónomo, no el que uno mismo arrastra); solo el
 * asentarse de vuelta usa el muelle suave del sistema.
 */
export const useSheetDrag = (onClose: () => void, visible: boolean) => {
  const dragY = useSharedValue(0);

  // Al reabrir, la hoja arranca en su sitio: el arrastre del cierre anterior
  // no se hereda.
  useEffect(() => {
    if (visible) dragY.value = 0;
  }, [visible, dragY]);

  const panGesture = Gesture.Pan()
    .onChange((event) => {
      // Los callbacks de `Gesture` son handlers de evento (worklets), no
      // render: la regla de inmutabilidad no los reconoce todavía.
      // eslint-disable-next-line react-hooks/immutability
      dragY.value = Math.max(0, event.translationY); // Solo hacia abajo: hacia arriba la hoja no tiene a dónde ir.
    })
    .onEnd((event) => {
      if (event.translationY > 80 || event.velocityY > 800) {
        runOnJS(onClose)();
        // Se queda donde está: el fade del Modal se lleva la hoja, y al
        // reabrir el valor arranca de cero.
        return;
      }
      // eslint-disable-next-line react-hooks/immutability
      dragY.value = withSpring(0, SPRING.gentle);
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  return { panGesture, dragStyle };
};

/** El asa visual de una hoja: la pastilla gris de "esto se arrastra". */
export const SheetGrabHandle = () => (
  <View className="items-center pb-1">
    <View className="h-1 w-9 rounded-full bg-plum/20" />
  </View>
);
