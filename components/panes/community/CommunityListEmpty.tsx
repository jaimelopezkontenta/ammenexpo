import { useTranslation } from "react-i18next";

import { ErrorState, LoadingState } from "@/components/ScreenState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Txt } from "@/components/ui/Text";

type ListQuery = {
  isLoading: boolean;
  isLoadingError: boolean;
  error: unknown;
  refetch: () => unknown;
};

/**
 * Lo que ocupa el sitio de las filas cuando no hay filas: cargando, el error
 * con su reintento, o el vacío — de la búsqueda o del feed, según cuál mande.
 * La lista lo pinta sin envoltorio, en el mismo hueco que antes ocupaba bajo
 * el buscador.
 */
export const CommunityListEmpty = ({
  searching,
  query,
}: {
  searching: boolean;
  /** La consulta que manda ahora: la de personas o la del feed. */
  query: ListQuery;
}) => {
  const { t } = useTranslation();

  if (query.isLoading) return <LoadingState />;

  if (query.isLoadingError) {
    return (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    );
  }

  return searching ? (
    <Txt variant="body" tone="secondary">
      {t("community.nobodyFound")}
    </Txt>
  ) : (
    <EmptyState title={t("community.empty")} />
  );
};
