import { prayBackPlanIdFor } from "./todayView";
import {
  usePlansSharedWithMe,
  useWhoPrayedForMe,
} from "@/core/intercessions/queries";

/**
 * Quién oró hoy por ti y, si alguien de ellos te compartió su plan, a cuál
 * devolverle la oración. Hoy lo enseña después del «Ya oré».
 */
export const useTodayIntercessions = (userId: string | undefined) => {
  const { data: prayedForMe, isLoadingError: prayedForMeFailed } =
    useWhoPrayedForMe(userId);
  const { data: sharedWithMe } = usePlansSharedWithMe(userId);

  return {
    prayedForMe,
    prayedForMeFailed,
    // The first person who prayed for you today and whose own plan you can open.
    prayBackPlanId: prayBackPlanIdFor(sharedWithMe, prayedForMe),
  };
};
