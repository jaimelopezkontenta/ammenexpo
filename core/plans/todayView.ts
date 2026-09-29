import { GenerationInFlight, RequestIdConflict } from "./queries";

/**
 * Las decisiones de la pestaña Hoy (app/(tabs)/index.tsx), puras para poder
 * probarlas sin montar la pantalla: qué plan se enseña, cuál de sus siete
 * caras toca, qué texto lleva cada una y qué error decir. La pantalla solo
 * compone lo que esto decide.
 */

/**
 * El plan de la pantalla: el elegido o, si no se eligió ninguno (o el elegido
 * ya no está), el más nuevo — lo que Hoy enseñó siempre, y lo que tiene
 * sentido para quien nunca eligió.
 */
export const pickActivePlan = <Plan extends { id: string }>(
  plans: readonly Plan[] | undefined,
  activePlanId: string | null | undefined,
): Plan | null =>
  (plans ?? []).find((entry) => entry.id === activePlanId) ??
  (plans ?? [])[0] ??
  null;

/**
 * El primer plan compartido contigo cuyo dueño oró hoy por ti: «ora tú por su
 * plan» necesita un plan de verdad al que apuntar.
 */
export const prayBackPlanIdFor = (
  sharedWithMe: readonly { owner_id: string; plan_id: string }[] | undefined,
  prayedForMe: readonly { intercessor_id: string }[] | undefined,
): string | null =>
  (sharedWithMe ?? []).find((shared) =>
    (prayedForMe ?? []).some(
      (person) => person.intercessor_id === shared.owner_id,
    ),
  )?.plan_id ?? null;

/**
 * Por qué Hoy no tiene día que orar: sin plan, un plan fallido (empezar de
 * nuevo gasta otro hueco, y el texto lo dice) o una generación que murió antes
 * del primer día (continuarla es gratis: aún tiene su reserva).
 */
export type TodayEmptyReason = "noPlan" | "failed" | "stalled";

/** Las siete caras de Hoy, en el orden en que se deciden. */
export type TodayScreen =
  | { kind: "loading" }
  | { kind: "plansError" }
  | { kind: "generating" }
  | { kind: "empty"; reason: TodayEmptyReason }
  | { kind: "dayError" }
  | { kind: "finished" }
  | { kind: "journey" };

export const todayScreen = (input: {
  plansLoading: boolean;
  plansFailed: boolean;
  plan: { status: string } | null;
  hasDay: boolean;
  dayPending: boolean;
  stuck: boolean;
  finished: boolean;
}): TodayScreen => {
  const { plan, hasDay, stuck } = input;

  if (input.plansLoading) return { kind: "loading" };
  if (input.plansFailed) return { kind: "plansError" };

  // Plans and progress can settle before today's day. `stuck && !day` used to
  // mean "generation died before the first day", but with the seed (active,
  // 4/14 days, stale heartbeat) it was also true for a few frames while
  // `get_my_day` was still in flight — a flash of the stalled empty screen.
  if (plan && !hasDay && input.dayPending) return { kind: "loading" };

  // Only block while there is nothing to pray yet. Generation runs in the
  // background, so this state survives closing the app.
  if (plan?.status === "generating" && !hasDay && !stuck) {
    return { kind: "generating" };
  }

  const failed = plan?.status === "failed";
  const stalledWithoutDay = stuck && !hasDay;
  if (!plan || (failed && !hasDay) || stalledWithoutDay) {
    return {
      kind: "empty",
      reason: stalledWithoutDay ? "stalled" : failed ? "failed" : "noPlan",
    };
  }

  // The plan is active but no day has come back after the query settled.
  // Pending is handled above: reaching here means get_my_day finished empty.
  if (!hasDay) return { kind: "dayError" };

  // The day a plan ends: without this the screen kept showing the last day.
  if (input.finished) return { kind: "finished" };

  return { kind: "journey" };
};

/** Título, cuerpo y CTA de cada motivo de Hoy vacío. */
export const emptyCopyKeys = (reason: TodayEmptyReason) =>
  ({
    stalled: {
      title: "plan.stalledTitle",
      body: "plan.stalledBody",
      cta: "plan.stalledCta",
    },
    failed: {
      title: "plan.failedTitle",
      body: "plan.failedBody",
      cta: "plan.createAnother",
    },
    noPlan: {
      title: "plan.noPlanTitle",
      body: "plan.noPlanBody",
      cta: "plan.createCta",
    },
  })[reason];

/** La línea de encima del «Día X de Y»: hecho, sigue, o empieza. */
export const journeyCaptionKey = (
  prayed: boolean | undefined,
  dayNumber: number,
) =>
  prayed
    ? "plan.captionDone"
    : dayNumber > 1
      ? "plan.captionContinue"
      : "plan.captionComingUp";

/** Archivar es solo para un plan vivo o acabado, nunca a medio escribir. */
export const canArchivePlan = (status: string) =>
  status === "active" || status === "completed";

/**
 * El error de «Seguir escribiendo». «Ya lo estamos escribiendo» no es un
 * fallo: otro toque rápido no debe pintar una línea roja encima de un plan
 * que sí se está escribiendo.
 */
export const resumeErrorKey = (caught: unknown) =>
  caught instanceof GenerationInFlight
    ? "plan.generationInFlight"
    : caught instanceof RequestIdConflict
      ? "plan.requestIdConflict"
      : "common.errorGeneric";

/**
 * El error de archivar. `archive_my_plan()` rechaza un plan que no se puede
 * archivar con `not_archivable` en el mensaje; eso se dice por su nombre, y
 * todo lo demás es el error de siempre.
 */
export const archiveErrorKey = (caught: unknown) => {
  const detail =
    caught && typeof caught === "object" && "message" in caught
      ? String((caught as { message: unknown }).message)
      : "";

  return detail.includes("not_archivable")
    ? "plan.notArchivable"
    : "common.errorGeneric";
};

type WindowBox = { y: number; height: number };

/**
 * ¿El «Ya oré hoy» de verdad está bajo el pliegue? Se mide su centro contra
 * el borde de abajo del área que hace scroll, en coordenadas de ventana.
 */
export const isCtaBelowFold = (viewport: WindowBox, cta: WindowBox) =>
  cta.y + cta.height / 2 > viewport.y + viewport.height;

/**
 * El gemelo flotante sale solo en móvil, solo mientras el de verdad no asoma
 * y solo cuando ya se sabe que hoy no has orado — no parpadea mientras carga.
 */
export const showFloatingCta = (input: {
  prayed: boolean | undefined;
  ctaOffscreen: boolean;
  isWide: boolean;
}) => input.prayed === false && input.ctaOffscreen && !input.isWide;
