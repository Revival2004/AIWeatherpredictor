import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { useFarmerSession } from "@/contexts/FarmerSessionContext";
import { useLanguage } from "@/contexts/LanguageContext";

type Stage = "phone" | "code";

function formatError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function FarmerOtpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { authStatus, requestOtp, verifyOtp } = useFarmerSession();
  const { language, t } = useLanguage();
  const [stage, setStage] = useState<Stage>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const otpCopy = {
    en: {
      codeRequired: "Please enter the sent OTP.",
      wrongCode: "Wrong OTP entered.",
      manualContinue: "I already have the code",
      manualHint: "If the SMS already arrived, enter the OTP below.",
    },
    sw: {
      codeRequired: "Tafadhali weka OTP uliyotumiwa.",
      wrongCode: "OTP uliyoingiza si sahihi.",
      manualContinue: "Nina OTP tayari",
      manualHint: "Kama SMS tayari imefika, weka OTP hapa chini.",
    },
    ki: {
      codeRequired: "Please enter the sent OTP.",
      wrongCode: "Wrong OTP entered.",
      manualContinue: "I already have the code",
      manualHint: "If the SMS already arrived, enter the OTP below.",
    },
  } as const;

  const helperText = useMemo(() => {
    if (authStatus?.usingDevelopmentOtp && devCode) {
      return language === "sw"
        ? `OTP ya development: ${devCode}`
        : language === "ki"
        ? `OTP ya development: ${devCode}`
        : `Development OTP: ${devCode}`;
    }
    if (stage === "code") {
      return t("otpCodeHelper");
    }
    return t("otpPhoneHelper");
  }, [authStatus?.usingDevelopmentOtp, devCode, language, stage, t]);

  async function handleRequestOtp(): Promise<void> {
    setRequesting(true);
    setError(null);
    setInfo(null);

    try {
      const response = await requestOtp({
        phoneNumber,
        displayName: displayName.trim() || undefined,
      });
      setPhoneNumber(response.phoneNumber);
      setDevCode(response.devCode ?? null);
      setInfo(
        response.deliveryMode === "development"
          ? t("otpInfoDev")
          : t("otpInfoSms"),
      );
      setStage("code");
    } catch (requestError) {
      setError(formatError(requestError, t("otpUnexpectedError")));
    } finally {
      setRequesting(false);
    }
  }

  async function handleVerifyOtp(): Promise<void> {
    if (!code.trim()) {
      setError(otpCopy[language].codeRequired);
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      await verifyOtp({
        phoneNumber,
        code,
        displayName: displayName.trim() || undefined,
      });
    } catch (verifyError) {
      const message = formatError(verifyError, t("otpUnexpectedError"));
      setError(message.includes("Wrong OTP entered.") ? otpCopy[language].wrongCode : message);
    } finally {
      setVerifying(false);
    }
  }

  const styles = StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flexGrow: 1,
      paddingTop: Platform.OS === "web" ? 48 : insets.top + 24,
      paddingBottom: Platform.OS === "web" ? 32 : insets.bottom + 32,
      paddingHorizontal: 20,
    },
    hero: {
      marginTop: 16,
      marginBottom: 24,
      padding: 20,
      borderRadius: 24,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    eyebrow: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.primary,
      letterSpacing: 1,
      marginBottom: 10,
    },
    title: {
      fontSize: 30,
      lineHeight: 36,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    subtitle: {
      marginTop: 10,
      fontSize: 14,
      lineHeight: 22,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 14,
    },
    featureIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${colors.primary}18`,
    },
    featureText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    panel: {
      padding: 18,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    panelTitle: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    panelSub: {
      fontSize: 13,
      lineHeight: 20,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    fieldLabel: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      letterSpacing: 0.6,
      marginBottom: 6,
    },
    input: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 16,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    hintRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: `${colors.primary}12`,
    },
    hintText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    errorRow: {
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: "#FEE2E2",
    },
    errorText: {
      fontSize: 12,
      lineHeight: 18,
      fontFamily: "Inter_500Medium",
      color: "#B91C1C",
    },
    button: {
      minHeight: 52,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    buttonSecondary: {
      minHeight: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${colors.primary}15`,
    },
    buttonText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontFamily: "Inter_700Bold",
    },
    buttonSecondaryText: {
      color: colors.primary,
      fontSize: 14,
      fontFamily: "Inter_700Bold",
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{t("otpEyebrow")}</Text>
          <Text style={styles.title}>{t("otpTitle")}</Text>
          <Text style={styles.subtitle}>{t("otpSubtitle")}</Text>

          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Feather name="map-pin" size={16} color={colors.primary} />
            </View>
            <Text style={styles.featureText}>{t("otpFeaturePrivate")}</Text>
          </View>
          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Feather name="shield" size={16} color={colors.primary} />
            </View>
            <Text style={styles.featureText}>{t("otpFeatureAutoWeather")}</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>
            {stage === "phone" ? t("otpPhoneStageTitle") : t("otpCodeStageTitle")}
          </Text>
          <Text style={styles.panelSub}>{helperText}</Text>

          {error ? (
            <View style={styles.errorRow}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {info ? (
            <View style={styles.hintRow}>
              <Feather name="message-square" size={14} color={colors.primary} />
              <Text style={styles.hintText}>{info}</Text>
            </View>
          ) : null}

          {stage === "phone" ? (
            <>
              <View>
                <Text style={styles.fieldLabel}>{t("otpPhoneField")}</Text>
                <TextInput
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholder={t("otpPhonePlaceholder")}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  style={styles.input}
                />
              </View>
              <View>
                <Text style={styles.fieldLabel}>{t("otpNameField")}</Text>
                <TextInput
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder={t("otpNamePlaceholder")}
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="words"
                  style={styles.input}
                />
              </View>

              <Pressable style={styles.button} onPress={handleRequestOtp} disabled={requesting}>
                {requesting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>{t("otpSendButton")}</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.buttonSecondary}
                onPress={() => {
                  setError(null);
                  setInfo(otpCopy[language].manualHint);
                  setStage("code");
                }}
              >
                <Text style={styles.buttonSecondaryText}>{otpCopy[language].manualContinue}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View>
                <Text style={styles.fieldLabel}>{t("otpCodeField")}</Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder={t("otpCodePlaceholder")}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  maxLength={8}
                  style={styles.input}
                />
              </View>

              {authStatus?.usingDevelopmentOtp && devCode ? (
                <View style={styles.hintRow}>
                  <Feather name="tool" size={14} color={colors.primary} />
                  <Text style={styles.hintText}>
                    {t("otpDevModeHint")}
                  </Text>
                </View>
              ) : null}

              <Pressable style={styles.button} onPress={handleVerifyOtp} disabled={verifying}>
                {verifying ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>{t("otpVerifyButton")}</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.buttonSecondary}
                onPress={() => {
                  setStage("phone");
                  setCode("");
                  setDevCode(null);
                  setInfo(null);
                }}
              >
                <Text style={styles.buttonSecondaryText}>{t("otpChangePhone")}</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
