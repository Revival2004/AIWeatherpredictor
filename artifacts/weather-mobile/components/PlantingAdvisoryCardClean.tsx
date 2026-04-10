import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { PlantingAdvisoryResponse } from "@/lib/api-client";

type Lang = "en" | "sw" | "ki";

interface Props {
  data: PlantingAdvisoryResponse;
  lang: Lang;
}

const STATUS_CONFIG = {
  safe: {
    icon: "check-circle" as const,
    label: { en: "SAFE TO PLANT", sw: "SALAMA KUPANDA", ki: "SALAMA KUPANDA" },
    accent: "#16A34A",
    bg: "#F0FDF4",
  },
  watch: {
    icon: "clock" as const,
    label: { en: "WAIT AND WATCH", sw: "SUBIRI UANGALIE", ki: "SUBIRI UANGALIE" },
    accent: "#CA8A04",
    bg: "#FEFCE8",
  },
  caution: {
    icon: "alert-triangle" as const,
    label: { en: "PLANTING IS RISKY", sw: "KUPANDA NI HATARI", ki: "KUPANDA NI HATARI" },
    accent: "#EA580C",
    bg: "#FFF7ED",
  },
  danger: {
    icon: "x-circle" as const,
    label: { en: "DO NOT PLANT", sw: "USIPANDE", ki: "USIPANDE" },
    accent: "#DC2626",
    bg: "#FEF2F2",
  },
} as const;

function pick(copy: Record<Lang, string>, lang: Lang) {
  return copy[lang];
}

function simplifySentence(text: string): string {
  return (
    text
      .replace(/\s+/g, " ")
      .split(/[.!?]/)
      .map((part) => part.trim())
      .find(Boolean) ?? text
  );
}

export default function PlantingAdvisoryCardClean({ data, lang }: Props) {
  const colors = useColors();
  const cfg = STATUS_CONFIG[data.status];

  const reason = simplifySentence(
    lang === "sw" ? data.reasonSw : lang === "ki" ? data.reasonKi : data.reasonEn,
  );
  const action = simplifySentence(
    lang === "sw" ? data.actionSw : lang === "ki" ? data.actionKi : data.actionEn,
  );

  const statCopy = {
    en: {
      rainDays: "Rain days ahead",
      dryGap: "Longest dry gap",
      nextStep: "Best next step",
    },
    sw: {
      rainDays: "Siku za mvua mbele",
      dryGap: "Pengo refu la ukavu",
      nextStep: "Hatua inayofuata",
    },
    ki: {
      rainDays: "Siku za mvua mbele",
      dryGap: "Pengo refu la ukavu",
      nextStep: "Hatua inayofuata",
    },
  } as const;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cfg.bg,
          borderColor: `${cfg.accent}35`,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: `${cfg.accent}18` }]}>
          <Feather name={cfg.icon} size={18} color={cfg.accent} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={[styles.statusLabel, { color: cfg.accent }]}>{pick(cfg.label, lang)}</Text>
          <Text style={[styles.reason, { color: colors.foreground }]}>{reason}</Text>
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: cfg.accent }]}>{data.rainDaysAhead}/14</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            {statCopy[lang].rainDays}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: cfg.accent }]}>{data.longestDryGap}d</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            {statCopy[lang].dryGap}
          </Text>
        </View>
      </View>

      <View style={[styles.nextStepCard, { backgroundColor: "#FFFFFFB3" }]}>
        <Feather name="arrow-right-circle" size={16} color={cfg.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.nextStepLabel, { color: cfg.accent }]}>{statCopy[lang].nextStep}</Text>
          <Text style={[styles.nextStepText, { color: colors.foreground }]}>{action}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: {
    flex: 1,
    gap: 6,
  },
  statusLabel: {
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "Inter_700Bold",
  },
  reason: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Inter_500Medium",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#FFFFFFB3",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    lineHeight: 24,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: "Inter_500Medium",
  },
  nextStepCard: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  nextStepLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  nextStepText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_600SemiBold",
  },
});
