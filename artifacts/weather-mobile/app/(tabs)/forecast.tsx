import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useGetWeatherForecast,
  useGetWeatherAlerts,
  useGetLocations,
  getGetWeatherForecastQueryKey,
  getGetWeatherAlertsQueryKey,
  getGetLocationsQueryKey,
  type DailyForecast,
} from "@/lib/api-client";
import { useColorScheme } from "react-native";
import { useColors as useColorTokens } from "@/hooks/useColors";
import colorTokens from "@/constants/colors";
import ForecastDayCard from "@/components/ForecastDayCard";
import AlertsBanner from "@/components/AlertsBannerClean";
import GDDWidget from "@/components/GDDWidget";
import CropSelector from "@/components/CropSelectorClean";
import StormTimelineWidget from "@/components/StormTimelineWidget";
import { useLanguage } from "@/contexts/LanguageContext";

const CROP_KEY = "selectedCrop";
const LAST_LOC_KEY = "microclimate_last_location_v1"; // same key as dashboard
const LEGACY_DEFAULT_COORDS = { latitude: -0.3031, longitude: 36.08 };
const DEGREE = "\u00B0";
const CROP_DISPLAY_NAMES = {
  General: { en: "general crops", sw: "mazao ya kawaida", ki: "mazao ya kawaida" },
  Corn: { en: "maize", sw: "mahindi", ki: "mahindi" },
  Wheat: { en: "wheat", sw: "ngano", ki: "ngano" },
  Tomatoes: { en: "tomatoes", sw: "nyanya", ki: "nyanya" },
  Potatoes: { en: "potatoes", sw: "viazi", ki: "viazi" },
  Grapes: { en: "grapes", sw: "zabibu", ki: "zabibu" },
  Rice: { en: "rice", sw: "mchele", ki: "mchele" },
  Lettuce: { en: "lettuce", sw: "saladi", ki: "saladi" },
  Cotton: { en: "cotton", sw: "pamba", ki: "pamba" },
  Soybeans: { en: "soybeans", sw: "soya", ki: "soya" },
  Citrus: { en: "citrus", sw: "machungwa", ki: "machungwa" },
  Sunflower: { en: "sunflower", sw: "alizeti", ki: "alizeti" },
} as const;

function getCropDisplayName(language: "en" | "sw" | "ki", crop: string): string {
  return CROP_DISPLAY_NAMES[crop as keyof typeof CROP_DISPLAY_NAMES]?.[language] ?? crop;
}

const CROP_HINTS = {
  en: {
    General: "Keep checking rain and wind before doing heavy field work.",
    Corn: "Maize likes steady moisture, but seedlings suffer quickly when water stays on the field.",
    Wheat: "Wheat handles cool weather well, but damp mornings can raise disease pressure.",
    Tomatoes: "Tomatoes need close checking in wet weather because leaf disease can spread fast.",
    Potatoes: "Potatoes need moisture, but waterlogged ridges can quickly harm roots and tubers.",
    Grapes: "Grapes need good airflow, so trim dense growth if humid weather keeps building.",
    Rice: "Rice handles wet spells well, but strong wind can still weaken soft stems.",
    Lettuce: "Lettuce prefers cooler weather, so heat and dry wind can stress it quickly.",
    Cotton: "Cotton handles heat, but flowering plants still need enough moisture to hold blooms.",
    Soybeans: "Soybeans like steady moisture, but saturated soil can slow growth.",
    Citrus: "Citrus trees like deep moisture, but long wet periods can increase fungal pressure.",
    Sunflower: "Sunflower can handle short dry spells, but strong wind can lean young plants.",
  },
  sw: {
    General: "Endelea kuangalia mvua na upepo kabla ya kazi nzito za shamba.",
    Corn: "Mahindi yanapenda unyevu wa wastani, lakini miche huumia haraka maji yanapotuama.",
    Wheat: "Ngano huvumilia baridi vizuri, lakini asubuhi zenye unyevu huongeza hatari ya magonjwa.",
    Tomatoes: "Nyanya zinahitaji uangalizi mkubwa wakati wa mvua kwa sababu magonjwa ya majani huenea haraka.",
    Potatoes: "Viazi vinahitaji unyevu, lakini matuta yenye maji mengi huathiri mizizi na viazi haraka.",
    Grapes: "Zabibu zinahitaji hewa kupita vizuri, kwa hiyo punguza msongamano kama unyevu unaongezeka.",
    Rice: "Mchele huvumilia vipindi vya mvua, lakini upepo mkali bado unaweza kuharibu mashina dhaifu.",
    Lettuce: "Saladi hupenda baridi, kwa hiyo joto na upepo mkavu huichosha haraka.",
    Cotton: "Pamba huvumilia joto, lakini mimea ya maua bado huhitaji unyevu wa kutosha.",
    Soybeans: "Soya hupenda unyevu wa wastani, lakini udongo wenye maji mengi hupunguza ukuaji.",
    Citrus: "Machungwa hupenda unyevu wa kina, lakini vipindi virefu vya mvua huongeza hatari ya fangasi.",
    Sunflower: "Alizeti huvumilia ukavu wa muda mfupi, lakini upepo mkali unaweza kulegeza mimea michanga.",
  },
  ki: {
    General: "Keep checking rain and wind before doing heavy field work.",
    Corn: "Maize likes steady moisture, but seedlings suffer quickly when water stays on the field.",
    Wheat: "Wheat handles cool weather well, but damp mornings can raise disease pressure.",
    Tomatoes: "Tomatoes need close checking in wet weather because leaf disease can spread fast.",
    Potatoes: "Potatoes need moisture, but waterlogged ridges can quickly harm roots and tubers.",
    Grapes: "Grapes need good airflow, so trim dense growth if humid weather keeps building.",
    Rice: "Rice handles wet spells well, but strong wind can still weaken soft stems.",
    Lettuce: "Lettuce prefers cooler weather, so heat and dry wind can stress it quickly.",
    Cotton: "Cotton handles heat, but flowering plants still need enough moisture to hold blooms.",
    Soybeans: "Soybeans like steady moisture, but saturated soil can slow growth.",
    Citrus: "Citrus trees like deep moisture, but long wet periods can increase fungal pressure.",
    Sunflower: "Sunflower can handle short dry spells, but strong wind can lean young plants.",
  },
} as const;

function isLegacyStoredDefault(saved: unknown): boolean {
  if (!saved || typeof saved !== "object") return false;

  const candidate = saved as {
    userSelected?: boolean;
    coords?: { latitude?: number; longitude?: number };
  };

  if (candidate.userSelected !== undefined) return false;

  const latitude = candidate.coords?.latitude;
  const longitude = candidate.coords?.longitude;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return false;
  }

  return (
    Math.abs(latitude - LEGACY_DEFAULT_COORDS.latitude) < 0.001 &&
    Math.abs(longitude - LEGACY_DEFAULT_COORDS.longitude) < 0.001
  );
}

function formatDayLabel(date: string, language: "en" | "sw" | "ki"): string {
  const locale = language === "sw" ? "sw-KE" : "en-KE";
  return new Date(date).toLocaleDateString(locale, { weekday: "short" });
}

function buildForecastAdvice(
  language: "en" | "sw" | "ki",
  selectedCrop: string,
  days: DailyForecast[],
): { title: string; intro: string; bullets: string[] } | null {
  if (!days.length) {
    return null;
  }

  const wetDays = days.filter((day) => day.precipitationProbability >= 60 || day.precipitationSum >= 5);
  const hotDays = days.filter((day) => day.tempMax >= 30);
  const windyDays = days.filter((day) => day.windspeedMax >= 24);
  const workDays = days.filter((day) => day.fieldDayScore >= 7 && day.precipitationProbability < 40);
  const sprayDays = days.filter((day) => day.sprayWindowOpen);
  const dryStart = days.slice(0, 3).every((day) => day.precipitationProbability < 40 && day.precipitationSum < 3);
  const cropName = getCropDisplayName(language, selectedCrop);

  if (language === "sw") {
    const bullets = [
      workDays.length > 0
        ? `Kazi za shamba: siku bora ni ${workDays
            .slice(0, 2)
            .map((day) => formatDayLabel(day.date, language))
            .join(" na ")}. Tumia dirisha hilo kwa kupalilia, kuweka mbolea, au kazi za udongo.`
        : "Kazi za shamba: ardhi inaweza kubaki laini kwa siku nyingi, kwa hiyo epuka kazi nzito zisizo za lazima.",
      wetDays.length >= 3
        ? "Maji na mvua: punguza umwagiliaji kwa sasa na angalia maeneo ya chini yenye maji yanayoweza kutuama."
        : dryStart
        ? "Maji na mvua: kama udongo wako ni mwepesi, jiandae kuongeza maji katikati ya wiki kabla ya mimea kuchoka."
        : "Maji na mvua: fuatilia udongo kila siku. Wiki hii inahitaji maamuzi ya karibu kwa karibu.",
      sprayDays.length > 0
        ? `Kunyunyizia: dirisha salama linaonekana ${sprayDays
            .slice(0, 2)
            .map((day) => formatDayLabel(day.date, language))
            .join(" na ")}. Epuka kunyunyizia wakati upepo au mvua vinaongezeka.`
        : "Kunyunyizia: wiki hii haina dirisha refu la kunyunyizia. Subiri kipindi kifupi chenye upepo mdogo na mvua ndogo.",
      CROP_HINTS.sw[selectedCrop as keyof typeof CROP_HINTS.sw] ?? CROP_HINTS.sw.General,
    ];

    if (hotDays.length >= 2) {
      bullets.splice(2, 0, "Joto: fanya umwagiliaji au kazi nyepesi asubuhi mapema au jioni.");
    }
    if (windyDays.length >= 2) {
      bullets.splice(2, 0, "Upepo: linda mimea michanga na mabomba mepesi kabla ya siku zenye upepo mkali kufika.");
    }

    return {
      title: "Ushauri wa zao lako kwa wiki hii",
      intro:
        wetDays.length >= 4
          ? `Kwa ${cropName}, siku hizi 7 zinaonekana kuwa na unyevu mwingi. Panga kazi zako kabla ya vipindi vya mvua nzito.`
          : dryStart
          ? `Kwa ${cropName}, mwanzo wa wiki unaonekana kuwa mkavu kiasi. Hii ni nafasi nzuri ya kupanga kazi za shamba.`
          : `Kwa ${cropName}, wiki hii ina mchanganyiko wa mvua na vipindi vya kazi. Uamuzi wa kila siku utakusaidia zaidi.`,
      bullets: bullets.slice(0, 4),
    };
  }

  const bullets = [
    workDays.length > 0
      ? `Field work: your best window is ${workDays
          .slice(0, 2)
          .map((day) => formatDayLabel(day.date, language))
          .join(" and ")}. Use that time for weeding, fertilizer, or soil work.`
      : "Field work: soils may stay soft for much of the week, so avoid unnecessary heavy traffic on the field.",
    wetDays.length >= 3
      ? "Water: ease back on irrigation for now and keep an eye on low spots where water could sit."
      : dryStart
      ? "Water: if your soil dries quickly, be ready to top up moisture by midweek before plants begin to stress."
      : "Water: keep checking soil moisture daily. This week needs close adjustments rather than one fixed irrigation plan.",
    sprayDays.length > 0
      ? `Spraying: the safer spray window looks like ${sprayDays
          .slice(0, 2)
          .map((day) => formatDayLabel(day.date, language))
          .join(" and ")}. Hold off when wind or showers start building.`
      : "Spraying: there is no long safe spray window right now. Wait for a shorter calm and drier period.",
    CROP_HINTS.en[selectedCrop as keyof typeof CROP_HINTS.en] ?? CROP_HINTS.en.General,
  ];

  if (hotDays.length >= 2) {
    bullets.splice(2, 0, "Heat: move irrigation and delicate crop work to early morning or late afternoon.");
  }
  if (windyDays.length >= 2) {
    bullets.splice(2, 0, "Wind: secure young plants, covers, and light irrigation lines before the windy days arrive.");
  }

  return {
    title: "Your crop advice this week",
    intro:
      wetDays.length >= 4
        ? `For ${cropName}, the next 7 days look wetter than usual. Try to front-load field work before the heavier rain windows.`
        : dryStart
        ? `For ${cropName}, the start of the week looks mostly dry. That gives you a better work window before conditions shift again.`
        : `For ${cropName}, this week looks mixed. Short day-by-day decisions will work better than one fixed plan.`,
    bullets: bullets.slice(0, 4),
  };
}

export default function ForecastScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = useColorTokens();
  const insets = useSafeAreaInsets();
  const { t, tf, language } = useLanguage();

  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState("General");

  // Load stored crop + location
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(CROP_KEY);
        if (stored) setSelectedCrop(stored);
      } catch {}
    })();
    requestLocation();
  }, []);

  const requestLocation = useCallback(async () => {
    setLocError(null);

    // Use whatever the dashboard saved — exact same location the user set
    try {
      const raw = await AsyncStorage.getItem(LAST_LOC_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // Format: { coords: { latitude, longitude }, label }
        if (!isLegacyStoredDefault(saved) && saved?.coords?.latitude != null) {
          setCoords({ lat: saved.coords.latitude, lon: saved.coords.longitude });
          setLocationLabel(typeof saved.label === "string" ? saved.label : null);
          return;
        }
      }
    } catch {}

    try {
      if (Platform.OS === "web") {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          setCoords(null);
          setLocError(t("locationBrowserPick"));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
            setLocationLabel(null);
            setLocError(null);
          },
          () => {
            setCoords(null);
            setLocError(t("locationEnableOrPick"));
          },
          { timeout: 8000 },
        );
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setCoords(null);
        setLocError(t("locationPermissionOrPick"));
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      setLocationLabel(null);
      setLocError(null);
    } catch {
      setCoords(null);
      setLocError(t("locationCurrentOrPick"));
    }
  }, []);

  const forecastParams = coords ? { lat: coords.lat, lon: coords.lon } : undefined;

  const { data: forecast, isLoading: forecastLoading, refetch: refetchForecast, error: forecastError } =
    useGetWeatherForecast(
      forecastParams ?? ({ lat: 0, lon: 0 } as { lat: number; lon: number }),
      { query: { queryKey: getGetWeatherForecastQueryKey(forecastParams), enabled: !!coords } }
    );

  const { data: alertsData, isLoading: alertsLoading, refetch: refetchAlerts } =
    useGetWeatherAlerts(
      forecastParams ?? ({ lat: 0, lon: 0 } as { lat: number; lon: number }),
      { query: { queryKey: getGetWeatherAlertsQueryKey(forecastParams), enabled: !!coords } }
    );

  const { data: locationsData } = useGetLocations({
    query: { queryKey: getGetLocationsQueryKey(), staleTime: 5 * 60 * 1000 },
  });

  // Find the tracked location nearest to current coords that has a crop set
  const growingSeasonInfo = React.useMemo(() => {
    if (!locationsData || !coords) return null;
    const locs = (locationsData.locations as any[]).filter((l) => l.cropType && l.plantingDate);
    if (locs.length === 0) return null;
    const nearest = locs.reduce((best: any, l: any) => {
      const d = Math.abs(l.latitude - coords.lat) + Math.abs(l.longitude - coords.lon);
      const bd = Math.abs(best.latitude - coords.lat) + Math.abs(best.longitude - coords.lon);
      return d < bd ? l : best;
    });
    const planted = new Date(nearest.plantingDate);
    const dayN = Math.floor((Date.now() - planted.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (dayN < 1) return null;
    return {
      cropType: nearest.cropType as string,
      dayN,
      locationName: (nearest.villageName as string | null | undefined) || (nearest.name as string),
    };
  }, [locationsData, coords]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchForecast(), refetchAlerts()]);
    setRefreshing(false);
  }, [refetchForecast, refetchAlerts]);

  const handleCropChange = useCallback(
    async (crop: string) => {
      setSelectedCrop(crop);
      await AsyncStorage.setItem(CROP_KEY, crop).catch(() => {});
      setRefreshing(true);
      await Promise.all([refetchForecast(), refetchAlerts()]);
      setRefreshing(false);
    },
    [refetchAlerts, refetchForecast],
  );

  const forecastAdvice = useMemo(
    () => buildForecastAdvice(language, selectedCrop, forecast?.days ?? []),
    [forecast?.days, language, selectedCrop],
  );

  const isLoading = (forecastLoading || alertsLoading) && !refreshing;
  const headerLocationText = coords
    ? locationLabel || `${Math.abs(coords.lat).toFixed(2)}${DEGREE}${coords.lat >= 0 ? "N" : "S"}, ${Math.abs(coords.lon).toFixed(2)}${DEGREE}${coords.lon >= 0 ? "E" : "W"}`
    : t("forecastLocating");
  const locationText = coords
    ? `${Math.abs(coords.lat).toFixed(2)}°${coords.lat >= 0 ? "N" : "S"}, ${Math.abs(coords.lon).toFixed(2)}°${coords.lon >= 0 ? "E" : "W"}`
    : t("forecastLocating");
  const displayLocationText = coords ? locationLabel || locationText.replace("Â°", "°") : locationText;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t("forecastTitle")}</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          {headerLocationText}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colorTokens.light.primary} />}
        contentContainerStyle={{ paddingBottom: Platform.OS === "android" ? insets.bottom + 20 : insets.bottom + 100 }}
      >
        {/* Crop selector */}
        <CropSelector selectedCrop={selectedCrop} onSelect={handleCropChange} />

        {forecastAdvice ? (
          <View
            style={[
              styles.adviceCard,
              {
                backgroundColor: isDark ? colors.card : "#F5F0E7",
                borderColor: isDark ? colors.border : "#D8C8AE",
              },
            ]}
          >
            <Text style={[styles.adviceTitle, { color: colors.text }]}>{forecastAdvice.title}</Text>
            <Text style={[styles.adviceIntro, { color: colors.mutedForeground }]}>
              {forecastAdvice.intro}
            </Text>
              {forecastAdvice.bullets.map((bullet: string) => (
              <View key={bullet} style={styles.adviceRow}>
                <View style={[styles.adviceDot, { backgroundColor: colorTokens.light.primary }]} />
                <Text style={[styles.adviceBullet, { color: colors.text }]}>{bullet}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {!coords && locError ? (
          <View style={styles.errorBox}>
            <Feather name="map-pin" size={36} color="#F59E0B" />
            <Text style={[styles.errorText, { color: colors.text }]}>{t("forecastLocationNeeded")}</Text>
            <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>{locError}</Text>
          </View>
        ) : isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colorTokens.light.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>{t("forecastLoading")}</Text>
          </View>
        ) : forecastError ? (
          <View style={styles.errorBox}>
            <Feather name="alert-triangle" size={36} color="#F59E0B" />
            <Text style={[styles.errorText, { color: colors.text }]}>{t("forecastLoadFailed")}</Text>
            <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>{t("forecastPullToRetry")}</Text>
          </View>
        ) : (
          <>
            {/* Alerts */}
            {alertsData && alertsData.alerts.length > 0 && (
              <AlertsBanner alerts={alertsData.alerts} />
            )}

            {/* Growing season context banner */}
            {growingSeasonInfo && (
              <View style={{
                marginHorizontal: 16,
                marginTop: 8,
                padding: 12,
                borderRadius: 14,
                backgroundColor: "#E8F5E9",
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}>
                <Text style={{ fontSize: 20 }}>🌱</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#1B5E20" }}>
                    {tf("forecastSeasonDay", { crop: growingSeasonInfo.cropType, day: growingSeasonInfo.dayN })}
                  </Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#388E3C", marginTop: 1 }}>
                    {growingSeasonInfo.locationName}
                  </Text>
                </View>
              </View>
            )}

            {/* Storm Arrival Timeline */}
            {coords && (
              <StormTimelineWidget lat={coords.lat} lon={coords.lon} />
            )}

            {/* GDD Widget */}
            {forecast && (
              <GDDWidget
                cumulativeGDD={forecast.cumulativeGDD}
                irrigationDeficit={forecast.irrigationDeficit}
                cropName={selectedCrop}
              />
            )}

            {/* 7-day cards */}
            <View style={styles.cardsSection}>
              <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{t("forecastDailySection")}</Text>
              {forecast?.days.map((day: DailyForecast, idx: number) => (
                <ForecastDayCard key={day.date} day={day} isToday={idx === 0} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  adviceCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
  },
  adviceTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  adviceIntro: {
    fontSize: 13,
    lineHeight: 20,
  },
  adviceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  adviceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  adviceBullet: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  cardsSection: {
    paddingHorizontal: 16,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  loadingBox: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorBox: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 8,
  },
  errorIcon: {
    fontSize: 36,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "700",
  },
  errorSub: {
    fontSize: 13,
  },
});
