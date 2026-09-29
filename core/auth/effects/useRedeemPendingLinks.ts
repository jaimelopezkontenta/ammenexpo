import { useQueryClient } from "@tanstack/react-query";
import { router, useRootNavigationState } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { redeemPendingTokens } from "../pendingToken";
import { redeemAction } from "../sessionFlow";
import { rememberReturnTo } from "@/core/nav/returnTo";
import type { RedeemDestination } from "@/core/plans/redeemOutcome";
import { qk } from "@/core/query/keys";

/**
 * Canjea el enlace que alguien abrió antes de tener sesión y le lleva adonde
 * apuntaba.
 *
 * Vivía dentro de `SessionProvider`, que es por donde pasa cada inicio de
 * sesión; sigue colgando de lo mismo (el `userId` de la sesión), solo que en
 * su propio hook. **Los dos efectos van en este orden y con estas
 * dependencias a propósito**: el primero canjea al cambiar de usuario y deja
 * el destino esperando; el segundo lo suelta solo cuando `AuthGate` ya no va
 * a sacar a nadie de donde aterrice (core/auth/sessionFlow.ts, `redeemStep`).
 */
export const useRedeemPendingLinks = ({
  userId,
  hasOnboarded,
  termsAccepted,
}: {
  userId: string | null;
  hasOnboarded: boolean | null;
  termsAccepted: boolean | null;
}) => {
  const queryClient = useQueryClient();
  // Adónde llevar tras canjear un enlace, a la espera de que se pueda navegar.
  const pendingDestination = useRef<RedeemDestination | null>(null);
  const [destinationTick, setDestinationTick] = useState(0);

  // The single place every sign-in passes through, which is why the redemption
  // hangs off the session and not off one of the four screens that can produce
  // one. It is a no-op once there is nothing stashed, so it costs one
  // AsyncStorage read per launch.
  useEffect(() => {
    if (!userId) {
      // Un destino de la sesión anterior no es de quien entre después.
      pendingDestination.current = null;
      return;
    }

    let active = true;

    void redeemPendingTokens().then((destination) => {
      if (!active || !destination) return;
      pendingDestination.current = destination;
      setDestinationTick((tick) => tick + 1);

      // Redeeming is what makes that plan visible. Without invalidating, the
      // Orar tab would keep insisting nobody had shared anything — this app
      // never refetches on focus, so it would say so until it was killed.
      void queryClient.invalidateQueries({ queryKey: qk.sharedWithMe.root });
      void queryClient.invalidateQueries({ queryKey: qk.circles.root });
    });

    return () => {
      active = false;
    };
  }, [userId, queryClient]);

  const rootNavigation = useRootNavigationState();
  const navigationReady = Boolean(rootNavigation?.key);

  // Un share canjeado al entrar abre el día que toca orar, y una invitación a
  // un círculo abre ese círculo — no Hoy, que dejaba a quien llegaba a una
  // pestaña de distancia y sin pista de qué había pasado. El invite code de
  // la app no lleva a ningún sitio concreto y no navega.
  //
  // Se navega solo con el navegador raíz ya montado: el canje puede resolver
  // en el arranque en frío, antes, y un `router.replace` en ese momento caía
  // en `/` arrastrando los parámetros de la ruta anterior (`/?token=…`).
  //
  // Y solo con las puertas de `AuthGate` cruzadas: en un alta nueva el canje
  // vuelve mientras faltan los términos y el onboarding, y navegar entonces
  // era perder el destino. Mientras falten, se le deja a `returnTo`, que es
  // adonde la puerta lleva al cruzar la última (core/auth/sessionFlow.ts).
  useEffect(() => {
    const destination = pendingDestination.current;
    if (!destination) return;

    const action = redeemAction(destination, {
      hasOnboarded,
      termsAccepted,
      navigationReady,
    });
    if (action.kind === "wait") return;
    pendingDestination.current = null;

    if (action.kind === "handoff") {
      rememberReturnTo(action.path);
      return;
    }

    router.replace(action.route);
  }, [destinationTick, navigationReady, hasOnboarded, termsAccepted]);
};
