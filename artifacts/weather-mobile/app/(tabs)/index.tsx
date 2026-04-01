import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
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
  type WeatherPredictionResponse,
} from "@workspace/api-client-react";
import { WeatherHeroCard } from "@/components/WeatherHeroCard";
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

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [coords, setCoords] = useState<Coords | null>(null);
  const [fetchEnabled, setFetchEnabled] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

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

  const handleLocate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setGeoLoading(true);

    const onSuccess = (pos: { coords: { latitude: number; longitude: number } }) => {
      setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      setFetchEnabled(true);
      setGeoLoading(false);
    };

    const onError = () => {
      setGeoLoading(false);
    };

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, { timeout: 10000 });
    } else {
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
  });

  const farmingTip = getFarmingTip(weatherData);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Microclimate</Text>
          <Text style={styles.subtitle}>AI Weather Predictor</Text>
        </View>
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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={!!weatherLoading && fetchEnabled}
            onRefresh={() => refetch()}
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
