import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { WeatherStats } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

interface StatsPanelProps {
  stats: WeatherStats | undefined;
  isLoading: boolean;
}

interface StatTileProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  iconColor: string;
  bgColor: string;
}

function StatTile({ icon, label, value, iconColor, bgColor }: StatTileProps) {
  const colors = useColors();

  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: bgColor }]}>
        <Feather name={icon} size={20} color={iconColor} />
      </View>
      <Text
        style={[styles.tileValue, { color: colors.foreground }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={[styles.tileLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: "44%",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    gap: 8,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  tileValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  tileLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});

interface ConditionBarProps {
  label: string;
  count: number;
  maxCount: number;
}

function ConditionBar({ label, count, maxCount }: ConditionBarProps) {
  const colors = useColors();
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;

  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground }}>
          {label}
        </Text>
        <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.primary }}>
          {count}
        </Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.muted,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.primary,
            width: `${pct}%`,
          }}
        />
      </View>
    </View>
  );
}

export function StatsPanel({ stats, isLoading }: StatsPanelProps) {
  const colors = useColors();

  if (isLoading || !stats) {
    return (
      <View style={{ alignItems: "center", padding: 40 }}>
        <Feather name="bar-chart-2" size={40} color={colors.muted} />
        <Text
          style={{
            color: colors.mutedForeground,
            marginTop: 12,
            fontFamily: "Inter_400Regular",
            fontSize: 14,
          }}
        >
          {isLoading ? "Loading statistics…" : "No data yet — fetch weather to get started"}
        </Text>
      </View>
    );
  }

  const breakdown = stats.predictionBreakdown ?? {};
  const condEntries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const maxCount = condEntries[0]?.[1] ?? 1;

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
          marginHorizontal: 16,
          marginBottom: 20,
        }}
      >
        <StatTile
          icon="thermometer"
          label="Avg Temperature"
          value={stats.avgTemperature != null ? `${Math.round(stats.avgTemperature)}°C` : "—"}
          iconColor="#E65100"
          bgColor="#FFF3E0"
        />
        <StatTile
          icon="droplet"
          label="Avg Humidity"
          value={stats.avgHumidity != null ? `${Math.round(stats.avgHumidity)}%` : "—"}
          iconColor="#1565C0"
          bgColor="#E3F2FD"
        />
        <StatTile
          icon="wind"
          label="Avg Wind"
          value={stats.avgWindspeed != null ? `${Math.round(stats.avgWindspeed)} km/h` : "—"}
          iconColor={colors.primary}
          bgColor={`${colors.primary}18`}
        />
        <StatTile
          icon="database"
          label="Total Readings"
          value={`${stats.totalReadings ?? 0}`}
          iconColor={colors.secondary}
          bgColor={`${colors.secondary}18`}
        />
      </View>

      {condEntries.length > 0 && (
        <View
          style={{
            marginHorizontal: 16,
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontFamily: "Inter_600SemiBold",
              color: colors.mutedForeground,
              letterSpacing: 0.8,
              marginBottom: 14,
            }}
          >
            PREDICTION BREAKDOWN
          </Text>
          {condEntries.map(([pred, count]) => (
            <ConditionBar key={pred} label={pred} count={count} maxCount={maxCount} />
          ))}
        </View>
      )}
    </View>
  );
}
