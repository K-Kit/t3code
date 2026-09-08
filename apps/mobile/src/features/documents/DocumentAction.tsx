import { Pressable } from "react-native";
import { AppText as Text } from "../../components/AppText";
export function DocumentAction({
  title,
  onPress,
  disabled = false,
}: {
  readonly title: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className={`min-h-12 justify-center rounded-xl border border-input-border px-4 py-3 ${disabled ? "opacity-50" : "bg-input"}`}
    >
      <Text className="text-sm font-medium">{title}</Text>
    </Pressable>
  );
}
