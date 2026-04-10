import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { useColorScheme } from "react-native";
import { useColors } from "@/hooks/useColors";
import colorTokens from "@/constants/colors";
import { useLanguage } from "@/contexts/LanguageContext";

export const CROPS = [
  { name: "General", icon: "🌱", frostThreshold: 0, heatThreshold: 38, gddBase: 10 },
  { name: "Corn", icon: "🌽", frostThreshold: -1, heatThreshold: 40, gddBase: 10 },
  { name: "Wheat", icon: "🌾", frostThreshold: -5, heatThreshold: 35, gddBase: 0 },
  { name: "Tomatoes", icon: "🍅", frostThreshold: 2, heatThreshold: 35, gddBase: 10 },
  { name: "Potatoes", icon: "🥔", frostThreshold: -1, heatThreshold: 32, gddBase: 7 },
  { name: "Grapes", icon: "🍇", frostThreshold: -1, heatThreshold: 38, gddBase: 10 },
  { name: "Rice", icon: "🌾", frostThreshold: 10, heatThreshold: 42, gddBase: 10 },
  { name: "Lettuce", icon: "🥬", frostThreshold: -3, heatThreshold: 28, gddBase: 4 },
  { name: "Cotton", icon: "🌿", frostThreshold: 5, heatThreshold: 42, gddBase: 15 },
  { name: "Soybeans", icon: "🫘", frostThreshold: 0, heatThreshold: 38, gddBase: 10 },
  { name: "Citrus", icon: "🍊", frostThreshold: -2, heatThreshold: 40, gddBase: 12 },
  { name: "Sunflower", icon: "🌻", frostThreshold: -1, heatThreshold: 40, gddBase: 7 },
];

interface CropSelectorProps {
  selectedCrop: string;
  onSelect: (cropName: string) => void;
}

const CROP_LABELS = {
  General: { en: "Any crop", sw: "Zao lolote", ki: "Mũmera o wothe" },
  Corn: { en: "Maize", sw: "Mahindi", ki: "Mbembe" },
  Wheat: { en: "Wheat", sw: "Ngano", ki: "Ngano" },
  Tomatoes: { en: "Tomatoes", sw: "Nyanya", ki: "Nyanya" },
  Potatoes: { en: "Potatoes", sw: "Viazi", ki: "Matuma" },
  Grapes: { en: "Grapes", sw: "Zabibu", ki: "Zabibu" },
  Rice: { en: "Rice", sw: "Mchele", ki: "Mũchele" },
  Lettuce: { en: "Lettuce", sw: "Saladi", ki: "Saladi" },
  Cotton: { en: "Cotton", sw: "Pamba", ki: "Pamba" },
  Soybeans: { en: "Soybeans", sw: "Soya", ki: "Soya" },
  Citrus: { en: "Citrus", sw: "Machungwa", ki: "Machungwa" },
  Sunflower: { en: "Sunflower", sw: "Alizeti", ki: "Alizeti" },
} as const;

export default function CropSelector({ selectedCrop, onSelect }: CropSelectorProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = useColors();
  const { language } = useLanguage();
  const [modalVisible, setModalVisible] = useState(false);

  const current = CROPS.find((c) => c.name === selectedCrop) ?? CROPS[0];
  const copy = {
    en: {
      trigger: "YOUR MAIN CROP",
      title: "Choose your crop",
      subtitle: "FarmPal uses this to explain weather and season advice in a way that fits your crop.",
      coldLimit: "Cold limit",
    },
    sw: {
      trigger: "ZAO LAKO KUU",
      title: "Chagua zao lako",
      subtitle: "FarmPal hutumia hili kueleza hali ya hewa na msimu kwa njia inayolingana na zao lako.",
      coldLimit: "Kiwango cha baridi",
    },
    ki: {
      trigger: "MŨMERA WAKO MŨNENE",
      title: "Thuuria mũmera wako",
      subtitle: "FarmPal irutaga ũhoro wa mbura na mũaka na njĩra ĩrĩ hamwe na mũmera wako.",
      coldLimit: "Ũrĩa wa mbeho",
    },
  } as const;
  const cropName = (name: string) => CROP_LABELS[name as keyof typeof CROP_LABELS]?.[language] ?? name;

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: isDark ? colors.card : "#F0F7EE", borderColor: colorTokens.light.primary + "40" }]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.cropIcon}>{current.icon}</Text>
        <View>
          <Text style={[styles.triggerLabel, { color: colors.mutedForeground }]}>{copy[language].trigger}</Text>
          <Text style={[styles.triggerValue, { color: colors.text }]}>{cropName(current.name)}</Text>
        </View>
        <Text style={[styles.chevron, { color: colorTokens.light.primary }]}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: isDark ? colors.card : "#FFFFFF" }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{copy[language].title}</Text>
            <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>
              {copy[language].subtitle}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.cropGrid}>
                {CROPS.map((crop) => (
                  <TouchableOpacity
                    key={crop.name}
                    style={[
                      styles.cropCard,
                      {
                        backgroundColor: selectedCrop === crop.name
                          ? colorTokens.light.primary + "20"
                          : isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                        borderColor: selectedCrop === crop.name ? colorTokens.light.primary : "transparent",
                      },
                    ]}
                    onPress={() => {
                      onSelect(crop.name);
                      setModalVisible(false);
                    }}
                  >
                    <Text style={styles.cropCardIcon}>{crop.icon}</Text>
                    <Text style={[styles.cropCardName, { color: colors.text }]}>{cropName(crop.name)}</Text>
                    <Text style={[styles.cropCardMeta, { color: colors.mutedForeground }]}>
                      Frost: {crop.frostThreshold}°C
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ height: Platform.OS === "ios" ? 40 : 20 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  cropIcon: {
    fontSize: 24,
  },
  triggerLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  triggerValue: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 1,
  },
  chevron: {
    marginLeft: "auto",
    fontSize: 12,
    fontWeight: "700",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "75%",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  cropGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  cropCard: {
    width: "30%",
    borderRadius: 12,
    borderWidth: 2,
    padding: 10,
    alignItems: "center",
    gap: 4,
  },
  cropCardIcon: {
    fontSize: 26,
  },
  cropCardName: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  cropCardMeta: {
    fontSize: 10,
    textAlign: "center",
  },
});
