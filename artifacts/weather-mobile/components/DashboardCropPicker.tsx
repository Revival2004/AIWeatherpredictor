import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import {
  DASHBOARD_CROPS,
  getDashboardCropLabel,
  type DashboardCropName,
  type FarmUiLanguage,
  summarizeDashboardCrops,
} from "@/lib/farm-context";

interface DashboardCropPickerProps {
  language: FarmUiLanguage;
  selectedCrops: string[];
  onChange: (next: DashboardCropName[]) => void;
}

export default function DashboardCropPicker({
  language,
  selectedCrops,
  onChange,
}: DashboardCropPickerProps) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const copy = useMemo(
    () =>
      ({
        en: {
          label: "YOUR CROPS",
          title: "Choose the crops on this farm",
          subtitle: "FarmPal uses this to shape the decision card for the crops you care about most.",
          helper: "Choose one or more crops",
          empty: "Choose crops for sharper advice",
          done: "Done",
        },
        sw: {
          label: "MAZAO YAKO",
          title: "Chagua mazao ya shamba hili",
          subtitle: "FarmPal hutumia hili kufanya kadi ya uamuzi ifae mazao unayolenga zaidi.",
          helper: "Chagua zao moja au zaidi",
          empty: "Chagua mazao upate ushauri ulio makini zaidi",
          done: "Sawa",
        },
        ki: {
          label: "MAZAO YAKO",
          title: "Chagua mazao ya shamba hili",
          subtitle: "FarmPal hutumia hili kufanya kadi ya uamuzi ifae mazao unayolenga zaidi.",
          helper: "Chagua zao moja au zaidi",
          empty: "Chagua mazao upate ushauri ulio makini zaidi",
          done: "Sawa",
        },
      } as const)[language],
    [language],
  );

  const normalizedSelection = selectedCrops.filter((crop, index, source) => source.indexOf(crop) === index);
  const summary = normalizedSelection.length > 0
    ? summarizeDashboardCrops(normalizedSelection, language)
    : copy.empty;

  const toggleCrop = (crop: DashboardCropName) => {
    const current = normalizedSelection as DashboardCropName[];

    if (crop === "General") {
      onChange(current.length === 1 && current[0] === "General" ? [] : ["General"]);
      return;
    }

    if (current.includes(crop)) {
      onChange(current.filter((entry) => entry !== crop));
      return;
    }

    onChange(current.filter((entry) => entry !== "General").concat(crop));
  };

  return (
    <>
      <Pressable
        style={[
          styles.trigger,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
        onPress={() => setOpen(true)}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}16` }]}>
          <Feather name="layers" size={18} color={colors.primary} />
        </View>
        <View style={styles.triggerMeta}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>{copy.label}</Text>
          <Text style={[styles.summary, { color: colors.foreground }]} numberOfLines={2}>
            {summary}
          </Text>
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>{copy.helper}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>{copy.title}</Text>
                <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>{copy.subtitle}</Text>
              </View>
              <Pressable style={[styles.doneBtn, { backgroundColor: `${colors.primary}16` }]} onPress={() => setOpen(false)}>
                <Text style={[styles.doneText, { color: colors.primary }]}>{copy.done}</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.cropGrid}>
                {DASHBOARD_CROPS.map((crop) => {
                  const selected = normalizedSelection.includes(crop);
                  return (
                    <Pressable
                      key={crop}
                      style={[
                        styles.cropChip,
                        {
                          backgroundColor: selected ? `${colors.primary}14` : colors.background,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => toggleCrop(crop)}
                    >
                      <Feather
                        name={selected ? "check-circle" : "circle"}
                        size={15}
                        color={selected ? colors.primary : colors.mutedForeground}
                      />
                      <Text style={[styles.cropText, { color: colors.foreground }]}>
                        {getDashboardCropLabel(crop, language)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerMeta: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  summary: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Inter_700Bold",
  },
  helper: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 17, 0.45)",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  modalCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    maxHeight: "82%",
    gap: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  modalTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontFamily: "Inter_700Bold",
  },
  modalSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  doneBtn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  doneText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  cropGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  cropChip: {
    width: "47%",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cropText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_600SemiBold",
  },
});
