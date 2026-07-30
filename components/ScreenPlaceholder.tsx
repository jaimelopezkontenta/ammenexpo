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
    <View className="flex-1 items-center justify-center gap-3 bg-white px-8">
      <Text className="text-center text-2xl font-bold text-slate-900">
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-center text-base leading-6 text-slate-500">
          {subtitle}
        </Text>
      ) : null}
      {children}
    </View>
  );
};
