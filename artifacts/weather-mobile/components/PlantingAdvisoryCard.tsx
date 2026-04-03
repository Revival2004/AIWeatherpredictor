/**
 * PlantingAdvisoryCard
 *
 * Tells the farmer whether it is safe to plant into current or forecast rains,
 * or whether this is a false onset (masika ya uongo) that will stop and kill
 * their seedlings.
 *
 * Four states:
 *   safe    — green  — season establishing, plant now
 *   watch   — amber  — promising but not confirmed, short-season crops only
 *   caution — orange — fragmented rains, high dry-spell risk, wait
 *   danger  — red    — isolated event, do not plant
 */

import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { PlantingAdvisoryResponse } from "@/lib/api-client";
import { useColors } from "@/hooks/useColors";

interface Props {
  data: PlantingAdvisoryResponse;
  lang: "en" | "sw" | "ki";
}

const STATUS_CONFIG = {
  safe: {
    icon: "check-circle" as const,
    label: { en: "Safe to Plant", sw: "Salama Kupanda", ki: "Mwega Gũthiga" },
    lightBg: "#F0FDF4",
    darkBg:  "#14532D",
    accent:  "#16A34A",
  },
  watch: {
    icon: "eye" as const,
    label: { en: "Watch & Wait", sw: "Angalia na Usubiri", ki: "Rora na Ũrĩa" },
    lightBg: "#FFFBEB",
    darkBg:  "#78350F",
    accent:  "#D97706",
  },
  caution: {
    icon: "alert-triangle" as const,
    label: { en: "High Risk", sw: "Hatari Kubwa", ki: "Hatarĩ Nĩngi" },
    lightBg: "#FFF7ED",
    darkBg:  "#7C2D12",
    accent:  "#EA580C",
  },
  danger: {
    icon: "x-circle" as const,
    label: { en: "Do Not Plant", sw: "Usipande", ki: "Ũtigĩre Gũthiga" },
    lightBg: "#FEF2F2",
    darkBg:  "#7F1D1D",
    accent:  "#DC2626",
  },
} as const;

const SEASON_LABEL = {
  "long-rains":  { en: "Long Rains Season (MAM)", sw: "Msimu wa Masika", ki: "Mũaka wa Mbura Nĩngi" },
  "short-rains": { en: "Short Rains Season (OND)", sw: "Msimu wa Vuli", ki: "Mũaka wa Mbura Gutî" },
  "off-season":  { en: "Off-Season", sw: "Nje ya Msimu", ki: "Tũtĩ Mũakene" },
} as const;

function pick(obj: Record<"en" | "sw" | "ki", string>, lang: "en" | "sw" | "ki") {
  return obj[lang] ?? obj.en;
}

export default function PlantingAdvisoryCard({ data, lang }: Props) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  const cfg = STATUS_CONFIG[data.status];
  const headline =
    data.status === "safe"    ? data.headlineEn :
    data.status === "watch"   ? data.headlineSw :
    lang === "en" ? data.headlineEn :
    lang === "sw" ? data.headlineSw : data.headlineKi;

  const reason =
    lang === "en" ? data.reasonEn :
    lang === "sw" ? data.reasonSw : data.reasonKi;

  const action =
    lang === "en" ? data.actionEn :
    lang === "sw" ? data.actionSw : data.actionKi;

  const headline_l =
    lang === "en" ? data.headlineEn :
    lang === "sw" ? data.headlineSw : data.headlineKi;

  return (
    <Pressable
      onPress={() => setExpanded((e) => !e)}
      style={[styles.card, { backgroundColor: cfg.lightBg, borderColor: cfg.accent }]}
      accessibilityRole="button"
      accessibilityLabel={`Planting advisory: ${pick(cfg.label, lang)}`}
    >
      {/* ── Header row ── */}
      <View style={styles.header}>
        <View style={[styles.iconBadge, { backgroundColor: cfg.accent }]}>
          <Feather name={cfg.icon} size={20} color="#FFFFFF" />
        </View>

        <View style={styles.titleBlock}>
          <Text style={[styles.label, { color: cfg.accent }]}>
            {pick(cfg.label, lang).toUpperCase()}
          </Text>
          <Text style={[styles.headline, { color: "#1C1208" }]} numberOfLines={2}>
            {headline_l}
          </Text>
        </View>

        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={cfg.accent}
        />
      </View>

      {/* ── Rain stats row ── */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: cfg.accent }]}>{data.rainDaysAhead}</Text>
          <Text style={styles.statLabel}>{lang === "sw" ? "Siku za Mvua / 14" : lang === "ki" ? "Matukũ ma Mbura / 14" : "Rain Days / 14"}</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: cfg.accent + "33" }]} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: data.longestDryGap >= 5 ? "#DC2626" : "#16A34A" }]}>
            {data.longestDryGap}d
          </Text>
          <Text style={styles.statLabel}>{lang === "sw" ? "Pengo la Ukame" : lang === "ki" ? "Ũkaugo Mũraihu" : "Longest Dry Gap"}</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: cfg.accent + "33" }]} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: "#1C1208" }]}>
            {pick(SEASON_LABEL[data.season], lang).split(" ")[0]}
          </Text>
          <Text style={styles.statLabel}>{pick(SEASON_LABEL[data.season], lang).split(" ").slice(1).join(" ")}</Text>
        </View>
      </View>

      {/* ── Expanded detail ── */}
      {expanded && (
        <View style={[styles.detail, { borderTopColor: cfg.accent + "33" }]}>
          <Text style={styles.detailHeading}>
            {lang === "sw" ? "Sababu:" : lang === "ki" ? "Ũndũ:" : "Why:"}
          </Text>
          <Text style={styles.detailText}>{reason}</Text>

          <Text style={[styles.detailHeading, { marginTop: 10 }]}>
            {lang === "sw" ? "Fanya hivi:" : lang === "ki" ? "Ĩgua ũyũ:" : "What to do:"}
          </Text>
          <Text style={styles.detailText}>{action}</Text>

          {data.historicalRainRate > 0 && (
            <View style={[styles.histRow, { backgroundColor: cfg.accent + "18" }]}>
              <Feather name="bar-chart-2" size={13} color={cfg.accent} />
              <Text style={[styles.histText, { color: cfg.accent }]}>
                {lang === "sw"
                  ? `Kawaida mwezi huu: mvua siku ${data.historicalRainRate}% ya wakati`
                  : lang === "ki"
                  ? `Kawaida mweri ũyũ: mbura matukũ ${data.historicalRainRate}% wa ũhuro`
                  : `Historical average this month: rain on ${data.historicalRainRate}% of days`}
              </Text>
            </View>
          )}
        </View>
      )}

      <Text style={[styles.tapHint, { color: cfg.accent + "99" }]}>
        {expanded
          ? (lang === "sw" ? "Bonyeza kufunga" : lang === "ki" ? "Kanda ngumo" : "Tap to collapse")
          : (lang === "sw" ? "Bonyeza kwa maelezo zaidi" : lang === "ki" ? "Kanda ũone mwarie" : "Tap for details & advice")}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: "hidden",
    padding: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  titleBlock: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headline: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 10,
    marginBottom: 4,
  },
  stat: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 10,
    color: "#7A6A55",
    textAlign: "center",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
    marginHorizontal: 4,
  },
  detail: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 6,
  },
  detailHeading: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7A6A55",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 13,
    color: "#1C1208",
    lineHeight: 19,
  },
  histRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  histText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  tapHint: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 10,
  },
});
