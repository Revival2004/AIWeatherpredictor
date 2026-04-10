import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGetWeatherHistory, getGetWeatherHistoryQueryKey } from "@/lib/api-client";
import { HistoryCard } from "@/components/HistoryCard";
import { useColors } from "@/hooks/useColors";
import { useLanguage } from "@/contexts/LanguageContext";

const LIMITS = [10, 25, 50];
const LAST_LOC_KEY = "microclimate_last_location_v1";

function parseStoredCoords(raw: string | null): { lat: number; lon: number } | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      coords?: { latitude?: number; longitude?: number };
    };

    const latitude = parsed.coords?.latitude;
    const longitude = parsed.coords?.longitude;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return null;
    }

    return { lat: latitude, lon: longitude };
  } catch {
    return null;
  }
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const [limit, setLimit] = useState(25);
  const [farmCoords, setFarmCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(LAST_LOC_KEY)
      .then((raw) => {
        if (active) {
          setFarmCoords(parseStoredCoords(raw));
        }
      })
      .catch(() => {
        if (active) {
          setFarmCoords(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const historyParams = farmCoords
    ? { limit, lat: farmCoords.lat, lon: farmCoords.lon }
    : { limit };

  const { data, isLoading, error, refetch, isRefetching } =
    useGetWeatherHistory(
      historyParams,
      { query: { queryKey: getGetWeatherHistoryQueryKey(historyParams), staleTime: 60 * 1000 } }
    );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: Platform.OS === "web" ? 67 : insets.top + 16,
      paddingBottom: 12,
      paddingHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    title: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    refreshBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    filterRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 10,
      gap: 8,
    },
    filterLabel: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      marginRight: 4,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
    },
    chipText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
    },
    listContent: {
      paddingTop: 8,
      paddingBottom: Platform.OS === "android" ? insets.bottom + 20 : insets.bottom + 100,
    },
    emptyBox: {
      alignItems: "center",
      paddingTop: 60,
      paddingHorizontal: 40,
    },
    emptyText: {
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      textAlign: "center",
      marginTop: 12,
    },
    errorBox: {
      alignItems: "center",
      paddingTop: 60,
      paddingHorizontal: 40,
    },
    errorText: {
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      textAlign: "center",
      marginTop: 12,
    },
    retryBtn: {
      marginTop: 16,
      backgroundColor: colors.primary,
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 8,
    },
    retryText: {
      color: colors.primaryForeground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
    },
  });

  if (isLoading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("historyTitle")}</Text>
        </View>
        <View style={styles.errorBox}>
          <Feather name="alert-circle" size={40} color={colors.muted} />
          <Text style={styles.errorText}>{t("historyLoadFailed")}</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>{t("historyRetry")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t("historyTitle")}</Text>
          <Text style={[styles.filterLabel, { marginTop: 4, marginRight: 0 }]}>
            {farmCoords ? t("historySelectedFarm") : t("historySavedArea")}
          </Text>
        </View>
        <Pressable
          style={styles.refreshBtn}
          onPress={() => refetch()}
          testID="history-refresh-btn"
        >
          <Feather
            name="refresh-cw"
            size={16}
            color={isRefetching ? colors.primary : colors.mutedForeground}
          />
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>{t("historyShowLabel")}</Text>
        {LIMITS.map((l) => (
          <Pressable
            key={l}
            style={[
              styles.chip,
              {
                backgroundColor: limit === l ? colors.primary : colors.card,
                borderColor: limit === l ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setLimit(l)}
          >
            <Text
              style={[
                styles.chipText,
                { color: limit === l ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              {l}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <HistoryCard record={item} />}
        contentContainerStyle={styles.listContent}
        scrollEnabled={!!(data && data.length > 0)}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Feather name="clock" size={40} color={colors.muted} />
            <Text style={styles.emptyText}>
              {t("historyEmpty")}
            </Text>
          </View>
        }
      />
    </View>
  );
}
