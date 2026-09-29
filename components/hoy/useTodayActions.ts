import { router } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { triggerHaptic } from "@/components/ui/Tap";
import { useReportIntercession } from "@/core/intercessions/queries";
import { useBlockUser } from "@/core/moderation/blocks";
import {
  useArchivePlan,
  useContinuePlan,
  useMarkPrayed,
  useRenamePlan,
  useSetActivePlan,
  type OwnPlan,
  type PlanDay,
} from "@/core/plans/queries";
import { archiveErrorKey, resumeErrorKey } from "@/core/plans/todayView";
import { useToast } from "@/core/toast/ToastProvider";

/**
 * Todo lo que se hace desde Hoy: marcar el día, seguir escribiendo el plan,
 * cambiar de plan, renombrarlo, archivarlo, y reportar o bloquear a quien
 * oró. Y el cajón del `···` con su estado efímero, porque varias acciones lo
 * cierran al terminar.
 *
 * Los resultados van por el toast del sistema; el error que pide volver a
 * intentar (`actionError`) se queda en línea, pegado a su CTA.
 */
export const useTodayActions = ({
  userId,
  plan,
  day,
}: {
  userId: string | undefined;
  plan: OwnPlan | null;
  day: PlanDay | null | undefined;
}) => {
  const { t } = useTranslation();
  const toast = useToast();

  const setActivePlan = useSetActivePlan(userId);
  const report = useReportIntercession(userId);
  const block = useBlockUser(userId);
  const rename = useRenamePlan(userId);
  const archivePlan = useArchivePlan(userId);
  const continuePlan = useContinuePlan(userId);
  const markPrayed = useMarkPrayed(day?.id, userId);

  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingArchiveId, setConfirmingArchiveId] = useState<string | null>(
    null,
  );
  const [optionsOpen, setOptionsOpen] = useState(false);
  // Navegar desde el cajón espera a que se cierre (AGENTS.md): se deja aquí
  // y lo ejecuta `onOptionsClosed`.
  const afterClose = useRef<(() => void) | null>(null);

  // Al cerrar el cajón se desarma lo efímero: ni el archivar queda a un toque
  // de dispararse ni el rename abierto, para que la próxima apertura empiece
  // de cero.
  const closeOptions = () => {
    setOptionsOpen(false);
    setConfirmingArchiveId(null);
    setDraftTitle(null);
  };

  const openOptions = () => setOptionsOpen(true);

  /** Cierra el cajón y, cuando haya terminado de cerrarse, hace `next`. */
  const closeOptionsThen = (next: () => void) => {
    afterClose.current = next;
    setOptionsOpen(false);
  };

  const onOptionsClosed = () => {
    const next = afterClose.current;
    afterClose.current = null;
    next?.();
  };

  const startGeneration = async () => {
    setActionError(null);

    try {
      // A failed plan is left as it is (its quota is already spent and is not
      // refunded by marking it failed); starting over means creating a new
      // plan, which the form gates against the allowance itself.
      router.push("/plan/nuevo");
    } catch {
      setActionError(t("common.errorGeneric"));
    }
  };

  // Reporting used to be `report.mutate(...)` with no onError and no success
  // feedback: two round trips, and if the second failed the report was filed,
  // the message stayed on screen, and nothing was said. `intercession.reported`
  // has been translated in both languages all along without ever rendering.
  const runOnIntercessor = async (
    action: () => Promise<unknown>,
    done: string,
  ) => {
    try {
      await action();
      toast.success(done);
    } catch {
      toast.error(t("common.errorGeneric"));
    }
  };

  const reportIntercession = (intercessionId: string) =>
    runOnIntercessor(
      () => report.mutateAsync({ intercessionId }),
      t("intercession.reported"),
    );

  const blockIntercessor = (blockedId: string) =>
    runOnIntercessor(
      () => block.mutateAsync(blockedId),
      t("moderation.blockDone"),
    );

  const resumeGeneration = async () => {
    if (!plan) return;

    setActionError(null);
    try {
      await continuePlan.mutateAsync(plan.id);
      toast.success(t("plan.resumed"));
    } catch (caught) {
      setActionError(t(resumeErrorKey(caught)));
    }
  };

  const selectPlan = async (planId: string) => {
    if (planId === plan?.id) return;

    setActionError(null);

    try {
      await setActivePlan.mutateAsync(planId);
    } catch {
      // Silent here would be the worst outcome: the chips would snap back and
      // the screen would keep showing the plan you just tried to leave.
      setActionError(t("common.errorGeneric"));
    }
  };

  // Cambiar de plan desde el cajón lo cierra: la pantalla que aparece debajo
  // ya es del plan nuevo, y dejar el sheet encima sería enseñar el anterior.
  const selectPlanFromSheet = async (planId: string) => {
    setOptionsOpen(false);
    await selectPlan(planId);
  };

  const archiveCurrentPlan = async () => {
    if (!plan) return;

    // Two taps, like the list and the profile delete: archiving is
    // forward-only and does not refund the free-plan slot.
    if (confirmingArchiveId !== plan.id) {
      setActionError(null);
      setConfirmingArchiveId(plan.id);
      return;
    }

    setActionError(null);
    try {
      await archivePlan.mutateAsync(plan.id);
      setConfirmingArchiveId(null);
      // El plan archivado desaparece de la lista al refrescar: el sheet se
      // quedaría abierto sobre un plan que ya no está. Se cierra con él.
      setOptionsOpen(false);
      toast.success(t("plan.archived"));
    } catch (caught) {
      setConfirmingArchiveId(null);
      setActionError(t(archiveErrorKey(caught)));
    }
  };

  const saveTitle = async () => {
    if (!plan || draftTitle === null) return;

    setActionError(null);

    try {
      if (draftTitle.trim().length > 0 && draftTitle.trim() !== plan.title) {
        await rename.mutateAsync({ planId: plan.id, title: draftTitle });
      }

      setDraftTitle(null);
    } catch {
      // Leaving the editor open is the right call here: the text they typed is
      // still in it, so they can try again without retyping.
      setActionError(t("common.errorGeneric"));
    }
  };

  const markToday = () =>
    markPrayed.mutate(undefined, {
      onSuccess: () => {
        setActionError(null);
        // La háptica de resultado, no la del toque: el amén del día es el
        // único "hecho" que la app celebra.
        triggerHaptic("success");
      },
      onError: () => setActionError(t("common.errorGeneric")),
    });

  return {
    actionError,
    draftTitle,
    setDraftTitle,
    confirmingArchive: plan !== null && confirmingArchiveId === plan.id,
    optionsOpen,
    openOptions,
    closeOptions,
    closeOptionsThen,
    onOptionsClosed,
    startGeneration,
    resumeGeneration,
    resumePending: continuePlan.isPending,
    selectPlan,
    selectPlanFromSheet,
    archiveCurrentPlan,
    archivePending: archivePlan.isPending,
    saveTitle,
    renamePending: rename.isPending,
    markToday,
    markPending: markPrayed.isPending,
    reportIntercession,
    blockIntercessor,
  };
};
