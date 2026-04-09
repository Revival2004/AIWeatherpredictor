import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import KenyaLocationPicker, { type PickedLocation } from "@/components/KenyaLocationPicker";
import MapLocationPicker from "@/components/MapLocationPicker";
import { StatsPanel } from "@/components/StatsPanel";
import { useColors } from "@/hooks/useColors";
import {
  getBaseUrl,
  getGetLocationsQueryKey,
  getGetWeatherStatsQueryKey,
  type TrackedLocation,
  useActivateLocation,
  useAddLocation,
  useDeactivateLocation,
  useDeleteLocation,
  useGetLocations,
  useGetWeatherStats,
} from "@/lib/api-client";

function getApiBase() {
  return getBaseUrl() ?? "http://localhost:8080";
}

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [newName, setNewName] = useState("");
  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(null);
  const [editingCropId, setEditingCropId] = useState<number | null>(null);
  const [cropTypeInput, setCropTypeInput] = useState("");
  const [plantingDateInput, setPlantingDateInput] = useState("");
  const [savingCrop, setSavingCrop] = useState(false);

  const {
    data: statsData,
    isLoading: statsLoading,
    isRefetching: statsRefetching,
    refetch: refetchStats,
  } = useGetWeatherStats({
    query: {
      queryKey: getGetWeatherStatsQueryKey(),
      staleTime: 2 * 60 * 1000,
    },
  });

  const {
    data: locationsData,
    isLoading: locationsLoading,
    refetch: refetchLocations,
  } = useGetLocations({
    query: {
      queryKey: getGetLocationsQueryKey(),
      staleTime: 30 * 1000,
    },
  });

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
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() });
      },
    },
  });

  const activateMutation = useActivateLocation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() });
      },
    },
  });

  const deactivateMutation = useDeactivateLocation({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLocationsQueryKey() });
      },
    },
  });

  function handleAddLocation() {
    if (!pickedLocation) {
      Alert.alert("No location selected", "Please choose a location before saving it.");
      return;
    }

    const name = newName.trim() || pickedLocation.name;
    if (!name) {
      Alert.alert("Missing name", "Please enter a name for this location.");
      return;
    }

    addLocationMutation.mutate({
      data: {
        name,
        latitude: pickedLocation.lat,
        longitude: pickedLocation.lon,
      },
    });
  }

  function confirmDelete(id: number, name: string) {
    Alert.alert("Remove location", `Remove \"${name}\" from tracked locations?`, [
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
    refetchLocations();
  }

  const isRefetching = statsRefetching || locationsLoading;
  const predEntries = Object.entries(statsData?.predictionBreakdown ?? {}).sort((a, b) => b[1] - a[1]);
  const locations: TrackedLocation[] = locationsData?.locations ?? [];
  const readingCount = statsData?.totalReadings ?? 0;
  const learningColor =
    readingCount >= 120 ? "#3D8B37"
    : readingCount >= 40 ? "#D4851A"
    : colors.mutedForeground;
  const learningHeadline =
    readingCount >= 120 ? "Strong local learning base"
    : readingCount >= 40 ? "Building useful local patterns"
    : "Still collecting local history";
  const learningSummary =
    readingCount >= 120
      ? "This farm network has enough recent readings to support more stable field guidance."
      : readingCount >= 40
      ? "FarmPal has started to recognize local weather patterns, and more readings will keep improving it."
      : "Keep checking weather from the dashboard so the system can build stronger local memory.";

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
    insightRow: { flexDirection: "row", alignItems: "center", gap: 16, paddingBottom: 8 },
    ringContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 5,
      alignItems: "center",
      justifyContent: "center",
    },
    ringPct: { fontSize: 15, fontFamily: "Inter_700Bold" },
    insightMeta: { flex: 1, gap: 4 },
    insightTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    insightSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
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
        {statsData?.lastReading ? (
          <View style={[styles.lastReadingRow, { marginTop: 12 }]}>
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text style={styles.lastReadingText}>
              Last reading: {new Date(statsData.lastReading).toLocaleString()}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>AVERAGES</Text>
        <StatsPanel stats={statsData} isLoading={statsLoading} />

        {predEntries.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>RECENT OUTLOOKS</Text>
            <View style={styles.card}>
              {predEntries.map(([pred, count], idx) => (
                <View key={pred} style={idx === predEntries.length - 1 ? styles.rowLast : styles.row}>
                  <Text style={styles.label}>{pred}</Text>
                  <Text style={styles.value}>{count}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>FIELD INTELLIGENCE</Text>
        <View style={styles.card}>
          <View style={styles.insightRow}>
            <View style={[styles.ringContainer, { borderColor: learningColor }]}>
              <Text style={[styles.ringPct, { color: learningColor }]}>{readingCount}</Text>
            </View>
            <View style={styles.insightMeta}>
              <Text style={styles.insightTitle}>{learningHeadline}</Text>
              <Text style={styles.insightSub}>
                {locations.length} tracked {locations.length === 1 ? "farm" : "farms"} and {readingCount} stored readings.
              </Text>
              <Text style={styles.insightSub}>{learningSummary}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Latest reading</Text>
            <Text style={styles.mutedValue}>
              {statsData?.lastReading ? new Date(statsData.lastReading).toLocaleDateString() : "Not yet available"}
            </Text>
          </View>
          <View style={styles.rowLast}>
            <Text style={styles.label}>Prediction note types tracked</Text>
            <Text style={styles.value}>{predEntries.length}</Text>
          </View>
        </View>

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

        {showAddLocation ? (
          <View style={[styles.addForm, { marginBottom: 12 }]}>
            <Text style={styles.addFormTitle}>Add tracked location</Text>

            {pickedLocation ? (
              <TouchableOpacity
                style={[
                  styles.input,
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 12,
                  },
                ]}
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
                    Browse by county
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.input, { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }]}
                  onPress={() => setShowMapPicker(true)}
                >
                  <Feather name="map" size={14} color={colors.primary} />
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: colors.primary }}>
                    Pin on map
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder={pickedLocation ? `Custom name (default: ${pickedLocation.town})` : "Custom name (optional)"}
              placeholderTextColor={colors.mutedForeground}
              value={newName}
              onChangeText={setNewName}
            />

            {pickedLocation ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                  paddingHorizontal: 4,
                }}
              >
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
            ) : null}

            <View style={styles.addFormBtns}>
              <TouchableOpacity
                style={[styles.addBtn, !pickedLocation && { opacity: 0.5 }]}
                onPress={handleAddLocation}
                disabled={addLocationMutation.isPending || !pickedLocation}
              >
                {addLocationMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.addBtnText}>Add location</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowAddLocation(false);
                  setPickedLocation(null);
                  setNewName("");
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <KenyaLocationPicker
          visible={showLocationPicker}
          onClose={() => setShowLocationPicker(false)}
          onSelect={(loc) => {
            setPickedLocation(loc);
            setShowLocationPicker(false);
          }}
        />

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
              No tracked locations yet. Add one above to enable local weather tracking.
            </Text>
          ) : (
            locations.map((loc, idx) => {
              const isLast = idx === locations.length - 1;
              const days = daysInSeason(loc.plantingDate ?? null);
              const isEditing = editingCropId === loc.id;

              return (
                <View key={loc.id} style={isLast ? styles.locationItemLast : styles.locationItem}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.locationName}>{loc.name}</Text>
                      <Text style={styles.locationCoords}>
                        {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                        {loc.elevation != null ? `  -  ${Math.round(loc.elevation)}m` : ""}
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
                              {days != null ? (
                                <Text style={{ color: "#3D8B37", fontFamily: "Inter_700Bold" }}>
                                  {" "} - Day {days} of season
                                </Text>
                              ) : null}
                            </Text>
                            {loc.plantingDate ? (
                              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                                Planted {new Date(loc.plantingDate).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                              </Text>
                            ) : null}
                          </>
                        ) : (
                          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                            Tap to set crop and planting date
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
                            <Text
                              style={{
                                fontSize: 11,
                                fontFamily: "Inter_500Medium",
                                color: cropTypeInput === crop ? colors.primary : colors.foreground,
                              }}
                            >
                              {crop}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput
                        style={[styles.input, { marginBottom: 8, fontSize: 13 }]}
                        placeholder="Custom crop name..."
                        placeholderTextColor={colors.mutedForeground}
                        value={cropTypeInput}
                        onChangeText={setCropTypeInput}
                      />
                      <TextInput
                        style={[styles.input, { marginBottom: 10, fontSize: 13 }]}
                        placeholder="Planting date (YYYY-MM-DD)"
                        placeholderTextColor={colors.mutedForeground}
                        value={plantingDateInput}
                        onChangeText={setPlantingDateInput}
                        keyboardType="numeric"
                      />
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity style={[styles.addBtn, { flex: 1 }]} onPress={() => saveCrop(loc.id)} disabled={savingCrop}>
                          {savingCrop ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.addBtnText}>Save crop</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={() => setEditingCropId(null)}>
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
