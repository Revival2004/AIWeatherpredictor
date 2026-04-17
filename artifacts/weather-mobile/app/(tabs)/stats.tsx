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
import { useFarmerSession } from "@/contexts/FarmerSessionContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useColors } from "@/hooks/useColors";
import { useTrackedLocationsCache } from "@/hooks/useTrackedLocationsCache";
import {
  getGetLocationsQueryKey,
  getGetWeatherStatsQueryKey,
  type TrackedLocation,
  useActivateLocation,
  useAddLocation,
  useDeactivateLocation,
  useDeleteLocation,
  useGetWeatherStats,
} from "@/lib/api-client";
import { customFetch } from "@/lib/api-client/custom-fetch";

export default function StatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { farmer, logout } = useFarmerSession();
  const { t, tf, language } = useLanguage();
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [newName, setNewName] = useState("");
  const [newVillageName, setNewVillageName] = useState("");
  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(null);
  const [editingCropId, setEditingCropId] = useState<number | null>(null);
  const [cropTypeInput, setCropTypeInput] = useState("");
  const [plantingDateInput, setPlantingDateInput] = useState("");
  const [villageInput, setVillageInput] = useState("");
  const [savingCrop, setSavingCrop] = useState(false);
  const villageCopy = {
    en: {
      villageLabel: "Village name",
      villagePlaceholder: "Village name (optional)",
      villageMissing: "Village name not set",
    },
    sw: {
      villageLabel: "Jina la kijiji",
      villagePlaceholder: "Jina la kijiji (hiari)",
      villageMissing: "Jina la kijiji halijawekwa",
    },
    ki: {
      villageLabel: "Village name",
      villagePlaceholder: "Village name (optional)",
      villageMissing: "Village name not set",
    },
  } as const;
  const trackedFarmStatusCopy = {
    en: {
      cached: "Saved farms are showing from local cache while FarmPal reconnects.",
      refreshError: "Saved farms could not refresh right now. Pull down to try again.",
    },
    sw: {
      cached: "Mashamba yaliyohifadhiwa yanaonyeshwa kutoka kumbukumbu ya simu wakati FarmPal inaunganisha tena.",
      refreshError: "Mashamba yaliyohifadhiwa hayakuweza kusasishwa sasa. Vuta chini kujaribu tena.",
    },
    ki: {
      cached: "Mashamba yaliyohifadhiwa yanaonyeshwa kutoka kumbukumbu ya simu wakati FarmPal inaunganisha tena.",
      refreshError: "Mashamba yaliyohifadhiwa hayakuweza kusasishwa sasa. Vuta chini kujaribu tena.",
    },
  } as const;
  const cropChipCopy = {
    Maize: { en: "Maize", sw: "Mahindi", ki: "Mahindi" },
    Tea: { en: "Tea", sw: "Chai", ki: "Chai" },
    Coffee: { en: "Coffee", sw: "Kahawa", ki: "Kahawa" },
    Beans: { en: "Beans", sw: "Maharagwe", ki: "Maharagwe" },
    Potatoes: { en: "Potatoes", sw: "Viazi", ki: "Viazi" },
    Wheat: { en: "Wheat", sw: "Ngano", ki: "Ngano" },
    Vegetables: { en: "Vegetables", sw: "Mboga", ki: "Mboga" },
    Pyrethrum: { en: "Pyrethrum", sw: "Pareto", ki: "Pareto" },
  } as const;

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
    locations,
    isLoading: locationsLoading,
    isFetching: locationsFetching,
    error: locationsError,
    hasFallbackLocations,
    refetch: refetchLocations,
    replaceLocations,
  } = useTrackedLocationsCache({
    enabled: Boolean(farmer?.id),
    farmerId: farmer?.id,
  });

  function sortLocationsForUi(nextLocations: TrackedLocation[]): TrackedLocation[] {
    return [...nextLocations].sort((a, b) => {
      const activeDelta = Number(b.active) - Number(a.active);
      if (activeDelta !== 0) {
        return activeDelta;
      }

      return new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime();
    });
  }

  function syncLocations(nextLocations: TrackedLocation[]) {
    const normalized = sortLocationsForUi(nextLocations);
    replaceLocations(normalized);
    queryClient.setQueryData(getGetLocationsQueryKey(), { locations: normalized });
  }

  function upsertLocationEverywhere(location: TrackedLocation) {
    syncLocations([location, ...locations.filter((entry) => entry.id !== location.id)]);
  }

  function removeLocationEverywhere(locationId: number) {
    syncLocations(locations.filter((entry) => entry.id !== locationId));
  }

  const addLocationMutation = useAddLocation({
    mutation: {
      onSuccess: ({ location }) => {
        upsertLocationEverywhere(location);
        setShowAddLocation(false);
        setNewName("");
        setNewVillageName("");
        setPickedLocation(null);
      },
    },
  });

  const deleteLocationMutation = useDeleteLocation({
    mutation: {
      onSuccess: ({ location }) => {
        removeLocationEverywhere(location.id);
      },
    },
  });

  const activateMutation = useActivateLocation({
    mutation: {
      onSuccess: ({ location }) => {
        upsertLocationEverywhere(location);
      },
    },
  });

  const deactivateMutation = useDeactivateLocation({
    mutation: {
      onSuccess: ({ location }) => {
        upsertLocationEverywhere(location);
      },
    },
  });

  function handleAddLocation() {
    if (!pickedLocation) {
      Alert.alert(t("statsNoLocationSelected"), t("statsChooseLocationBeforeSaving"));
      return;
    }

    const name = newName.trim() || pickedLocation.name;
    if (!name) {
      Alert.alert(t("statsMissingNameTitle"), t("statsEnterLocationName"));
      return;
    }

    addLocationMutation.mutate({
      data: {
        name,
        villageName: newVillageName.trim() || undefined,
        latitude: pickedLocation.lat,
        longitude: pickedLocation.lon,
      },
    });
  }

  function confirmDelete(id: number, name: string) {
    Alert.alert(t("statsRemoveLocationTitle"), tf("statsRemoveLocationBody", { name }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("statsRemoveLocationTitle"),
        style: "destructive",
        onPress: () => deleteLocationMutation.mutate({ id }),
      },
    ]);
  }

  async function saveCrop(id: number) {
    setSavingCrop(true);

    try {
      const response = await customFetch<{ location: TrackedLocation }>(`/api/locations/${id}/crop`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cropType: cropTypeInput || undefined,
          plantingDate: plantingDateInput || undefined,
          villageName: villageInput || undefined,
        }),
        responseType: "json",
      });
      upsertLocationEverywhere(response.location);
      setEditingCropId(null);
    } catch {
      Alert.alert(t("statsCropSaveErrorTitle"), t("statsCropSaveErrorBody"));
    } finally {
      setSavingCrop(false);
    }
  }

  function startEditCrop(loc: {
    id: number;
    cropType: string | null;
    plantingDate: string | null;
    villageName?: string | null;
  }) {
    setEditingCropId(loc.id);
    setCropTypeInput(loc.cropType ?? "");
    setPlantingDateInput(loc.plantingDate ?? "");
    setVillageInput(loc.villageName ?? "");
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

  function confirmLogout() {
    Alert.alert(t("statsSignOutTitle"), t("statsSignOutBody"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("statsSignOut"),
        style: "destructive",
        onPress: () => {
          logout().catch(() => {
            Alert.alert(t("statsSignOutFailedTitle"), t("statsSignOutFailedBody"));
          });
        },
      },
    ]);
  }

  const isRefetching = statsRefetching || locationsFetching;
  const predEntries = Object.entries(statsData?.predictionBreakdown ?? {}).sort((a, b) => b[1] - a[1]);
  const readingCount = statsData?.totalReadings ?? 0;
  const learningColor =
    readingCount >= 120 ? "#3D8B37"
    : readingCount >= 40 ? "#D4851A"
    : colors.mutedForeground;
  const learningHeadline =
    readingCount >= 120 ? t("statsLearningStrongTitle")
    : readingCount >= 40 ? t("statsLearningBuildingTitle")
    : t("statsLearningStartingTitle");
  const learningSummary =
    readingCount >= 120
      ? t("statsLearningStrongBody")
      : readingCount >= 40
      ? t("statsLearningBuildingBody")
      : t("statsLearningStartingBody");

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
    accountRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    accountIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${colors.primary}15`,
    },
    accountMeta: { flex: 1, gap: 4 },
    accountTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground },
    accountSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    accountAction: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: `${colors.primary}12`,
    },
    accountActionText: { fontSize: 12, fontFamily: "Inter_700Bold", color: colors.primary },
    locationItem: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    locationItemLast: { paddingTop: 12 },
    locationTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    locationMeta: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    locationName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    locationVillage: { fontSize: 11, fontFamily: "Inter_500Medium", color: colors.primary },
    locationCoords: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    locationBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    locationBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
    locationControlsRow: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    },
    locationActions: {
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
      paddingRight: 4,
    },
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
    addFormBtns: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    addBtn: {
      flexGrow: 1,
      minWidth: 140,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
    },
    cancelBtn: {
      flexGrow: 1,
      minWidth: 140,
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
        <Text style={styles.title}>{t("statsTitle")}</Text>
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
              {t("statsLastReading")}: {new Date(statsData.lastReading).toLocaleString()}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>{t("statsAverages")}</Text>
        <StatsPanel stats={statsData} isLoading={statsLoading} />

        {predEntries.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>{t("statsRecentNotes")}</Text>
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

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>{t("statsLearning")}</Text>
        <View style={styles.card}>
          <View style={styles.insightRow}>
            <View style={[styles.ringContainer, { borderColor: learningColor }]}>
              <Text style={[styles.ringPct, { color: learningColor }]}>{readingCount}</Text>
            </View>
            <View style={styles.insightMeta}>
              <Text style={styles.insightTitle}>{learningHeadline}</Text>
              <Text style={styles.insightSub}>
                {tf("statsTrackedSummary", {
                  farms: locations.length,
                  farmLabel: locations.length === 1 ? t("statsFarmLabelOne") : t("statsFarmLabelMany"),
                  readings: readingCount,
                })}
              </Text>
              <Text style={styles.insightSub}>{learningSummary}</Text>
            </View>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>{t("statsLatestReading")}</Text>
            <Text style={styles.mutedValue}>
              {statsData?.lastReading ? new Date(statsData.lastReading).toLocaleDateString() : t("statsNotAvailable")}
            </Text>
          </View>
          <View style={styles.rowLast}>
            <Text style={styles.label}>{t("statsPredictionTypes")}</Text>
            <Text style={styles.value}>{predEntries.length}</Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>{t("statsAccount")}</Text>
        <View style={styles.card}>
          <View style={styles.accountRow}>
            <View style={styles.accountIcon}>
              <Feather name="user" size={18} color={colors.primary} />
            </View>
            <View style={styles.accountMeta}>
              <Text style={styles.accountTitle}>{farmer?.displayName?.trim() || t("statsFarmOwner")}</Text>
              <Text style={styles.accountSub}>{farmer?.phoneNumber ?? t("statsPhoneUnavailable")}</Text>
            </View>
            <TouchableOpacity style={styles.accountAction} onPress={confirmLogout}>
              <Text style={styles.accountActionText}>{t("statsSignOut")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 24, marginBottom: 10 }}>
          <Text style={[styles.sectionLabel, { marginBottom: 0, flex: 1 }]}>{t("statsTrackedLocations")}</Text>
          <TouchableOpacity
            onPress={() => setShowAddLocation(!showAddLocation)}
            style={{ marginRight: 20, flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Feather name={showAddLocation ? "x" : "plus"} size={14} color={colors.primary} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.primary }}>
              {showAddLocation ? t("cancel") : t("statsAdd")}
            </Text>
          </TouchableOpacity>
        </View>

        {showAddLocation ? (
          <View style={[styles.addForm, { marginBottom: 12 }]}>
            <Text style={styles.addFormTitle}>{t("statsAddTrackedLocation")}</Text>

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
                    {t("browseCounty")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.input, { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }]}
                  onPress={() => setShowMapPicker(true)}
                >
                  <Feather name="map" size={14} color={colors.primary} />
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: colors.primary }}>
                    {t("pinOnMap")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder={
                pickedLocation
                  ? tf("statsCustomNameDefault", { name: pickedLocation.town })
                  : t("statsCustomNameOptional")
              }
              placeholderTextColor={colors.mutedForeground}
              value={newName}
              onChangeText={setNewName}
            />
            <TextInput
              style={styles.input}
              placeholder={villageCopy[language].villagePlaceholder}
              placeholderTextColor={colors.mutedForeground}
              value={newVillageName}
              onChangeText={setNewVillageName}
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
                    {t("statsClear")}
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
                  <Text style={styles.addBtnText}>{t("statsAddLocation")}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowAddLocation(false);
                  setPickedLocation(null);
                  setNewName("");
                  setNewVillageName("");
                }}
              >
                <Text style={styles.cancelBtnText}>{t("cancel")}</Text>
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
          {locationsError ? (
            <Text style={[styles.emptyText, { paddingTop: 0, paddingBottom: 8 }]}>
              {hasFallbackLocations
                ? trackedFarmStatusCopy[language].cached
                : trackedFarmStatusCopy[language].refreshError}
            </Text>
          ) : null}
          {locationsLoading && locations.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
          ) : locations.length === 0 ? (
            <Text style={styles.emptyText}>
              {t("statsNoTrackedLocations")}
            </Text>
          ) : (
            locations.map((loc, idx) => {
              const isLast = idx === locations.length - 1;
              const days = daysInSeason(loc.plantingDate ?? null);
              const isEditing = editingCropId === loc.id;

              return (
                <View key={loc.id} style={isLast ? styles.locationItemLast : styles.locationItem}>
                  <View style={styles.locationTopRow}>
                    <View style={styles.locationMeta}>
                      <Text style={styles.locationName}>{loc.name}</Text>
                      <Text style={styles.locationVillage}>
                        {loc.villageName?.trim() || villageCopy[language].villageMissing}
                      </Text>
                      <Text style={styles.locationCoords}>
                        {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                        {loc.elevation != null ? `  -  ${Math.round(loc.elevation)}m` : ""}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.locationControlsRow}>
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
                        {loc.active ? t("statsActive") : t("statsPaused")}
                      </Text>
                    </View>
                    <View style={styles.locationActions}>
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
                      onPress={() =>
                        startEditCrop({
                          id: loc.id,
                          cropType: loc.cropType ?? null,
                          plantingDate: loc.plantingDate ?? null,
                          villageName: loc.villageName ?? null,
                        })
                      }
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
                                  {" "} - {tf("statsSeasonDay", { day: days })}
                                </Text>
                              ) : null}
                            </Text>
                            {loc.plantingDate ? (
                              <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                                {tf("statsPlantedOn", {
                                  date: new Date(loc.plantingDate).toLocaleDateString("en-KE", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  }),
                                })}
                              </Text>
                            ) : null}
                          </>
                        ) : (
                          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                            {t("statsTapToSetCrop")}
                          </Text>
                        )}
                      </View>
                      <Feather name="edit-2" size={12} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  ) : (
                    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border }}>
                      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 8, letterSpacing: 0.6 }}>
                        {t("statsCropCalendar")}
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {(["Maize", "Tea", "Coffee", "Beans", "Potatoes", "Wheat", "Vegetables", "Pyrethrum"] as const).map((crop) => (
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
                              {cropChipCopy[crop][language]}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput
                        style={[styles.input, { marginBottom: 8, fontSize: 13 }]}
                        placeholder={t("statsCustomCropPlaceholder")}
                        placeholderTextColor={colors.mutedForeground}
                        value={cropTypeInput}
                        onChangeText={setCropTypeInput}
                      />
                      <TextInput
                        style={[styles.input, { marginBottom: 8, fontSize: 13 }]}
                        placeholder={villageCopy[language].villagePlaceholder}
                        placeholderTextColor={colors.mutedForeground}
                        value={villageInput}
                        onChangeText={setVillageInput}
                      />
                      <TextInput
                        style={[styles.input, { marginBottom: 10, fontSize: 13 }]}
                        placeholder={t("statsPlantingDatePlaceholder")}
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
                            <Text style={styles.addBtnText}>{t("statsSaveCrop")}</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={() => setEditingCropId(null)}>
                          <Text style={styles.cancelBtnText}>{t("cancel")}</Text>
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
