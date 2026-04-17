import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import {
  DASHBOARD_WORK_STAGES,
  getDashboardWorkStageLabel,
  type DashboardWorkStage,
  type FarmUiLanguage,
} from "@/lib/farm-context";

interface WorkStageSelectorProps {
  language: FarmUiLanguage;
  selectedStage: DashboardWorkStage;
  onSelect: (stage: DashboardWorkStage) => void;
}

const STAGE_ICONS: Record<DashboardWorkStage, keyof typeof Feather.glyphMap> = {
  planting: "edit-3",
  harvesting: "package",
  weeding: "scissors",
  spraying: "cloud-drizzle",
};

export default function WorkStageSelector({
  language,
  selectedStage,
  onSelect,
}: WorkStageSelectorProps) {
  const colors = useColors();
  const copy = useMemo(
    () =>
      ({
        en: {
          title: "TODAY'S FARM TASK",
          subtitle: "Tell FarmPal what kind of work you are planning so the decision card fits the job.",
        },
        sw: {
          title: "KAZI YA SHAMBA YA LEO",
          subtitle: "Iambie FarmPal kazi unayopanga ili kadi ya uamuzi ifae kazi hiyo.",
        },
        ki: {
          title: "KAZI YA SHAMBA YA LEO",
          subtitle: "Iambie FarmPal kazi unayopanga ili kadi ya uamuzi ifae kazi hiyo.",
        },
      } as const)[language],
    [language],
  );

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.title, { color: colors.mutedForeground }]}>{copy.title}</Text>
      <Text style={[styles.subtitle, { color: colors.foreground }]}>{copy.subtitle}</Text>

      <View style={styles.grid}>
        {DASHBOARD_WORK_STAGES.map((stage) => {
          const selected = selectedStage === stage;
          return (
            <Pressable
              key={stage}
              style={[
                styles.stageChip,
                {
                  backgroundColor: selected ? `${colors.primary}16` : colors.background,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => onSelect(stage)}
            >
              <Feather
                name={STAGE_ICONS[stage]}
                size={15}
                color={selected ? colors.primary : colors.mutedForeground}
              />
              <Text style={[styles.stageText, { color: selected ? colors.primary : colors.foreground }]}>
                {getDashboardWorkStageLabel(stage, language)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_600SemiBold",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  stageChip: {
    width: "47%",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stageText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_700Bold",
  },
});
