import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { customFetch } from "@/lib/api-client/custom-fetch";
import { cancelFeedbackReminder } from "@/services/NotificationService";

export const FEEDBACK_PENDING_KEY = "microclimate_feedback_pending_v1";

export interface PendingFeedback {
  lat: number;
  lon: number;
  locationName: string;
  predictedAt: number;
  targetTime: string;
  dueAt: number;
  predictionValue: "yes" | "no";
  probability: number;
}

interface Props {
  pending: PendingFeedback;
  onClose: () => void;
  onComplete: () => void;
}

type Answer = "yes" | "almost" | "no";

const COPY = {
  en: {
    title: "What happened on your farm?",
    detail: "One quick answer helps FarmPal learn this field faster.",
    yes: "Rain",
    almost: "Almost",
    no: "Dry",
    later: "Later",
    saved: "Saved. Thanks for helping FarmPal learn your farm.",
  },
  sw: {
    title: "Kulitokea nini shambani?",
    detail: "Jibu moja la haraka husaidia FarmPal kujifunza shamba hili vizuri zaidi.",
    yes: "Mvua",
    almost: "Karibu",
    no: "Kavu",
    later: "Baadaye",
    saved: "Imehifadhiwa. Asante kwa kusaidia FarmPal kujifunza shamba lako.",
  },
  ki: {
    title: "What happened on your farm?",
    detail: "One quick answer helps FarmPal learn this field faster.",
    yes: "Rain",
    almost: "Almost",
    no: "Dry",
    later: "Later",
    saved: "Saved. Thanks for helping FarmPal learn your farm.",
  },
} as const;

export default function FarmerFeedbackCard({ pending, onClose, onComplete }: Props) {
  const colors = useColors();
  const { language } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const copy = COPY[language];
  const hoursAgo = Math.max(1, Math.round((Date.now() - pending.predictedAt) / (1000 * 60 * 60)));
  const followUpSummary = useMemo(() => {
    if (language === "sw") {
      return pending.predictionValue === "yes"
        ? `Takriban saa ${hoursAgo} zilizopita, FarmPal ilitarajia mvua kwenye ${pending.locationName}.`
        : `Takriban saa ${hoursAgo} zilizopita, FarmPal ilitarajia hali kavu kwenye ${pending.locationName}.`;
    }

    return pending.predictionValue === "yes"
      ? `About ${hoursAgo} hour${hoursAgo === 1 ? "" : "s"} ago, FarmPal expected rain at ${pending.locationName}.`
      : `About ${hoursAgo} hour${hoursAgo === 1 ? "" : "s"} ago, FarmPal expected mostly dry conditions at ${pending.locationName}.`;
  }, [hoursAgo, language, pending.locationName, pending.predictionValue]);

  const submitFeedback = async (answer: Answer) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSubmitting(true);
    try {
      await customFetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: pending.lat,
          lon: pending.lon,
          question: "rain",
          answer,
          locationName: pending.locationName,
        }),
        responseType: "json",
      });
      setSaved(true);
      await AsyncStorage.removeItem(FEEDBACK_PENDING_KEY);
      await cancelFeedbackReminder().catch(() => {});
      setTimeout(onComplete, 800);
    } catch {
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
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
      <View style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: "#3B82F615" }]}>
          <Feather name="cloud-rain" size={20} color="#3B82F6" />
        </View>
        <View style={styles.meta}>
          <Text style={[styles.title, { color: colors.foreground }]}>{copy.title}</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>{followUpSummary}</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground, marginTop: 4 }]}>{copy.detail}</Text>
        </View>
        {!saved ? (
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[styles.laterText, { color: colors.mutedForeground }]}>{copy.later}</Text>
          </Pressable>
        ) : null}
      </View>

      {saved ? (
        <View style={styles.doneWrap}>
          <View style={[styles.iconCircle, { backgroundColor: "#10B98115" }]}>
            <Feather name="check-circle" size={20} color="#10B981" />
          </View>
          <Text style={[styles.doneText, { color: colors.foreground }]}>{copy.saved}</Text>
        </View>
      ) : submitting ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 14 }} />
      ) : (
        <View style={styles.buttonRow}>
          <AnswerBtn label={copy.yes} color="#2563EB" onPress={() => submitFeedback("yes")} />
          <AnswerBtn label={copy.almost} color="#D4851A" onPress={() => submitFeedback("almost")} />
          <AnswerBtn label={copy.no} color="#15803D" onPress={() => submitFeedback("no")} />
        </View>
      )}
    </View>
  );
}

function AnswerBtn({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.answerBtn, { borderColor: `${color}33`, backgroundColor: `${color}12` }]}
    >
      <Text style={[styles.answerText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  meta: {
    flex: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  sub: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  laterText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  answerBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  answerText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  doneWrap: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  doneText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_600SemiBold",
  },
});
