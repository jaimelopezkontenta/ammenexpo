import { Link, router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

import { KeyboardScreen } from "@/components/KeyboardScreen";
import { Button } from "@/components/Button";
import { ChoiceChips } from "@/components/ChoiceChips";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import { TextField } from "@/components/TextField";
import { useSession } from "@/core/auth/SessionProvider";
import {
  useCreateCircle,
  useMyCircles,
  useUnreadCounts,
  type CircleVisibility,
} from "@/core/circles/queries";
import { usePrayerFeed } from "@/core/posts/queries";
import { useHomeFeed } from "@/core/social/feed";

import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { Txt } from "@/components/ui/Text";

/**
 * Los círculos — el contenido del segmento, con su alta inline y su scroll.
 * La pantalla alrededor (TabHeader, fondo, segmentos) la pone la tab Juntos.
 */
export const CirclesPane = ({
  onGoToSegment,
}: {
  /**
   * Dentro de la tab Juntos, los asomos del final saltan al segmento vecino.
   * Sin el callback (si el pane volviera a montarse suelto), el bloque
   * entero no se pinta.
   */
  onGoToSegment?: (segment: "community" | "requests") => void;
}) => {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const {
    data: circles,
    isLoading,
    isError,
    error: circlesError,
    refetch,
  } = useMyCircles(userId);
  const createCircle = useCreateCircle(userId);
  const { data: unread } = useUnreadCounts(userId);

  // Los asomos comparten queryKey con los panes vecinos: montarlas aquí es
  // adelantar la caché, no pagar dos veces — al cambiar de segmento, el pane
  // de destino pinta al instante.
  const requestsPeek = usePrayerFeed();
  const communityPeek = useHomeFeed();
  const latestRequest = requestsPeek.data?.[0];
  const latestStory = communityPeek.data?.find(
    (entry) => entry.kind !== "request",
  );

  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<CircleVisibility>("private");
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);

    try {
      const circle = await createCircle.mutateAsync({
        name,
        description,
        visibility,
      });
      setName("");
      setDescription("");
      setVisibility("private");
      setIsCreating(false);

      // Straight into the circle rather than back to the list. A circle you
      // just created is empty, and the one thing it needs is somebody in it —
      // which used to be two more taps away, through a list you were already
      // looking at.
      router.push({ pathname: "/circulo/[id]", params: { id: circle.id } });
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  if (isLoading) {
    return <LoadingState skeleton="list" />;
  }

  // A failed read used to fall through to "you have no circles yet", which is
  // a different and untrue thing to say.
  if (isError) {
    return <ErrorState error={circlesError} onRetry={() => void refetch()} />;
  }

  if (isCreating) {
    return (
      <KeyboardScreen>
        <ScrollView
          contentContainerClassName="gap-6 px-7 py-10 md:w-full md:max-w-read md:self-center md:px-10"
          keyboardShouldPersistTaps="handled"
        >
          <Txt variant="headingLg">{t("circles.createTitle")}</Txt>

          <TextField
            label={t("circles.name")}
            value={name}
            onChangeText={setName}
            placeholder={t("circles.namePlaceholder")}
            maxLength={80}
          />

          <TextField
            label={t("circles.description")}
            value={description}
            onChangeText={setDescription}
            placeholder={t("circles.descriptionPlaceholder")}
            maxLength={500}
            multiline
          />

          <View className="gap-3">
            <Txt variant="label" tone="secondary">
              {t("circles.visibility")}
            </Txt>
            <ChoiceChips
              options={[
                { value: "private", label: t("circles.visibilityPrivate") },
                { value: "public", label: t("circles.visibilityPublic") },
              ]}
              selected={[visibility]}
              onToggle={(value) => setVisibility(value as CircleVisibility)}
            />
            {/* Public circles carry a moderation duty, so say so before creating. */}
            <Txt variant="caption">
              {visibility === "private"
                ? t("circles.visibilityPrivateHint")
                : t("circles.visibilityPublicHint")}
            </Txt>
          </View>

          {error ? (
            <Txt variant="caption" tone="danger" accessibilityRole="alert">
              {error}
            </Txt>
          ) : null}

          <View className="gap-3 pt-2">
            <Button
              title={t("circles.create")}
              disabled={name.trim().length === 0}
              loading={createCircle.isPending}
              onPress={() => void handleCreate()}
            />
            <Button
              title={t("common.cancel")}
              variant="ghost"
              onPress={() => setIsCreating(false)}
            />
          </View>
        </ScrollView>
      </KeyboardScreen>
    );
  }

  return (
    // `md:px-10` como el TabHeader y la fila de segmentos: sin él, el
    // contenido de Juntos quedaba 12 px desalineado de su propia cabecera.
    <ScrollView contentContainerClassName="flex-grow gap-4 px-7 py-6 md:w-full md:max-w-read md:self-center md:px-10">
      {/* El título ya lo dice TabHeader; dos "Círculos" apilados no eran
          jerarquía sino eco. Queda la línea que explica qué es esto. */}
      <Txt variant="body" tone="secondary">
        {t("circles.subtitle")}
      </Txt>

      {/* Las dos puertas van arriba: en una cuenta nueva son lo único que
          hay que ver, y al fondo de un scroll eran un CTA huérfano. */}
      <View className="gap-3 pb-2">
        <Button
          title={t("circles.create")}
          onPress={() => setIsCreating(true)}
        />
        <Link href="/circulo/buscar" asChild>
          <Button title={t("circles.findCta")} variant="ghost" />
        </Link>
      </View>

      {circles && circles.length > 0 ? (
        <View className="gap-3">
          {circles.map((circle) => (
            <Link
              key={circle.id}
              href={{ pathname: "/circulo/[id]", params: { id: circle.id } }}
              asChild
            >
              {/* La fila social del sistema: la cara del círculo, el censo y
                  el aviso de no leídos en el mismo molde que Avisos. */}
              <ListRow
                accessibilityRole="link"
                leading={
                  <Avatar name={circle.name} seed={circle.id} size={40} />
                }
                title={circle.name}
                titleLines={1}
                meta={t("circles.members", { count: circle.member_count })}
                badge={unread?.[circle.id] || undefined}
              />
            </Link>
          ))}
        </View>
      ) : (
        <EmptyState title={t("circles.empty")} body={t("circles.emptyBody")} />
      )}

      {/* Lo vivo de los otros segmentos, asomado: con un círculo o ninguno,
          media pantalla quedaba muerta — y lo que pasa en Comunidad y en el
          muro es exactamente lo que esta tab promete juntar. */}
      {onGoToSegment && (latestRequest || latestStory) ? (
        <View className="gap-2 pt-4">
          <Txt variant="overline">{t("together.meanwhile")}</Txt>

          {latestRequest ? (
            <ListRow
              accessibilityRole="button"
              onPress={() => onGoToSegment("requests")}
              leading={
                <Avatar
                  name={
                    latestRequest.is_anonymous
                      ? t("feed.anonymousName")
                      : (latestRequest.author_name ?? "")
                  }
                  url={
                    latestRequest.is_anonymous
                      ? null
                      : latestRequest.author_avatar_url
                  }
                  seed={
                    latestRequest.is_anonymous
                      ? latestRequest.id
                      : (latestRequest.author_id ?? "")
                  }
                  size={40}
                />
              }
              title={latestRequest.body}
              titleLines={1}
              meta={t("feed.title")}
            />
          ) : null}

          {latestStory ? (
            <ListRow
              accessibilityRole="button"
              onPress={() => onGoToSegment("community")}
              leading={
                <Avatar
                  name={latestStory.author_name ?? ""}
                  url={latestStory.author_avatar_url}
                  seed={latestStory.author_id ?? latestStory.id}
                  size={40}
                />
              }
              title={latestStory.title ?? latestStory.body ?? ""}
              titleLines={1}
              meta={t("community.title")}
            />
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
};
