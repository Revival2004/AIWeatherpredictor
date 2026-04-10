import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type {
  PlantingAdvisoryResponse,
  RainPredictionResponse,
} from "@/lib/api-client";

type Lang = "en" | "sw" | "ki";

interface Props {
  advisory: PlantingAdvisoryResponse;
  rain?: RainPredictionResponse | null;
  lang: Lang;
}

const STATUS_STYLE = {
  safe: {
    bg: "#ECFDF3",
    border: "#22C55E",
    text: "#166534",
    badge: "#DCFCE7",
    icon: "check-circle" as const,
  },
  watch: {
    bg: "#FEFCE8",
    border: "#EAB308",
    text: "#854D0E",
    badge: "#FEF3C7",
    icon: "clock" as const,
  },
  caution: {
    bg: "#FFF7ED",
    border: "#F97316",
    text: "#9A3412",
    badge: "#FED7AA",
    icon: "alert-triangle" as const,
  },
  danger: {
    bg: "#FEF2F2",
    border: "#EF4444",
    text: "#991B1B",
    badge: "#FECACA",
    icon: "x-circle" as const,
  },
} as const;

function simplifyReason(text: string): string {
  const sentence = text
    .replace(/\s+/g, " ")
    .split(/[.!?]/)
    .map((part) => part.trim())
    .find(Boolean);

  return sentence ?? text;
}

function buildDecisionCopy(
  lang: Lang,
  advisory: PlantingAdvisoryResponse,
  rain?: RainPredictionResponse | null,
) {
  const rainPct = rain ? Math.round(rain.probability * 100) : null;

  const base = {
    safe: {
      title: {
        en: "PLANT TODAY",
        sw: "PANDA LEO",
        ki: "PANDA LEO",
      },
      reason: {
        en: "Rain pattern looks steady enough for planting.",
        sw: "Mpangilio wa mvua unaonekana kuwa wa kutosha kwa kupanda.",
        ki: "Mpangilio wa mvua unaonekana kuwa wa kutosha kwa kupanda.",
      },
      next: {
        en: "Prepare seed and plant while the soil still holds moisture.",
        sw: "Andaa mbegu na panda wakati udongo bado una unyevu.",
        ki: "Andaa mbegu na panda wakati udongo bado una unyevu.",
      },
    },
    watch: {
      title: {
        en: "CHECK AGAIN TOMORROW",
        sw: "ANGALIA TENA KESHO",
        ki: "ANGALIA TENA KESHO",
      },
      reason: {
        en: "Rain has started, but the pattern is not fully stable yet.",
        sw: "Mvua imeanza, lakini mpangilio bado haujatulia kabisa.",
        ki: "Mvua imeanza, lakini mpangilio bado haujatulia kabisa.",
      },
      next: {
        en: "Hold seed for now and confirm the next rain window.",
        sw: "Shikilia mbegu kwa sasa na hakiki dirisha lijalo la mvua.",
        ki: "Shikilia mbegu kwa sasa na hakiki dirisha lijalo la mvua.",
      },
    },
    caution: {
      title: {
        en: "WAIT 2 DAYS",
        sw: "SUBIRI SIKU 2",
        ki: "SUBIRI SIKU 2",
      },
      reason: {
        en: "A dry spell may follow this rain and stress new seed.",
        sw: "Ukavu unaweza kufuata mvua hii na kusumbua mbegu mpya.",
        ki: "Ukavu unaweza kufuata mvua hii na kusumbua mbegu mpya.",
      },
      next: {
        en: "Wait for a more reliable rain pattern before planting.",
        sw: "Subiri mpangilio wa mvua unaoaminika zaidi kabla ya kupanda.",
        ki: "Subiri mpangilio wa mvua unaoaminika zaidi kabla ya kupanda.",
      },
    },
    danger: {
      title: {
        en: "DO NOT PLANT",
        sw: "USIPANDE SASA",
        ki: "USIPANDE SASA",
      },
      reason: {
        en: "This looks like a short false start, not a safe planting window.",
        sw: "Hii inaonekana kama mwanzo wa muda mfupi, si dirisha salama la kupanda.",
        ki: "Hii inaonekana kama mwanzo wa muda mfupi, si dirisha salama la kupanda.",
      },
      next: {
        en: "Protect seed and wait for stronger follow-up rain.",
        sw: "Linda mbegu na subiri mvua ya kufuatia iliyo imara zaidi.",
        ki: "Linda mbegu na subiri mvua ya kufuatia iliyo imara zaidi.",
      },
    },
  } as const;

  const selected = base[advisory.status];

  return {
    eyebrow: {
      en: "TODAY'S PLANTING DECISION",
      sw: "UAMUZI WA KUPANDA WA LEO",
      ki: "UAMUZI WA KUPANDA WA LEO",
    }[lang],
    title: selected.title[lang],
    reason: simplifyReason(selected.reason[lang]),
    next: selected.next[lang],
    rainHint:
      rainPct === null
        ? {
            en: `Rain days ahead: ${advisory.rainDaysAhead}/14`,
            sw: `Siku za mvua mbele: ${advisory.rainDaysAhead}/14`,
            ki: `Siku za mvua mbele: ${advisory.rainDaysAhead}/14`,
          }[lang]
        : {
            en: `Rain chance soon: ${rainPct}%`,
            sw: `Uwezekano wa mvua hivi karibuni: ${rainPct}%`,
            ki: `Uwezekano wa mvua hivi karibuni: ${rainPct}%`,
          }[lang],
    soilHint: {
      en: `Dry gap risk: ${advisory.longestDryGap} day${advisory.longestDryGap === 1 ? "" : "s"}`,
      sw: `Hatari ya ukavu: siku ${advisory.longestDryGap}`,
      ki: `Hatari ya ukavu: siku ${advisory.longestDryGap}`,
    }[lang],
  };
}

export default function DecisionAssistantCard({ advisory, rain, lang }: Props) {
  const colors = useColors();
  const style = STATUS_STYLE[advisory.status];
  const copy = buildDecisionCopy(lang, advisory, rain);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: style.bg,
          borderColor: style.border,
          shadowColor: style.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: style.badge }]}>
          <Feather name={style.icon} size={18} color={style.text} />
        </View>
        <View style={styles.headlineBlock}>
          <Text style={[styles.eyebrow, { color: style.text }]}>{copy.eyebrow}</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{copy.title}</Text>
        </View>
      </View>

      <Text style={[styles.reason, { color: colors.foreground }]}>{copy.reason}</Text>
      <Text style={[styles.nextStep, { color: style.text }]}>{copy.next}</Text>

      <View style={styles.metaRow}>
        <View style={[styles.metaPill, { backgroundColor: "#FFFFFFAA" }]}>
          <Feather name="cloud-rain" size={13} color={style.text} />
          <Text style={[styles.metaText, { color: style.text }]}>{copy.rainHint}</Text>
        </View>
        <View style={[styles.metaPill, { backgroundColor: "#FFFFFFAA" }]}>
          <Feather name="droplet" size={13} color={style.text} />
          <Text style={[styles.metaText, { color: style.text }]}>{copy.soilHint}</Text>
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
    borderWidth: 1.5,
    padding: 18,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
    gap: 10,
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
  },
  headlineBlock: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "Inter_700Bold",
  },
  reason: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Inter_600SemiBold",
  },
  nextStep: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Inter_500Medium",
  },
  metaRow: {
    gap: 8,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_600SemiBold",
  },
});
