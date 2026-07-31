import { Link } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/Button";
import { ChoiceChips } from "@/components/ChoiceChips";
import { TextField } from "@/components/TextField";
import { useSession } from "@/core/auth/SessionProvider";
import {
  useCreateCircle,
  useMyCircles,
  type CircleVisibility,
} from "@/core/circles/queries";

export default function Circles() {
  const { t } = useTranslation();
  const { session } = useSession();
  const userId = session?.user.id;

  const { data: circles, isLoading } = useMyCircles(userId);
  const createCircle = useCreateCircle(userId);

  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<CircleVisibility>("private");
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);

    try {
      await createCircle.mutateAsync({ name, description, visibility });
      setName("");
      setDescription("");
      setVisibility("private");
      setIsCreating(false);
    } catch {
      setError(t("common.errorGeneric"));
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#0f172a" />
      </View>
    );
  }

  if (isCreating) {
    return (
      <ScrollView
        className="flex-1 bg-white"
        contentContainerClassName="gap-6 px-7 py-10"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-2xl font-bold text-slate-900">
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
          <Text className="text-sm font-medium text-slate-600">
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
          <Text className="text-sm text-slate-500">
            {visibility === "private"
              ? t("circles.visibilityPrivateHint")
              : t("circles.visibilityPublicHint")}
          </Text>
        </View>

        {error ? (
          <Text className="text-sm text-red-500" accessibilityRole="alert">
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
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="flex-grow gap-4 px-7 py-10"
    >
      <View className="gap-1">
        <Text className="text-2xl font-bold text-slate-900">
          {t("circles.title")}
        </Text>
        <Text className="text-base text-slate-500">
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
              <Pressable className="gap-1 rounded-2xl border border-slate-200 p-5">
                <Text className="text-lg font-semibold text-slate-900">
                  {circle.name}
                </Text>
                <Text className="text-sm text-slate-500">
                  {t("circles.members", { count: circle.member_count })}
                </Text>
              </Pressable>
            </Link>
          ))}
        </View>
      ) : (
        <View className="items-center gap-2 py-10">
          <Text className="text-center text-lg font-semibold text-slate-700">
            {t("circles.empty")}
          </Text>
          <Text className="text-center text-base text-slate-500">
            {t("circles.emptyBody")}
          </Text>
        </View>
      )}

      <View className="mt-auto pt-6">
        <Button
          title={t("circles.create")}
          onPress={() => setIsCreating(true)}
        />
      </View>
    </ScrollView>
  );
}
