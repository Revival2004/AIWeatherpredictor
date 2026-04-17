import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type {
  PlantingAdvisoryResponse,
  RainPredictionResponse,
  WeatherPredictionResponse,
} from "@/lib/api-client";
import {
  getCropStageHint,
  getDashboardWorkStageLabel,
  summarizeDashboardCrops,
  type DashboardWorkStage,
} from "@/lib/farm-context";

type Lang = "en" | "sw" | "ki";
type DecisionSignal = "safe" | "watch" | "caution" | "danger";

interface Props {
  advisory: PlantingAdvisoryResponse;
  rain?: RainPredictionResponse | null;
  weather?: WeatherPredictionResponse | null;
  lang: Lang;
  selectedCrops?: string[];
  workStage?: DashboardWorkStage;
}

const STATUS_ICON: Record<DecisionSignal, keyof typeof Feather.glyphMap> = {
  safe: "check-circle",
  watch: "clock",
  caution: "alert-triangle",
  danger: "x-circle",
};

const STATUS_THEME: Record<
  DecisionSignal,
  { background: string; border: string; soft: string }
> = {
  safe: { background: "#2F8F46", border: "#7FD29A", soft: "rgba(255,255,255,0.14)" },
  watch: { background: "#8A6A16", border: "#E8C868", soft: "rgba(255,255,255,0.15)" },
  caution: { background: "#9A5A12", border: "#F2BB68", soft: "rgba(255,255,255,0.15)" },
  danger: { background: "#A33A32", border: "#F0A29B", soft: "rgba(255,255,255,0.14)" },
};

function simplifyLine(text: string): string {
  const sentence = text
    .replace(/\s+/g, " ")
    .split(/[.!?]/)
    .map((part) => part.trim())
    .find(Boolean);

  return sentence ?? text.trim();
}

function buildDecisionCopy({
  advisory,
  rain,
  weather,
  lang,
  selectedCrops,
  workStage,
}: Required<Pick<Props, "advisory" | "lang">> &
  Pick<Props, "rain" | "weather" | "selectedCrops" | "workStage">) {
  const stage = workStage ?? "planting";
  const crops = selectedCrops?.length ? selectedCrops : ["General"];
  const cropSummary = summarizeDashboardCrops(crops, lang);
  const cropHint = getCropStageHint(crops, stage, lang);
  const rainPct = rain ? Math.round(rain.probability * 100) : null;
  const humidity = weather?.weather.humidity ?? 0;
  const wind = weather?.weather.windspeed ?? 0;
  const temperature = weather?.weather.temperature ?? 0;

  if (stage === "harvesting") {
    const status: DecisionSignal =
      rainPct !== null && rainPct >= 55
        ? "danger"
        : rainPct !== null && rainPct >= 30
        ? "caution"
        : humidity >= 84
        ? "watch"
        : "safe";

    if (lang === "sw") {
      return {
        status,
        eyebrow: "UAMUZI WA LEO",
        title:
          status === "safe"
            ? "VUNA LEO"
            : status === "watch"
            ? "SUBIRI KUKAUKA"
            : status === "caution"
            ? "VUNA KWA TAHADHARI"
            : "USIVUNE SASA",
        reason:
          status === "safe"
            ? `Dirisha la ukavu linafaa kwa kuvuna ${cropSummary}.`
            : status === "watch"
            ? `Unyevu bado uko juu, kwa hivyo ${cropSummary} zinaweza kuumia kwa ubora.`
            : status === "caution"
            ? `Mvua inaweza kuingia karibuni na kuharibu ubora wa ${cropSummary}.`
            : `Mvua au unyevu mkubwa unaweka ${cropSummary} kwenye hatari ya hasara baada ya kuvuna.`,
        actionLabel: `FANYA HII KWA ${getDashboardWorkStageLabel(stage, lang).toUpperCase()}`,
        action:
          status === "safe"
            ? "Anza kwa sehemu zilizoiva zaidi na uhifadhi mazao sehemu kavu yenye hewa."
            : status === "watch"
            ? "Ngoja jua au upepo upunguze unyevu kabla ya kuanza kuvuna."
            : status === "caution"
            ? "Vuna tu yale yaliyo tayari sana na ufunike mazao mara moja."
            : "Subiri dirisha la ukavu kabla ya kuvuna kiasi kikubwa.",
        cropHint,
        focusLabel: "MAZAO UNAYOLENGA",
        focusValue: cropSummary,
        rainHint:
          rainPct === null ? "Mvua karibuni: inasasishwa" : `Mvua karibuni: ${rainPct}%`,
        conditionHint: `Unyevu ${humidity}% • Upepo ${Math.round(wind)} km/h`,
      };
    }

    return {
      status,
      eyebrow: "TODAY'S FARM DECISION",
      title:
        status === "safe"
          ? "HARVEST TODAY"
          : status === "watch"
          ? "WAIT FOR A DRIER WINDOW"
          : status === "caution"
          ? "HARVEST WITH CARE"
          : "DO NOT HARVEST YET",
      reason:
        status === "safe"
          ? `A dry window is open for harvesting ${cropSummary}.`
          : status === "watch"
          ? `Moist air is still hanging around, so ${cropSummary} may lose quality after harvest.`
          : status === "caution"
          ? `Rain may reach this farm soon and can spoil harvested ${cropSummary}.`
          : `Rain or very damp air makes this a risky harvest window for ${cropSummary}.`,
      actionLabel: `DO THIS FOR ${getDashboardWorkStageLabel(stage, lang).toUpperCase()}`,
      action:
        status === "safe"
          ? "Start with the ripest section first and keep harvested produce in a dry airy place."
          : status === "watch"
          ? "Wait for sun or breeze to lower surface moisture before lifting or cutting."
          : status === "caution"
          ? "Only harvest what is urgently ready and cover produce immediately."
          : "Hold large harvest work until a better dry window opens.",
      cropHint,
      focusLabel: "CROP FOCUS",
      focusValue: cropSummary,
      rainHint: rainPct === null ? "Rain soon: updating" : `Rain soon: ${rainPct}%`,
      conditionHint: `Humidity ${humidity}% • Wind ${Math.round(wind)} km/h`,
    };
  }

  if (stage === "weeding") {
    const status: DecisionSignal =
      rainPct !== null && rainPct >= 60
        ? "danger"
        : rainPct !== null && rainPct >= 35
        ? "watch"
        : temperature >= 31
        ? "caution"
        : "safe";

    if (lang === "sw") {
      return {
        status,
        eyebrow: "UAMUZI WA LEO",
        title:
          status === "safe"
            ? "PALILIA LEO"
            : status === "watch"
            ? "PALILIA BAADAYE"
            : status === "caution"
            ? "PALILIA MAPEMA"
            : "SUBIRI KUPALILIA",
        reason:
          status === "safe"
            ? `Udongo unaonekana kufaa kwa kupalilia ${cropSummary} leo.`
            : status === "watch"
            ? `Mvua inaweza kufanya udongo wa ${cropSummary} uwe wa matope baadaye leo.`
            : status === "caution"
            ? `Joto linaweza kufanya kazi ya kupalilia ${cropSummary} kuwa nzito katikati ya siku.`
            : `Mvua ya karibu inaweza kufanya kupalilia ${cropSummary} kuwa ngumu na isiyo safi.`,
        actionLabel: `FANYA HII KWA ${getDashboardWorkStageLabel(stage, lang).toUpperCase()}`,
        action:
          status === "safe"
            ? "Tumia dirisha hili kuondoa magugu kabla hayajavuta maji na virutubisho."
            : status === "watch"
            ? "Ukipalilia, fanya mapema kabla ya udongo kulowa zaidi."
            : status === "caution"
            ? "Anza asubuhi na epuka saa za joto kali."
            : "Acha kupalilia mpaka udongo uache kulowa kwa mvua inayokuja.",
        cropHint,
        focusLabel: "MAZAO UNAYOLENGA",
        focusValue: cropSummary,
        rainHint:
          rainPct === null ? "Mvua karibuni: inasasishwa" : `Mvua karibuni: ${rainPct}%`,
        conditionHint: `Joto ${Math.round(temperature)}°C • Upepo ${Math.round(wind)} km/h`,
      };
    }

    return {
      status,
      eyebrow: "TODAY'S FARM DECISION",
      title:
        status === "safe"
          ? "WEED TODAY"
          : status === "watch"
          ? "WEED LATER"
          : status === "caution"
          ? "WEED EARLY"
          : "WAIT TO WEED",
      reason:
        status === "safe"
          ? `The soil looks workable for weeding ${cropSummary} today.`
          : status === "watch"
          ? `Rain may make the field for ${cropSummary} sticky later today.`
          : status === "caution"
          ? `Heat may make weeding ${cropSummary} heavy and tiring by midday.`
          : `Incoming rain makes this a poor weeding window for ${cropSummary}.`,
      actionLabel: `DO THIS FOR ${getDashboardWorkStageLabel(stage, lang).toUpperCase()}`,
      action:
        status === "safe"
          ? "Use this window to knock weeds back before they steal water and nutrients."
          : status === "watch"
          ? "If you must weed, start early before the soil gets wetter."
          : status === "caution"
          ? "Begin in the cooler morning hours and stop before the day turns harsh."
          : "Hold weeding until the field is drier and easier to work.",
      cropHint,
      focusLabel: "CROP FOCUS",
      focusValue: cropSummary,
      rainHint: rainPct === null ? "Rain soon: updating" : `Rain soon: ${rainPct}%`,
      conditionHint: `Temperature ${Math.round(temperature)}°C • Wind ${Math.round(wind)} km/h`,
    };
  }

  if (stage === "spraying") {
    const status: DecisionSignal =
      (rainPct !== null && rainPct >= 35) || wind >= 20
        ? "danger"
        : humidity >= 84
        ? "watch"
        : wind >= 14
        ? "caution"
        : "safe";

    if (lang === "sw") {
      return {
        status,
        eyebrow: "UAMUZI WA LEO",
        title:
          status === "safe"
            ? "NYUNYIZIA LEO"
            : status === "watch"
            ? "SUBIRI MAJANI YAKAUKE"
            : status === "caution"
            ? "NYUNYIZIA KWA UANGALIFU"
            : "USINYUNYIZIE SASA",
        reason:
          status === "safe"
            ? `Hewa tulivu na ukavu vinafaa kwa kunyunyizia ${cropSummary}.`
            : status === "watch"
            ? `Majani ya ${cropSummary} yanaweza kubaki na unyevu sana kwa dawa kushika vizuri.`
            : status === "caution"
            ? `Upepo wa wastani unaweza kupunguza jinsi dawa inavyofika kwenye ${cropSummary}.`
            : `Mvua au upepo mkali unaweza kuosha au kupeperusha dawa kutoka kwa ${cropSummary}.`,
        actionLabel: `FANYA HII KWA ${getDashboardWorkStageLabel(stage, lang).toUpperCase()}`,
        action:
          status === "safe"
            ? "Nyunyizia sasa wakati hewa bado ni tulivu na hakuna dalili ya mvua ya karibu."
            : status === "watch"
            ? "Subiri majani yakauke vizuri kabla ya kutumia dawa."
            : status === "caution"
            ? "Nyunyizia sehemu muhimu kwanza na fuatilia upepo usiongezeke."
            : "Acha kunyunyizia hadi upepo na mvua vipungue.",
        cropHint,
        focusLabel: "MAZAO UNAYOLENGA",
        focusValue: cropSummary,
        rainHint:
          rainPct === null ? "Mvua karibuni: inasasishwa" : `Mvua karibuni: ${rainPct}%`,
        conditionHint: `Upepo ${Math.round(wind)} km/h • Unyevu ${humidity}%`,
      };
    }

    return {
      status,
      eyebrow: "TODAY'S FARM DECISION",
      title:
        status === "safe"
          ? "SPRAY TODAY"
          : status === "watch"
          ? "WAIT FOR DRIER LEAVES"
          : status === "caution"
          ? "SPRAY WITH CARE"
          : "DO NOT SPRAY NOW",
      reason:
        status === "safe"
          ? `Calm, dry conditions are lining up for spraying ${cropSummary}.`
          : status === "watch"
          ? `${cropSummary} may stay too damp for spray to hold cleanly.`
          : status === "caution"
          ? `Moderate wind may reduce how well spray reaches ${cropSummary}.`
          : `Rain or strong wind will likely wash off or drift spray away from ${cropSummary}.`,
      actionLabel: `DO THIS FOR ${getDashboardWorkStageLabel(stage, lang).toUpperCase()}`,
      action:
        status === "safe"
          ? "Spray in this calm window before weather turns against coverage."
          : status === "watch"
          ? "Wait for leaves to dry before applying product."
          : status === "caution"
          ? "Cover the highest-risk crop blocks first and stop if wind rises."
          : "Pause spraying until wind and rain risk drop.",
      cropHint,
      focusLabel: "CROP FOCUS",
      focusValue: cropSummary,
      rainHint: rainPct === null ? "Rain soon: updating" : `Rain soon: ${rainPct}%`,
      conditionHint: `Wind ${Math.round(wind)} km/h • Humidity ${humidity}%`,
    };
  }

  const status: DecisionSignal = advisory.status;

  if (lang === "sw") {
    return {
      status,
      eyebrow: "UAMUZI WA LEO",
      title:
        status === "safe"
          ? "PANDA LEO"
          : status === "watch"
          ? "ANGALIA KESHO"
          : status === "caution"
          ? "SUBIRI SIKU 2"
          : "USIPANDE SASA",
      reason:
        status === "safe"
          ? `Unyevu unaonekana kutosha kuanzisha ${cropSummary} vizuri.`
          : status === "watch"
          ? `Mvua imeonyesha matumaini, lakini bado haijathibitisha mwanzo thabiti kwa ${cropSummary}.`
          : status === "caution"
          ? `Kuna hatari ya pengo la ukavu baada ya kuanza ${cropSummary}.`
          : `Dirisha hili la mvua ni dhaifu mno kwa kuanzisha ${cropSummary}.`,
      actionLabel: `FANYA HII KWA ${getDashboardWorkStageLabel(stage, lang).toUpperCase()}`,
      action:
        status === "safe"
          ? "Panda sasa wakati juu ya udongo bado ina unyevu, na funika mbegu vizuri."
          : status === "watch"
          ? "Andaa ardhi na pembejeo leo, kisha angalia uamuzi huu tena kesho."
          : status === "caution"
          ? "Shikilia mbegu kidogo mpaka mvua ijenge mwendelezo bora."
          : "Hifadhi mbegu na subiri dirisha la mvua lenye nguvu zaidi.",
      cropHint,
      focusLabel: "MAZAO UNAYOLENGA",
      focusValue: cropSummary,
      rainHint:
        rainPct === null
          ? `Siku za mvua mbele: ${advisory.rainDaysAhead}/14`
          : `Mvua karibuni: ${rainPct}%`,
      conditionHint: `Hatari ya ukavu: siku ${advisory.longestDryGap}`,
    };
  }

  return {
    status,
    eyebrow: "TODAY'S FARM DECISION",
    title:
      status === "safe"
        ? "PLANT TODAY"
        : status === "watch"
        ? "CHECK TOMORROW"
        : status === "caution"
        ? "WAIT 2 DAYS"
        : "DO NOT PLANT YET",
    reason:
      status === "safe"
        ? `Moisture looks steady enough to establish ${cropSummary}.`
        : status === "watch"
        ? `Rain has started to look promising, but it is not stable enough yet for ${cropSummary}.`
        : status === "caution"
        ? `A dry break could still follow and stress newly planted ${cropSummary}.`
        : `This rain signal is too weak to start ${cropSummary} safely.`,
    actionLabel: `DO THIS FOR ${getDashboardWorkStageLabel(stage, lang).toUpperCase()}`,
    action:
      status === "safe"
        ? "Plant while the topsoil still holds moisture and cover seed well."
        : status === "watch"
        ? "Prepare land and inputs today, then review this card again tomorrow."
        : status === "caution"
        ? "Hold seed a little longer until the rain pattern looks steadier."
        : "Keep seed safe and wait for a stronger planting window.",
    cropHint,
    focusLabel: "CROP FOCUS",
    focusValue: cropSummary,
    rainHint:
      rainPct === null
        ? `Rain days ahead: ${advisory.rainDaysAhead}/14`
        : `Rain soon: ${rainPct}%`,
    conditionHint: `Dry-gap risk: ${advisory.longestDryGap} day${advisory.longestDryGap === 1 ? "" : "s"}`,
  };
}

export default function DecisionAssistantCardAdaptive({
  advisory,
  rain,
  weather,
  lang,
  selectedCrops = ["General"],
  workStage = "planting",
}: Props) {
  const copy = buildDecisionCopy({
    advisory,
    rain,
    weather,
    lang,
    selectedCrops,
    workStage,
  });
  const theme = STATUS_THEME[copy.status];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.background,
          borderColor: theme.border,
          shadowColor: theme.background,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: theme.soft }]}>
          <Feather name={STATUS_ICON[copy.status]} size={18} color="#FFFFFF" />
        </View>
        <View style={styles.headlineBlock}>
          <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
          <Text style={styles.title}>{copy.title}</Text>
        </View>
      </View>

      <Text style={styles.reason}>{simplifyLine(copy.reason)}</Text>

      <View style={[styles.focusCard, { backgroundColor: theme.soft }]}>
        <Text style={styles.focusLabel}>{copy.focusLabel}</Text>
        <Text style={styles.focusValue}>{copy.focusValue}</Text>
      </View>

      <View style={[styles.actionCard, { backgroundColor: theme.soft }]}>
        <Text style={styles.actionLabel}>{copy.actionLabel}</Text>
        <Text style={styles.actionText}>{simplifyLine(copy.action)}</Text>
      </View>

      <View style={[styles.tipCard, { backgroundColor: theme.soft }]}>
        <Feather name="info" size={14} color="#FFFFFF" />
        <Text style={styles.tipText}>{copy.cropHint}</Text>
      </View>

      <View style={styles.metaRow}>
        <View style={[styles.metaPill, { backgroundColor: theme.soft }]}>
          <Feather name="cloud-rain" size={13} color="#FFFFFF" />
          <Text style={styles.metaText}>{copy.rainHint}</Text>
        </View>
        <View style={[styles.metaPill, { backgroundColor: theme.soft }]}>
          <Feather name="activity" size={13} color="#FFFFFF" />
          <Text style={styles.metaText}>{copy.conditionHint}</Text>
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
    padding: 18,
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
    fontSize: 27,
    lineHeight: 32,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  reason: {
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  focusCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 3,
  },
  focusLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    color: "rgba(255,255,255,0.8)",
  },
  focusValue: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  actionCard: {
    borderRadius: 18,
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
  tipCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
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
