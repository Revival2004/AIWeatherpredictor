import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import React, { useState } from "react";
import KenyaLocationPicker, { type PickedLocation } from "@/components/KenyaLocationPicker";
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
import { useColors } from "@/hooks/useColors";

interface Coords {
  latitude: number;
  longitude: number;
}

function getFarmingTip(data: WeatherPredictionResponse | undefined): string | null {
  if (!data) return null;
  const { weather, prediction } = data;
  if (!prediction) return null;
  const pred = prediction.prediction;
  if (pred.includes("Rain") || pred.includes("Storm") || pred.includes("Thunder")) {
    return "Hold off on irrigation — precipitation expected. Harvest or protect sensitive crops before rain arrives.";
  }
  if (pred === "Frost Risk") {
    return "Frost risk tonight. Cover frost-sensitive plants and disconnect irrigation lines.";
  }
  if (weather.humidity < 30) {
    return "Very low humidity. Increase irrigation frequency and watch for drought stress in crops.";
  }
  if (weather.windspeed > 30) {
    return "Strong winds expected. Secure loose structures, polytunnels, and lightweight equipment.";
  }
  if (weather.temperature > 35) {
    return "Extreme heat today. Irrigate in the early morning or evening to reduce heat stress.";
  }
  return "Conditions look favorable for outdoor farm work today.";
}

function RainPredictionCard({ data }: { data: RainPredictionResponse }) {
  const colors = useColors();
  const willRain = data.predictionValue === "yes";
  const pct = Math.round(data.probability * 100);
  const confPct = Math.round(data.confidence * 100);
  const isSklearn = data.modelVersion?.startsWith("sklearn");
  const mp = data.modelProbabilities;

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 4,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: willRain ? "#3B82F620" : "#3D8B3720",
        backgroundColor: willRain ? "#3B82F608" : "#3D8B3708",
      }}
    >
      {/* Header row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 16,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderColor: willRain ? "#3B82F618" : "#3D8B3718",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: willRain ? "#3B82F620" : "#3D8B3720",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather
              name={willRain ? "cloud-rain" : "sun"}
              size={20}
              color={willRain ? "#3B82F6" : "#3D8B37"}
            />
          </View>
          <View>
            <Text style={{ fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground }}>
              {willRain ? "Rain expected in 2h" : "No rain in next 2h"}
            </Text>
            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
              AI ensemble prediction · {confPct}% confidence
            </Text>
          </View>
        </View>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 20,
            backgroundColor: willRain ? "#3B82F620" : "#3D8B3720",
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontFamily: "Inter_700Bold",
              color: willRain ? "#3B82F6" : "#3D8B37",
            }}
          >
            {pct}%
          </Text>
        </View>
      </View>

      {/* Probability bar */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: mp ? 8 : 16 }}>
        <View style={{ height: 6, backgroundColor: colors.muted, borderRadius: 3, overflow: "hidden" }}>
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: willRain ? "#3B82F6" : "#3D8B37",
              width: `${pct}%`,
            }}
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 4,
          }}
        >
          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
            No rain
          </Text>
          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
            Rain
          </Text>
        </View>
      </View>

      {/* Per-model votes (only if sklearn ensemble) */}
      {isSklearn && mp && (
        <View
          style={{
            marginHorizontal: 16,
            marginBottom: 14,
            padding: 10,
            backgroundColor: colors.muted,
            borderRadius: 10,
            flexDirection: "row",
            justifyContent: "space-around",
          }}
        >
          {[
            { label: "LR", value: mp.lr, color: "#4A90D9" },
            { label: "RF", value: mp.rf, color: "#3D8B37" },
            { label: "GB", value: mp.gb, color: "#D4851A" },
          ].map((m) => (
            <View key={m.label} style={{ alignItems: "center", gap: 2 }}>
              <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: m.color }}>
                {Math.round(m.value * 100)}%
              </Text>
              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                {m.label}
              </Text>
            </View>
          ))}
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <View style={{ alignItems: "center", gap: 2 }}>
            <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: "#8B2FC9" }}>
              {pct}%
            </Text>
            <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
              Ensemble
            </Text>
          </View>
        </View>
      )}

      {/* Model badge */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12, alignItems: "flex-end" }}>
        <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
          {isSklearn ? "scikit-learn" : "rule-based"} · {data.modelVersion}
        </Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [fetchEnabled, setFetchEnabled] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);

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
              setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
              setFetchEnabled(true);
              setGeoLoading(false);
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
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setFetchEnabled(true);
        setGeoLoading(false);
      }
    } catch {
      setLocError("Could not get location");
      setGeoLoading(false);
    }
  };

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
      paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 100,
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

  const farmingTip = getFarmingTip(weatherData);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Microclimate</Text>
          <Text style={styles.subtitle}>
            {locationLabel ? locationLabel : "AI Weather Predictor"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Pressable
            style={[styles.locateBtn, { backgroundColor: `${colors.primary}22`, borderRadius: 12, width: 40, height: 40, justifyContent: "center", alignItems: "center" }]}
            onPress={() => setShowLocationPicker(true)}
            testID="search-location-btn"
          >
            <Feather name="search" size={18} color={colors.primary} />
          </Pressable>
          <Pressable
            style={styles.locateBtn}
            onPress={handleLocate}
            testID="locate-btn"
          >
            <Feather
              name={geoLoading ? "loader" : "map-pin"}
              size={20}
              color={colors.primaryForeground}
            />
          </Pressable>
        </View>
      </View>

      {/* Kenya Location Picker */}
      <KenyaLocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={(loc: PickedLocation) => {
          setCoords({ latitude: loc.lat, longitude: loc.lon });
          setFetchEnabled(true);
          setLocError(null);
          setLocationLabel(loc.displayName);
          setShowLocationPicker(false);
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
                <Text style={styles.sectionLabel}>RAIN PREDICTION (2H)</Text>
                <RainPredictionCard data={rainData} />
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
