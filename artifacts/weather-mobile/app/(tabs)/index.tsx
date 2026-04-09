import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import { scheduleFeedbackReminder, sendRainAlert } from "@/services/NotificationService";
import { useBarometer } from "@/hooks/useBarometer";
import FarmerFeedbackCard, {
  FEEDBACK_PENDING_KEY,
  type PendingFeedback,
} from "@/components/FarmerFeedbackCard";
import KenyaLocationPicker, { type PickedLocation } from "@/components/KenyaLocationPicker";
import MapLocationPicker from "@/components/MapLocationPicker";
import OnboardingModal from "@/components/OnboardingModal";
import { useLanguage, LANG_LABELS } from "@/contexts/LanguageContext";
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
  useGetPlantingAdvisory,
  getGetWeatherQueryKey,
  getGetWeatherAlertsQueryKey,
  getGetRainPredictionQueryKey,
  type WeatherPredictionResponse,
  type RainPredictionResponse,
} from "@/lib/api-client";
import PlantingAdvisoryCard from "@/components/PlantingAdvisoryCard";
import { WeatherHeroCard } from "@/components/WeatherHeroCard";
import AlertsBanner from "@/components/AlertsBanner";
import CommunityInsightCard from "@/components/CommunityInsightCard";
import TodayTimeline from "@/components/TodayTimeline";
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
  const community = data.community;

  // Colour theme: red >= 60%, amber 30-60%, green < 30%
  const accentColor = pct >= 60 ? "#EF4444" : pct >= 30 ? "#F59E0B" : "#10B981";
  const bgColor = pct >= 60 ? "#FEF2F2" : pct >= 30 ? "#FFFBEB" : "#F0FDF4";
  const communityMessage =
    community?.used && community.farmerCount > 0
      ? community.signalDirection === "wetter"
        ? `${community.farmerCount} nearby farmer${community.farmerCount === 1 ? "" : "s"} within ${community.zoneRadiusKm} km are reporting wetter conditions, which lifts this forecast slightly.`
        : community.signalDirection === "drier"
        ? `${community.farmerCount} nearby farmer${community.farmerCount === 1 ? "" : "s"} within ${community.zoneRadiusKm} km are seeing drier conditions, which pulls this forecast down slightly.`
        : `${community.farmerCount} nearby farmer${community.farmerCount === 1 ? "" : "s"} within ${community.zoneRadiusKm} km are contributing a mixed regional signal.`
      : null;

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
            {t("aiPrediction")} - 2-hour window
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

      {/* Per-model votes - only shown for sklearn */}
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

      {communityMessage ? (
        <View
          style={{
            borderTopWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 18,
            paddingVertical: 12,
            backgroundColor: "#F8FAFC",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <Feather name="users" size={14} color="#2563EB" style={{ marginTop: 1 }} />
          <Text
            style={{
              flex: 1,
              fontSize: 11,
              lineHeight: 17,
              fontFamily: "Inter_500Medium",
              color: colors.foreground,
            }}
          >
            {communityMessage}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const CACHE_KEY_PREFIX = "weather_cache_v1_";
const LAST_LOC_KEY = "microclimate_last_location_v1";
const LEGACY_DEFAULT_COORDS = { latitude: -0.3031, longitude: 36.08 };

function isPendingFeedbackStale(pending: PendingFeedback, now = Date.now()): boolean {
  return now - pending.dueAt > 24 * 60 * 60 * 1000;
}

function getPendingFeedbackKey(pending: Pick<PendingFeedback, "lat" | "lon" | "targetTime">): string {
  return `${pending.lat.toFixed(4)}:${pending.lon.toFixed(4)}:${pending.targetTime}`;
}

function formatFeedbackCountdown(dueAt: number, now: number): string {
  const minutes = Math.max(0, Math.round((dueAt - now) / 60000));
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}

function isLegacyStoredDefault(saved: unknown): boolean {
  if (!saved || typeof saved !== "object") return false;

  const candidate = saved as {
    userSelected?: boolean;
    coords?: { latitude?: number; longitude?: number };
  };

  if (candidate.userSelected !== undefined) return false;

  const latitude = candidate.coords?.latitude;
  const longitude = candidate.coords?.longitude;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return false;
  }

  return (
    Math.abs(latitude - LEGACY_DEFAULT_COORDS.latitude) < 0.001 &&
    Math.abs(longitude - LEGACY_DEFAULT_COORDS.longitude) < 0.001
  );
}

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const colors = useColors();

  return (
    <View
      style={{
        marginHorizontal: 20,
        marginTop: 22,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 17,
            lineHeight: 22,
            fontFamily: "Inter_700Bold",
            color: colors.foreground,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              marginTop: 3,
              fontSize: 12,
              lineHeight: 17,
              fontFamily: "Inter_400Regular",
              color: colors.mutedForeground,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

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
  const [cachedData, setCachedData] = useState<{ weather: unknown; rain: unknown; ts: number } | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [locationUpdated, setLocationUpdated] = useState(false);
  const [pendingFeedback, setPendingFeedback] = useState<PendingFeedback | null>(null);
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);
  const [feedbackNow, setFeedbackNow] = useState(Date.now());
  const lastFeedbackKeyRef = useRef<string | null>(null);

  // Haversine distance in km between two coordinates
  const distanceKm = (a: Coords, b: Coords): number => {
    const R = 6371;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const sinLat = Math.sin(dLat / 2);
    const sinLon = Math.sin(dLon / 2);
    const chord =
      sinLat * sinLat +
      Math.cos((a.latitude * Math.PI) / 180) *
        Math.cos((b.latitude * Math.PI) / 180) *
        sinLon * sinLon;
    return R * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
  };

  // On mount: restore last saved location immediately, then silently re-check GPS.
  // If farmer has moved >5 km since last save, auto-update their location.
  useEffect(() => {
    let savedCoords: Coords | null = null;

    const showLocationRequired = (message: string) => {
      setCoords(null);
      setFetchEnabled(false);
      setGeoLoading(false);
      setLocError(message);
    };

    const applyGps = (c: Coords, silent = false) => {
      if (silent && savedCoords) {
        const moved = distanceKm(savedCoords, c);
        if (moved < 5) return; // hasn't moved significantly - keep saved location
        // Farmer has moved - update silently and show brief banner
        setLocationUpdated(true);
        setTimeout(() => setLocationUpdated(false), 4000);
      }
      setCoords(c);
      setLocationLabel(null);
      setFetchEnabled(true);
      setGeoLoading(false);
      setLocError(null);
      AsyncStorage.setItem(
        LAST_LOC_KEY,
        JSON.stringify({ coords: c, label: null, userSelected: false, source: "device" })
      ).catch(() => {});
    };

    const tryGps = (silent: boolean) => {
      if (Platform.OS === "web") {
        if (typeof navigator !== "undefined" && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => applyGps({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }, silent),
            () => {
              if (!silent) {
                showLocationRequired("Enable location or tap the pin button to choose your farm.");
              }
            },
            { timeout: 8000 }
          );
        } else {
          if (!silent) {
            showLocationRequired("Location is unavailable in this browser. Tap the pin button to choose your farm.");
          }
        }
      } else {
        Location.requestForegroundPermissionsAsync().then(({ status }) => {
          if (status !== "granted") {
            if (!silent) {
              showLocationRequired("Location permission denied. Allow location or use the pin button to choose your farm.");
            }
            return null;
          }
          return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }).then((pos) => {
          if (!pos) return;
          applyGps({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }, silent);
        }).catch(() => {
          if (!silent) {
            showLocationRequired("Could not get your current location. Try again or use the pin button to choose your farm.");
          }
        });
      }
    };

    AsyncStorage.getItem(LAST_LOC_KEY).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (!isLegacyStoredDefault(saved) && saved.coords) {
            // Step 1: Show saved location immediately (fast)
            savedCoords = saved.coords;
            setCoords(saved.coords);
            setLocationLabel(saved.label ?? null);
            setFetchEnabled(true);
            setLocError(null);
            // Step 2: Silently re-check GPS in background - auto-update if moved >5 km
            tryGps(true);
            return;
          }
        } catch {}
      }
      // No saved location - request device location with a visible loading state
      setGeoLoading(true);
      tryGps(false);
    }).catch(() => {
      setGeoLoading(true);
      tryGps(false);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(FEEDBACK_PENDING_KEY)
      .then((raw) => {
        if (!raw) {
          return;
        }

        const parsed = JSON.parse(raw) as PendingFeedback;
        if (!parsed || typeof parsed !== "object" || isPendingFeedbackStale(parsed)) {
          AsyncStorage.removeItem(FEEDBACK_PENDING_KEY).catch(() => {});
          return;
        }

        lastFeedbackKeyRef.current = getPendingFeedbackKey(parsed);
        setPendingFeedback(parsed);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!pendingFeedback) {
      setFeedbackDismissed(false);
      return;
    }

    setFeedbackNow(Date.now());
    const interval = setInterval(() => {
      setFeedbackNow(Date.now());
    }, 30_000);

    return () => clearInterval(interval);
  }, [pendingFeedback]);

  useEffect(() => {
    if (!pendingFeedback || !isPendingFeedbackStale(pendingFeedback)) {
      return;
    }

    AsyncStorage.removeItem(FEEDBACK_PENDING_KEY).catch(() => {});
    setPendingFeedback(null);
    setFeedbackDismissed(false);
  }, [pendingFeedback, feedbackNow]);

  const baro = useBarometer();

  const weatherParams = {
    lat: coords?.latitude ?? 0,
    lon: coords?.longitude ?? 0,
    ...(baro.available && baro.pressure ? { localPressure: baro.pressure } : {}),
  };

  const {
    data: weatherData,
    isLoading: weatherLoading,
    error: weatherError,
    refetch,
  } = useGetWeather(
    weatherParams,
    {
      query: {
        queryKey: getGetWeatherQueryKey(weatherParams),
        enabled: fetchEnabled && coords !== null,
        staleTime: 5 * 60 * 1000,
      },
    }
  );

  const { data: alertsData, refetch: refetchAlerts } = useGetWeatherAlerts(
    { lat: coords?.latitude ?? 0, lon: coords?.longitude ?? 0 },
    {
      query: {
        queryKey: getGetWeatherAlertsQueryKey({ lat: coords?.latitude ?? 0, lon: coords?.longitude ?? 0 }),
        enabled: fetchEnabled && coords !== null,
        staleTime: 10 * 60 * 1000,
      },
    }
  );

  const { data: rainData, refetch: refetchRain } = useGetRainPrediction(
    { lat: coords?.latitude ?? 0, lon: coords?.longitude ?? 0 },
    {
      query: {
        queryKey: getGetRainPredictionQueryKey({ lat: coords?.latitude ?? 0, lon: coords?.longitude ?? 0 }),
        enabled: fetchEnabled && coords !== null,
        staleTime: 5 * 60 * 1000,
      },
    }
  );

  const { data: plantingAdvisory } = useGetPlantingAdvisory(
    { lat: coords?.latitude ?? 0, lon: coords?.longitude ?? 0 },
    {
      query: {
        queryKey: ["planting-advisory", coords?.latitude ?? 0, coords?.longitude ?? 0],
        enabled: fetchEnabled && coords !== null,
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
              AsyncStorage.setItem(
                LAST_LOC_KEY,
                JSON.stringify({ coords: c, label: null, userSelected: false, source: "device" })
              ).catch(() => {});
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
        AsyncStorage.setItem(
          LAST_LOC_KEY,
          JSON.stringify({ coords: c, label: null, userSelected: false, source: "device" })
        ).catch(() => {});
      }
    } catch {
      setLocError("Could not get location");
      setGeoLoading(false);
    }
  };

  // Offline caching - save good data, restore when offline
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

  // Rain alert notification - fires when fresh prediction crosses 70%
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

  useEffect(() => {
    if (!rainData || !coords) {
      return;
    }

    if (pendingFeedback && !isPendingFeedbackStale(pendingFeedback)) {
      return;
    }

    const dueAt = new Date(rainData.targetTime).getTime();
    if (!Number.isFinite(dueAt)) {
      return;
    }

    const nextPending: PendingFeedback = {
      lat: coords.latitude,
      lon: coords.longitude,
      locationName: locationLabel ?? "your farm",
      predictedAt: Date.now(),
      targetTime: rainData.targetTime,
      dueAt,
      predictionValue: rainData.predictionValue,
      probability: rainData.probability,
    };
    const feedbackKey = getPendingFeedbackKey(nextPending);

    if (lastFeedbackKeyRef.current === feedbackKey) {
      return;
    }

    lastFeedbackKeyRef.current = feedbackKey;
    setPendingFeedback(nextPending);
    setFeedbackDismissed(false);
    AsyncStorage.setItem(FEEDBACK_PENDING_KEY, JSON.stringify(nextPending)).catch(() => {});

    if (dueAt > Date.now()) {
      scheduleFeedbackReminder(
        nextPending.locationName,
        Math.round((dueAt - Date.now()) / 1000),
      ).catch(() => {});
    }
  }, [coords, locationLabel, pendingFeedback, rainData]);

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
      // Web/iOS: tab bar is absolute (floats over content) - need extra bottom room.
      // Android: tab bar sits in normal layout flow - just a small courtesy gap.
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
    followUpCard: {
      marginHorizontal: 16,
      marginTop: 10,
      borderRadius: 18,
      padding: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 14,
    },
    followUpRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    followUpIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#3B82F615",
    },
    followUpMeta: {
      flex: 1,
      gap: 4,
    },
    followUpTitle: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    followUpText: {
      fontSize: 12,
      lineHeight: 18,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    followUpPill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: `${colors.primary}14`,
      alignSelf: "flex-start",
    },
    followUpPillText: {
      fontSize: 11,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
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
  const feedbackDue = pendingFeedback ? feedbackNow >= pendingFeedback.dueAt : false;
  const feedbackCountdown = pendingFeedback ? formatFeedbackCountdown(pendingFeedback.dueAt, feedbackNow) : null;
  const feedbackTimeLabel = pendingFeedback
    ? new Date(pendingFeedback.dueAt).toLocaleTimeString("en-KE", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>FarmPal</Text>
          <Text style={styles.subtitle}>
            {locationLabel ? locationLabel : "Live weather and field decisions for your farm"}
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

      {/* Location auto-updated banner */}
      {locationUpdated && (
        <View style={{ backgroundColor: "#3D8B37", paddingVertical: 6, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="map-pin" size={13} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>
            Location updated - showing your latest farm area
          </Text>
        </View>
      )}

      {/* Barometer trend banner - only shown when sensor detects significant pressure change */}
      {baro.available && baro.trend === "falling" && (
        <View style={{ backgroundColor: "#1D4ED822", paddingVertical: 5, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: "#1D4ED833" }}>
          <Feather name="trending-down" size={13} color="#1D4ED8" />
          <Text style={{ color: "#1D4ED8", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>
            Pressure is falling on your farm - rain may be approaching
          </Text>
          <Text style={{ color: "#1D4ED899", fontSize: 11, fontFamily: "Inter_400Regular" }}>
            {baro.pressure?.toFixed(0)} hPa
          </Text>
        </View>
      )}
      {baro.available && baro.trend === "rising" && (
        <View style={{ backgroundColor: "#15803D22", paddingVertical: 5, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: "#15803D33" }}>
          <Feather name="trending-up" size={13} color="#15803D" />
          <Text style={{ color: "#15803D", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>
            Pressure is rising - field conditions are improving
          </Text>
          <Text style={{ color: "#15803D99", fontSize: 11, fontFamily: "Inter_400Regular" }}>
            {baro.pressure?.toFixed(0)} hPa
          </Text>
        </View>
      )}

      {/* Offline banner */}
      {isOffline && cachedData && (
        <View style={{ backgroundColor: "#8B5A2B", paddingVertical: 6, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="wifi-off" size={13} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>
            {t("offlineBanner")} - {Math.round((Date.now() - (cachedData.ts ?? 0)) / 60000)}m ago
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
          AsyncStorage.setItem(
            LAST_LOC_KEY,
            JSON.stringify({ coords: c, label: loc.displayName, userSelected: true, source: "picker" })
          ).catch(() => {});
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
          AsyncStorage.setItem(
            LAST_LOC_KEY,
            JSON.stringify({ coords: c, label: loc.name, userSelected: true, source: "map" })
          ).catch(() => {});
        }}
      />

      {locError && (
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 6,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
            backgroundColor: `${colors.warning}14`,
            borderWidth: 1,
            borderColor: `${colors.warning}35`,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <Feather name="map-pin" size={15} color={colors.warning} style={{ marginTop: 1 }} />
          <Text style={[styles.locErrorText, { flex: 1, marginTop: 0, textAlign: "left", color: colors.warning }]}>
            {locError}
          </Text>
        </View>
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
          locationName={locationLabel}
        />

        {__DEV__ && weatherError && (
          <Text style={{ color: "red", fontSize: 11, padding: 10, fontFamily: "Inter_400Regular" }}>
            {`DEBUG: ${(weatherError as Error)?.message ?? String(weatherError)}`}
          </Text>
        )}

        {alertsData && alertsData.alerts.length > 0 && (
          <AlertsBanner alerts={alertsData.alerts} />
        )}

        {/* Community Zone - nearby farmers sharing data */}
        {coords && (
          <>
            <SectionHeader
              title="Nearby farm signal"
              subtitle="What farmers close to this field are seeing right now"
            />
            <CommunityInsightCard
              lat={coords.latitude}
              lon={coords.longitude}
            />
          </>
        )}

        {weatherData && (
          <>
            <SectionHeader
              title="Field conditions"
              subtitle="The current readings shaping today&apos;s farm decisions"
            />
            <View style={styles.extraRow}>
              <View style={styles.extraCard}>
                <Text style={styles.extraLabel}>Temperature</Text>
                <Text style={styles.extraValue}>
                  {Math.round(weatherData.weather.temperature)}
                  <Text style={styles.extraUnit}>{"\u00B0"}C</Text>
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

            {/* ML Rain Prediction - uses device GPS location */}
            {rainData && (
              <>
                <SectionHeader
                  title="Rain chance soon"
                  subtitle="Model view for the next 2 hours"
                  right={
                    <MLStatusBadge
                      modelVersion={rainData.modelVersion}
                      accuracy={rainData.modelVersion?.includes("acc") ? parseFloat(rainData.modelVersion.split("acc")[1] ?? "0") : undefined}
                      isOffline={isOffline}
                    />
                  }
                />
                <RainPredictionCard data={rainData} />
                {pendingFeedback && !feedbackDue ? (
                  <View style={styles.followUpCard}>
                    <View style={styles.followUpRow}>
                      <View style={styles.followUpIcon}>
                        <Feather name="message-circle" size={18} color="#3B82F6" />
                      </View>
                      <View style={styles.followUpMeta}>
                        <Text style={styles.followUpTitle}>We will follow up on this prediction</Text>
                        <Text style={styles.followUpText}>
                          Around {feedbackTimeLabel}, FarmPal will ask whether it actually rained at {pendingFeedback.locationName}.
                          One quick answer helps the model learn your field faster.
                        </Text>
                      </View>
                    </View>
                    <View style={styles.followUpPill}>
                      <Text style={styles.followUpPillText}>Feedback opens in {feedbackCountdown}</Text>
                    </View>
                  </View>
                ) : null}
                {pendingFeedback && feedbackDue && !feedbackDismissed ? (
                  <>
                    <SectionHeader
                      title="How did the weather turn out?"
                      subtitle="Your answer teaches FarmPal what really happened on this field."
                    />
                    <FarmerFeedbackCard
                      pending={pendingFeedback}
                      onClose={() => setFeedbackDismissed(true)}
                      onComplete={() => {
                        setPendingFeedback(null);
                        setFeedbackDismissed(false);
                      }}
                    />
                  </>
                ) : null}
              </>
            )}

            {/* Today's hourly rain timeline */}
            {coords && (
              <TodayTimeline
                lat={coords.latitude}
                lon={coords.longitude}
              />
            )}

            {/* Planting Advisory - false-onset detection */}
            {plantingAdvisory && (
              <>
                <Text style={styles.sectionLabel}>PLANTING ADVISORY</Text>
                <PlantingAdvisoryCard
                  data={plantingAdvisory}
                  lang={language}
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

