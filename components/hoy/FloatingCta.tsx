import { type ReactNode, useState } from "react";
import Animated from "react-native-reanimated";

import { useToastLift } from "@/components/ui/Toast";
import { enterFade } from "@/theme/motion";

/**
 * El contenedor del «Ya oré hoy» gemelo. Mientras está montado, los avisos
 * suben su altura para no pintarse encima (components/ui/Toast.tsx); al
 * desmontarse —el de verdad asomó, o ya oraste— bajan solos.
 */
export const FloatingCta = ({ children }: { children: ReactNode }) => {
  const [height, setHeight] = useState(0);
  useToastLift(height);

  return (
    <Animated.View
      entering={enterFade}
      pointerEvents="box-none"
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      className="absolute inset-x-0 bottom-0 gap-2 px-7 pb-4"
    >
      {children}
    </Animated.View>
  );
};
