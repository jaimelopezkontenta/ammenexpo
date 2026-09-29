import { useCallback, useRef, useState } from "react";
import { useWindowDimensions, type View } from "react-native";

import { isCtaBelowFold, showFloatingCta } from "@/core/plans/todayView";

/**
 * «Ya oré hoy» siempre a la vista. En móvil el journey empuja el CTA bajo
 * el pliegue (en 390×844 asomaba una franja); mientras no se ve, un gemelo
 * flota encima de la barra, y desaparece en cuanto el de verdad asoma. Se
 * mide en coordenadas de ventana, igual en nativo y en web: el centro del
 * CTA contra el borde de abajo del área que hace scroll.
 *
 * `viewportRef` va en la vista que envuelve el scroll y `ctaRef` en la del
 * CTA de verdad; `checkCta`, en sus `onLayout` y en el `onScroll`.
 */
export const useFloatingCta = (prayed: boolean | undefined) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 1024;
  const viewportRef = useRef<View>(null);
  const ctaRef = useRef<View>(null);
  const [ctaOffscreen, setCtaOffscreen] = useState(false);

  const checkCta = useCallback(() => {
    const viewport = viewportRef.current;
    const cta = ctaRef.current;
    if (!viewport || !cta) return;
    viewport.measureInWindow((_vx, viewportY, _vw, viewportHeight) => {
      cta.measureInWindow((_x, ctaY, _w, ctaHeight) => {
        setCtaOffscreen(
          isCtaBelowFold(
            { y: viewportY, height: viewportHeight },
            { y: ctaY, height: ctaHeight },
          ),
        );
      });
    });
  }, []);

  return {
    viewportRef,
    ctaRef,
    checkCta,
    floatingCta: showFloatingCta({ prayed, ctaOffscreen, isWide }),
  };
};
