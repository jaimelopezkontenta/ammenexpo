import { Link, router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { TabHeader } from "@/components/TabHeader";
import { DawnBackground } from "@/components/DawnBackground";
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

export default function Circles() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: circles, isLoading, isError, refetch } = useMyCircles(userId);
  const createCircle = useCreateCircle(userId);
  const { data: unread } = useUnreadCounts(userId);

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
    return <LoadingState />;
  }

  // A failed read used to fall through to "you have no circles yet", which is
  // a different and untrue thing to say.
  if (isError) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  if (isCreating) {
    return (
      <DawnBackground>
        <TabHeader title={t("tabs.circles")} />
        <ScrollView
          contentContainerClassName="gap-6 px-7 py-10"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="font-sans-bold text-2xl text-plum">
            {t("circles.createTitle")}
          </Text>

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
            <Text className="font-sans-medium text-sm text-mist-ink">
              {t("circles.visibility")}
            </Text>
            <ChoiceChips
              options={[
                { value: "private", label: t("circles.visibilityPrivate") },
                { value: "public", label: t("circles.visibilityPublic") },
              ]}
              selected={[visibility]}
              onToggle={(value) => setVisibility(value as CircleVisibility)}
            />
            {/* Public circles carry a moderation duty, so say so before creating. */}
            <Text className="font-sans text-sm text-mist-ink">
              {visibility === "private"
                ? t("circles.visibilityPrivateHint")
                : t("circles.visibilityPublicHint")}
            </Text>
          </View>

          {error ? (
            <Text
              className="font-sans text-sm text-danger"
              accessibilityRole="alert"
            >
              {error}
            </Text>
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
      </DawnBackground>
    );
  }

  return (
    <DawnBackground>
      <TabHeader title={t("tabs.circles")} />
      <ScrollView contentContainerClassName="flex-grow gap-4 px-7 py-10">
        <View className="gap-1">
          <Text className="font-sans-bold text-2xl text-plum">
            {t("circles.title")}
          </Text>
          <Text className="font-sans text-base text-mist-ink">
            {t("circles.subtitle")}
          </Text>
        </View>

        {circles && circles.length > 0 ? (
          <View className="gap-3">
            {circles.map((circle) => (
              <Link
                key={circle.id}
                href={{ pathname: "/circulo/[id]", params: { id: circle.id } }}
                asChild
              >
                {/* The only interactive element in the app with no role: a screen
                  reader announced the whole list as static text, so the way
                  into a circle was invisible when swiping for controls. */}
                <Pressable
                  accessibilityRole="link"
                  className="gap-1 rounded-2xl border border-white/60 p-5"
                >
                  <View className="flex-row items-center justify-between gap-3">
                    <Text className="flex-1 font-sans-semibold text-lg text-plum">
                      {circle.name}
                    </Text>
                    {/* Without this there was no way to know somebody had written
                      without opening every circle to check. */}
                    {(unread?.[circle.id] ?? 0) > 0 ? (
                      <View className="rounded-full bg-plum-chip px-2.5 py-1">
                        <Text
                          className="font-sans-semibold text-xs text-white"
                          accessibilityLabel={t("chat.unread", {
                            count: unread![circle.id],
                          })}
                        >
                          {unread![circle.id]}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="font-sans text-sm text-mist-ink">
                    {t("circles.members", { count: circle.member_count })}
                  </Text>
                </Pressable>
              </Link>
            ))}
          </View>
        ) : (
          <View className="items-center gap-2 py-10">
            <Text className="text-center font-sans-semibold text-lg text-mist-ink">
              {t("circles.empty")}
            </Text>
            <Text className="text-center font-sans text-base text-mist-ink">
              {t("circles.emptyBody")}
            </Text>
          </View>
        )}

        {/* Two ways in, and the second one matters most on an empty account:
          with no invite in your pocket, creating a circle nobody is in yet is
          not much of a start. */}
        <View className="mt-auto gap-3 pt-6">
          <Button
            title={t("circles.create")}
            onPress={() => setIsCreating(true)}
          />
          <Link href="/circulo/buscar" asChild>
            <Button title={t("circles.findCta")} variant="ghost" />
          </Link>
        </View>
      </ScrollView>
    </DawnBackground>
  );
}
