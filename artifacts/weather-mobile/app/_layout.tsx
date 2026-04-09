import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Feather } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { setBaseUrl } from "@/lib/api-client";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import FarmerOtpScreen from "@/components/FarmerOtpScreen";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { FarmerSessionProvider, useFarmerSession } from "@/contexts/FarmerSessionContext";

// EXPO_PUBLIC_DOMAIN is set in eas.json for production builds.
// It can be a full URL (https://farmpal-api.onrender.com) or just a domain.
// Falls back to the Render API domain for local builds when no env is provided.
const _apiDomain = process.env.EXPO_PUBLIC_DOMAIN;
const _baseUrl = _apiDomain
  ? (_apiDomain.startsWith("http") ? _apiDomain : `https://${_apiDomain}`)
  : "https://farmpal-api.onrender.com";
setBaseUrl(_baseUrl);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { status } = useFarmerSession();

  if (status === "checking") {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#3D8B37" />
        <Text style={styles.loadingTitle}>Securing your FarmPal account</Text>
        <Text style={styles.loadingCopy}>Restoring your farms, weather history, and alerts.</Text>
      </View>
    );
  }

  if (status !== "authenticated") {
    return <FarmerOtpScreen />;
  }

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#F7F5EF",
  },
  loadingTitle: {
    marginTop: 16,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#152A1B",
  },
  loadingCopy: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
    color: "#5F6E62",
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    // Explicitly preload the Feather icon font so it renders on all Android devices
    ...Feather.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <LanguageProvider>
          <QueryClientProvider client={queryClient}>
            <FarmerSessionProvider>
              <GestureHandlerRootView>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </FarmerSessionProvider>
          </QueryClientProvider>
        </LanguageProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
