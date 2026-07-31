import { Text, View } from "react-native";

type Tone = "plain" | "scripture" | "action";

interface DaySectionProps {
  label: string;
  tone?: Tone;
  children: React.ReactNode;
}

const CONTAINER: Record<Tone, string> = {
  plain: "gap-2",
  scripture: "gap-3 rounded-2xl bg-paper-sunken p-6",
  // The action is the only part of the day that leaves the phone, so it is the
  // one block that visually asks for something — and the only place the accent
  // is spent.
  action: "gap-2 rounded-2xl border border-clay/25 bg-clay-soft p-5",
};

const LABEL: Record<Tone, string> = {
  plain: "text-ink-soft",
  scripture: "text-ink-soft",
  action: "text-clay-deep",
};

export const DaySection = ({
  label,
  tone = "plain",
  children,
}: DaySectionProps) => (
  <View className={CONTAINER[tone]}>
    <Text
      className={`text-xs font-semibold uppercase tracking-wide ${LABEL[tone]}`}
    >
      {label}
    </Text>
    {children}
  </View>
);
