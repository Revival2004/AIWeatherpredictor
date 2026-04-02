import { Feather } from "@expo/vector-icons";
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLanguage } from "@/contexts/LanguageContext";

type Status = "active" | "fallback" | "offline";

function getStatus(modelVersion: string | undefined, isOffline: boolean): Status {
  if (isOffline) return "offline";
  if (!modelVersion) return "fallback";
  if (modelVersion.startsWith("sklearn")) return "active";
  return "fallback";
}

const CONFIG: Record<Status, { color: string; bg: string; icon: keyof typeof Feather.glyphMap }> = {
  active:   { color: "#3D8B37", bg: "#3D8B3718", icon: "cpu" },
  fallback: { color: "#D4851A", bg: "#D4851A18", icon: "alert-circle" },
  offline:  { color: "#6B7280", bg: "#6B728018", icon: "wifi-off" },
};

interface Props {
  modelVersion?: string;
  accuracy?: number;
  isOffline?: boolean;
}

export default function MLStatusBadge({ modelVersion, accuracy, isOffline = false }: Props) {
  const { t } = useLanguage();
  const status = getStatus(modelVersion, isOffline);
  const { color, bg, icon } = CONFIG[status];
  const label =
    status === "active"
      ? t("mlStatusActive")
      : status === "fallback"
      ? t("mlStatusFallback")
      : t("mlStatusOffline");

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: color + "40" }]}>
      <Feather name={icon} size={11} color={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
      {status === "active" && accuracy != null && (
        <Text style={[styles.accuracy, { color }]}>{accuracy.toFixed(0)}%</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  accuracy: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
});
