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
  Beans: { en: "beans", sw: "maharagwe", ki: "maharagwe" },
  Wheat: { en: "wheat", sw: "ngano", ki: "ngano" },
  Tomatoes: { en: "tomatoes", sw: "nyanya", ki: "nyanya" },
  Potatoes: { en: "potatoes", sw: "viazi", ki: "viazi" },
  Cabbages: { en: "cabbages", sw: "kabichi", ki: "kabichi" },
  SukumaWiki: { en: "sukuma wiki", sw: "sukuma wiki", ki: "sukuma wiki" },
  Spinach: { en: "spinach", sw: "spinachi", ki: "spinachi" },
  Onions: { en: "onions", sw: "vitunguu", ki: "vitunguu" },
  Watermelons: { en: "watermelons", sw: "matikiti maji", ki: "matikiti maji" },
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

const CROP_SPECIFIC_ADVICE = {
  en: {
    General: {
      dry: "Keep seed out of dust-dry soil. Wait for moisture to settle in the topsoil before planting or top dressing.",
      wet: "Keep drainage lines open and stay off the field while the soil is sticky to avoid compaction.",
      balanced: "Use short dry windows for planting, weeding, and fertilizer work while moisture is still in the soil.",
    },
    Corn: {
      dry: "Maize germinates best when the top 3 to 5 cm of soil is moist. If the surface dries fast, plant after a soaking rain or conserve moisture with light mulch.",
      wet: "Maize roots need air as well as water. Open drainage and avoid applying nitrogen just before heavy rain so nutrients are not washed away.",
      balanced: "If the rain stays steady, this is a good week for planting or early top dressing on well-drained land.",
    },
    Beans: {
      dry: "Beans drop flowers quickly under moisture stress. Keep the root zone evenly moist and avoid cultivating in the hottest hours.",
      wet: "Long wet periods raise blight and rust pressure in beans. Improve airflow, avoid touching wet leaves, and watch lower leaves for spots.",
      balanced: "Use calm dry windows to check flowers, young pods, and early disease signs before problems spread.",
    },
    Wheat: {
      dry: "Wheat can handle some dryness, but tillering suffers if the soil stays too dry for long. Watch for weak pale growth in lighter soils.",
      wet: "Cool damp mornings can raise fungal pressure in wheat. Keep scouting for leaf disease before it spreads across the canopy.",
      balanced: "This week suits wheat best when leaves dry out by midday and the soil stays moist but not saturated.",
    },
    Tomatoes: {
      dry: "Tomatoes need steady root moisture to avoid blossom drop and fruit cracking. Water deeply and keep the soil covered if hot afternoons build up.",
      wet: "Wet leaves and high humidity can trigger blight very quickly in tomatoes. Prune for airflow and avoid overhead irrigation when rain is frequent.",
      balanced: "Watch both flowers and leaves this week. Tomatoes respond well when moisture stays steady and leaves stay dry.",
    },
    Potatoes: {
      dry: "Potatoes need moisture during tuber bulking, but shallow dry soil can slow tuber growth. Check ridges often and keep moisture even.",
      wet: "Waterlogged ridges can cut oxygen around roots and tubers. Open drainage early and delay field traffic until the ridges firm up.",
      balanced: "This week is useful for maintaining even ridge moisture without letting the field stay saturated.",
    },
    Cabbages: {
      dry: "Cabbages make firmer heads when moisture stays steady. Dry swings can slow head formation and split growth later.",
      wet: "Wet crowded leaves can hold disease and caterpillars unnoticed. Open the crop for airflow and keep scouting inside the head zone.",
      balanced: "Keep cabbage growth steady this week by combining clean moisture, regular scouting, and gentle weed control.",
    },
    SukumaWiki: {
      dry: "Sukuma wiki needs frequent moisture to keep leaves tender and productive. Dry hot wind can quickly harden leaves.",
      wet: "Long wet spells can increase leaf spot and reduce leaf quality. Harvest mature leaves early and improve airflow between rows.",
      balanced: "This week favors regular leaf harvest, light feeding, and close checks for insect or leaf spot pressure.",
    },
    Spinach: {
      dry: "Spinach stresses quickly in dry heat. Keep the topsoil cool and moist so leaves stay soft and marketable.",
      wet: "Wet spinach leaves bruise and carry disease easily. Harvest only when leaves are dry and avoid stepping through wet beds.",
      balanced: "Use cool mornings for harvest and keep spinach growing steadily with shallow but regular moisture.",
    },
    Onions: {
      dry: "Onions need steady moisture while bulbs are sizing, but shallow rooting makes them sensitive to dry topsoil. Check the top layer often.",
      wet: "Too much moisture around onions can raise downy mildew and soften bulbs. Improve drainage and avoid late irrigation in humid spells.",
      balanced: "This is a good week to keep onion growth even, with light moisture and a clean weed-free root zone.",
    },
    Watermelons: {
      dry: "Watermelons need deep moisture while vines and fruits are expanding. Dry stress can reduce fruit size and sweetness.",
      wet: "Too much surface moisture can raise fruit rot and foliar disease. Keep fruits off wet soil and avoid overwatering when rain is frequent.",
      balanced: "The crop will benefit most from deep moisture, clean fruit contact points, and calm scouting for vine health.",
    },
    Grapes: {
      dry: "Grapes can handle some dry weather, but young bunches need balanced moisture to avoid berry stress. Keep roots moist, not flooded.",
      wet: "Humid wet weather raises mildew risk in grapes. Thin dense growth and keep bunches exposed to moving air.",
      balanced: "This week is best used for canopy management, disease scouting, and keeping moisture stable around the roots.",
    },
    Rice: {
      dry: "Rice suffers when standing water drops too low during active growth. Watch field levels closely and protect water channels.",
      wet: "Rice handles wet conditions, but strong wind and deep water can still lodge soft stems. Keep bunds and outlets in good shape.",
      balanced: "A stable water level and quick repair of field channels will keep rice more even this week.",
    },
    Lettuce: {
      dry: "Lettuce turns bitter and wilts quickly in dry heat. Keep the soil cool and moist, especially in lighter beds.",
      wet: "Wet leaves increase rot risk in lettuce. Harvest clean, dry heads and improve spacing if humidity stays trapped.",
      balanced: "Use this week to keep lettuce clean, cool, and moving steadily toward harvest without moisture swings.",
    },
    Cotton: {
      dry: "Cotton tolerates heat, but flowering and boll set still need reliable soil moisture. Watch for stress before blooms begin dropping.",
      wet: "Too much wetness can push weak leafy growth and disease pressure. Let the field drain and avoid unnecessary irrigation.",
      balanced: "This week suits cotton when soil moisture is steady and the canopy stays open enough to dry after rain.",
    },
    Soybeans: {
      dry: "Soybeans need even moisture around flowering and pod set. Dry stress at that stage can reduce pod numbers quickly.",
      wet: "Saturated soil slows root function in soybeans and can increase root disease. Watch fields that stay wet for too long after rain.",
      balanced: "Keep soybean growth steady this week with close checks around flowering, pods, and field drainage.",
    },
    Citrus: {
      dry: "Citrus trees benefit from deep slow moisture, especially when fruits are sizing. Dry stress can reduce fruit set and fruit size.",
      wet: "Long wet periods can raise fungal pressure in citrus canopies and around the root zone. Keep the base clean and watch for yellowing or spotting.",
      balanced: "This week favors deep watering only when needed, plus careful canopy and orchard-floor hygiene.",
    },
    Sunflower: {
      dry: "Sunflower handles short dry periods, but moisture stress during head filling can reduce seed weight. Watch plants on shallow soils first.",
      wet: "Heavy wet soil and strong wind can lean sunflower stems. Support young stands and avoid waterlogging around roots.",
      balanced: "Use this week to maintain steady growth and protect stems before the windier days arrive.",
    },
  },
  sw: {
    General: {
      dry: "Usipande au kuweka mbolea kwenye udongo wa vumbi kavu. Subiri unyevu ushike juu ya udongo kwanza.",
      wet: "Fungua njia za kupitisha maji na epuka kuingia shambani wakati udongo ni wa matope ili usikandamize ardhi.",
      balanced: "Tumia vipindi vifupi vya ukavu kwa kupanda, kupalilia, na kuweka mbolea huku unyevu bado upo kwenye udongo.",
    },
    Corn: {
      dry: "Mahindi huota vizuri wakati sentimita 3 hadi 5 za juu za udongo zina unyevu. Kama juu ya udongo hukauka haraka, panda baada ya mvua nzuri au hifadhi unyevu kwa matandazo mepesi.",
      wet: "Mizizi ya mahindi huhitaji hewa pamoja na maji. Toa maji shambani na epuka kuweka mbolea ya nitrojeni kabla ya mvua kubwa ili isioshwe.",
      balanced: "Mvua ikiwa ya wastani wiki hii ni nzuri kwa kupanda au kuweka mbolea ya mwanzo kwenye ardhi inayotoa maji vizuri.",
    },
    Beans: {
      dry: "Maharagwe hupoteza maua haraka yakikosa unyevu. Weka unyevu wa mizizi sawa na epuka kulima wakati wa joto kali la mchana.",
      wet: "Mvua ya muda mrefu huongeza ukungu na kutu kwenye maharagwe. Ruhusu hewa ipite, usiguse majani yakiwa na maji, na angalia madoa kwenye majani ya chini.",
      balanced: "Tumia vipindi tulivu vya ukavu kukagua maua, maganda changa, na dalili za mapema za magonjwa.",
    },
    Wheat: {
      dry: "Ngano huvumilia ukavu kiasi, lakini kuchanua kwa vichipukizi hupungua udongo ukikaa mkavu kwa muda mrefu. Angalia mimea dhaifu katika udongo mwepesi.",
      wet: "Asubuhi za baridi zenye unyevu huongeza magonjwa ya fangasi kwenye ngano. Endelea kukagua majani kabla ugonjwa haujaenea kwenye shamba lote.",
      balanced: "Ngano itanufaika wiki hii kama majani yanakauka kufikia mchana na udongo unabaki na unyevu bila kuzidi.",
    },
    Tomatoes: {
      dry: "Nyanya zinahitaji unyevu wa mizizi usiobadilika ili maua na matunda yasiporomoke wala kupasuka. Mwagilia kwa kina na funika udongo joto la mchana likiongezeka.",
      wet: "Majani yenye maji na unyevu mwingi huanzisha blight haraka kwenye nyanya. Punguza msongamano, ongeza hewa, na epuka kunyunyiza maji juu ya majani wakati mvua ni nyingi.",
      balanced: "Wiki hii angalia maua na majani kwa karibu. Nyanya hufanya vizuri unyevu ukiwa wa wastani na majani yakibaki makavu.",
    },
    Potatoes: {
      dry: "Viazi vinahitaji unyevu wakati wa kujaza viazi chini ya udongo, lakini ukavu wa juu ya udongo hupunguza ukubwa wa viazi. Angalia matuta mara kwa mara.",
      wet: "Matuta yenye maji mengi hupunguza hewa karibu na mizizi na viazi. Toa maji mapema na epuka kuingia shambani matuta yakiwa bado laini.",
      balanced: "Wiki hii ni nzuri kudumisha unyevu sawa kwenye matuta bila kuruhusu shamba kubaki na maji mengi.",
    },
    Cabbages: {
      dry: "Kabichi hutengeneza vichwa vizuri unyevu ukiwa wa wastani. Mabadiliko makubwa ya ukavu yanaweza kuchelewesha au kupasua vichwa baadaye.",
      wet: "Majani mengi yenye maji yanaweza kuficha magonjwa na viwavi. Ongeza hewa kwenye zao na endelea kukagua ndani ya eneo la kichwa.",
      balanced: "Dumisha ukuaji wa kabichi wiki hii kwa unyevu safi, ukaguzi wa mara kwa mara, na palizi ya upole.",
    },
    SukumaWiki: {
      dry: "Sukuma wiki huhitaji unyevu wa mara kwa mara ili majani yabaki laini na yenye ubora. Upepo mkavu na joto huifanya kuwa ngumu haraka.",
      wet: "Mvua ndefu huongeza madoa ya majani na kupunguza ubora wa mavuno. Vuna majani yaliyokomaa mapema na ongeza nafasi ya hewa kati ya mistari.",
      balanced: "Wiki hii ni nzuri kwa kuvuna majani mara kwa mara, kuweka mbolea kidogo, na kukagua wadudu au madoa ya majani.",
    },
    Spinach: {
      dry: "Spinachi huathirika haraka kwa joto na ukavu. Weka udongo wa juu uwe baridi na wenye unyevu ili majani yabaki laini.",
      wet: "Majani yenye maji huumia na kushika magonjwa kwa urahisi. Vuna wakati majani ni makavu na epuka kutembea kwenye vitanda vyenye maji.",
      balanced: "Tumia asubuhi za baridi kuvuna na weka spinachi ikiendelea vizuri kwa unyevu mdogo lakini wa mara kwa mara.",
    },
    Onions: {
      dry: "Vitunguu vinahitaji unyevu wa wastani wakati balbu zinakua, lakini mizizi yake mifupi huathirika haraka udongo wa juu ukikauka. Angalia tabaka la juu mara kwa mara.",
      wet: "Maji mengi karibu na vitunguu huongeza downy mildew na kulainisha balbu. Toa maji vizuri na epuka umwagiliaji wa jioni wakati unyevu ni mwingi.",
      balanced: "Wiki hii ni nzuri kudumisha ukuaji wa vitunguu kwa unyevu wa kiasi na eneo safi lisilo na magugu.",
    },
    Watermelons: {
      dry: "Matikiti maji yanahitaji unyevu wa kina wakati mizabibu na matunda yanapanuka. Ukavu hupunguza ukubwa na utamu wa matunda.",
      wet: "Maji mengi juu ya uso huongeza kuoza kwa matunda na magonjwa ya majani. Inua matunda juu ya udongo wenye maji na epuka umwagiliaji kupita kiasi mvua zinapokuwa nyingi.",
      balanced: "Zao hili litafaidika wiki hii kwa unyevu wa kina, sehemu safi ya kulalia matunda, na ukaguzi wa afya ya mizabibu.",
    },
    Grapes: {
      dry: "Zabibu huvumilia ukavu kiasi, lakini vichala changa huhitaji unyevu wa wastani ili tunda lisipate msongo. Weka mizizi na unyevu wa kutosha bila kuzamisha.",
      wet: "Unyevu mwingi huongeza mildew kwenye zabibu. Punguza msongamano na ruhusu vichala vipate hewa inayopita.",
      balanced: "Wiki hii tumia muda kwa usimamizi wa canopy, ukaguzi wa magonjwa, na kudumisha unyevu sawa kwenye mizizi.",
    },
    Rice: {
      dry: "Mchele huathirika kiwango cha maji kinaposhuka sana wakati wa ukuaji. Angalia kina cha maji na linda njia za kuingiza maji.",
      wet: "Mchele huvumilia maji, lakini upepo mkali na kina kikubwa vinaweza kulaza mashina laini. Hakikisha bunds na njia za kutoa maji ziko sawa.",
      balanced: "Kiwango thabiti cha maji na marekebisho ya haraka ya njia za shamba vitasaidia mchele wiki hii.",
    },
    Lettuce: {
      dry: "Saladi huwa chungu na kunyauka haraka kwenye joto na ukavu. Weka udongo baridi na wenye unyevu hasa kwenye vitanda vyepesi.",
      wet: "Majani yenye maji huongeza hatari ya kuoza. Vuna vichwa vikavu na ongeza nafasi kama unyevu umefungika ndani ya zao.",
      balanced: "Wiki hii ni nzuri kwa kudumisha saladi safi, baridi, na yenye ukuaji wa wastani bila kubadilisha sana unyevu.",
    },
    Cotton: {
      dry: "Pamba huvumilia joto, lakini maua na boll zinahitaji unyevu wa kutosha. Angalia dalili za msongo kabla maua hayajaanza kuporomoka.",
      wet: "Maji mengi yanaweza kusababisha majani mengi dhaifu na magonjwa. Ruhusu shamba litoe maji na epuka umwagiliaji usio wa lazima.",
      balanced: "Wiki hii pamba itafanya vizuri kama unyevu wa udongo ni wa wastani na canopy inakauka baada ya mvua.",
    },
    Soybeans: {
      dry: "Soya huhitaji unyevu wa wastani wakati wa kutoa maua na kufunga maganda. Ukavu wakati huo hupunguza idadi ya maganda haraka.",
      wet: "Udongo wenye maji mengi hupunguza kazi ya mizizi ya soya na huongeza magonjwa ya mizizi. Angalia mashamba yanayochelewa kukauka baada ya mvua.",
      balanced: "Dumisha ukuaji wa soya wiki hii kwa kukagua maua, maganda, na utoaji wa maji shambani.",
    },
    Citrus: {
      dry: "Machungwa hufaidika na umwagiliaji wa kina hasa matunda yanapokua. Ukavu hupunguza ukubwa wa matunda na ushikaji wa matunda.",
      wet: "Mvua ndefu huongeza magonjwa ya fangasi kwenye canopy na karibu na mizizi. Weka eneo la chini safi na angalia majani ya manjano au madoa.",
      balanced: "Wiki hii inapendelea umwagiliaji wa kina pale tu unapohitajika na usafi mzuri wa mti na udongo wake.",
    },
    Sunflower: {
      dry: "Alizeti huvumilia ukavu wa muda mfupi, lakini upungufu wa unyevu wakati wa kujaza mbegu hupunguza uzito wa mbegu. Angalia mimea kwenye udongo mwepesi kwanza.",
      wet: "Udongo mzito wenye maji na upepo mkali unaweza kuangusha alizeti. Linda mimea michanga na epuka maji kusimama karibu na mizizi.",
      balanced: "Wiki hii tumia muda kudumisha ukuaji wa wastani na kulinda mashina kabla ya siku zenye upepo kufika.",
    },
  },
  ki: {
    General: {
      dry: "Keep seed out of dust-dry soil. Wait for moisture to settle in the topsoil before planting or top dressing.",
      wet: "Keep drainage lines open and stay off the field while the soil is sticky to avoid compaction.",
      balanced: "Use short dry windows for planting, weeding, and fertilizer work while moisture is still in the soil.",
    },
    Corn: {
      dry: "Maize germinates best when the top 3 to 5 cm of soil is moist. If the surface dries fast, plant after a soaking rain or conserve moisture with light mulch.",
      wet: "Maize roots need air as well as water. Open drainage and avoid applying nitrogen just before heavy rain so nutrients are not washed away.",
      balanced: "If the rain stays steady, this is a good week for planting or early top dressing on well-drained land.",
    },
    Beans: {
      dry: "Beans drop flowers quickly under moisture stress. Keep the root zone evenly moist and avoid cultivating in the hottest hours.",
      wet: "Long wet periods raise blight and rust pressure in beans. Improve airflow, avoid touching wet leaves, and watch lower leaves for spots.",
      balanced: "Use calm dry windows to check flowers, young pods, and early disease signs before problems spread.",
    },
    Wheat: {
      dry: "Wheat can handle some dryness, but tillering suffers if the soil stays too dry for long. Watch for weak pale growth in lighter soils.",
      wet: "Cool damp mornings can raise fungal pressure in wheat. Keep scouting for leaf disease before it spreads across the canopy.",
      balanced: "This week suits wheat best when leaves dry out by midday and the soil stays moist but not saturated.",
    },
    Tomatoes: {
      dry: "Tomatoes need steady root moisture to avoid blossom drop and fruit cracking. Water deeply and keep the soil covered if hot afternoons build up.",
      wet: "Wet leaves and high humidity can trigger blight very quickly in tomatoes. Prune for airflow and avoid overhead irrigation when rain is frequent.",
      balanced: "Watch both flowers and leaves this week. Tomatoes respond well when moisture stays steady and leaves stay dry.",
    },
    Potatoes: {
      dry: "Potatoes need moisture during tuber bulking, but shallow dry soil can slow tuber growth. Check ridges often and keep moisture even.",
      wet: "Waterlogged ridges can cut oxygen around roots and tubers. Open drainage early and delay field traffic until the ridges firm up.",
      balanced: "This week is useful for maintaining even ridge moisture without letting the field stay saturated.",
    },
    Cabbages: {
      dry: "Cabbages make firmer heads when moisture stays steady. Dry swings can slow head formation and split growth later.",
      wet: "Wet crowded leaves can hold disease and caterpillars unnoticed. Open the crop for airflow and keep scouting inside the head zone.",
      balanced: "Keep cabbage growth steady this week by combining clean moisture, regular scouting, and gentle weed control.",
    },
    SukumaWiki: {
      dry: "Sukuma wiki needs frequent moisture to keep leaves tender and productive. Dry hot wind can quickly harden leaves.",
      wet: "Long wet spells can increase leaf spot and reduce leaf quality. Harvest mature leaves early and improve airflow between rows.",
      balanced: "This week favors regular leaf harvest, light feeding, and close checks for insect or leaf spot pressure.",
    },
    Spinach: {
      dry: "Spinach stresses quickly in dry heat. Keep the topsoil cool and moist so leaves stay soft and marketable.",
      wet: "Wet spinach leaves bruise and carry disease easily. Harvest only when leaves are dry and avoid stepping through wet beds.",
      balanced: "Use cool mornings for harvest and keep spinach growing steadily with shallow but regular moisture.",
    },
    Onions: {
      dry: "Onions need steady moisture while bulbs are sizing, but shallow rooting makes them sensitive to dry topsoil. Check the top layer often.",
      wet: "Too much moisture around onions can raise downy mildew and soften bulbs. Improve drainage and avoid late irrigation in humid spells.",
      balanced: "This is a good week to keep onion growth even, with light moisture and a clean weed-free root zone.",
    },
    Watermelons: {
      dry: "Watermelons need deep moisture while vines and fruits are expanding. Dry stress can reduce fruit size and sweetness.",
      wet: "Too much surface moisture can raise fruit rot and foliar disease. Keep fruits off wet soil and avoid overwatering when rain is frequent.",
      balanced: "The crop will benefit most from deep moisture, clean fruit contact points, and calm scouting for vine health.",
    },
    Grapes: {
      dry: "Grapes can handle some dry weather, but young bunches need balanced moisture to avoid berry stress. Keep roots moist, not flooded.",
      wet: "Humid wet weather raises mildew risk in grapes. Thin dense growth and keep bunches exposed to moving air.",
      balanced: "This week is best used for canopy management, disease scouting, and keeping moisture stable around the roots.",
    },
    Rice: {
      dry: "Rice suffers when standing water drops too low during active growth. Watch field levels closely and protect water channels.",
      wet: "Rice handles wet conditions, but strong wind and deep water can still lodge soft stems. Keep bunds and outlets in good shape.",
      balanced: "A stable water level and quick repair of field channels will keep rice more even this week.",
    },
    Lettuce: {
      dry: "Lettuce turns bitter and wilts quickly in dry heat. Keep the soil cool and moist, especially in lighter beds.",
      wet: "Wet leaves increase rot risk in lettuce. Harvest clean, dry heads and improve spacing if humidity stays trapped.",
      balanced: "Use this week to keep lettuce clean, cool, and moving steadily toward harvest without moisture swings.",
    },
    Cotton: {
      dry: "Cotton tolerates heat, but flowering and boll set still need reliable soil moisture. Watch for stress before blooms begin dropping.",
      wet: "Too much wetness can push weak leafy growth and disease pressure. Let the field drain and avoid unnecessary irrigation.",
      balanced: "This week suits cotton when soil moisture is steady and the canopy stays open enough to dry after rain.",
    },
    Soybeans: {
      dry: "Soybeans need even moisture around flowering and pod set. Dry stress at that stage can reduce pod numbers quickly.",
      wet: "Saturated soil slows root function in soybeans and can increase root disease. Watch fields that stay wet for too long after rain.",
      balanced: "Keep soybean growth steady this week with close checks around flowering, pods, and field drainage.",
    },
    Citrus: {
      dry: "Citrus trees benefit from deep slow moisture, especially when fruits are sizing. Dry stress can reduce fruit set and fruit size.",
      wet: "Long wet periods can raise fungal pressure in citrus canopies and around the root zone. Keep the base clean and watch for yellowing or spotting.",
      balanced: "This week favors deep watering only when needed, plus careful canopy and orchard-floor hygiene.",
    },
    Sunflower: {
      dry: "Sunflower handles short dry periods, but moisture stress during head filling can reduce seed weight. Watch plants on shallow soils first.",
      wet: "Heavy wet soil and strong wind can lean sunflower stems. Support young stands and avoid waterlogging around roots.",
      balanced: "Use this week to maintain steady growth and protect stems before the windier days arrive.",
    },
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
  const weatherPattern = wetDays.length >= 4 ? "wet" : dryStart ? "dry" : "balanced";
  const cropName = getCropDisplayName(language, selectedCrop);
  const cropAdvice =
    CROP_SPECIFIC_ADVICE[language][selectedCrop as keyof typeof CROP_SPECIFIC_ADVICE.en] ??
    CROP_SPECIFIC_ADVICE[language].General;
  const cropNote = cropAdvice[weatherPattern];

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
      cropNote,
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
      bullets: bullets.slice(0, 5),
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
    cropNote,
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
    bullets: bullets.slice(0, 5),
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
