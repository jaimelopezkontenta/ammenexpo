import { Text, View } from "react-native";

type Tone = "plain" | "scripture" | "action";

interface DaySectionProps {
  label: string;
  tone?: Tone;
  children: React.ReactNode;
}

const CONTAINER: Record<Tone, string> = {
  plain: "gap-2",
  scripture: "gap-2 rounded-2xl bg-slate-50 p-5",
  // The action is the only part of the day that leaves the phone, so it is the
  // one block that visually asks for something.
  action: "gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-5",
};

const LABEL: Record<Tone, string> = {
  plain: "text-slate-400",
  scripture: "text-slate-400",
  action: "text-amber-700",
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
