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
  const wetSignal = rainPct !== null && rainPct >= 60;
  const moderateRain = rainPct !== null && rainPct >= 35;

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
    tipsLabel: {
      en: "QUICK STEPS",
      sw: "HATUA ZA HARAKA",
      ki: "HATUA ZA HARAKA",
    }[lang],
    tips:
      advisory.status === "safe"
        ? [
            {
              icon: "check" as const,
              text: {
                en: "Plant in moist soil first, then cover seed well.",
                sw: "Panda kwanza kwenye udongo wenye unyevu, kisha funika mbegu vizuri.",
                ki: "Panda kwanza kwenye udongo wenye unyevu, kisha funika mbegu vizuri.",
              }[lang],
            },
            {
              icon: "droplet" as const,
              text: wetSignal
                ? {
                    en: "Hold irrigation for now and let this rain do the first watering.",
                    sw: "Acha umwagiliaji kwa sasa na uache mvua hii ifanye umwagiliaji wa kwanza.",
                    ki: "Acha umwagiliaji kwa sasa na uache mvua hii ifanye umwagiliaji wa kwanza.",
                  }[lang]
                : {
                    en: "Watch topsoil moisture this evening so the seed does not dry out.",
                    sw: "Angalia unyevu wa juu ya udongo jioni ili mbegu isikauke.",
                    ki: "Angalia unyevu wa juu ya udongo jioni ili mbegu isikauke.",
                  }[lang],
            },
            {
              icon: "wind" as const,
              text: {
                en: "Use the calmer part of the day for planting and fertilizer placement.",
                sw: "Tumia sehemu tulivu ya siku kwa kupanda na kuweka mbolea.",
                ki: "Tumia sehemu tulivu ya siku kwa kupanda na kuweka mbolea.",
              }[lang],
            },
          ]
        : advisory.status === "watch"
        ? [
            {
              icon: "clock" as const,
              text: {
                en: "Give the rain one more day to prove it is steady.",
                sw: "Ipe mvua siku moja zaidi kuthibitisha kuwa imetulia.",
                ki: "Ipe mvua siku moja zaidi kuthibitisha kuwa imetulia.",
              }[lang],
            },
            {
              icon: "package" as const,
              text: {
                en: "Keep seed, fertilizer, and labor ready so you can move quickly tomorrow.",
                sw: "Weka mbegu, mbolea, na maandalizi tayari ili uanze haraka kesho.",
                ki: "Weka mbegu, mbolea, na maandalizi tayari ili uanze haraka kesho.",
              }[lang],
            },
            {
              icon: "cloud-rain" as const,
              text: {
                en: "Check this card again after the next rain update.",
                sw: "Angalia tena kadi hii baada ya taarifa inayofuata ya mvua.",
                ki: "Angalia tena kadi hii baada ya taarifa inayofuata ya mvua.",
              }[lang],
            },
          ]
        : advisory.status === "caution"
        ? [
            {
              icon: "pause-circle" as const,
              text: {
                en: "Wait before planting so seed is not caught by a dry break.",
                sw: "Subiri kabla ya kupanda ili mbegu isishikwe na kipindi cha ukavu.",
                ki: "Subiri kabla ya kupanda ili mbegu isishikwe na kipindi cha ukavu.",
              }[lang],
            },
            {
              icon: "droplet" as const,
              text: moderateRain
                ? {
                    en: "Use this rain to recharge the soil, not to rush planting.",
                    sw: "Tumia mvua hii kuongeza unyevu wa udongo, si kuharakisha kupanda.",
                    ki: "Tumia mvua hii kuongeza unyevu wa udongo, si kuharakisha kupanda.",
                  }[lang]
                : {
                    en: "Keep moisture in the seedbed with mulch or light soil cover if possible.",
                    sw: "Hifadhi unyevu wa kitanda cha mbegu kwa matandazo au kifuniko chepesi cha udongo ikiwezekana.",
                    ki: "Hifadhi unyevu wa kitanda cha mbegu kwa matandazo au kifuniko chepesi cha udongo ikiwezekana.",
                  }[lang],
            },
            {
              icon: "refresh-cw" as const,
              text: {
                en: "Review the decision again after the next weather refresh.",
                sw: "Angalia uamuzi huu tena baada ya hali ya hewa kusasishwa.",
                ki: "Angalia uamuzi huu tena baada ya hali ya hewa kusasishwa.",
              }[lang],
            },
          ]
        : [
            {
              icon: "x-circle" as const,
              text: {
                en: "Keep seed dry and hold planting until a stronger rain window opens.",
                sw: "Hifadhi mbegu vizuri na usipande hadi dirisha bora la mvua lifunguke.",
                ki: "Hifadhi mbegu vizuri na usipande hadi dirisha bora la mvua lifunguke.",
              }[lang],
            },
            {
              icon: "shield" as const,
              text: {
                en: "Protect stored inputs and check field drainage before the next storm.",
                sw: "Linda pembejeo zilizohifadhiwa na angalia njia za maji kabla ya dhoruba inayofuata.",
                ki: "Linda pembejeo zilizohifadhiwa na angalia njia za maji kabla ya dhoruba inayofuata.",
              }[lang],
            },
            {
              icon: "calendar" as const,
              text: {
                en: "Plan labor and seed for the next safe planting window instead of today.",
                sw: "Panga kazi na mbegu kwa dirisha lijalo salama la kupanda badala ya leo.",
                ki: "Panga kazi na mbegu kwa dirisha lijalo salama la kupanda badala ya leo.",
              }[lang],
            },
          ],
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

      <View style={styles.tipsCard}>
        <Text style={styles.tipsLabel}>{copy.tipsLabel}</Text>
        {copy.tips.map((tip) => (
          <View key={tip.text} style={styles.tipRow}>
            <Feather name={tip.icon} size={14} color="#FFFFFF" />
            <Text style={styles.tipText}>{tip.text}</Text>
          </View>
        ))}
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
  tipsCard: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 8,
  },
  tipsLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    color: "rgba(255,255,255,0.82)",
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_600SemiBold",
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
