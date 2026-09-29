import { memo } from "react";

import { PrayerRequestCard } from "@/components/PrayerRequestCard";
import type { FeedEntry } from "@/core/social/feed";

import { StoryCard } from "./StoryCard";
import { toPrayerRequest } from "./rows";
import type { CommunityActions } from "./useCommunityActions";

// En el muro abierto no hay quien administre, así que esta nunca se llama:
// `canHide` mantiene el control fuera.
const noHide = () => undefined;

/**
 * Una fila del feed. Memorizada: solo se repinta si cambia ella (React Query
 * conserva la misma fila si el refresco la trae igual), no porque llegue otra
 * página, se escriba en el buscador o se ore en la tarjeta de al lado.
 */
export const FeedEntryRow = memo(function FeedEntryRow({
  entry,
  actions,
}: {
  entry: FeedEntry;
  actions: CommunityActions;
}) {
  if (entry.kind === "request") {
    // La misma tarjeta que el muro, con todo lo que trae: reportar, bloquear,
    // marcar respondida y borrar. `canHide` en falso porque en el muro
    // abierto no manda nadie, y eso la propia pantalla del muro ya lo dice en
    // voz alta.
    return (
      <PrayerRequestCard
        request={toPrayerRequest(entry)}
        canHide={false}
        onTogglePrayer={() => actions.togglePrayer(entry.id, entry.i_prayed)}
        onOpen={() => actions.openRequest(entry.id)}
        onReport={() => actions.reportPost(entry.id)}
        onBlock={actions.askBlock}
        onHide={noHide}
        onMarkAnswered={() => actions.markAnswered(entry.id)}
        onDelete={() => actions.remove(entry.id)}
      />
    );
  }

  return (
    <StoryCard
      entry={entry}
      onReport={() => actions.reportStory(entry.kind, entry.id)}
      onBlock={() => {
        if (!entry.author_id) return;

        actions.askBlock(entry.author_id, entry.author_name ?? "");
      }}
    />
  );
});
