import React, { useState, useMemo, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import {
  KENYA_COUNTIES,
  searchLocations,
  type KenyaCounty,
  type KenyaSubCounty,
  type KenyaTown,
  type LocationSearchResult,
} from "@/constants/kenyaLocations";

export interface PickedLocation {
  name: string;        // e.g. "Kangemi, Westlands, Nairobi"
  displayName: string; // for the UI
  lat: number;
  lon: number;
  county: string;
  subCounty: string;
  town: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (loc: PickedLocation) => void;
}

type Step = "county" | "sub" | "town" | "search";

export default function KenyaLocationPicker({ visible, onClose, onSelect }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>("county");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCounty, setSelectedCounty] = useState<KenyaCounty | null>(null);
  const [selectedSub, setSelectedSub] = useState<KenyaSubCounty | null>(null);

  const searchResults = useMemo(() => {
    if (step !== "search") return [];
    return searchLocations(searchQuery);
  }, [searchQuery, step]);

  const resetAndClose = useCallback(() => {
    setStep("county");
    setSearchQuery("");
    setSelectedCounty(null);
    setSelectedSub(null);
    onClose();
  }, [onClose]);

  const handleCountySelect = (county: KenyaCounty) => {
    setSelectedCounty(county);
    setSelectedSub(null);
    setStep("sub");
  };

  const handleSubSelect = (sub: KenyaSubCounty) => {
    setSelectedSub(sub);
    setStep("town");
  };

  const handleTownSelect = (town: KenyaTown) => {
    if (!selectedCounty || !selectedSub) return;
    onSelect({
      name: `${town.name}, ${selectedSub.name}, ${selectedCounty.name}`,
      displayName: `${town.name} · ${selectedSub.name} · ${selectedCounty.name}`,
      lat: town.lat,
      lon: town.lon,
      county: selectedCounty.name,
      subCounty: selectedSub.name,
      town: town.name,
    });
    resetAndClose();
  };

  const handleSearchResult = (r: LocationSearchResult) => {
    onSelect({
      name: `${r.town}, ${r.subCounty}, ${r.county}`,
      displayName: r.displayName,
      lat: r.lat,
      lon: r.lon,
      county: r.county,
      subCounty: r.subCounty,
      town: r.town,
    });
    resetAndClose();
  };

  const handleCountyAsLocation = (county: KenyaCounty) => {
    onSelect({
      name: county.name,
      displayName: `${county.name} County`,
      lat: county.lat,
      lon: county.lon,
      county: county.name,
      subCounty: "",
      town: county.name,
    });
    resetAndClose();
  };

  const handleSubAsLocation = (sub: KenyaSubCounty) => {
    if (!selectedCounty) return;
    onSelect({
      name: `${sub.name}, ${selectedCounty.name}`,
      displayName: `${sub.name} · ${selectedCounty.name}`,
      lat: sub.lat,
      lon: sub.lon,
      county: selectedCounty.name,
      subCounty: sub.name,
      town: sub.name,
    });
    resetAndClose();
  };

  const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "#00000066" },
    sheet: {
      flex: 1,
      marginTop: Platform.OS === "web" ? 60 : insets.top + 20,
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    headerTitle: { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground },
    closeBtn: { padding: 4 },
    breadcrumb: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 6,
      borderBottomWidth: 1,
      borderColor: colors.border,
      flexWrap: "wrap",
    },
    breadcrumbText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    breadcrumbActive: { color: colors.primary, fontFamily: "Inter_600SemiBold" },
    breadcrumbSep: { fontSize: 12, color: colors.mutedForeground },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginVertical: 10,
      backgroundColor: colors.muted,
      borderRadius: 12,
      paddingHorizontal: 12,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      height: 40,
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      color: colors.foreground,
    },
    modeRow: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginBottom: 10,
      gap: 8,
    },
    modeBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      alignItems: "center",
      borderWidth: 1,
    },
    modeBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    item: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    itemText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground },
    itemSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    emptyText: { textAlign: "center", color: colors.mutedForeground, marginTop: 40, fontFamily: "Inter_400Regular" },
    regionHeader: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.muted,
    },
    regionHeaderText: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      letterSpacing: 0.8,
      color: colors.mutedForeground,
    },
    pinUseBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: `${colors.primary}18`,
    },
    pinUseBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.primary },
  });

  // Group counties by region for the county list
  const regionGroups = useMemo(() => {
    const map = new Map<string, KenyaCounty[]>();
    for (const c of KENYA_COUNTIES) {
      const list = map.get(c.region) ?? [];
      list.push(c);
      map.set(c.region, list);
    }
    return Array.from(map.entries());
  }, []);

  const title =
    step === "search"
      ? "Search All Kenya"
      : step === "county"
      ? "Select County"
      : step === "sub"
      ? `${selectedCounty?.name} · Sub-County`
      : `${selectedSub?.name} · Select Town/Ward`;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={resetAndClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            {step !== "county" && step !== "search" ? (
              <Pressable
                onPress={() => {
                  if (step === "town") setStep("sub");
                  else if (step === "sub") setStep("county");
                }}
                style={{ padding: 4 }}
              >
                <Feather name="arrow-left" size={20} color={colors.foreground} />
              </Pressable>
            ) : null}
            <Text style={s.headerTitle}>{title}</Text>
            <Pressable style={s.closeBtn} onPress={resetAndClose}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          {/* Mode toggle */}
          <View style={[s.modeRow, { marginTop: 12 }]}>
            <Pressable
              style={[
                s.modeBtn,
                {
                  borderColor: step !== "search" ? colors.primary : colors.border,
                  backgroundColor: step !== "search" ? `${colors.primary}15` : "transparent",
                },
              ]}
              onPress={() => {
                setStep(selectedCounty ? (selectedSub ? "town" : "sub") : "county");
                setSearchQuery("");
              }}
            >
              <Text style={[s.modeBtnText, { color: step !== "search" ? colors.primary : colors.mutedForeground }]}>
                Browse
              </Text>
            </Pressable>
            <Pressable
              style={[
                s.modeBtn,
                {
                  borderColor: step === "search" ? colors.primary : colors.border,
                  backgroundColor: step === "search" ? `${colors.primary}15` : "transparent",
                },
              ]}
              onPress={() => setStep("search")}
            >
              <Text style={[s.modeBtnText, { color: step === "search" ? colors.primary : colors.mutedForeground }]}>
                Search
              </Text>
            </Pressable>
          </View>

          {/* Search box */}
          {step === "search" && (
            <View style={s.searchRow}>
              <Feather name="search" size={16} color={colors.mutedForeground} />
              <TextInput
                style={s.searchInput}
                placeholder="Search county, town, ward..."
                placeholderTextColor={colors.mutedForeground}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                clearButtonMode="while-editing"
              />
            </View>
          )}

          {/* Breadcrumb */}
          {step !== "search" && (selectedCounty || selectedSub) && (
            <View style={s.breadcrumb}>
              <Pressable onPress={() => { setStep("county"); setSelectedCounty(null); setSelectedSub(null); }}>
                <Text style={[s.breadcrumbText, step === "county" && s.breadcrumbActive]}>Kenya</Text>
              </Pressable>
              {selectedCounty && (
                <>
                  <Text style={s.breadcrumbSep}>›</Text>
                  <Pressable onPress={() => { setStep("sub"); setSelectedSub(null); }}>
                    <Text style={[s.breadcrumbText, step === "sub" && s.breadcrumbActive]}>
                      {selectedCounty.name}
                    </Text>
                  </Pressable>
                </>
              )}
              {selectedSub && (
                <>
                  <Text style={s.breadcrumbSep}>›</Text>
                  <Text style={[s.breadcrumbText, s.breadcrumbActive]}>{selectedSub.name}</Text>
                </>
              )}
            </View>
          )}

          {/* Content */}
          {step === "county" && (
            <FlatList
              data={regionGroups}
              keyExtractor={([region]) => region}
              renderItem={({ item: [region, counties] }) => (
                <View>
                  <View style={s.regionHeader}>
                    <Text style={s.regionHeaderText}>{region.toUpperCase()}</Text>
                  </View>
                  {counties.map((county) => (
                    <Pressable
                      key={county.id}
                      style={s.item}
                      onPress={() => handleCountySelect(county)}
                      onLongPress={() => handleCountyAsLocation(county)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemText}>{county.name}</Text>
                        <Text style={s.itemSub}>{county.subCounties.length} sub-counties · hold to use county center</Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                    </Pressable>
                  ))}
                </View>
              )}
              showsVerticalScrollIndicator={false}
            />
          )}

          {step === "sub" && selectedCounty && (
            <FlatList
              data={selectedCounty.subCounties}
              keyExtractor={(sub) => sub.name}
              renderItem={({ item: sub }) => (
                <Pressable
                  style={s.item}
                  onPress={() => handleSubSelect(sub)}
                  onLongPress={() => handleSubAsLocation(sub)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemText}>{sub.name}</Text>
                    <Text style={s.itemSub}>{sub.towns.length} towns/wards · hold to use sub-county center</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
              showsVerticalScrollIndicator={false}
            />
          )}

          {step === "town" && selectedSub && (
            <FlatList
              data={selectedSub.towns}
              keyExtractor={(t) => t.name}
              renderItem={({ item: town }) => (
                <Pressable style={s.item} onPress={() => handleTownSelect(town)}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemText}>{town.name}</Text>
                    <Text style={s.itemSub}>{town.lat.toFixed(4)}, {town.lon.toFixed(4)}</Text>
                  </View>
                  <Pressable style={s.pinUseBtn} onPress={() => handleTownSelect(town)}>
                    <Text style={s.pinUseBtnText}>Select</Text>
                  </Pressable>
                </Pressable>
              )}
              showsVerticalScrollIndicator={false}
            />
          )}

          {step === "search" && (
            <FlatList
              data={searchResults}
              keyExtractor={(r) => r.displayName}
              renderItem={({ item: r }) => (
                <Pressable style={s.item} onPress={() => handleSearchResult(r)}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemText}>{r.town}</Text>
                    <Text style={s.itemSub}>{r.subCounty} · {r.county}</Text>
                  </View>
                  <Text style={s.itemSub}>{r.lat.toFixed(3)}, {r.lon.toFixed(3)}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                searchQuery.length > 1 ? (
                  <Text style={s.emptyText}>No results for "{searchQuery}"</Text>
                ) : (
                  <Text style={s.emptyText}>Type to search towns, wards or counties…</Text>
                )
              }
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
