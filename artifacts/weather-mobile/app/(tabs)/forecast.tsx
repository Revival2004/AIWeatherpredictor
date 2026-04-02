import { Feather } from "@expo/vector-icons";
import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useGetWeatherForecast,
  useGetWeatherAlerts,
  useGetLocations,
  getGetWeatherForecastQueryKey,
  getGetWeatherAlertsQueryKey,
  getGetLocationsQueryKey,
  type DailyForecast,
} from "@/lib/api-client";
import { useColorScheme } from "react-native";
import { useColors as useColorTokens } from "@/hooks/useColors";
import colorTokens from "@/constants/colors";
import ForecastDayCard from "@/components/ForecastDayCard";
import AlertsBanner from "@/components/AlertsBanner";
import GDDWidget from "@/components/GDDWidget";
import CropSelector from "@/components/CropSelector";
import StormTimelineWidget from "@/components/StormTimelineWidget";

const CROP_KEY = "selectedCrop";
const LAST_LOC_KEY = "microclimate_last_location_v1"; // same key as dashboard

export default function ForecastScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = useColorTokens();
  const insets = useSafeAreaInsets();

  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState("General");

  // Load stored crop + location
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(CROP_KEY);
        if (stored) setSelectedCrop(stored);
      } catch {}
    })();
    requestLocation();
  }, []);

  const KENYA_DEFAULT = { lat: -0.3031, lon: 36.08 };

  const requestLocation = useCallback(async () => {
    // Use whatever the dashboard saved — exact same location the user set
    try {
      const raw = await AsyncStorage.getItem(LAST_LOC_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // Format: { coords: { latitude, longitude }, label }
        if (saved?.coords?.latitude != null) {
          setCoords({ lat: saved.coords.latitude, lon: saved.coords.longitude });
          return;
        }
      }
    } catch {}
    setCoords(KENYA_DEFAULT);
  }, []);

  const forecastParams = coords ? { lat: coords.lat, lon: coords.lon } : undefined;

  const { data: forecast, isLoading: forecastLoading, refetch: refetchForecast, error: forecastError } =
    useGetWeatherForecast(
      forecastParams ?? ({ lat: 0, lon: 0 } as { lat: number; lon: number }),
      { query: { queryKey: getGetWeatherForecastQueryKey(forecastParams), enabled: !!coords } }
    );

  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } =
    useGetWeatherAlerts(
      forecastParams ?? ({ lat: 0, lon: 0 } as { lat: number; lon: number }),
      { query: { queryKey: getGetWeatherAlertsQueryKey(forecastParams), enabled: !!coords } }
    );

  const { data: locationsData } = useGetLocations({
    query: { queryKey: getGetLocationsQueryKey(), staleTime: 5 * 60 * 1000 },
  });

  // Find the tracked location nearest to current coords that has a crop set
  const growingSeasonInfo = React.useMemo(() => {
    if (!locationsData || !coords) return null;
    const locs = (locationsData.locations as any[]).filter((l) => l.cropType && l.plantingDate);
    if (locs.length === 0) return null;
    const nearest = locs.reduce((best: any, l: any) => {
      const d = Math.abs(l.latitude - coords.lat) + Math.abs(l.longitude - coords.lon);
      const bd = Math.abs(best.latitude - coords.lat) + Math.abs(best.longitude - coords.lon);
      return d < bd ? l : best;
    });
    const planted = new Date(nearest.plantingDate);
    const dayN = Math.floor((Date.now() - planted.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (dayN < 1) return null;
    return { cropType: nearest.cropType as string, dayN, locationName: nearest.name as string };
  }, [locationsData, coords]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchForecast(), refetchAlerts()]);
    setRefreshing(false);
  }, [refetchForecast, refetchAlerts]);

  const handleCropChange = useCallback(async (crop: string) => {
    setSelectedCrop(crop);
    await AsyncStorage.setItem(CROP_KEY, crop).catch(() => {});
  }, []);

  const isLoading = (forecastLoading || alertsLoading) && !refreshing;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>7-Day Farm Forecast</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          {coords ? `${coords.lat.toFixed(2)}°N, ${Math.abs(coords.lon).toFixed(2)}°${coords.lon >= 0 ? "E" : "W"}` : "Locating…"}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colorTokens.light.primary} />}
        contentContainerStyle={{ paddingBottom: Platform.OS === "android" ? insets.bottom + 20 : insets.bottom + 100 }}
      >
        {/* Crop selector */}
        <CropSelector selectedCrop={selectedCrop} onSelect={handleCropChange} />

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colorTokens.light.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading forecast…</Text>
          </View>
        ) : forecastError ? (
          <View style={styles.errorBox}>
            <Feather name="alert-triangle" size={36} color="#F59E0B" />
            <Text style={[styles.errorText, { color: colors.text }]}>Could not load forecast.</Text>
            <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>Pull down to retry.</Text>
          </View>
        ) : (
          <>
            {/* Alerts */}
            {alertsData && alertsData.alerts.length > 0 && (
              <AlertsBanner alerts={alertsData.alerts} />
            )}

            {/* Growing season context banner */}
            {growingSeasonInfo && (
              <View style={{
                marginHorizontal: 16,
                marginTop: 8,
                padding: 12,
                borderRadius: 14,
                backgroundColor: "#E8F5E9",
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}>
                <Text style={{ fontSize: 20 }}>🌱</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#1B5E20" }}>
                    {growingSeasonInfo.cropType} — Day {growingSeasonInfo.dayN} of growing season
                  </Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#388E3C", marginTop: 1 }}>
                    {growingSeasonInfo.locationName}
                  </Text>
                </View>
              </View>
            )}

            {/* Storm Arrival Timeline */}
            {coords && (
              <StormTimelineWidget lat={coords.lat} lon={coords.lon} />
            )}

            {/* GDD Widget */}
            {forecast && (
              <GDDWidget
                cumulativeGDD={forecast.cumulativeGDD}
                irrigationDeficit={forecast.irrigationDeficit}
                cropName={selectedCrop}
              />
            )}

            {/* 7-day cards */}
            <View style={styles.cardsSection}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>DAILY FORECAST</Text>
              {forecast?.days.map((day: DailyForecast, idx: number) => (
                <ForecastDayCard key={day.date} day={day} isToday={idx === 0} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  cardsSection: {
    paddingHorizontal: 16,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  loadingBox: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorBox: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 8,
  },
  errorIcon: {
    fontSize: 36,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "700",
  },
  errorSub: {
    fontSize: 13,
  },
});
