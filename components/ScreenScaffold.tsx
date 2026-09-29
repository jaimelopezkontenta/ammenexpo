import { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Stack } from "expo-router";

import { DawnBackground } from "@/components/DawnBackground";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { useScreenPadding } from "@/components/useScreenPadding";

type SkeletonPreset = "day" | "list" | "profile" | "circle";

type Props = {
  /** El título del header (y del documento en web). */
  title: string;
  /** La rama de carga: pinta el esqueleto o el spinner con el header puesto. */
  loading?: boolean;
  /** El preset de esqueleto del dominio; sin él, spinner centrado. */
  skeleton?: SkeletonPreset;
  /** La rama de error, con su retry y su mensaje específico si lo hay. */
  error?: boolean;
  /** El error real, para que ErrorState distinga «sin conexión» (ver classifyError). */
  cause?: unknown;
  errorMessage?: string;
  onRetry?: () => void;
  /**
   * `true` (por defecto): el contenido va en un ScrollView con el ancho de
   * lectura y los paddings del sistema. `false`: un View flex-1 y el caller
   * decide (listas virtualizadas, layouts propios).
   */
  scroll?: boolean;
  /**
   * Clases extra del contenedor de contenido. Se SUMAN a las del sistema, no
   * las sustituyen: entre dos clases de la misma familia no gana la última
   * del string sino la que va después en la hoja de Tailwind (dentro de una
   * familia, orden alfabético), en web y en nativo. `gap-6`/`gap-7`/`gap-8`
   * pisan el `gap-5`; `gap-3`/`gap-4` no, y tampoco un `py-10` al `py-8`.
   * Una pantalla que necesite eso no encaja aquí tal cual.
   */
  contentClassName?: string;
  /** Opciones extra de la pantalla (animation, headerRight…). */
  screenOptions?: Parameters<typeof Stack.Screen>[0]["options"];
  children?: ReactNode;
};

/**
 * El andamio de una pantalla de stack: header + fondo + estados + ancho de
 * lectura, declarados una sola vez.
 *
 * Antes cada pantalla repetía `<Stack.Screen headerShown>` en cada rama
 * temprana (72 veces en 31 ficheros) porque el default del stack raíz es sin
 * header, y una rama olvidada nacía sin título ni volver — pasó más de una
 * vez. Aquí el header existe siempre, pase lo que pase con los datos, y la
 * clase del ancho de lectura deja de copiarse a mano.
 */
export const ScreenScaffold = ({
  title,
  loading = false,
  skeleton,
  error = false,
  cause,
  errorMessage,
  onRetry,
  scroll = true,
  contentClassName = "",
  screenOptions,
  children,
}: Props) => {
  const { scrollBottom } = useScreenPadding();

  return (
    <>
      <Stack.Screen options={{ title, headerShown: true, ...screenOptions }} />
      {loading ? (
        <LoadingState skeleton={skeleton} />
      ) : error ? (
        <ErrorState error={cause} onRetry={onRetry} message={errorMessage} />
      ) : (
        <DawnBackground>
          {scroll ? (
            <ScrollView
              contentContainerClassName={`gap-5 px-7 py-8 md:w-full md:max-w-read md:self-center ${contentClassName}`}
              contentContainerStyle={{ paddingBottom: scrollBottom }}
            >
              {children}
            </ScrollView>
          ) : (
            <View className={`flex-1 ${contentClassName}`}>{children}</View>
          )}
        </DawnBackground>
      )}
    </>
  );
};
