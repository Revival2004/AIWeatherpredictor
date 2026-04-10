import { Feather } from "@expo/vector-icons";
import { Stack } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import FarmerOtpScreen from "@/components/FarmerOtpScreen";
import { useLanguage } from "@/contexts/LanguageContext";
import { useFarmerSession } from "@/contexts/FarmerSessionContext";
import { useColors } from "@/hooks/useColors";

export default function RootLayoutShell() {
  const { farmer, status, updateProfile } = useFarmerSession();
  const { language } = useLanguage();
  const colors = useColors();
  const [showOpening, setShowOpening] = useState(true);
  const [villageName, setVillageName] = useState("");
  const [savingVillage, setSavingVillage] = useState(false);
  const [villageError, setVillageError] = useState<string | null>(null);
  const [villagePromptDismissed, setVillagePromptDismissed] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const copy = useMemo(
    () =>
      ({
        en: {
          title: "Add your village",
          body: "This helps FarmPal show your current-location weather using a familiar village name.",
          field: "Village name",
          placeholder: "Type your village name",
          save: "Save village",
          saving: "Saving...",
          later: "Maybe later",
          error: "Please enter your village name.",
          saveError: "We could not save your village right now. Please try again.",
        },
        sw: {
          title: "Ongeza kijiji chako",
          body: "Hii husaidia FarmPal kuonyesha hali ya hewa ya mahali ulipo kwa jina la kijiji unalotambua.",
          field: "Jina la kijiji",
          placeholder: "Andika jina la kijiji chako",
          save: "Hifadhi kijiji",
          saving: "Inahifadhi...",
          later: "Baadaye",
          error: "Tafadhali andika jina la kijiji chako.",
          saveError: "Hatukuweza kuhifadhi kijiji chako sasa. Tafadhali jaribu tena.",
        },
        ki: {
          title: "Add your village",
          body: "This helps FarmPal show your current-location weather using a familiar village name.",
          field: "Village name",
          placeholder: "Type your village name",
          save: "Save village",
          saving: "Saving...",
          later: "Maybe later",
          error: "Please enter your village name.",
          saveError: "We could not save your village right now. Please try again.",
        },
      } as const)[language],
    [language],
  );

  function getFriendlyVillageError(error: unknown): string {
    if (!(error instanceof Error) || !error.message.trim()) {
      return copy.saveError;
    }

    const message = error.message.trim();
    const lower = message.toLowerCase();
    if (
      lower.includes("<html") ||
      lower.includes("<!doctype") ||
      lower.includes("unexpected token <") ||
      lower.includes("failed to parse response") ||
      lower.startsWith("http ")
    ) {
      return copy.saveError;
    }

    return message;
  }
  const shouldPromptVillage =
    status === "authenticated" &&
    Boolean(farmer) &&
    !farmer?.villageName?.trim() &&
    !villagePromptDismissed;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -12,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => setShowOpening(false));
    }, 900);

    return () => clearTimeout(timer);
  }, [opacity, translateY]);

  useEffect(() => {
    if (!shouldPromptVillage) {
      setVillageName("");
      setVillageError(null);
    }
  }, [shouldPromptVillage]);

  useEffect(() => {
    if (status !== "authenticated" || farmer?.villageName?.trim()) {
      setVillagePromptDismissed(false);
    }
  }, [farmer?.villageName, status]);

  const content =
    status === "authenticated" ? (
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    ) : (
      <FarmerOtpScreen />
    );

  return (
    <View style={styles.root}>
      {content}

      <Modal visible={shouldPromptVillage} transparent animationType="fade">
        <View style={styles.promptBackdrop}>
          <View style={[styles.promptCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.promptTitle, { color: colors.foreground }]}>{copy.title}</Text>
            <Text style={[styles.promptBody, { color: colors.mutedForeground }]}>{copy.body}</Text>
            <Text style={[styles.promptLabel, { color: colors.mutedForeground }]}>{copy.field}</Text>
            <TextInput
              value={villageName}
              onChangeText={setVillageName}
              placeholder={copy.placeholder}
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.promptInput,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
            />
            {villageError ? <Text style={styles.promptError}>{villageError}</Text> : null}
            <View style={styles.promptActions}>
              <Pressable
                style={[styles.promptSecondary, { backgroundColor: colors.muted }]}
                onPress={() => {
                  setVillageName("");
                  setVillageError(null);
                  setVillagePromptDismissed(true);
                }}
              >
                <Text style={[styles.promptSecondaryText, { color: colors.foreground }]}>{copy.later}</Text>
              </Pressable>
              <Pressable
                style={[styles.promptPrimary, { backgroundColor: "#3D8B37" }]}
                onPress={async () => {
                  const value = villageName.trim();
                  if (!value) {
                    setVillageError(copy.error);
                    return;
                  }

                  setSavingVillage(true);
                  setVillageError(null);
                  try {
                    await updateProfile({ villageName: value });
                    setVillageName("");
                  } catch (error) {
                    setVillageError(getFriendlyVillageError(error));
                  } finally {
                    setSavingVillage(false);
                  }
                }}
                disabled={savingVillage}
              >
                <Text style={styles.promptPrimaryText}>{savingVillage ? copy.saving : copy.save}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {showOpening ? (
        <Animated.View
          style={[
            styles.openingOverlay,
            {
              opacity,
              transform: [{ translateY }],
            },
          ]}
          pointerEvents="none"
        >
          <View style={styles.openingMark}>
            <Feather name="cloud-rain" size={26} color="#3D8B37" />
          </View>
          <Text style={styles.openingTitle}>FarmPal</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  promptBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(15, 23, 17, 0.4)",
  },
  promptCard: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  promptTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  promptBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
  },
  promptLabel: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
  },
  promptInput: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  promptError: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter_500Medium",
    color: "#B91C1C",
  },
  promptActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  promptPrimary: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  promptSecondary: {
    flex: 1,
    minHeight: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  promptPrimaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  promptSecondaryText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  openingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F5EF",
    gap: 14,
  },
  openingMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F3E5",
    borderWidth: 1,
    borderColor: "#C7DEC2",
  },
  openingTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#152A1B",
  },
});
