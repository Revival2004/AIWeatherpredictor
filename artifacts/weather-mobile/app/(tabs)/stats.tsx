import { Feather } from "@expo/vector-icons";
import React from "react";
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

import { useGetWeatherStats } from "@workspace/api-client-react";
import { StatsPanel } from "@/components/StatsPanel";
import { useColors } from "@/hooks/useColors";

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data, isLoading, refetch, isRefetching } = useGetWeatherStats({
    query: { staleTime: 2 * 60 * 1000 },
  });

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
    scrollContent: {
      paddingTop: 16,
      paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 100,
    },
    sectionLabel: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      letterSpacing: 0.8,
      marginHorizontal: 20,
      marginBottom: 12,
    },
    predCard: {
      marginHorizontal: 16,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 4,
    },
    predItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    predItemLast: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 8,
    },
    predLabel: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
      flex: 1,
    },
    predCount: {
      fontSize: 14,
      fontFamily: "Inter_700Bold",
      color: colors.primary,
    },
    lastReadingRow: {
      marginHorizontal: 16,
      marginBottom: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    lastReadingText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
  });

  const predBreakdown = data?.predictionBreakdown ?? {};
  const predEntries = Object.entries(predBreakdown).sort((a, b) => b[1] - a[1]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <Pressable
          style={styles.refreshBtn}
          onPress={() => refetch()}
          testID="stats-refresh-btn"
        >
          <Feather
            name="refresh-cw"
            size={16}
            color={isRefetching ? colors.primary : colors.mutedForeground}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {data?.lastReading && (
          <View style={[styles.lastReadingRow, { marginTop: 12 }]}>
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text style={styles.lastReadingText}>
              Last reading: {new Date(data.lastReading).toLocaleString()}
            </Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>AVERAGES</Text>
        <StatsPanel stats={data} isLoading={isLoading} />

        {predEntries.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>AI PREDICTIONS</Text>
            <View style={styles.predCard}>
              {predEntries.map(([pred, count], idx) => (
                <View
                  key={pred}
                  style={idx === predEntries.length - 1 ? styles.predItemLast : styles.predItem}
                >
                  <Text style={styles.predLabel}>{pred}</Text>
                  <Text style={styles.predCount}>{count}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
