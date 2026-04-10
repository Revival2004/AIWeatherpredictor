import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { PlantingAdvisoryResponse, RainPredictionResponse } from "@/lib/api-client";

type Lang = "en" | "sw" | "ki";

interface Props {
  advisory: PlantingAdvisoryResponse;
  rain?: RainPredictionResponse | null;
  lang: Lang;
}

const STATUS_ICON = {
  safe: "check-circle",
  watch: "clock",
  caution: "alert-triangle",
  danger: "x-circle",
} as const;

function simplifyLine(text: string): string {
  const sentence = text
    .replace(/\s+/g, " ")
    .split(/[.!?]/)
    .map((part) => part.trim())
    .find(Boolean);

  return sentence ?? text.trim();
}

function buildDecisionCopy(lang: Lang, advisory: PlantingAdvisoryResponse, rain?: RainPredictionResponse | null) {
  const rainPct = rain ? Math.round(rain.probability * 100) : null;

  const base = {
    safe: {
      title: { en: "PLANT TODAY", sw: "PANDA LEO", ki: "PANDA LEO" },
      reason: {
        en: "Rain is steady enough for planting.",
        sw: "Mvua inaonekana kuwa ya kutosha kwa kupanda.",
        ki: "Mvua inaonekana kuwa ya kutosha kwa kupanda.",
      },
      action: {
        en: "Put seed in while the soil is still moist.",
        sw: "Panda sasa wakati udongo bado una unyevu.",
        ki: "Panda sasa wakati udongo bado una unyevu.",
      },
    },
    watch: {
      title: { en: "CHECK TOMORROW", sw: "ANGALIA KESHO", ki: "ANGALIA KESHO" },
      reason: {
        en: "Rain has started, but it is not stable yet.",
        sw: "Mvua imeanza, lakini bado haijatulia.",
        ki: "Mvua imeanza, lakini bado haijatulia.",
      },
      action: {
        en: "Wait one more day before planting.",
        sw: "Subiri siku moja zaidi kabla ya kupanda.",
        ki: "Subiri siku moja zaidi kabla ya kupanda.",
      },
    },
    caution: {
      title: { en: "WAIT 2 DAYS", sw: "SUBIRI SIKU 2", ki: "SUBIRI SIKU 2" },
      reason: {
        en: "A dry break may follow this rain.",
        sw: "Ukavu unaweza kufuata mvua hii.",
        ki: "Ukavu unaweza kufuata mvua hii.",
      },
      action: {
        en: "Hold the seed and wait for steadier rain.",
        sw: "Shikilia mbegu na subiri mvua itulie.",
        ki: "Shikilia mbegu na subiri mvua itulie.",
      },
    },
    danger: {
      title: { en: "DO NOT PLANT", sw: "USIPANDE SASA", ki: "USIPANDE SASA" },
      reason: {
        en: "This rain window is too weak for planting.",
        sw: "Dirisha hili la mvua ni dhaifu sana kwa kupanda.",
        ki: "Dirisha hili la mvua ni dhaifu sana kwa kupanda.",
      },
      action: {
        en: "Keep seed safe and wait for stronger follow-up rain.",
        sw: "Hifadhi mbegu na subiri mvua ya kufuatia iliyo bora.",
        ki: "Hifadhi mbegu na subiri mvua ya kufuatia iliyo bora.",
      },
    },
  } as const;

  const selected = base[advisory.status];

  return {
    eyebrow: {
      en: "TODAY'S DECISION",
      sw: "UAMUZI WA LEO",
      ki: "UAMUZI WA LEO",
    }[lang],
    title: selected.title[lang],
    reason: simplifyLine(selected.reason[lang]),
    actionLabel: {
      en: "DO THIS NOW",
      sw: "FANYA HII SASA",
      ki: "FANYA HII SASA",
    }[lang],
    action: simplifyLine(selected.action[lang]),
    rainHint:
      rainPct === null
        ? {
            en: `Rain days ahead: ${advisory.rainDaysAhead}/14`,
            sw: `Siku za mvua mbele: ${advisory.rainDaysAhead}/14`,
            ki: `Siku za mvua mbele: ${advisory.rainDaysAhead}/14`,
          }[lang]
        : {
            en: `Rain chance soon: ${rainPct}%`,
            sw: `Uwezekano wa mvua karibuni: ${rainPct}%`,
            ki: `Uwezekano wa mvua karibuni: ${rainPct}%`,
          }[lang],
    soilHint: {
      en: `Dry gap risk: ${advisory.longestDryGap} day${advisory.longestDryGap === 1 ? "" : "s"}`,
      sw: `Hatari ya ukavu: siku ${advisory.longestDryGap}`,
      ki: `Hatari ya ukavu: siku ${advisory.longestDryGap}`,
    }[lang],
  };
}

export default function DecisionAssistantCard({ advisory, rain, lang }: Props) {
  const copy = buildDecisionCopy(lang, advisory, rain);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Feather name={STATUS_ICON[advisory.status]} size={18} color="#FFFFFF" />
        </View>
        <View style={styles.headlineBlock}>
          <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
          <Text style={styles.title}>{copy.title}</Text>
        </View>
      </View>

      <Text style={styles.reason}>{copy.reason}</Text>

      <View style={styles.actionCard}>
        <Text style={styles.actionLabel}>{copy.actionLabel}</Text>
        <Text style={styles.actionText}>{copy.action}</Text>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaPill}>
          <Feather name="cloud-rain" size={13} color="#FFFFFF" />
          <Text style={styles.metaText}>{copy.rainHint}</Text>
        </View>
        <View style={styles.metaPill}>
          <Feather name="droplet" size={13} color="#FFFFFF" />
          <Text style={styles.metaText}>{copy.soilHint}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#7FD29A",
    backgroundColor: "#2F8F46",
    padding: 18,
    shadowColor: "#2F8F46",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  headlineBlock: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.82)",
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  reason: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  actionCard: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 4,
  },
  actionLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    color: "rgba(255,255,255,0.8)",
  },
  actionText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  metaRow: {
    gap: 8,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});
