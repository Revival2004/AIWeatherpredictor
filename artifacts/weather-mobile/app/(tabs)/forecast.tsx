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
import * as Location from "expo-location";
import { useGetWeatherForecast, useGetWeatherAlerts } from "@workspace/api-client-react";
import { useColorScheme } from "react-native";
import { useColors as useColorTokens } from "@/hooks/useColors";
import colorTokens from "@/constants/colors";
import ForecastDayCard from "@/components/ForecastDayCard";
import AlertsBanner from "@/components/AlertsBanner";
import GDDWidget from "@/components/GDDWidget";
import CropSelector from "@/components/CropSelector";

const CROP_KEY = "selectedCrop";
const LOC_KEY = "cachedLocation";

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

  const requestLocation = useCallback(async () => {
    try {
      if (Platform.OS === "web") {
        navigator.geolocation?.getCurrentPosition(
          (pos) => {
            const c = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            setCoords(c);
            AsyncStorage.setItem(LOC_KEY, JSON.stringify(c)).catch(() => {});
          },
          async () => {
            const cached = await AsyncStorage.getItem(LOC_KEY);
            if (cached) setCoords(JSON.parse(cached));
            else setCoords({ lat: 51.5, lon: -0.1 });
          }
        );
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          const cached = await AsyncStorage.getItem(LOC_KEY);
          if (cached) setCoords(JSON.parse(cached));
          else setCoords({ lat: 51.5, lon: -0.1 });
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const c = { lat: loc.coords.latitude, lon: loc.coords.longitude };
        setCoords(c);
        AsyncStorage.setItem(LOC_KEY, JSON.stringify(c)).catch(() => {});
      }
    } catch {
      const cached = await AsyncStorage.getItem(LOC_KEY);
      if (cached) setCoords(JSON.parse(cached));
      else setCoords({ lat: 51.5, lon: -0.1 });
    }
  }, []);

  const { data: forecast, isLoading: forecastLoading, refetch: refetchForecast, error: forecastError } =
    useGetWeatherForecast(
      coords ? { lat: coords.lat, lon: coords.lon } : ({} as any),
      { query: { enabled: !!coords } }
    );

  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } =
    useGetWeatherAlerts(
      coords ? { lat: coords.lat, lon: coords.lon } : ({} as any),
      { query: { enabled: !!coords } }
    );

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
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
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
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={[styles.errorText, { color: colors.text }]}>Could not load forecast.</Text>
            <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>Pull down to retry.</Text>
          </View>
        ) : (
          <>
            {/* Alerts */}
            {alertsData && alertsData.alerts.length > 0 && (
              <AlertsBanner alerts={alertsData.alerts} />
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
              {forecast?.days.map((day, idx) => (
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
