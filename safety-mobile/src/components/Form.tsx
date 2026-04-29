import { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type TextInputProps
} from "react-native";
import { theme } from "@/theme";

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  textContentType,
  returnKeyType,
  editable = true
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoCorrect?: boolean;
  textContentType?: TextInputProps["textContentType"];
  returnKeyType?: ReturnKeyTypeOptions;
  editable?: boolean;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        textContentType={textContentType}
        returnKeyType={returnKeyType}
        editable={editable}
        style={[styles.input, multiline ? styles.area : null]}
      />
    </View>
  );
}

export function Button({
  children,
  onPress,
  disabled,
  variant = "primary"
}: {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, variant === "secondary" ? styles.secondary : styles.primary, disabled ? styles.disabled : null]}
    >
      <Text style={variant === "secondary" ? styles.secondaryText : styles.primaryText}>{children}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  group: { gap: 7 },
  label: { color: theme.textStrong, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.6 },
  input: {
    borderWidth: 1,
    borderColor: theme.borderStrong,
    backgroundColor: theme.surface,
    color: theme.textStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "600"
  },
  area: { minHeight: 110, textAlignVertical: "top" },
  button: { borderRadius: 8, paddingVertical: 14, alignItems: "center" },
  primary: { backgroundColor: theme.primary },
  secondary: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderStrong },
  disabled: { opacity: 0.55 },
  primaryText: { color: theme.white, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
  secondaryText: { color: theme.textStrong, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 }
});
