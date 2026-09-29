import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, type ListRenderItem, ScrollView } from "react-native";

import { LoadMore } from "@/components/LoadMore";
import { useScreenPadding } from "@/components/useScreenPadding";
import { useSession } from "@/core/auth/SessionProvider";
import { useFeatureFlag } from "@/core/flags/useFeatureFlag";
import { END_REACHED_THRESHOLD, useLoadMoreOnEnd } from "@/core/paging";
import { usePublicProfile } from "@/core/profile/queries";
import { useHomeFeed, useSearchPeople } from "@/core/social/feed";

import { EmptyState } from "@/components/ui/EmptyState";

import { CommunityHeader } from "./community/CommunityHeader";
import { CommunityListEmpty } from "./community/CommunityListEmpty";
import { FeedEntryRow } from "./community/FeedEntryRow";
import { PersonRow } from "./community/PersonRow";
import { communityRowKey, isPerson, type CommunityRow } from "./community/rows";
import { useCommunityActions } from "./community/useCommunityActions";

const NO_ROWS: CommunityRow[] = [];

/**
 * La comunidad — el contenido, sin pantalla alrededor.
 *
 * Vive como pane porque se sienta en dos sitios: la ruta /comunidad (con su
 * header de stack) y el segmento Comunidad de la tab Juntos. El scroll es
 * suyo: cada segmento trae su propio contenedor.
 *
 * Media red social ya estaba construida y escondida: el muro abierto de
 * peticiones era un enlace dentro de la pestaña Orar, y los testimonios estaban
 * detrás de un botón en el Perfil. Aquí se juntan, con los planes públicos y
 * —lo que no existía de ninguna forma— una manera de encontrar a una persona.
 *
 * **Buscar no es otra ruta**: escribir sustituye el feed por personas, igual
 * que en la pestaña de la Biblia. Un paso menos y ningún nombre que inventar.
 * Por eso es una sola `FlatList` con el buscador en la cabecera (ver
 * `community/rows.ts`): cambian las filas, no la lista.
 *
 * Y las peticiones se pintan con `PrayerRequestCard`, la misma del muro. La
 * primera versión traía tarjeta propia con orar y comentar, y **sin reportar ni
 * bloquear** — en la pantalla donde aparecen más desconocidos, que es justo
 * donde mira primero la Guideline 1.2.
 *
 * Las piezas viven en `community/`: la cabecera, las filas (memorizadas), el
 * vacío y los gestos (`useCommunityActions`).
 */
export const CommunityPane = () => {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const [query, setQuery] = useState("");

  const { scrollBottom } = useScreenPadding();

  const searching = query.trim().length > 0;
  // Tu propio perfil ya trae este número y está en caché desde cualquier
  // pantalla que lo haya abierto; no hace falta una consulta nueva para una
  // línea de texto.
  const { data: me } = usePublicProfile(userId);
  const following = me?.following_count ?? 0;

  // Con `community_feed` apagado el servidor devuelve vacío en el feed, la
  // búsqueda y los perfiles: se sabe de antemano y se dice. `unknown`
  // (cargando, o la lectura falló) no cuenta como apagado.
  const communityFlag = useFeatureFlag("community_feed");

  const feed = useHomeFeed();
  const people = useSearchPeople(query.trim());

  const { actions, onFollow, pendingFollow, blockDialog } = useCommunityActions(
    userId,
    people.refetch,
  );

  const renderItem = useCallback<ListRenderItem<CommunityRow>>(
    ({ item }) =>
      isPerson(item) ? (
        <PersonRow
          person={item}
          pending={pendingFollow === item.id}
          onFollow={onFollow}
        />
      ) : (
        <FeedEntryRow entry={item} actions={actions} />
      ),
    [pendingFollow, onFollow, actions],
  );

  const loadMore = useLoadMoreOnEnd(feed);

  // Cerrada, no vacía: sin buscador que no encuentra a nadie ni «Pedir
  // oración» hacia un muro que nadie ve. El vacío genérico de abajo decía
  // «sé la primera en pedir oración» en un sitio que aún no abre.
  if (communityFlag === "off") {
    return (
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-7 py-8 md:w-full md:max-w-read md:self-center md:px-10"
        contentContainerStyle={{ paddingBottom: scrollBottom }}
      >
        <EmptyState
          title={t("community.closedTitle")}
          body={t("community.closedBody")}
        />
      </ScrollView>
    );
  }

  // La consulta que manda: personas mientras se escribe, el feed si no.
  const active = searching ? people : feed;
  const ready = !active.isLoading && !active.isLoadingError;
  const feedShown = !searching && ready;

  return (
    <>
      <FlatList<CommunityRow>
        data={ready ? (active.data ?? NO_ROWS) : NO_ROWS}
        keyExtractor={communityRowKey}
        renderItem={renderItem}
        contentContainerClassName="gap-5 px-7 py-8 md:w-full md:max-w-read md:self-center md:px-10"
        contentContainerStyle={{ paddingBottom: scrollBottom }}
        keyboardShouldPersistTaps="handled"
        onEndReached={searching ? undefined : loadMore}
        onEndReachedThreshold={END_REACHED_THRESHOLD}
        ListHeaderComponent={
          <CommunityHeader
            query={query}
            onQueryChange={setQuery}
            following={feedShown ? following : null}
          />
        }
        ListEmptyComponent={
          <CommunityListEmpty searching={searching} query={active} />
        }
        // Sin más páginas no hay pie: una celda vacía se llevaría su hueco.
        ListFooterComponent={
          feedShown && feed.hasNextPage ? (
            <LoadMore
              hasMore={feed.hasNextPage}
              loading={feed.isFetchingNextPage}
              onPress={() => void feed.fetchNextPage()}
            />
          ) : null
        }
      />

      {blockDialog}
    </>
  );
};
