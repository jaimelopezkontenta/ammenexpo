type PrayerStatus = {
  already_prayed: boolean;
};

/**
 * Particiona sin mutar ni reordenar lo que devolvió el servidor.
 *
 * La lista pendiente se presenta primero, pero dentro de cada grupo se conserva
 * el orden original para no convertir cada refresco en una lista distinta.
 */
export const derivePrayerProgress = <T extends PrayerStatus>(
  plans: readonly T[],
) => {
  const pending: T[] = [];
  const completed: T[] = [];

  for (const plan of plans) {
    (plan.already_prayed ? completed : pending).push(plan);
  }

  return {
    pending,
    completed,
    completedCount: completed.length,
    total: plans.length,
    allPrayed: plans.length > 0 && completed.length === plans.length,
  };
};
