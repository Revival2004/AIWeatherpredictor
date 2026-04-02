import { Feather } from "@expo/vector-icons";
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";
import colorTokens from "@/constants/colors";

interface GDDWidgetProps {
  cumulativeGDD: number;
  irrigationDeficit: number;
  cropName?: string;
}

const CROP_GDD_MILESTONES: Record<string, { milestone: number; stage: string; color: string }[]> = {
  Corn: [
    { milestone: 100, stage: "Emergence", color: "#81C784" },
    { milestone: 350, stage: "V6 Stage", color: "#4CAF50" },
    { milestone: 700, stage: "Tasseling", color: "#F9A825" },
    { milestone: 1100, stage: "Silking", color: "#FF8F00" },
    { milestone: 1400, stage: "Maturity", color: "#8B5A2B" },
  ],
  Wheat: [
    { milestone: 100, stage: "Germination", color: "#A5D6A7" },
    { milestone: 400, stage: "Tillering", color: "#66BB6A" },
    { milestone: 700, stage: "Jointing", color: "#F9A825" },
    { milestone: 900, stage: "Heading", color: "#FF8F00" },
    { milestone: 1200, stage: "Harvest", color: "#8B5A2B" },
  ],
  Tomatoes: [
    { milestone: 50, stage: "Germination", color: "#A5D6A7" },
    { milestone: 200, stage: "Transplant Ready", color: "#4CAF50" },
    { milestone: 400, stage: "First Flower", color: "#F9A825" },
    { milestone: 700, stage: "Fruit Set", color: "#FF8F00" },
    { milestone: 1000, stage: "Harvest", color: "#E53935" },
  ],
  Potatoes: [
    { milestone: 80, stage: "Emergence", color: "#A5D6A7" },
    { milestone: 250, stage: "Tuber Initiation", color: "#66BB6A" },
    { milestone: 500, stage: "Tuber Bulking", color: "#F9A825" },
    { milestone: 800, stage: "Maturity", color: "#8B5A2B" },
  ],
  General: [
    { milestone: 200, stage: "Early Growth", color: "#A5D6A7" },
    { milestone: 500, stage: "Vegetative", color: "#4CAF50" },
    { milestone: 800, stage: "Reproductive", color: "#F9A825" },
    { milestone: 1200, stage: "Maturity", color: "#8B5A2B" },
  ],
};

function getCurrentStage(gdd: number, cropName: string) {
  const milestones = CROP_GDD_MILESTONES[cropName] ?? CROP_GDD_MILESTONES.General;
  const passed = milestones.filter((m) => gdd >= m.milestone);
  const next = milestones.find((m) => gdd < m.milestone);
  const current = passed[passed.length - 1];
  return { current, next, milestones };
}

export default function GDDWidget({ cumulativeGDD, irrigationDeficit, cropName = "General" }: GDDWidgetProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = useColors();

  const { current, next, milestones } = getCurrentStage(cumulativeGDD, cropName);
  const maxGDD = milestones[milestones.length - 1].milestone;
  const progressPct = Math.min(100, (cumulativeGDD / maxGDD) * 100);
  const irrigationUrgent = irrigationDeficit > 20;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.card : "#F0F7EE" }]}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>GROWING DEGREE DAYS</Text>

      <View style={styles.row}>
        <View style={styles.gddBlock}>
          <Text style={[styles.gddValue, { color: colorTokens.light.primary }]}>{cumulativeGDD.toFixed(0)}</Text>
          <Text style={[styles.gddUnit, { color: colors.mutedForeground }]}>GDD (base 10°C)</Text>
        </View>

        {current && (
          <View style={[styles.stageBadge, { backgroundColor: current.color + "30", borderColor: current.color }]}>
            <Text style={[styles.stageText, { color: current.color }]}>📍 {current.stage}</Text>
          </View>
        )}
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }]}>
        <View style={[styles.progressFill, { width: `${progressPct}%` as any, backgroundColor: colorTokens.light.primary }]} />
        {milestones.map((m, i) => {
          const pct = Math.min(100, (m.milestone / maxGDD) * 100);
          return (
            <View
              key={i}
              style={[styles.milestoneMark, { left: `${pct}%` as any, backgroundColor: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)" }]}
            />
          );
        })}
      </View>

      {/* Next milestone */}
      {next && (
        <Text style={[styles.nextMilestone, { color: colors.mutedForeground }]}>
          Next: <Text style={{ color: colors.text, fontWeight: "700" }}>{next.stage}</Text> at {next.milestone} GDD
          {" "}({Math.max(0, next.milestone - cumulativeGDD).toFixed(0)} more to go)
        </Text>
      )}
      {!next && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Feather name="check-circle" size={14} color={colorTokens.light.primary} />
          <Text style={[styles.nextMilestone, { color: colorTokens.light.primary, fontWeight: "700" }]}>
            Crop has reached maturity GDD threshold
          </Text>
        </View>
      )}

      {/* Irrigation deficit */}
      <View style={[styles.irrigationRow, { borderTopColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }]}>
        <Feather
          name={irrigationUrgent ? "alert-triangle" : "droplet"}
          size={18}
          color={irrigationUrgent ? "#CC0000" : colorTokens.light.primary}
        />
        <View style={styles.irrigationText}>
          <Text style={[styles.irrigationLabel, { color: colors.mutedForeground }]}>7-DAY IRRIGATION DEFICIT</Text>
          <Text style={[styles.irrigationValue, { color: irrigationUrgent ? "#CC0000" : colorTokens.light.primary }]}>
            {irrigationDeficit > 0 ? `+${irrigationDeficit.toFixed(0)}mm deficit` : `${Math.abs(irrigationDeficit).toFixed(0)}mm surplus`}
          </Text>
          {irrigationUrgent && (
            <Text style={styles.irrigationWarning}>Irrigation needed — soil moisture likely low</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  gddBlock: {},
  gddValue: {
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 40,
  },
  gddUnit: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  stageBadge: {
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stageText: {
    fontSize: 13,
    fontWeight: "700",
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    position: "relative",
    marginBottom: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  milestoneMark: {
    position: "absolute",
    top: 0,
    width: 2,
    height: "100%",
  },
  nextMilestone: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  irrigationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 10,
  },
  irrigationIcon: {
    fontSize: 20,
    marginTop: 1,
  },
  irrigationText: {
    flex: 1,
  },
  irrigationLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 2,
  },
  irrigationValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  irrigationWarning: {
    fontSize: 11,
    color: "#CC0000",
    marginTop: 2,
    fontWeight: "500",
  },
});
