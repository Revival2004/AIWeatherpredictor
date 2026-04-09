import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";
import { getBaseUrl } from "@/lib/api-client";

export const FEEDBACK_PENDING_KEY = "microclimate_feedback_pending_v1";

export interface PendingFeedback {
  lat: number;
  lon: number;
  locationName: string;
  predictedAt: number;
}

interface Props {
  pending: PendingFeedback;
  onDismiss: () => void;
}

type Answer = "yes" | "almost" | "no";
type Step = "rain" | "cloudy" | "done";

function getApiBase() {
  return getBaseUrl() ?? "http://localhost:8080";
}

export default function FarmerFeedbackCard({ pending, onDismiss }: Props) {
  const colors = useColors();
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>("rain");
  const [submitting, setSubmitting] = useState(false);
  const [rainAnswer, setRainAnswer] = useState<Answer | null>(null);

  const submitFeedback = async (question: string, answer: Answer) => {
    setSubmitting(true);
    try {
      await fetch(`${getApiBase()}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: pending.lat,
          lon: pending.lon,
          question,
          answer,
          locationName: pending.locationName,
        }),
      });
    } catch {}
    setSubmitting(false);
  };

  const handleRainAnswer = async (answer: Answer) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRainAnswer(answer);
    await submitFeedback("rain", answer);
    setStep("cloudy");
  };

  const handleCloudyAnswer = async (answer: Answer) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await submitFeedback("cloudy", answer);
    setStep("done");
    await AsyncStorage.removeItem(FEEDBACK_PENDING_KEY);
    setTimeout(onDismiss, 1200);
  };

  const handleSkip = async () => {
    await AsyncStorage.removeItem(FEEDBACK_PENDING_KEY);
    onDismiss();
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: "#000",
        },
      ]}
    >
      {step === "rain" && (
        <>
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: "#3B82F615" }]}>
              <Feather name="cloud-rain" size={20} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {t("feedbackTitle")}
              </Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                {t("feedbackSubtitle")}
              </Text>
            </View>
            <Pressable onPress={handleSkip} hitSlop={12}>
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {submitting ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
          ) : (
            <View style={styles.buttonRow}>
              <AnswerBtn label={t("feedbackYes")} color="#3B82F6" icon="check-circle" onPress={() => handleRainAnswer("yes")} />
              <AnswerBtn label={t("feedbackAlmost")} color="#D4851A" icon="cloud-drizzle" onPress={() => handleRainAnswer("almost")} />
              <AnswerBtn label={t("feedbackNo")} color="#3D8B37" icon="sun" onPress={() => handleRainAnswer("no")} />
            </View>
          )}
        </>
      )}

      {step === "cloudy" && (
        <>
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: "#6B728015" }]}>
              <Feather name="cloud" size={20} color="#6B7280" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                {t("feedbackCloudy")}
              </Text>
            </View>
          </View>

          {submitting ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
          ) : (
            <View style={styles.buttonRow}>
              <AnswerBtn label={t("feedbackYesCloudy")} color="#6B7280" icon="cloud" onPress={() => handleCloudyAnswer("yes")} />
              <AnswerBtn label={t("feedbackPartlyCloudy")} color="#D4851A" icon="cloud-drizzle" onPress={() => handleCloudyAnswer("almost")} />
              <AnswerBtn label={t("feedbackSunny")} color="#F59E0B" icon="sun" onPress={() => handleCloudyAnswer("no")} />
            </View>
          )}
        </>
      )}

      {step === "done" && (
        <View style={[styles.row, { justifyContent: "center", paddingVertical: 4 }]}>
          <Feather name="check-circle" size={20} color="#3D8B37" />
          <Text style={[styles.title, { color: "#3D8B37", marginLeft: 8 }]}>
            {t("feedbackThanks")}
          </Text>
        </View>
      )}
    </View>
  );
}

function AnswerBtn({
  label,
  color,
  icon,
  onPress,
}: {
  label: string;
  color: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.answerBtn,
        { backgroundColor: color + "18", borderColor: color + "40", opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Feather name={icon} size={14} color={color} />
      <Text style={[styles.answerLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  sub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 6,
  },
  answerBtn: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  answerLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
});
