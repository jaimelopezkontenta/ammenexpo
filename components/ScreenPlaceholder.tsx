import { Text, View } from "react-native";

interface ScreenPlaceholderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

/**
 * Temporary shell for screens whose real content lands in a later phase.
 * Keeps the navigation skeleton walkable on all three platforms.
 */
export const ScreenPlaceholder: React.FC<ScreenPlaceholderProps> = ({
  title,
  subtitle,
  children,
}) => {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-paper px-8">
      <Text className="text-center text-2xl font-bold text-ink">{title}</Text>
      {subtitle ? (
        <Text className="text-center text-base leading-6 text-ink-muted">
          {subtitle}
        </Text>
      ) : null}
      {children}
    </View>
  );
};
