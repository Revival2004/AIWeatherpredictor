import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  cancelFeedbackReminder,
  sendRainAlert,
} from "@/services/NotificationService";
import { useBarometer } from "@/hooks/useBarometer";
import KenyaLocationPicker, { type PickedLocation } from "@/components/KenyaLocationPicker";
import MapLocationPicker from "@/components/MapLocationPicker";
import OnboardingModal from "@/components/OnboardingModal";
import { useFarmerSession } from "@/contexts/FarmerSessionContext";
import { useLanguage, LANG_LABELS } from "@/contexts/LanguageContext";
import MLStatusBadge from "@/components/MLStatusBadge";
import DashboardCropPicker from "@/components/DashboardCropPicker";
import WorkStageSelector from "@/components/WorkStageSelector";
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
  type TrackedLocation,
  type RainPredictionResponse,
} from "@/lib/api-client";
import { customFetch } from "@/lib/api-client/custom-fetch";
import DecisionAssistantCardAdaptive from "@/components/DecisionAssistantCardAdaptive";
import AlertsBanner from "@/components/AlertsBannerClean";
import CommunityInsightCard from "@/components/CommunityInsightCard";
import TodayTimeline from "@/components/TodayTimeline";
import WeatherSnapshotCard from "@/components/WeatherSnapshotCardClean";
import { useTrackedLocationsCache } from "@/hooks/useTrackedLocationsCache";
import {
  getCropStageHint,
  normalizeCropName,
  type DashboardWorkStage,
} from "@/lib/farm-context";
import { useColors } from "@/hooks/useColors";

interface Coords {
  latitude: number;
  longitude: number;
}

type LocationSelectionSource = "device" | "tracked" | "picker" | "map";

interface StoredLocationState {
  coords: Coords;
  label: string | null;
  userSelected: boolean;
  source: LocationSelectionSource;
  accuracyMeters?: number | null;
  trackedLocationId?: number | null;
}

function RainPredictionCard({ data }: { data: RainPredictionResponse }) {
  const colors = useColors();
  const { t, tf } = useLanguage();
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
        ? tf("communityMessageWetter", {
            count: community.farmerCount,
            radius: community.zoneRadiusKm,
          })
        : community.signalDirection === "drier"
        ? tf("communityMessageDrier", {
            count: community.farmerCount,
            radius: community.zoneRadiusKm,
          })
        : tf("communityMessageMixed", {
            count: community.farmerCount,
            radius: community.zoneRadiusKm,
          })
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
            {t("rainCircleLabel")}
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
            {t("aiPrediction")}
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
            <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{t("lowLabel")}</Text>
            <Text style={{ fontSize: 9, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>{t("highLabel")}</Text>
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
            { label: t("patternModel"), value: mp.lr, color: "#4A90D9" },
            { label: t("treeModel"), value: mp.rf, color: "#3D8B37" },
            { label: t("boostModel"), value: mp.gb, color: "#D4851A" },
            { label: t("combinedModel"), value: data.probability, color: accentColor },
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
const AUTO_VERIFY_PENDING_KEY = "farmpal_auto_verify_pending_v1";
const DASHBOARD_CROPS_KEY = "farmpal_dashboard_crops_v1";
const DASHBOARD_WORK_STAGE_KEY = "farmpal_dashboard_work_stage_v1";
const LEGACY_DEFAULT_COORDS = { latitude: -0.3031, longitude: 36.08 };

interface PendingAutoVerification {
  lat: number;
  lon: number;
  locationName: string;
  targetTime: string;
  dueAt: number;
  predictionValue: "yes" | "no";
  probability: number;
}

function isAutoVerificationStale(pending: PendingAutoVerification, now = Date.now()): boolean {
  return now - pending.dueAt > 4 * 60 * 60 * 1000;
}

function getAutoVerificationKey(pending: Pick<PendingAutoVerification, "lat" | "lon" | "targetTime">): string {
  return `${pending.lat.toFixed(4)}:${pending.lon.toFixed(4)}:${pending.targetTime}`;
}

function formatCountdown(dueAt: number, now: number): string {
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
  const { t, tf, toggle, language } = useLanguage();
  const { farmer } = useFarmerSession();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [fetchEnabled, setFetchEnabled] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSelectionSource>("device");
  const [locationAccuracyMeters, setLocationAccuracyMeters] = useState<number | null>(null);
  const [selectedTrackedLocationId, setSelectedTrackedLocationId] = useState<number | null>(null);
  const [cachedData, setCachedData] = useState<{ weather: unknown; rain: unknown; ts: number } | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [locationUpdated, setLocationUpdated] = useState(false);
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [selectedWorkStage, setSelectedWorkStage] = useState<DashboardWorkStage>("planting");
  const [pendingAutoVerification, setPendingAutoVerification] = useState<PendingAutoVerification | null>(null);
  const [autoVerificationNow, setAutoVerificationNow] = useState(Date.now());
  const [autoResolving, setAutoResolving] = useState(false);
  const [autoVerificationMessage, setAutoVerificationMessage] = useState<string | null>(null);
  const lastAutoVerificationKeyRef = useRef<string | null>(null);
  const autoVerificationRetryAtRef = useRef<number>(0);
  const {
    locations,
    error: locationsError,
    hasFallbackLocations,
    refetch: refetchLocations,
  } = useTrackedLocationsCache({
    enabled: Boolean(farmer?.id),
    farmerId: farmer?.id,
  });
  const currentVillageName = farmer?.villageName?.trim() || null;
  const farmerFirstName = farmer?.displayName?.trim()?.split(/\s+/)[0] || null;
  const trackedFarmLabel = (loc: TrackedLocation) => loc.villageName?.trim() || loc.name;
  const currentLocationSummary = currentVillageName
    ? ({
        en: `Current village: ${currentVillageName}`,
        sw: `Kijiji cha sasa: ${currentVillageName}`,
        ki: `Current village: ${currentVillageName}`,
      } as const)[language]
    : t("homeSubtitle");

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

  const applyLocationSelection = (
    next: StoredLocationState,
    options?: { showUpdatedBanner?: boolean },
  ) => {
    if (options?.showUpdatedBanner) {
      setLocationUpdated(true);
      setTimeout(() => setLocationUpdated(false), 4000);
    }

    setCoords(next.coords);
    setFetchEnabled(true);
    setGeoLoading(false);
    setLocError(null);
    setLocationLabel(next.label);
    setLocationSource(next.source);
    setLocationAccuracyMeters(next.accuracyMeters ?? null);
    setSelectedTrackedLocationId(next.trackedLocationId ?? null);
    AsyncStorage.setItem(LAST_LOC_KEY, JSON.stringify(next)).catch(() => {});
  };

  const useTrackedFarm = (loc: TrackedLocation) => {
    applyLocationSelection({
      coords: { latitude: loc.latitude, longitude: loc.longitude },
      label: trackedFarmLabel(loc),
      userSelected: true,
      source: "tracked",
      trackedLocationId: loc.id,
    });

    const preferredCrop = normalizeCropName(loc.cropType);
    if (preferredCrop && selectedCrops.length === 0) {
      setSelectedCrops([preferredCrop]);
    }
  };

  const getDevicePosition = async (): Promise<{ coords: Coords; accuracyMeters: number | null }> => {
    if (Platform.OS === "web") {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        throw new Error(t("locationBrowserPick"));
      }

      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
              accuracyMeters: typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null,
            }),
          () => reject(new Error(t("locationEnableOrPick"))),
          { enableHighAccuracy: true, timeout: 12_000, maximumAge: 15_000 },
        );
      });
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error(t("locationPermissionOrPick"));
    }

    const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
    const precisePosition = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }),
      new Promise<Location.LocationObject | null>((resolve) => {
        setTimeout(() => resolve(null), 12_000);
      }),
    ]).catch(() => null);

    const chosen = precisePosition ?? lastKnown;
    if (!chosen) {
      throw new Error(t("locationCurrentOrPick"));
    }

    return {
      coords: { latitude: chosen.coords.latitude, longitude: chosen.coords.longitude },
      accuracyMeters: typeof chosen.coords.accuracy === "number" ? chosen.coords.accuracy : null,
    };
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

    const applyGps = (
      position: { coords: Coords; accuracyMeters: number | null },
      silent = false,
    ) => {
      const movedDistance = silent && savedCoords ? distanceKm(savedCoords, position.coords) : 0;
      if (silent && savedCoords) {
        savedCoords = position.coords;
      }
      applyLocationSelection(
        {
          coords: position.coords,
          label: null,
          userSelected: false,
          source: "device",
          accuracyMeters: position.accuracyMeters,
        },
        { showUpdatedBanner: silent && Boolean(savedCoords) && movedDistance >= 0.5 },
      );
    };

    const tryGps = (silent: boolean) => {
      getDevicePosition()
        .then((position) => applyGps(position, silent))
        .catch(() => {
          if (!silent) {
            showLocationRequired(
              Platform.OS === "web" ? t("locationEnableOrPick") : t("locationCurrentOrPick"),
            );
          }
        });
    };

    AsyncStorage.getItem(LAST_LOC_KEY).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Partial<StoredLocationState>;
          if (!isLegacyStoredDefault(saved) && saved.coords) {
            // Step 1: Show saved location immediately (fast)
            savedCoords = saved.coords;
            applyLocationSelection({
              coords: saved.coords,
              label: saved.label ?? null,
              userSelected: Boolean(saved.userSelected),
              source: saved.source ?? (saved.userSelected ? "picker" : "device"),
              accuracyMeters:
                typeof saved.accuracyMeters === "number" ? saved.accuracyMeters : null,
              trackedLocationId:
                typeof saved.trackedLocationId === "number" ? saved.trackedLocationId : null,
            });
            if (!saved.userSelected) {
              // Only background-refresh device-driven views. If the farmer explicitly chose a
              // saved farm, keep that farm locked until they switch back to current location.
              tryGps(true);
            }
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
  }, [t]);

  useEffect(() => {
    AsyncStorage.multiGet([DASHBOARD_CROPS_KEY, DASHBOARD_WORK_STAGE_KEY, AUTO_VERIFY_PENDING_KEY])
      .then((entries) => {
        const cropsRaw = entries[0]?.[1];
        const stageRaw = entries[1]?.[1];
        const autoRaw = entries[2]?.[1];

        if (cropsRaw) {
          try {
            const parsed = JSON.parse(cropsRaw) as string[];
            if (Array.isArray(parsed)) {
              setSelectedCrops(parsed);
            }
          } catch {}
        }

        if (
          stageRaw === "planting" ||
          stageRaw === "harvesting" ||
          stageRaw === "weeding" ||
          stageRaw === "spraying"
        ) {
          setSelectedWorkStage(stageRaw);
        }

        if (autoRaw) {
          try {
            const parsed = JSON.parse(autoRaw) as PendingAutoVerification;
            if (parsed && typeof parsed === "object" && !isAutoVerificationStale(parsed)) {
              lastAutoVerificationKeyRef.current = getAutoVerificationKey(parsed);
              setPendingAutoVerification(parsed);
            } else {
              AsyncStorage.removeItem(AUTO_VERIFY_PENDING_KEY).catch(() => {});
            }
          } catch {
            AsyncStorage.removeItem(AUTO_VERIFY_PENDING_KEY).catch(() => {});
          }
        }
      })
      .catch(() => {});

    cancelFeedbackReminder().catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(DASHBOARD_CROPS_KEY, JSON.stringify(selectedCrops)).catch(() => {});
  }, [selectedCrops]);

  useEffect(() => {
    AsyncStorage.setItem(DASHBOARD_WORK_STAGE_KEY, selectedWorkStage).catch(() => {});
  }, [selectedWorkStage]);

  useEffect(() => {
    if (!pendingAutoVerification) {
      return;
    }

    setAutoVerificationNow(Date.now());
    const interval = setInterval(() => {
      setAutoVerificationNow(Date.now());
    }, 30_000);

    return () => clearInterval(interval);
  }, [pendingAutoVerification]);

  useEffect(() => {
    if (!pendingAutoVerification || !isAutoVerificationStale(pendingAutoVerification)) {
      return;
    }

    AsyncStorage.removeItem(AUTO_VERIFY_PENDING_KEY).catch(() => {});
    setPendingAutoVerification(null);
  }, [autoVerificationNow, pendingAutoVerification]);

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

  const { data: plantingAdvisory, refetch: refetchAdvisory } = useGetPlantingAdvisory(
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
      const position = await getDevicePosition();
      applyLocationSelection({
        coords: position.coords,
        label: null,
        userSelected: false,
        source: "device",
        accuracyMeters: position.accuracyMeters,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === t("locationBrowserPick")) {
        setLocError(t("locationUnsupportedShort"));
      } else if (message === t("locationPermissionOrPick")) {
        setLocError(t("locationPermissionDeniedShort"));
      } else {
        setLocError(t("locationCouldNotGetShort"));
      }
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
      const name =
        locationSource === "device"
          ? currentVillageName || t("yourFarmFallback")
          : locationLabel ?? t("yourFarmFallback");
      sendRainAlert(prob, name).catch(() => {});
    }
  }, [currentVillageName, locationLabel, locationSource, rainData, t]);

  useEffect(() => {
    if (!rainData || !coords) {
      return;
    }

    const dueAt = new Date(rainData.targetTime).getTime();
    if (!Number.isFinite(dueAt)) {
      return;
    }

    const nextPending: PendingAutoVerification = {
      lat: coords.latitude,
      lon: coords.longitude,
      locationName:
        locationSource === "device"
          ? currentVillageName || t("yourFarmFallback")
          : locationLabel ?? t("yourFarmFallback"),
      targetTime: rainData.targetTime,
      dueAt,
      predictionValue: rainData.predictionValue,
      probability: rainData.probability,
    };
    const autoVerificationKey = getAutoVerificationKey(nextPending);
    const currentKey = pendingAutoVerification
      ? getAutoVerificationKey(pendingAutoVerification)
      : null;

    if (
      currentKey === autoVerificationKey &&
      pendingAutoVerification &&
      !isAutoVerificationStale(pendingAutoVerification)
    ) {
      return;
    }

    if (lastAutoVerificationKeyRef.current === autoVerificationKey) {
      return;
    }

    lastAutoVerificationKeyRef.current = autoVerificationKey;
    autoVerificationRetryAtRef.current = 0;
    setAutoVerificationMessage(null);
    setPendingAutoVerification(nextPending);
    AsyncStorage.setItem(AUTO_VERIFY_PENDING_KEY, JSON.stringify(nextPending)).catch(() => {});
  }, [coords, currentVillageName, locationLabel, locationSource, pendingAutoVerification, rainData, t]);

  useEffect(() => {
    if (!pendingAutoVerification || autoResolving) {
      return;
    }

    if (autoVerificationNow < pendingAutoVerification.dueAt) {
      return;
    }

    if (autoVerificationNow < autoVerificationRetryAtRef.current) {
      return;
    }

    let cancelled = false;

    const runAutoVerification = async () => {
      setAutoResolving(true);

      try {
        const result = await customFetch<{
          matchedPrediction?: boolean;
          observedAnswer?: "yes" | "no" | "almost";
          resolved?: boolean;
        }>("/api/feedback/auto-resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: pendingAutoVerification.lat,
            lon: pendingAutoVerification.lon,
            locationName: pendingAutoVerification.locationName,
            targetTime: pendingAutoVerification.targetTime,
          }),
          responseType: "json",
          timeoutMs: 15_000,
        });

        if (cancelled) {
          return;
        }

        AsyncStorage.removeItem(AUTO_VERIFY_PENDING_KEY).catch(() => {});
        setPendingAutoVerification(null);
        autoVerificationRetryAtRef.current = 0;

        const observedAnswer = result.observedAnswer;
        const verificationCopy = {
          en:
            observedAnswer === "yes"
              ? "FarmPal checked real weather and confirmed wet conditions for this call."
              : observedAnswer === "almost"
              ? "FarmPal checked real weather and saw mixed rain conditions for this call."
              : "FarmPal checked real weather and confirmed dry conditions for this call.",
          sw:
            observedAnswer === "yes"
              ? "FarmPal imekagua hali halisi ya hewa na kuthibitisha kuwa kulikuwa na unyevu au mvua."
              : observedAnswer === "almost"
              ? "FarmPal imekagua hali halisi ya hewa na kuona ishara za mvua zilizochanganyika."
              : "FarmPal imekagua hali halisi ya hewa na kuthibitisha dirisha la ukavu.",
          ki:
            observedAnswer === "yes"
              ? "FarmPal imekagua hali halisi ya hewa na kuthibitisha kuwa kulikuwa na unyevu au mvua."
              : observedAnswer === "almost"
              ? "FarmPal imekagua hali halisi ya hewa na kuona ishara za mvua zilizochanganyika."
              : "FarmPal imekagua hali halisi ya hewa na kuthibitisha dirisha la ukavu.",
        } as const;

        setAutoVerificationMessage(verificationCopy[language]);
      } catch {
        if (cancelled) {
          return;
        }

        autoVerificationRetryAtRef.current = Date.now() + 5 * 60 * 1000;
        setAutoVerificationMessage(
          ({
            en: "FarmPal could not confirm the outcome right now. It will retry shortly.",
            sw: "FarmPal haikuweza kuthibitisha matokeo sasa. Itajaribu tena baada ya muda mfupi.",
            ki: "FarmPal haikuweza kuthibitisha matokeo sasa. Itajaribu tena baada ya muda mfupi.",
          } as const)[language],
        );
      } finally {
        if (!cancelled) {
          setAutoResolving(false);
        }
      }
    };

    runAutoVerification().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [autoResolving, autoVerificationNow, language, pendingAutoVerification]);

  useEffect(() => {
    if (!autoVerificationMessage) {
      return;
    }

    const timeout = setTimeout(() => {
      setAutoVerificationMessage(null);
    }, 9000);

    return () => clearTimeout(timeout);
  }, [autoVerificationMessage]);

  const isLoading = geoLoading || weatherLoading;
  const isCurrentLocationView = locationSource === "device";
  const heroLocationName = isCurrentLocationView
    ? currentVillageName || t("currentLocationLabel")
    : locationLabel;
  const locationSummary = isCurrentLocationView
    ? currentLocationSummary
    : locationLabel
    ? tf("viewingSavedFarm", { name: locationLabel })
    : t("homeSubtitle");
  const greetingTitle = farmerFirstName
    ? ({
        en: `Welcome ${farmerFirstName}`,
        sw: `Karibu ${farmerFirstName}`,
        ki: `Karibu ${farmerFirstName}`,
      } as const)[language]
    : "FarmPal";
  const dashboardCopy = {
    en: {
      cachedLocations: "Saved farms are showing from local cache while FarmPal reconnects.",
      refreshLocations: "Saved farms could not refresh yet. Pull down to try again.",
      autoCheckTitle: "Automatic forecast check",
      autoCheckWaiting: "FarmPal will compare the real weather around",
      autoCheckWorking: "FarmPal is checking the real weather now.",
    },
    sw: {
      cachedLocations: "Mashamba yaliyohifadhiwa yanaonyeshwa kutoka kumbukumbu ya simu wakati FarmPal inaunganisha tena.",
      refreshLocations: "Mashamba yaliyohifadhiwa hayakuweza kusasishwa sasa. Vuta chini kujaribu tena.",
      autoCheckTitle: "Ukaguzi wa moja kwa moja",
      autoCheckWaiting: "FarmPal italinganisha hali halisi ya hewa karibu saa",
      autoCheckWorking: "FarmPal inakagua hali halisi ya hewa sasa.",
    },
    ki: {
      cachedLocations: "Mashamba yaliyohifadhiwa yanaonyeshwa kutoka kumbukumbu ya simu wakati FarmPal inaunganisha tena.",
      refreshLocations: "Mashamba yaliyohifadhiwa hayakuweza kusasishwa sasa. Vuta chini kujaribu tena.",
      autoCheckTitle: "Ukaguzi wa moja kwa moja",
      autoCheckWaiting: "FarmPal italinganisha hali halisi ya hewa karibu saa",
      autoCheckWorking: "FarmPal inakagua hali halisi ya hewa sasa.",
    },
  } as const;

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
    switcherCard: {
      marginHorizontal: 16,
      marginTop: 8,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 14,
      gap: 10,
    },
    switcherTitle: {
      fontSize: 14,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    switcherSubtitle: {
      fontSize: 12,
      lineHeight: 18,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    switcherChip: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 9,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginRight: 8,
    },
    switcherChipText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
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

  const farmingTip = getCropStageHint(selectedCrops, selectedWorkStage, language);
  const activeLocations = locations.filter((loc) => loc.active);
  const autoVerificationDue = pendingAutoVerification
    ? autoVerificationNow >= pendingAutoVerification.dueAt
    : false;
  const autoVerificationCountdown = pendingAutoVerification
    ? formatCountdown(pendingAutoVerification.dueAt, autoVerificationNow)
    : null;
  const autoVerificationTimeLabel = pendingAutoVerification
    ? new Date(pendingAutoVerification.dueAt).toLocaleTimeString("en-KE", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{greetingTitle}</Text>
          <Text style={styles.subtitle}>{locationSummary}</Text>
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

      <View style={styles.switcherCard}>
        <Text style={styles.switcherTitle}>{t("savedFarmsTitle")}</Text>
        <Text style={styles.switcherSubtitle}>
          {activeLocations.length > 0 ? t("savedFarmsSubtitle") : t("noTrackedFarms")}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Pressable
            style={[
              styles.switcherChip,
              {
                backgroundColor: isCurrentLocationView ? `${colors.primary}18` : colors.background,
                borderColor: isCurrentLocationView ? colors.primary : colors.border,
              },
            ]}
            onPress={handleLocate}
          >
            <Feather
              name="crosshair"
              size={14}
              color={isCurrentLocationView ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                styles.switcherChipText,
                { color: isCurrentLocationView ? colors.primary : colors.foreground },
              ]}
            >
              {t("useCurrentLocationCta")}
            </Text>
          </Pressable>

          {activeLocations.map((loc) => {
            const selected = selectedTrackedLocationId === loc.id;
            return (
              <Pressable
                key={loc.id}
                style={[
                  styles.switcherChip,
                  {
                    backgroundColor: selected ? `${colors.primary}18` : colors.background,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => useTrackedFarm(loc)}
              >
                <Feather
                  name="map-pin"
                  size={14}
                  color={selected ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.switcherChipText,
                    { color: selected ? colors.primary : colors.foreground },
                  ]}
                >
                  {trackedFarmLabel(loc)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {locationsError ? (
          <Text style={styles.switcherSubtitle}>
            {hasFallbackLocations
              ? dashboardCopy[language].cachedLocations
              : dashboardCopy[language].refreshLocations}
          </Text>
        ) : null}
      </View>

      {/* Location auto-updated banner */}
      {locationUpdated && (
        <View style={{ backgroundColor: "#3D8B37", paddingVertical: 6, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="map-pin" size={13} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>
            {t("locationUpdatedBanner")}
          </Text>
        </View>
      )}

      {/* Barometer trend banner - only shown when sensor detects significant pressure change */}
      {baro.available && baro.trend === "falling" && (
        <View style={{ backgroundColor: "#1D4ED822", paddingVertical: 5, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: "#1D4ED833" }}>
          <Feather name="trending-down" size={13} color="#1D4ED8" />
          <Text style={{ color: "#1D4ED8", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>
            {t("pressureFallingBanner")}
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
            {t("pressureRisingBanner")}
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
          applyLocationSelection({
            coords: c,
            label: loc.displayName,
            userSelected: true,
            source: "picker",
          });
          setShowLocationPicker(false);
        }}
      />

      {/* Map Location Picker (tap-to-pin on OpenStreetMap) */}
      <MapLocationPicker
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onConfirm={(loc) => {
          applyLocationSelection({
            coords: { latitude: loc.latitude, longitude: loc.longitude },
            label: loc.name,
            userSelected: true,
            source: "map",
          });
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
            onRefresh={() => {
              refetch();
              refetchAlerts();
              refetchRain();
              refetchAdvisory();
              refetchLocations();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <DashboardCropPicker
          language={language}
          selectedCrops={selectedCrops}
          onChange={setSelectedCrops}
        />

        {plantingAdvisory ? (
          <DecisionAssistantCardAdaptive
            advisory={plantingAdvisory}
            rain={rainData ?? null}
            weather={weatherData ?? null}
            lang={language}
            selectedCrops={selectedCrops}
            workStage={selectedWorkStage}
          />
        ) : null}

        <WeatherSnapshotCard
          data={weatherData}
          isLoading={isLoading}
          error={weatherError as Error | null}
          onRefresh={() => {
            refetch();
            refetchRain();
            refetchAdvisory();
          }}
          locationName={heroLocationName}
          locationAccuracyMeters={isCurrentLocationView ? locationAccuracyMeters : null}
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
              title={t("nearbySignalTitle")}
              subtitle={t("nearbySignalSubtitle")}
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
              title={t("fieldConditionsTitle")}
              subtitle={t("fieldConditionsSubtitle")}
            />
            <View style={styles.extraRow}>
              <View style={styles.extraCard}>
                <Text style={styles.extraLabel}>{t("temperatureLabel")}</Text>
                <Text style={styles.extraValue}>
                  {Math.round(weatherData.weather.temperature)}
                  <Text style={styles.extraUnit}>{"\u00B0"}C</Text>
                </Text>
              </View>
              <View style={styles.extraCard}>
                <Text style={styles.extraLabel}>{t("pressureLabel")}</Text>
                <Text style={styles.extraValue}>
                  {weatherData.weather.pressure}
                  <Text style={styles.extraUnit}> hPa</Text>
                </Text>
              </View>
            </View>
            <View style={styles.extraRow}>
              <View style={styles.extraCard}>
                <Text style={styles.extraLabel}>{t("humidityLabel")}</Text>
                <Text style={styles.extraValue}>
                  {weatherData.weather.humidity}
                  <Text style={styles.extraUnit}>%</Text>
                </Text>
              </View>
              <View style={styles.extraCard}>
                <Text style={styles.extraLabel}>{t("windLabel")}</Text>
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
                  title={t("rainSoonTitle")}
                  subtitle={t("rainSoonSubtitle")}
                  right={
                    <MLStatusBadge
                      modelVersion={rainData.modelVersion}
                      accuracy={rainData.modelVersion?.includes("acc") ? parseFloat(rainData.modelVersion.split("acc")[1] ?? "0") : undefined}
                      isOffline={isOffline}
                    />
                  }
                />
                <RainPredictionCard data={rainData} />
                {pendingAutoVerification ? (
                  <View style={styles.followUpCard}>
                    <View style={styles.followUpRow}>
                      <View style={styles.followUpIcon}>
                        <Feather
                          name={autoResolving ? "refresh-cw" : "cloud-rain"}
                          size={18}
                          color="#3B82F6"
                        />
                      </View>
                      <View style={styles.followUpMeta}>
                        <Text style={styles.followUpTitle}>{dashboardCopy[language].autoCheckTitle}</Text>
                        <Text style={styles.followUpText}>
                          {autoResolving
                            ? dashboardCopy[language].autoCheckWorking
                            : `${dashboardCopy[language].autoCheckWaiting} ${autoVerificationTimeLabel ?? "--:--"} (${pendingAutoVerification.locationName}).`}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.followUpPill}>
                      <Text style={styles.followUpPillText}>
                        {autoVerificationDue
                          ? dashboardCopy[language].autoCheckWorking
                          : autoVerificationCountdown ?? "0 min"}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {autoVerificationMessage ? (
                  <View
                    style={[
                      styles.followUpCard,
                      {
                        backgroundColor: `${colors.primary}10`,
                        borderColor: `${colors.primary}35`,
                      },
                    ]}
                  >
                    <View style={styles.followUpRow}>
                      <View style={[styles.followUpIcon, { backgroundColor: `${colors.primary}16` }]}>
                        <Feather name="check-circle" size={18} color={colors.primary} />
                      </View>
                      <View style={styles.followUpMeta}>
                        <Text style={styles.followUpTitle}>{dashboardCopy[language].autoCheckTitle}</Text>
                        <Text style={styles.followUpText}>{autoVerificationMessage}</Text>
                      </View>
                    </View>
                  </View>
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

            <WorkStageSelector
              language={language}
              selectedStage={selectedWorkStage}
              onSelect={setSelectedWorkStage}
            />

            <Text style={styles.sectionLabel}>{t("actionNowTitle").toUpperCase()}</Text>
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

