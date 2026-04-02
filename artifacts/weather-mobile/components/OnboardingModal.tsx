import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";

const ONBOARDING_KEY = "microclimate_onboarding_v1";

type Step = {
  titleKey: "welcomeTitle" | "step2Title" | "step3Title";
  bodyKey: "welcomeBody" | "step2Body" | "step3Body";
  icon: keyof typeof Feather.glyphMap;
  color: string;
};

const STEPS: Step[] = [
  {
    titleKey: "welcomeTitle",
    bodyKey: "welcomeBody",
    icon: "cloud-rain",
    color: "#3B82F6",
  },
  {
    titleKey: "step2Title",
    bodyKey: "step2Body",
    icon: "map-pin",
    color: "#3D8B37",
  },
  {
    titleKey: "step3Title",
    bodyKey: "step3Body",
    icon: "bar-chart-2",
    color: "#8B5A2B",
  },
];

export default function OnboardingModal() {
  const colors = useColors();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((done) => {
      if (!done) setVisible(true);
    });
  }, []);

  function finish() {
    AsyncStorage.setItem(ONBOARDING_KEY, "done");
    setVisible(false);
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  }

  const current = STEPS[step];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {/* Icon */}
          <View style={[styles.iconWrap, { backgroundColor: `${current.color}18` }]}>
            <Feather name={current.icon} size={40} color={current.color} />
          </View>

          {/* Text */}
          <Text style={[styles.title, { color: colors.foreground }]}>
            {t(current.titleKey)}
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {t(current.bodyKey)}
          </Text>

          {/* Step dots */}
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === step ? current.color : colors.muted,
                    width: i === step ? 20 : 8,
                  },
                ]}
              />
            ))}
          </View>

          {/* Buttons */}
          <View style={styles.btns}>
            {step < STEPS.length - 1 ? (
              <>
                <Pressable onPress={finish} style={styles.skipBtn}>
                  <Text style={[styles.skipText, { color: colors.mutedForeground }]}>
                    Skip
                  </Text>
                </Pressable>
                <Pressable
                  onPress={next}
                  style={[styles.nextBtn, { backgroundColor: current.color }]}
                >
                  <Text style={styles.nextText}>{t("next")}</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={finish}
                style={[styles.nextBtn, { backgroundColor: current.color, flex: 1 }]}
              >
                <Text style={styles.nextText}>{t("getStarted")}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 28,
    alignItems: "center",
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  btns: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 14,
  },
  skipText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  nextBtn: {
    flex: 2,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 14,
  },
  nextText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
