import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLanguage } from "@/contexts/LanguageContext";
import KenyaLocationPicker, { type PickedLocation } from "@/components/KenyaLocationPicker";
import MapLocationPicker from "@/components/MapLocationPicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useGetWeatherStats,
  useGetMetrics,
  useGetLocations,
  useAddLocation,
  useDeleteLocation,
  useActivateLocation,
  useDeactivateLocation,
  useTriggerCollection,
  useTrainModel,
  getGetLocationsQueryKey,
  getGetMetricsQueryKey,
  getGetWeatherStatsQueryKey,
  type CollectionResponse,
  type TrainResponse,
} from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { StatsPanel } from "@/components/StatsPanel";
import { useColors } from "@/hooks/useColors";

function getApiBase() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : "http://localhost:8080";
}

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { t } = useLanguage();
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [newName, setNewName] = useState("");
  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(null);

  // Crop calendar editing state
  const [editingCropId, setEditingCropId] = useState<number | null>(null);
  const [cropTypeInput, setCropTypeInput] = useState("");
  const [plantingDateInput, setPlantingDateInput] = useState("");
  const [savingCrop, setSavingCrop] = useState(false);

  const { data: statsData, isLoading: statsLoading, refetch: refetchStats, isRefetching: statsRefetching } =
    useGetWeatherStats({ query: { queryKey: getGetWeatherStatsQueryKey(), staleTime: 2 * 60 * 1000 } });

  const { data: metricsData, isLoading: metricsLoading, refetch: refetchMetrics } =
    useGetMetrics({ query: { queryKey: getGetMetricsQueryKey(), staleTime: 60 * 1000 } });

  const { data: locationsData, isLoading: locationsLoading, refetch: refetchLocations } =
    useGetLocations({ query: { queryKey: getGetLocationsQueryKey(), staleTime: 30 * 1000 } });

  const addLocationMutation = useAddLocation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() });
        setShowAddLocation(false);
        setNewName("");
        setPickedLocation(null);
      },
    },
  });

  const deleteLocationMutation = useDeleteLocation({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() }),
    },
  });

  const activateMutation = useActivateLocation({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() }),
    },
  });

  const deactivateMutation = useDeactivateLocation({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() }),
    },
  });

  const collectMutation = useTriggerCollection({
    mutation: {
      onSuccess: (data: CollectionResponse) => {
        queryClient.invalidateQueries({ queryKey: getGetMetricsQueryKey() });
        Alert.alert("Collection complete", `Collected ${data.collected} of ${data.total} locations.`);
      },
      onError: () => Alert.alert("Error", "Collection failed. Check your locations."),
    },
  });

  const trainMutation = useTrainModel({
    mutation: {
      onSuccess: (data: TrainResponse) => {
        queryClient.invalidateQueries({ queryKey: getGetMetricsQueryKey() });
        Alert.alert("Training complete", data.message ?? `Trained on ${data.trainingSamples} samples.`);
      },
      onError: () => Alert.alert("Error", "Training failed. Need more weather data first."),
    },
  });

  const bootstrapMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${getApiBase()}/api/bootstrap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthsBack: 120 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Bootstrap failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: getGetMetricsQueryKey() });
      Alert.alert(
        "Historical data loaded",
        data.message ?? `Model trained on ${data.trainingSamples?.toLocaleString()} samples.`
      );
    },
    onError: (err: Error) =>
      Alert.alert("Bootstrap failed", err.message ?? "Could not fetch historical data."),
  });

  function handleAddLocation() {
    if (!pickedLocation) {
      Alert.alert("No location selected", "Please pick a location from the Kenya location browser.");
      return;
    }
    const lat = pickedLocation.lat;
    const lon = pickedLocation.lon;
    const name = newName.trim() || pickedLocation.name;
    if (!name) {
      Alert.alert("No name", "Please enter a name for this location.");
      return;
    }
    addLocationMutation.mutate({ data: { name, latitude: lat, longitude: lon } });
  }

  function confirmDelete(id: number, name: string) {
    Alert.alert("Remove Location", `Remove "${name}" from tracked locations?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => deleteLocationMutation.mutate({ id }),
      },
    ]);
  }

  async function saveCrop(id: number) {
    setSavingCrop(true);
    try {
      await fetch(`${getApiBase()}/api/locations/${id}/crop`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cropType: cropTypeInput || undefined,
          plantingDate: plantingDateInput || undefined,
        }),
      });
      queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() });
      setEditingCropId(null);
    } catch {
      Alert.alert("Error", "Could not save crop info.");
    } finally {
      setSavingCrop(false);
    }
  }

  function startEditCrop(loc: { id: number; cropType: string | null; plantingDate: string | null }) {
    setEditingCropId(loc.id);
    setCropTypeInput(loc.cropType ?? "");
    setPlantingDateInput(loc.plantingDate ?? "");
  }

  function daysInSeason(plantingDate: string | null): number | null {
    if (!plantingDate) return null;
    const planted = new Date(plantingDate);
    const now = new Date();
    const diff = Math.floor((now.getTime() - planted.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff + 1 : null;
  }

  function refetchAll() {
    refetchStats();
    refetchMetrics();
    refetchLocations();
  }

  const isRefetching = statsRefetching || metricsLoading;

  const predBreakdown: Record<string, number> = statsData?.predictionBreakdown ?? {};
  const predEntries = Object.entries(predBreakdown).sort((a, b) => b[1] - a[1]);
  const accuracy = metricsData?.predictions?.accuracy;
  const model = metricsData?.model;
  const locations = locationsData?.locations ?? [];

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
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
    title: { fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground },
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
      paddingBottom: Platform.OS === "android" ? insets.bottom + 20 : insets.bottom + 100,
    },
    sectionLabel: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      letterSpacing: 1,
      marginHorizontal: 20,
      marginBottom: 10,
    },
    card: {
      marginHorizontal: 16,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    rowLast: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 8,
    },
    label: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground, flex: 1 },
    value: { fontSize: 14, fontFamily: "Inter_700Bold", color: colors.primary },
    mutedValue: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    lastReadingRow: {
      marginHorizontal: 16,
      marginBottom: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    lastReadingText: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },

    // Accuracy ring
    accuracyRow: { flexDirection: "row", alignItems: "center", gap: 16, paddingBottom: 8, borderBottomWidth: 1, borderColor: colors.border },
    ringContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 5,
      alignItems: "center",
      justifyContent: "center",
    },
    ringPct: { fontSize: 15, fontFamily: "Inter_700Bold" },
    accuracyMeta: { flex: 1, gap: 4 },
    accuracyTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    accuracySub: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },

    // Buttons
    actionRow: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginBottom: 4 },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    actionBtnSecondary: { backgroundColor: colors.muted },
    actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
    actionBtnTextSecondary: { color: colors.foreground },

    // Locations
    locationItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    locationItemLast: { flexDirection: "row", alignItems: "center", paddingTop: 10 },
    locationName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground, flex: 1 },
    locationCoords: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1 },
    locationBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      marginRight: 8,
    },
    locationBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
    locationActions: { flexDirection: "row", gap: 8, alignItems: "center" },

    // Add location form
    addForm: {
      marginHorizontal: 16,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    addFormTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 4 },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    inputRow: { flexDirection: "row", gap: 8 },
    inputHalf: { flex: 1 },
    addFormBtns: { flexDirection: "row", gap: 10 },
    addBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.muted,
      alignItems: "center",
    },
    addBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
    cancelBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    emptyText: {
      textAlign: "center",
      color: colors.mutedForeground,
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      paddingVertical: 12,
    },
  });

  const accuracyColor =
    accuracy == null ? colors.mutedForeground
    : accuracy >= 70 ? "#3D8B37"
    : accuracy >= 50 ? "#D4851A"
    : "#D94F4F";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <Pressable style={styles.refreshBtn} onPress={refetchAll} testID="stats-refresh-btn">
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
            onRefresh={refetchAll}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {statsData?.lastReading && (
          <View style={[styles.lastReadingRow, { marginTop: 12 }]}>
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text style={styles.lastReadingText}>
              Last reading: {new Date(statsData.lastReading).toLocaleString()}
            </Text>
          </View>
        )}

        {/* Averages */}
        <Text style={styles.sectionLabel}>AVERAGES</Text>
        <StatsPanel stats={statsData} isLoading={statsLoading} />

        {/* AI Prediction breakdown */}
        {predEntries.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>AI PREDICTIONS</Text>
            <View style={styles.card}>
              {predEntries.map(([pred, count], idx) => (
                <View
                  key={pred}
                  style={idx === predEntries.length - 1 ? styles.rowLast : styles.row}
                >
                  <Text style={styles.label}>{pred}</Text>
                  <Text style={styles.value}>{count}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ML Accuracy */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>ML ACCURACY</Text>
        <View style={styles.card}>
          <View style={styles.accuracyRow}>
            <View style={[styles.ringContainer, { borderColor: accuracyColor }]}>
              <Text style={[styles.ringPct, { color: accuracyColor }]}>
                {accuracy != null ? `${accuracy}%` : "–"}
              </Text>
            </View>
            <View style={styles.accuracyMeta}>
              <Text style={styles.accuracyTitle}>
                {accuracy != null ? "Prediction Accuracy" : "No feedback yet"}
              </Text>
              <Text style={styles.accuracySub}>
                {metricsData?.predictions?.resolved ?? 0} resolved · {metricsData?.predictions?.total ?? 0} total
              </Text>
              {metricsData?.observations != null && (
                <Text style={styles.accuracySub}>
                  {metricsData.observations} observations in DB
                </Text>
              )}
            </View>
          </View>

          {model ? (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Training samples</Text>
                <Text style={styles.value}>{model.trainingSamples}</Text>
              </View>
              {/* Per-model accuracy bars */}
              <View style={{ paddingTop: 12 }}>
                <Text style={[styles.mutedValue, { marginBottom: 10, fontSize: 11, letterSpacing: 0.8 }]}>
                  MODEL COMPARISON
                </Text>
                {[
                  { name: "Logistic Regression", key: "lr", pct: model.lrAccuracy, color: "#4A90D9" },
                  { name: "Random Forest", key: "rf", pct: model.rfAccuracy, color: "#3D8B37" },
                  { name: "Gradient Boosting", key: "gb", pct: model.gbAccuracy, color: "#D4851A" },
                  { name: "🏆 Ensemble Vote", key: "ens", pct: model.accuracy, color: "#8B2FC9" },
                ].map((m, idx, arr) => (
                  <View key={m.key} style={{ marginBottom: idx === arr.length - 1 ? 0 : 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.foreground }}>
                        {m.name}
                      </Text>
                      <Text style={{ fontSize: 12, fontFamily: "Inter_700Bold", color: m.color }}>
                        {m.pct != null ? `${m.pct}%` : "–"}
                      </Text>
                    </View>
                    <View style={{ height: 6, backgroundColor: colors.muted, borderRadius: 3, overflow: "hidden" }}>
                      <View
                        style={{
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: m.color,
                          width: `${Math.min(100, m.pct ?? 0)}%`,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={{ paddingTop: 12 }}>
              <Text style={styles.emptyText}>No ensemble trained yet. Tap "Train Model" below.</Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={[styles.actionRow, { marginTop: 20 }]}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => collectMutation.mutate()}
            disabled={collectMutation.isPending || locations.length === 0}
            activeOpacity={0.8}
          >
            {collectMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="cloud-rain" size={14} color="#fff" />
            )}
            <Text style={styles.actionBtnText}>Collect Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#3D8B37" }]}
            onPress={() => trainMutation.mutate()}
            disabled={trainMutation.isPending || (metricsData?.observations ?? 0) < 5}
            activeOpacity={0.8}
          >
            {trainMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="cpu" size={14} color="#fff" />
            )}
            <Text style={styles.actionBtnText}>Train Model</Text>
          </TouchableOpacity>
        </View>

        {/* Bootstrap from Kenya historical data */}
        <View style={{
          marginHorizontal: 20,
          marginTop: 10,
          padding: 14,
          backgroundColor: `${colors.primary}10`,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: `${colors.primary}30`,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Feather name="database" size={14} color={colors.primary} />
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.primary }}>
              Seed with Kenya Historical Data
            </Text>
          </View>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, marginBottom: 10, lineHeight: 17 }}>
            Downloads 10 years of real weather records for 8 major Kenyan farming regions from the Open-Meteo archive (~600,000 hourly readings) and trains the model — capturing seasonal cycles, long rains/short rains patterns, and year-to-year climate drift.
          </Text>
          <TouchableOpacity
            style={[styles.actionBtn, {
              backgroundColor: bootstrapMutation.isPending ? colors.muted : colors.primary,
              alignSelf: "flex-start",
              paddingHorizontal: 16,
            }]}
            onPress={() => {
              Alert.alert(
                "Seed with Historical Data?",
                "This will fetch ~600,000 hourly readings from Open-Meteo for Nakuru, Eldoret, Kisumu, Meru, Kericho, Kitale, Nairobi and Embu (last 10 years) and train the model. Takes about 8–12 minutes — please keep the app open.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Proceed", onPress: () => bootstrapMutation.mutate() },
                ]
              );
            }}
            disabled={bootstrapMutation.isPending}
            activeOpacity={0.8}
          >
            {bootstrapMutation.isPending ? (
              <>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>Fetching Kenya data…</Text>
              </>
            ) : (
              <>
                <Feather name="download" size={14} color="#fff" />
                <Text style={styles.actionBtnText}>
                  {bootstrapMutation.isSuccess ? "Re-seed Historical Data" : "Seed Historical Data"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Tracked Locations */}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 24, marginBottom: 10 }}>
          <Text style={[styles.sectionLabel, { marginBottom: 0, flex: 1 }]}>TRACKED LOCATIONS</Text>
          <TouchableOpacity
            onPress={() => setShowAddLocation(!showAddLocation)}
            style={{ marginRight: 20, flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Feather name={showAddLocation ? "x" : "plus"} size={14} color={colors.primary} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.primary }}>
              {showAddLocation ? "Cancel" : "Add"}
            </Text>
          </TouchableOpacity>
        </View>

        {showAddLocation && (
          <View style={[styles.addForm, { marginBottom: 12 }]}>
            <Text style={styles.addFormTitle}>Add tracked location</Text>

            {/* Location selection — two methods */}
            {pickedLocation ? (
              <TouchableOpacity
                style={[styles.input, {
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 12,
                }]}
                onPress={() => setShowLocationPicker(true)}
              >
                <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 14, color: colors.foreground }}>
                  {pickedLocation.displayName}
                </Text>
                <Feather name="edit-2" size={14} color={colors.primary} />
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  style={[styles.input, { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }]}
                  onPress={() => setShowLocationPicker(true)}
                >
                  <Feather name="list" size={14} color={colors.primary} />
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: colors.primary }}>
                    Browse by County
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.input, { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }]}
                  onPress={() => setShowMapPicker(true)}
                >
                  <Feather name="map" size={14} color={colors.primary} />
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: colors.primary }}>
                    Pin on Map
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Optional custom name */}
            <TextInput
              style={styles.input}
              placeholder={pickedLocation ? `Custom name (default: ${pickedLocation.town})` : "Custom name (optional)"}
              placeholderTextColor={colors.mutedForeground}
              value={newName}
              onChangeText={setNewName}
            />

            {/* Show coordinates once picked */}
            {pickedLocation && (
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginBottom: 8,
                paddingHorizontal: 4,
              }}>
                <Feather name="crosshair" size={12} color={colors.mutedForeground} />
                <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                  {pickedLocation.lat.toFixed(4)}, {pickedLocation.lon.toFixed(4)}
                </Text>
                <TouchableOpacity onPress={() => setPickedLocation(null)} style={{ marginLeft: "auto" }}>
                  <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.destructive ?? "#e53e3e" }}>
                    Clear
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.addFormBtns}>
              <TouchableOpacity
                style={[styles.addBtn, !pickedLocation && { opacity: 0.5 }]}
                onPress={handleAddLocation}
                disabled={addLocationMutation.isPending || !pickedLocation}
              >
                {addLocationMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.addBtnText}>Add Location</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => {
                setShowAddLocation(false);
                setPickedLocation(null);
                setNewName("");
              }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Kenya Location Picker Modal (browse by county) */}
        <KenyaLocationPicker
          visible={showLocationPicker}
          onClose={() => setShowLocationPicker(false)}
          onSelect={(loc) => {
            setPickedLocation(loc);
            setShowLocationPicker(false);
          }}
        />

        {/* Map Location Picker Modal (tap-to-pin) */}
        <MapLocationPicker
          visible={showMapPicker}
          onClose={() => setShowMapPicker(false)}
          onConfirm={(loc) => {
            const placeName = loc.name.split(",")[0].trim();
            setPickedLocation({
              lat: loc.latitude,
              lon: loc.longitude,
              name: loc.name,
              displayName: loc.name,
              town: placeName,
              county: "",
              subCounty: "",
            });
          }}
        />

        <View style={styles.card}>
          {locationsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
          ) : locations.length === 0 ? (
            <Text style={styles.emptyText}>
              No tracked locations yet. Add one above to enable automatic hourly collection.
            </Text>
          ) : (
            (locations as any[]).map((loc, idx) => {
              const isLast = idx === locations.length - 1;
              const days = daysInSeason(loc.plantingDate ?? null);
              const isEditing = editingCropId === loc.id;
              return (
                <View key={loc.id} style={isLast ? styles.locationItemLast : styles.locationItem}>
                  {/* Top row: name + actions */}
                  <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.locationName}>{loc.name}</Text>
                      <Text style={styles.locationCoords}>
                        {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                        {loc.elevation != null ? `  ·  ${Math.round(loc.elevation)}m` : ""}
                      </Text>
                    </View>
                    <View style={styles.locationActions}>
                      <View
                        style={[
                          styles.locationBadge,
                          { backgroundColor: loc.active ? "#E8F5E9" : colors.muted },
                        ]}
                      >
                        <Text
                          style={[
                            styles.locationBadgeText,
                            { color: loc.active ? "#3D8B37" : colors.mutedForeground },
                          ]}
                        >
                          {loc.active ? "ACTIVE" : "PAUSED"}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          loc.active
                            ? deactivateMutation.mutate({ id: loc.id })
                            : activateMutation.mutate({ id: loc.id })
                        }
                      >
                        <Feather
                          name={loc.active ? "pause-circle" : "play-circle"}
                          size={20}
                          color={loc.active ? colors.mutedForeground : colors.primary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmDelete(loc.id, loc.name)}>
                        <Feather name="trash-2" size={18} color="#D94F4F" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Crop calendar row */}
                  {!isEditing ? (
                    <TouchableOpacity
                      onPress={() => startEditCrop({ id: loc.id, cropType: loc.cropType ?? null, plantingDate: loc.plantingDate ?? null })}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 8,
                        paddingTop: 8,
                        borderTopWidth: 1,
                        borderColor: colors.border,
                        gap: 8,
                      }}
                    >
                      <Feather name="calendar" size={13} color={loc.cropType ? colors.primary : colors.mutedForeground} />
                      <View style={{ flex: 1 }}>
                        {loc.cropType ? (
                          <>
                            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                              {loc.cropType}
                              {days != null && (
                                <Text style={{ color: "#3D8B37", fontFamily: "Inter_700Bold" }}>
                                  {" "}· Day {days} of season
                                </Text>
                              )}
                            </Text>
                            {loc.plantingDate && (
                              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                                Planted {new Date(loc.plantingDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                              </Text>
                            )}
                          </>
                        ) : (
                          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                            Tap to set crop & planting date
                          </Text>
                        )}
                      </View>
                      <Feather name="edit-2" size={12} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  ) : (
                    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border }}>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 8, letterSpacing: 0.6 }}>
                        CROP CALENDAR
                      </Text>
                      {/* Crop type quick-pick */}
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {["Maize", "Tea", "Coffee", "Beans", "Potatoes", "Wheat", "Vegetables", "Pyrethrum"].map((crop) => (
                          <TouchableOpacity
                            key={crop}
                            onPress={() => setCropTypeInput(crop)}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              borderRadius: 20,
                              borderWidth: 1,
                              borderColor: cropTypeInput === crop ? colors.primary : colors.border,
                              backgroundColor: cropTypeInput === crop ? `${colors.primary}18` : colors.background,
                            }}
                          >
                            <Text style={{
                              fontSize: 11,
                              fontFamily: "Inter_500Medium",
                              color: cropTypeInput === crop ? colors.primary : colors.foreground,
                            }}>
                              {crop}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {/* Custom crop name */}
                      <TextInput
                        style={[styles.input, { marginBottom: 8, fontSize: 13 }]}
                        placeholder="Custom crop name…"
                        placeholderTextColor={colors.mutedForeground}
                        value={cropTypeInput}
                        onChangeText={setCropTypeInput}
                      />
                      {/* Planting date */}
                      <TextInput
                        style={[styles.input, { marginBottom: 10, fontSize: 13 }]}
                        placeholder="Planting date (YYYY-MM-DD)"
                        placeholderTextColor={colors.mutedForeground}
                        value={plantingDateInput}
                        onChangeText={setPlantingDateInput}
                        keyboardType="numeric"
                      />
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity
                          style={[styles.addBtn, { flex: 1 }]}
                          onPress={() => saveCrop(loc.id)}
                          disabled={savingCrop}
                        >
                          {savingCrop ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.addBtnText}>Save Crop</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.cancelBtn, { flex: 1 }]}
                          onPress={() => setEditingCropId(null)}
                        >
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

      </ScrollView>
    </View>
  );
}
