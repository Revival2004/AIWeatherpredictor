import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  sendRainAlert,
  scheduleFeedbackReminder,
  cancelFeedbackReminder,
} from "@/services/NotificationService";
import * as Notifications from "expo-notifications";
import KenyaLocationPicker, { type PickedLocation } from "@/components/KenyaLocationPicker";
import MapLocationPicker from "@/components/MapLocationPicker";
import OnboardingModal from "@/components/OnboardingModal";
import { useLanguage, LANG_LABELS } from "@/contexts/LanguageContext";
import FarmerFeedbackCard, { FEEDBACK_PENDING_KEY, type PendingFeedback } from "@/components/FarmerFeedbackCard";
import MLStatusBadge from "@/components/MLStatusBadge";
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useGetWeather,
  useGetWeatherAlerts,
  useGetRainPrediction,
  type WeatherPredictionResponse,
  type RainPredictionResponse,
} from "@workspace/api-client-react";
import { WeatherHeroCard } from "@/components/WeatherHeroCard";
import AlertsBanner from "@/components/AlertsBanner";
import CommunityInsightCard from "@/components/CommunityInsightCard";
import { useColors } from "@/hooks/useColors";

interface Coords {
  latitude: number;
  longitude: number;
}

type TipFn = (key: import("@/constants/translations").TranslationKey) => string;

function getFarmingTip(data: WeatherPredictionResponse | undefined, t: TipFn): string | null {
  if (!data) return null;
  const { weather, prediction } = data;
  if (!prediction) return null;
  const pred = prediction.prediction;
  if (pred.includes("Rain") || pred.includes("Storm") || pred.includes("Thunder")) {
    return t("tipIrrigation");
  }
  if (pred === "Frost Risk") {
    return t("tipFrost");
  }
  if (weather.humidity < 30) {
    return t("tipDry");
  }
  if (weather.windspeed > 30) {
    return t("tipWind");
  }
  if (weather.temperature > 35) {
    return t("tipHeat");
  }
  return t("tipGood");
}

function RainPredictionCard({ data }: { data: RainPredictionResponse }) {
  const colors = useColors();
  const { t } = useLanguage();
  const willRain = data.predictionValue === "yes";
  const pct = Math.round(data.probability * 100);
  const isSklearn = data.modelVersion?.startsWith("sklearn");
  const mp = data.modelProbabilities;

  // Colour theme: red >= 60%, amber 30-60%, green < 30%
  const accentColor = pct >= 60 ? "#EF4444" : pct >= 30 ? "#F59E0B" : "#10B981";
  const bgColor = pct >= 60 ? "#FEF2F2" : pct >= 30 ? "#FFFBEB" : "#F0FDF4";

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 4,
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {/* Main content row */}
      <View style={{ flexDirection: "row", alignItems: "center", padding: 18, gap: 16 }}>
        {/* Big probability circle */}
        <View style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: bgColor,
          borderWidth: 3,
          borderColor: accentColor,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: accentColor, lineHeight: 28 }}>
            {pct}%
          </Text>
          <Text style={{ fontSize: 9, fontFamily: "Inter_500Medium", color: accentColor, opacity: 0.75 }}>
            RAIN
          </Text>
        </View>

        {/* Label + bar */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Feather
              name={willRain ? "cloud-rain" : pct >= 30 ? "cloud-drizzle" : "sun"}
              size={14}
              color={accentColor}
            />
            <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground }}>
              {willRain ? t("rainExpected") : t("noRain")}
            </Text>
          </View>
          <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 8 }}>
            {t("aiPrediction")} · 2-hour window
          </Text>

          {/* Segmented probability bar */}
          <View style={{ flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 }}>
            {[20, 20, 20, 20, 20].map((_, i) => {
              const threshold = (i + 1) * 20;
              const filled = pct >= threshold - 10;
              return (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    borderRadius: 2,
                    backgroundColor: filled ? accentColor : colors.muted,
                    opacity: filled ? 1 - i * 0.05 : 1,
                  }}
                />
              );
            })}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 3 }}>
            <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>Low</Text>
            <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>High</Text>
          </View>
        </View>
      </View>

      {/* Per-model votes — only shown for sklearn */}
      {isSklearn && mp && (
        <View style={{
          flexDirection: "row",
          borderTopWidth: 1,
          borderColor: colors.border,
          paddingVertical: 10,
          paddingHorizontal: 18,
          gap: 0,
          backgroundColor: colors.muted,
        }}>
          {[
            { label: "Logistic Reg.", value: mp.lr, color: "#4A90D9" },
            { label: "Random Forest", value: mp.rf, color: "#3D8B37" },
            { label: "Gradient Boost", value: mp.gb, color: "#D4851A" },
            { label: "Ensemble", value: data.probability, color: accentColor },
          ].map((m, i) => (
            <View key={m.label} style={{ flex: 1, alignItems: "center", borderLeftWidth: i > 0 ? 1 : 0, borderColor: colors.border }}>
              <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: m.color }}>
                {Math.round((m.value ?? 0) * 100)}%
              </Text>
              <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" }}>
                {m.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const CACHE_KEY_PREFIX = "weather_cache_v1_";
const LAST_LOC_KEY = "microclimate_last_location_v1";
const KENYA_DEFAULT_COORDS: Coords = { latitude: -0.3031, longitude: 36.08 };
const KENYA_DEFAULT_LABEL = "Nakuru (default)";

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, toggle, language } = useLanguage();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [fetchEnabled, setFetchEnabled] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [usingDefault, setUsingDefault] = useState(false);
  const [cachedData, setCachedData] = useState<{ weather: unknown; rain: unknown; ts: number } | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [feedbackPending, setFeedbackPending] = useState<PendingFeedback | null>(null);

  // On mount: restore last saved location OR try GPS → fallback to Nakuru
  useEffect(() => {
    AsyncStorage.getItem(LAST_LOC_KEY).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          // If the saved label is our old hard-coded default, treat as no saved location
          const isOldDefault = saved.label === "Nakuru, Kenya" || saved.label === KENYA_DEFAULT_LABEL;
          if (!isOldDefault) {
            setCoords(saved.coords);
            setLocationLabel(saved.label ?? null);
            setUsingDefault(false);
            setFetchEnabled(true);
            return;
          }
        } catch {}
      }

      // No saved location — try GPS first
      setGeoLoading(true);

      const applyGps = (c: Coords) => {
        setCoords(c);
        setLocationLabel(null);
        setUsingDefault(false);
        setFetchEnabled(true);
        setGeoLoading(false);
        AsyncStorage.setItem(LAST_LOC_KEY, JSON.stringify({ coords: c, label: null })).catch(() => {});
      };

      const applyDefault = () => {
        setCoords(KENYA_DEFAULT_COORDS);
        setLocationLabel(KENYA_DEFAULT_LABEL);
        setUsingDefault(true);
        setFetchEnabled(true);
        setGeoLoading(false);
      };

      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => applyGps({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            () => applyDefault(),
            { timeout: 8000 }
          );
        } else {
          applyDefault();
        }
      } else {
        Location.requestForegroundPermissionsAsync().then(({ status }) => {
          if (status !== "granted") { applyDefault(); return; }
          return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }).then((pos) => {
          if (!pos) return;
          applyGps({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        }).catch(() => applyDefault());
      }
    }).catch(() => {
      setCoords(KENYA_DEFAULT_COORDS);
      setLocationLabel(KENYA_DEFAULT_LABEL);
      setUsingDefault(true);
      setFetchEnabled(true);
    });
  }, []);

  const {
    data: weatherData,
    isLoading: weatherLoading,
    error: weatherError,
    refetch,
  } = useGetWeather(
    { lat: coords?.latitude ?? 0, lon: coords?.longitude ?? 0 },
    {
      query: {
        enabled: fetchEnabled && coords !== null,
        staleTime: 5 * 60 * 1000,
      },
    }
  );

  const { data: alertsData, refetch: refetchAlerts } = useGetWeatherAlerts(
    { lat: coords?.latitude ?? 0, lon: coords?.longitude ?? 0 },
    {
      query: {
        enabled: fetchEnabled && coords !== null,
        staleTime: 10 * 60 * 1000,
      },
    }
  );

  const { data: rainData, refetch: refetchRain } = useGetRainPrediction(
    { lat: coords?.latitude ?? 0, lon: coords?.longitude ?? 0 },
    {
      query: {
        enabled: fetchEnabled && coords !== null,
        staleTime: 5 * 60 * 1000,
      },
    }
  );

  const handleLocate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setGeoLoading(true);
    setLocError(null);

    try {
      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
              setCoords(c);
              setFetchEnabled(true);
              setGeoLoading(false);
              setLocationLabel(null);
              setUsingDefault(false);
              AsyncStorage.setItem(LAST_LOC_KEY, JSON.stringify({ coords: c, label: null })).catch(() => {});
            },
            () => {
              setLocError("Location unavailable");
              setGeoLoading(false);
            },
            { timeout: 10000 }
          );
        } else {
          setLocError("Geolocation not supported");
          setGeoLoading(false);
        }
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocError("Location permission denied");
          setGeoLoading(false);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setCoords(c);
        setFetchEnabled(true);
        setGeoLoading(false);
        setLocationLabel(null);
        setUsingDefault(false);
        AsyncStorage.setItem(LAST_LOC_KEY, JSON.stringify({ coords: c, label: null })).catch(() => {});
      }
    } catch {
      setLocError("Could not get location");
      setGeoLoading(false);
    }
  };

  // Offline caching — save good data, restore when offline
  useEffect(() => {
    if (!coords) return;
    const key = `${CACHE_KEY_PREFIX}${coords.latitude.toFixed(3)}_${coords.longitude.toFixed(3)}`;
    AsyncStorage.getItem(key).then((raw) => {
      if (raw) {
        try { setCachedData(JSON.parse(raw)); } catch {}
      }
    });
  }, [coords]);

  useEffect(() => {
    if (!coords || !weatherData) return;
    const key = `${CACHE_KEY_PREFIX}${coords.latitude.toFixed(3)}_${coords.longitude.toFixed(3)}`;
    const payload = { weather: weatherData, rain: rainData ?? null, ts: Date.now() };
    AsyncStorage.setItem(key, JSON.stringify(payload));
    setIsOffline(false);
  }, [weatherData, rainData]);

  useEffect(() => {
    if (weatherError && cachedData) setIsOffline(true);
  }, [weatherError, cachedData]);

  // Rain alert notification — fires when fresh prediction crosses 70%
  const lastAlertedProbRef = useRef<number>(0);
  useEffect(() => {
    if (!rainData) return;
    const prob = rainData.probability;
    if (prob >= 0.7 && prob !== lastAlertedProbRef.current) {
      lastAlertedProbRef.current = prob;
      const name = locationLabel ?? "your farm";
      sendRainAlert(prob, name).catch(() => {});
    }
  }, [rainData, locationLabel]);

  // Farmer feedback — store pending + schedule push notification when prediction arrives
  useEffect(() => {
    if (!rainData || !coords) return;
    const name = locationLabel ?? "My Farm";
    const pending: PendingFeedback = {
      lat: coords.latitude,
      lon: coords.longitude,
      locationName: name,
      predictedAt: Date.now(),
    };
    // Persist so the card appears when app is re-opened after 2h
    AsyncStorage.setItem(FEEDBACK_PENDING_KEY, JSON.stringify(pending)).catch(() => {});
    // Schedule a push notification that fires in exactly 2 hours
    scheduleFeedbackReminder(name).catch(() => {});
  }, [rainData]);

  // On mount: show feedback card if a pending prediction is already ≥2h old
  useEffect(() => {
    AsyncStorage.getItem(FEEDBACK_PENDING_KEY).then((raw) => {
      if (!raw) return;
      try {
        const p: PendingFeedback = JSON.parse(raw);
        const ageMs = Date.now() - p.predictedAt;
        const TWO_HOURS = 2 * 60 * 60 * 1000;
        if (ageMs >= TWO_HOURS) {
          setFeedbackPending(p);
        }
      } catch {}
    });
  }, []);

  // Notification tap listener — farmer taps the "Did it rain?" notification
  // Covers both: app already open (live listener) + app cold-started from notification
  useEffect(() => {
    const showFeedbackFromStorage = () => {
      AsyncStorage.getItem(FEEDBACK_PENDING_KEY).then((raw) => {
        if (!raw) return;
        try { setFeedbackPending(JSON.parse(raw)); } catch {}
      });
    };

    // Cold-start: app was opened by tapping the notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification.request.content.data?.type === "feedback_reminder") {
        showFeedbackFromStorage();
      }
    }).catch(() => {});

    // Foreground: app was already open when notification was tapped
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (response.notification.request.content.data?.type === "feedback_reminder") {
        showFeedbackFromStorage();
      }
    });
    return () => sub.remove();
  }, []);

  const isLoading = geoLoading || weatherLoading;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
      paddingBottom: 16,
      paddingHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    titleBlock: {
      gap: 2,
    },
    title: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    subtitle: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    locateBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    scrollContent: {
      // Web/iOS: tab bar is absolute (floats over content) — need extra bottom room.
      // Android: tab bar sits in normal layout flow — just a small courtesy gap.
      paddingBottom: Platform.OS === "android" ? insets.bottom + 20 : insets.bottom + 100,
      paddingTop: 4,
    },
    sectionLabel: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      letterSpacing: 0.8,
      marginHorizontal: 20,
      marginTop: 20,
      marginBottom: 8,
    },
    extraRow: {
      flexDirection: "row",
      marginHorizontal: 16,
      gap: 10,
      marginBottom: 10,
    },
    extraCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    extraLabel: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      marginBottom: 4,
    },
    extraValue: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    extraUnit: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    tipCard: {
      marginHorizontal: 16,
      marginTop: 4,
      backgroundColor: `${colors.secondary}18`,
      borderRadius: 16,
      padding: 16,
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-start",
      borderWidth: 1,
      borderColor: `${colors.secondary}30`,
    },
    tipText: {
      flex: 1,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.secondary,
      lineHeight: 19,
    },
    locErrorText: {
      textAlign: "center",
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 8,
    },
  });

  const farmingTip = getFarmingTip(weatherData, t);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>FarmPal</Text>
          <Text style={styles.subtitle}>
            {locationLabel ? locationLabel : t("appSubtitle")}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
          {/* Language toggle */}
          <Pressable
            style={{ backgroundColor: `${colors.primary}22`, borderRadius: 10, width: 36, height: 36, justifyContent: "center", alignItems: "center" }}
            onPress={toggle}
            testID="language-toggle-btn"
          >
            <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.primary }}>
              {LANG_LABELS[language]}
            </Text>
          </Pressable>
          <Pressable
            style={{ backgroundColor: `${colors.primary}22`, borderRadius: 10, width: 36, height: 36, justifyContent: "center", alignItems: "center" }}
            onPress={() => setShowLocationPicker(true)}
            testID="search-location-btn"
          >
            <Feather name="search" size={16} color={colors.primary} />
          </Pressable>
          <Pressable
            style={{ backgroundColor: `${colors.primary}22`, borderRadius: 10, width: 36, height: 36, justifyContent: "center", alignItems: "center" }}
            onPress={() => setShowMapPicker(true)}
            testID="map-location-btn"
          >
            <Feather name="map" size={16} color={colors.primary} />
          </Pressable>
          <Pressable
            style={{ backgroundColor: colors.primary, borderRadius: 10, width: 36, height: 36, justifyContent: "center", alignItems: "center" }}
            onPress={handleLocate}
            testID="locate-btn"
          >
            <Feather
              name={geoLoading ? "loader" : "map-pin"}
              size={17}
              color={colors.primaryForeground}
            />
          </Pressable>
        </View>
      </View>

      {/* Default-location banner — shown when GPS failed and Nakuru is the fallback */}
      {usingDefault && !isOffline && (
        <Pressable
          onPress={handleLocate}
          style={{ backgroundColor: "#8B5A2B22", paddingVertical: 7, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: "#8B5A2B33" }}
        >
          <Feather name="alert-circle" size={13} color="#8B5A2B" />
          <Text style={{ color: "#8B5A2B", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>
            {geoLoading ? "Detecting your location…" : "Using Nakuru as default — tap here or the pin button to use your location"}
          </Text>
          {!geoLoading && <Feather name="map-pin" size={13} color="#8B5A2B" />}
        </Pressable>
      )}

      {/* Offline banner */}
      {isOffline && cachedData && (
        <View style={{ backgroundColor: "#8B5A2B", paddingVertical: 6, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="wifi-off" size={13} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>
            {t("offlineBanner")} · {Math.round((Date.now() - (cachedData.ts ?? 0)) / 60000)}m ago
          </Text>
        </View>
      )}

      {/* Onboarding */}
      <OnboardingModal />

      {/* Kenya Location Picker (browse/search by county) */}
      <KenyaLocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={(loc: PickedLocation) => {
          const c = { latitude: loc.lat, longitude: loc.lon };
          setCoords(c);
          setFetchEnabled(true);
          setLocError(null);
          setLocationLabel(loc.displayName);
          setShowLocationPicker(false);
          AsyncStorage.setItem(LAST_LOC_KEY, JSON.stringify({ coords: c, label: loc.displayName })).catch(() => {});
        }}
      />

      {/* Map Location Picker (tap-to-pin on OpenStreetMap) */}
      <MapLocationPicker
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onConfirm={(loc) => {
          const c = { latitude: loc.latitude, longitude: loc.longitude };
          setCoords(c);
          setFetchEnabled(true);
          setLocError(null);
          setLocationLabel(loc.name);
          AsyncStorage.setItem(LAST_LOC_KEY, JSON.stringify({ coords: c, label: loc.name })).catch(() => {});
        }}
      />

      {locError && (
        <Text style={styles.locErrorText}>{locError}</Text>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={!!weatherLoading && fetchEnabled}
            onRefresh={() => { refetch(); refetchAlerts(); refetchRain(); }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <WeatherHeroCard
          data={weatherData}
          isLoading={isLoading}
          error={weatherError as Error | null}
          onRefresh={() => refetch()}
        />

        {alertsData && alertsData.alerts.length > 0 && (
          <AlertsBanner alerts={alertsData.alerts} />
        )}

        {/* Community Zone — nearby farmers sharing data */}
        {coords && (
          <>
            <Text style={styles.sectionLabel}>COMMUNITY ZONE</Text>
            <CommunityInsightCard
              lat={coords.latitude}
              lon={coords.longitude}
            />
          </>
        )}

        {weatherData && (
          <>
            <Text style={styles.sectionLabel}>CONDITIONS</Text>
            <View style={styles.extraRow}>
              <View style={styles.extraCard}>
                <Text style={styles.extraLabel}>Temperature</Text>
                <Text style={styles.extraValue}>
                  {Math.round(weatherData.weather.temperature)}
                  <Text style={styles.extraUnit}>°C</Text>
                </Text>
              </View>
              <View style={styles.extraCard}>
                <Text style={styles.extraLabel}>Pressure</Text>
                <Text style={styles.extraValue}>
                  {weatherData.weather.pressure}
                  <Text style={styles.extraUnit}> hPa</Text>
                </Text>
              </View>
            </View>
            <View style={styles.extraRow}>
              <View style={styles.extraCard}>
                <Text style={styles.extraLabel}>Humidity</Text>
                <Text style={styles.extraValue}>
                  {weatherData.weather.humidity}
                  <Text style={styles.extraUnit}>%</Text>
                </Text>
              </View>
              <View style={styles.extraCard}>
                <Text style={styles.extraLabel}>Wind Speed</Text>
                <Text style={styles.extraValue}>
                  {weatherData.weather.windspeed}
                  <Text style={styles.extraUnit}> km/h</Text>
                </Text>
              </View>
            </View>

            {/* ML Rain Prediction — uses device GPS location */}
            {rainData && (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 20, marginTop: 20, marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.8 }}>
                    RAIN PREDICTION (2H)
                  </Text>
                  <MLStatusBadge
                    modelVersion={rainData.modelVersion}
                    accuracy={rainData.modelVersion?.includes("acc") ? parseFloat(rainData.modelVersion.split("acc")[1] ?? "0") : undefined}
                    isOffline={isOffline}
                  />
                </View>
                <RainPredictionCard data={rainData} />
              </>
            )}

            {/* Farmer feedback — shown 2h after prediction */}
            {feedbackPending && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 4 }]}>YOUR FEEDBACK</Text>
                <FarmerFeedbackCard
                  pending={feedbackPending}
                  onDismiss={() => {
                    setFeedbackPending(null);
                    cancelFeedbackReminder().catch(() => {});
                  }}
                />
              </>
            )}

            <Text style={styles.sectionLabel}>FARMING TIP</Text>
            {farmingTip && (
              <View style={styles.tipCard}>
                <Feather
                  name="info"
                  size={16}
                  color={colors.secondary}
                  style={{ marginTop: 1 }}
                />
                <Text style={styles.tipText}>{farmingTip}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
