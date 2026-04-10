/**
 * CommunityInsightCard
 *
 * Shows how many farmers are active in the same 10 km zone,
 * what they reported in the last 24 hours, and whether their
 * combined feedback is boosting the prediction model.
 *
 * The card is intentionally subtle - it appears only when
 * there's real community data worth showing.
 */
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { customFetch } from "@/lib/api-client/custom-fetch";
import { useLanguage } from "@/contexts/LanguageContext";

interface CommunityData {
  farmerCount: number;
  feedbackCount: number;
  recentReports: { rain: number; dry: number; cloudy: number; total: number };
  zoneAccuracy: number | null;
  communityBoost: boolean;
  zoneRadiusKm: number;
  regionalRainProbability?: number | null;
  blendWeight?: number;
  signalDirection?: "wetter" | "drier" | "mixed" | null;
  sharedWeatherSamples?: number;
}

interface Props {
  lat: number;
  lon: number;
}

export default function CommunityInsightCard({ lat, lon }: Props) {
  const colors = useColors();
  const { t, tf } = useLanguage();
  const [data, setData] = useState<CommunityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    customFetch<CommunityData>(`/api/weather/community?lat=${lat}&lon=${lon}`, {
      responseType: "json",
    })
      .then((d: CommunityData) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  // Don't show anything while loading or if there are no nearby farmers
  if (loading) return null;
  if (!data || data.farmerCount === 0) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: "#F0FDF4" }]}>
            <Feather name="users" size={16} color="#3D8B37" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>{t("zoneEmptyTitle")}</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {t("zoneEmptySubtitle")}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const { farmerCount, feedbackCount, recentReports, zoneAccuracy, communityBoost, zoneRadiusKm } = data;

  // Determine dominant recent condition
  const dominantCondition =
    recentReports.total === 0
      ? null
      : recentReports.rain >= recentReports.dry
      ? "rain"
      : "dry";

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: "#F0FDF4" }]}>
          <Feather name="users" size={16} color="#3D8B37" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {tf("zoneFarmersTitle", { count: farmerCount })}
          </Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {tf("zoneFarmersSubtitle", {
              radius: zoneRadiusKm,
              reports: feedbackCount,
              samples: data.sharedWeatherSamples ?? 0,
            })}
          </Text>
        </View>

        {/* Community boost badge */}
        {communityBoost && (
          <View style={styles.boostBadge}>
            <Feather name="zap" size={10} color="#3D8B37" />
            <Text style={styles.boostText}>{t("communityBoosted")}</Text>
          </View>
        )}
      </View>

      {/* Recent reports row */}
      {recentReports.total > 0 && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.reportRow}>
            <Text style={[styles.reportLabel, { color: colors.mutedForeground }]}>
              {t("nearbyReportsLabel")}
            </Text>
            <View style={styles.pills}>
              {recentReports.rain > 0 && (
                <View style={[styles.pill, { backgroundColor: "#EFF6FF" }]}>
                  <Feather name="cloud-rain" size={12} color="#2563EB" />
                  <Text style={[styles.pillText, { color: "#2563EB" }]}>
                    {tf("rainReportsLabel", { count: recentReports.rain })}
                  </Text>
                </View>
              )}
              {recentReports.dry > 0 && (
                <View style={[styles.pill, { backgroundColor: "#F0FDF4" }]}>
                  <Feather name="sun" size={12} color="#15803D" />
                  <Text style={[styles.pillText, { color: "#15803D" }]}>
                    {tf("dryReportsLabel", { count: recentReports.dry })}
                  </Text>
                </View>
              )}
              {recentReports.cloudy > 0 && (
                <View style={[styles.pill, { backgroundColor: "#F8F8F8" }]}>
                  <Feather name="cloud" size={12} color="#6B7280" />
                  <Text style={[styles.pillText, { color: "#6B7280" }]}>
                    {tf("cloudyReportsLabel", { count: recentReports.cloudy })}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Consensus message */}
          {dominantCondition && (
            <View style={[styles.consensus, { backgroundColor: dominantCondition === "rain" ? "#EFF6FF" : "#F0FDF4" }]}>
              <Feather
                name={dominantCondition === "rain" ? "cloud-rain" : "sun"}
                size={12}
                color={dominantCondition === "rain" ? "#2563EB" : "#15803D"}
              />
              <Text style={[styles.consensusText, { color: dominantCondition === "rain" ? "#2563EB" : "#15803D" }]}>
                {dominantCondition === "rain"
                  ? t("communityMostlyRain")
                  : t("communityMostlyDry")}
              </Text>
            </View>
          )}
        </>
      )}

      {communityBoost && data.signalDirection ? (
        <View
          style={[
            styles.consensus,
            {
              backgroundColor:
                data.signalDirection === "wetter" ? "#EFF6FF"
                : data.signalDirection === "drier" ? "#F0FDF4"
                : "#F8FAFC",
              marginTop: 10,
            },
          ]}
        >
          <Feather
            name={
              data.signalDirection === "wetter" ? "cloud-rain"
              : data.signalDirection === "drier" ? "sun"
              : "shuffle"
            }
            size={12}
            color={
              data.signalDirection === "wetter" ? "#2563EB"
              : data.signalDirection === "drier" ? "#15803D"
              : "#475569"
            }
          />
          <Text
            style={[
              styles.consensusText,
              {
                color:
                  data.signalDirection === "wetter" ? "#2563EB"
                  : data.signalDirection === "drier" ? "#15803D"
                  : "#475569",
              },
            ]}
          >
            {data.signalDirection === "wetter"
              ? t("communityNudgeWetter")
              : data.signalDirection === "drier"
              ? t("communityNudgeDrier")
              : t("communityNudgeMixed")}
          </Text>
        </View>
      ) : null}

      {/* Zone accuracy */}
      {zoneAccuracy !== null && (
        <View style={styles.accuracyRow}>
          <Feather name="target" size={11} color={colors.mutedForeground} />
          <Text style={[styles.accuracyText, { color: colors.mutedForeground }]}>
            {tf("zoneAccuracyLabel", { accuracy: zoneAccuracy })}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  sub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
  boostBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#DCFCE7",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexShrink: 0,
  },
  boostText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#3D8B37",
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  reportRow: {
    gap: 8,
  },
  reportLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },
  pills: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillEmoji: {
    fontSize: 12,
  },
  pillText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  consensus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 8,
  },
  consensusText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  accuracyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
  },
  accuracyText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});

