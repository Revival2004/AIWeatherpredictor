/**
 * Planting Advisory Service
 *
 * Answers the most dangerous question in Kenyan smallholder farming:
 * "It is raining now — is it safe to plant, or will the rain stop and kill my seedlings?"
 *
 * The false onset of rains (masika ya uongo) is one of the leading causes of
 * crop failure in Kenya. Farmers plant at the first rains, the rains stop for
 * 4–8 weeks, seedlings die, and the real season starts when no seeds remain.
 *
 * This service combines:
 *   1. 14-day Open-Meteo forecast — how many of the next 14 days will have rain?
 *   2. The longest dry gap within those 14 days — a 6+ day gap mid-season kills seedlings
 *   3. Calendar month — is this even a rain-season month for Kenya?
 *   4. Historical DB baseline — how often does it rain here in this month historically?
 *
 * Output levels:
 *   safe    — season is establishing, safe window for planting
 *   watch   — promising but not confirmed, short-season crops only
 *   caution — fragmented rains, high dry-spell risk, wait longer
 *   danger  — isolated event, very likely to stop, do not plant
 */

import { db, weatherDataTable } from "@workspace/db";
import { and, gte, lte, sql } from "drizzle-orm";

// Kenya's two rainy seasons by month (1-indexed)
const LONG_RAINS_MONTHS  = [3, 4, 5];        // March, April, May
const SHORT_RAINS_MONTHS = [10, 11, 12];      // October, November, December

export type AdvisoryStatus = "safe" | "watch" | "caution" | "danger";

export interface PlantingAdvisory {
  status: AdvisoryStatus;
  rainDaysAhead: number;          // rain days in next 14 days (probability >= 40%)
  longestDryGap: number;          // longest consecutive dry-day stretch in next 14 days
  historicalRainRate: number;     // % of days that historically have rain this month at this location
  season: "long-rains" | "short-rains" | "off-season";
  headlineEn: string;
  headlineSw: string;
  headlineKi: string;
  reasonEn: string;
  reasonSw: string;
  reasonKi: string;
  actionEn: string;
  actionSw: string;
  actionKi: string;
}

interface OpenMeteo14DayResponse {
  daily: {
    time: string[];
    precipitation_probability_max: number[];
    precipitation_sum: number[];
  };
}

async function fetch14DayForecast(lat: number, lon: number): Promise<{
  precipProbabilities: number[];
  precipSums: number[];
}> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("daily", "precipitation_probability_max,precipitation_sum");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "14");

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Open-Meteo 14d error: ${res.status}`);

  const data = (await res.json()) as OpenMeteo14DayResponse;
  return {
    precipProbabilities: data.daily.precipitation_probability_max,
    precipSums: data.daily.precipitation_sum,
  };
}

/**
 * Queries the DB for historical rain frequency at this location in this month.
 * Uses ±1 degree (~110km) radius and the last 5 years of data.
 */
async function getHistoricalRainRate(lat: number, lon: number, month: number): Promise<number> {
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  const rows = await db
    .select({
      total: sql<number>`count(*)`,
      rainDays: sql<number>`count(*) filter (where ${weatherDataTable.weathercode} >= 51)`,
    })
    .from(weatherDataTable)
    .where(
      and(
        gte(weatherDataTable.createdAt, fiveYearsAgo),
        sql`abs(${weatherDataTable.latitude} - ${lat}) < 1`,
        sql`abs(${weatherDataTable.longitude} - ${lon}) < 1`,
        sql`extract(month from ${weatherDataTable.createdAt}) = ${month}`
      )
    );

  const { total, rainDays } = rows[0] ?? { total: 0, rainDays: 0 };
  if (total < 10) return -1; // not enough data to compute baseline

  return Math.round((rainDays / total) * 100);
}

/**
 * Finds the longest consecutive run of dry days (probability < 30%) in an array.
 * A 5+ day gap kills germinating seedlings.
 */
function longestDryStreak(precipProbabilities: number[]): number {
  let maxStreak = 0;
  let currentStreak = 0;
  for (const prob of precipProbabilities) {
    if (prob < 30) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  return maxStreak;
}

function getSeason(month: number): PlantingAdvisory["season"] {
  if (LONG_RAINS_MONTHS.includes(month))  return "long-rains";
  if (SHORT_RAINS_MONTHS.includes(month)) return "short-rains";
  return "off-season";
}

function buildAdvisory(
  rainDays: number,
  dryGap: number,
  season: PlantingAdvisory["season"],
  historicalRainRate: number,
  precipProbabilities: number[]
): Pick<PlantingAdvisory, "status" | "headlineEn" | "headlineSw" | "headlineKi" | "reasonEn" | "reasonSw" | "reasonKi" | "actionEn" | "actionSw" | "actionKi"> {

  // --- Score the situation ---

  // Rain days signal (out of 14)
  const rainScore = rainDays >= 9 ? 3 : rainDays >= 6 ? 2 : rainDays >= 3 ? 1 : 0;

  // Dry gap penalty — a 7+ day gap is a seedling killer
  const gapPenalty = dryGap >= 7 ? 2 : dryGap >= 5 ? 1 : 0;

  // Season bonus — rain in off-season months is almost always a false onset
  const seasonBonus = season === "off-season" ? -2 : 0;

  // Historical rate comparison — if historical rate < 20% this month, current rain is unusual
  const historyPenalty = historicalRainRate > 0 && historicalRainRate < 20 ? -1 : 0;

  // First 3 days — if they're already dry, this rain event is already ending
  const first3DryCount = precipProbabilities.slice(0, 3).filter((p) => p < 30).length;
  const fadingPenalty = first3DryCount >= 2 ? -1 : 0;

  const score = rainScore - gapPenalty + seasonBonus + historyPenalty + fadingPenalty;

  // --- Map score to status ---
  let status: AdvisoryStatus;
  if (score >= 3)       status = "safe";
  else if (score === 2) status = "watch";
  else if (score >= 0)  status = "caution";
  else                  status = "danger";

  // --- Build the messages ---
  const messages: Record<AdvisoryStatus, {
    headlineEn: string; headlineSw: string; headlineKi: string;
    reasonEn: string; reasonSw: string; reasonKi: string;
    actionEn: string; actionSw: string; actionKi: string;
  }> = {
    safe: {
      headlineEn: "Season establishing — safe to plant",
      headlineSw: "Mvua inaendelea — salama kupanda",
      headlineKi: "Mbura nĩyathiite — nĩ mwega gũthiga",
      reasonEn: `${rainDays} of the next 14 days are forecast to have rain, with no significant dry gap. The season appears to be establishing.`,
      reasonSw: `Siku ${rainDays} kati ya 14 zijazo zinatarajiwa kuwa na mvua, bila pengo kubwa la ukame. Msimu unaonekana kuanza vizuri.`,
      reasonKi: `Matukũ ${rainDays} mũgaa wa 14 tũgataraga mbura, na hatirĩ ya ũkaugo mũnene. Mũaka wa mbura ũgũtwara nĩ wega.`,
      actionEn: `Plant now — conditions favour seed germination and early establishment. Use rain-season varieties.`,
      actionSw: `Panda sasa — hali ya hewa inafaa kwa kuota kwa mbegu. Tumia aina za msimu wa mvua.`,
      actionKi: `Thiga rĩu — kirĩnda kĩa rũa nĩ kĩagĩrĩire mbegu. Gĩthagĩria cia mũaka wa mbura.`,
    },
    watch: {
      headlineEn: "Rains are promising — plant short-season crops only",
      headlineSw: "Mvua inaahidi — panda mazao ya msimu mfupi tu",
      headlineKi: "Mbura nĩ ĩyarĩ na tũmĩrĩri — thiga irio cia ũhoro mũnoru tu",
      reasonEn: `${rainDays} of the next 14 days show rain, but a dry gap of ${dryGap} days is forecast mid-period. The season may be establishing but is not yet confirmed.`,
      reasonSw: `Siku ${rainDays} za mvua zinatarajiwa, lakini pengo la ukame la siku ${dryGap} linatarajiwa katikati. Msimu unaweza kuanza lakini haujathibitishwa bado.`,
      reasonKi: `Matukũ ${rainDays} ma mbura nĩ matarajiwe, no ũkaugo wa matukũ ${dryGap} nĩ ũtarajiwe mũgaa. Mũaka wa mbura ũgũtwara ungĩbatĩkana no ndũrĩ na kĩgĩrĩro gĩothe.`,
      actionEn: `Plant quick-maturing varieties (60–75 days) or drought-tolerant crops. Avoid planting fruit trees or long-season maize until the season is confirmed.`,
      actionSw: `Panda aina zinazokomaa haraka (siku 60–75) au mazao yanayostahimili ukame. Epuka kupanda miti ya matunda au mahindi ya msimu mrefu hadi msimu uthibitishwe.`,
      actionKi: `Thiga ithagĩria ikũra haraka (matukũ 60–75) kana irio ithĩinaga ũkaugo. Tigĩra gũthiga mĩtĩ ya maciara kana mũthere wa gĩthĩ gĩa mũaka mũraihu nginya mũaka ũgaathibitikane.`,
    },
    caution: {
      headlineEn: "Fragmented rains — high risk of dry spell, wait",
      headlineSw: "Mvua ya vipande vipande — hatari kubwa ya ukame, subiri",
      headlineKi: "Mbura ya gatagati — hatarĩ nĩngi ya ũkaugo, rĩga",
      reasonEn: `Only ${rainDays} of the next 14 days are forecast with rain, and a dry gap of ${dryGap} days could stress or kill germinating seedlings.${season === "off-season" ? " This is not a typical rain-season month — these rains are likely temporary." : ""}`,
      reasonSw: `Ni siku ${rainDays} tu kati ya 14 zinazoonyesha mvua, na pengo la ukame la siku ${dryGap} linaweza kuharibu au kuua miche inayoota.${season === "off-season" ? " Hii si mwezi wa kawaida wa mvua — mvua hii inaweza kuisha haraka." : ""}`,
      reasonKi: `Matukũ ${rainDays} tu mũgaa wa 14 nĩ matarajiwe na mbura, na ũkaugo wa matukũ ${dryGap} ũngĩhurũkia mbegu ithiĩ ĩkiura.${season === "off-season" ? " Mweri ũyũ ndĩ wa mbura ta kawaida — mbura ino ingĩhingũka haraka." : ""}`,
      actionEn: `Hold off planting. Water any existing crops through the dry gap if possible. Watch for 5+ consecutive rain days before committing seeds.`,
      actionSw: `Subiri kupanda. Mwagilia mazao yaliyopo wakati wa ukame ikiwezekana. Angalia siku 5+ za mvua mfululizo kabla ya kupanda mbegu.`,
      actionKi: `Rĩga gũthiga. Thiria irio irĩ na rũũĩ mũthithia wa ũkaugo ũngĩhooka. Rora matukũ 5+ ma mbura ũrĩa gũtũũra nginya ũthige mbegu.`,
    },
    danger: {
      headlineEn: "False onset — do not plant, rains will likely stop",
      headlineSw: "Mvua ya uongo — usipande, mvua inaweza kuacha",
      headlineKi: "Mbura ya ũkĩa — ũtigĩre gũthiga, mbura ingĩhingũka",
      reasonEn: `Only ${rainDays} of the next 14 days are forecast with rain.${season === "off-season" ? ` ${["January", "February", "June", "July", "August", "September"][new Date().getMonth()] || "This month"} is historically dry here — this is almost certainly a temporary event.` : ` The forecast shows a ${dryGap}-day dry gap that would kill germinating seedlings.`} This pattern matches historical false onsets.`,
      reasonSw: `Ni siku ${rainDays} tu kati ya 14 zinazoonyesha mvua.${season === "off-season" ? " Mwezi huu kwa kawaida ni mkame hapa — hii ni tukio la muda tu karibu." : ` Utabiri unaonyesha pengo la ukame la siku ${dryGap} ambalo lingeua miche inayoota.`} Mfumo huu unafanana na mwanzo wa uongo wa kihistoria.`,
      reasonKi: `Matukũ ${rainDays} tu mũgaa wa 14 nĩ matarajiwe na mbura.${season === "off-season" ? " Mweri ũyũ nĩ wa ũkaugo haha kawaida — ũyũ nĩ ũhuro wa kahinda kadoko." : ` Ũtaranirio ũonania ũkaugo wa matukũ ${dryGap} ũngĩhurũkia mbegu ithiĩ ĩkiura.`} Mwĩgĩro ũyũ nĩ ũfananiria na mbura ya ũkĩa ya historia.`,
      actionEn: `Do not plant. These rains will most likely stop within days. Save your seeds and inputs for when the season properly establishes. Use this time to prepare your land.`,
      actionSw: `Usipande. Mvua hizi zinaweza kuacha ndani ya siku chache. Hifadhi mbegu zako na pembejeo kwa wakati msimu utakapoanza vizuri. Tumia wakati huu kutayarisha shamba lako.`,
      actionKi: `Ũtigĩre gũthiga. Mbura icio ingĩhingũka kahinda kadoko. Hifadhi mbegu ciaku na mahitaji nginya mũaka ũgaathibitike. Gĩthagĩria mũgũnda waku mweri ũyũ.`,
    },
  };

  return { status, ...messages[status] };
}

export async function getPlantingAdvisory(lat: number, lon: number): Promise<PlantingAdvisory> {
  const month = new Date().getMonth() + 1; // 1-indexed
  const season = getSeason(month);

  const [{ precipProbabilities, precipSums }, historicalRainRate] = await Promise.all([
    fetch14DayForecast(lat, lon),
    getHistoricalRainRate(lat, lon, month),
  ]);

  const rainDays = precipProbabilities.filter((p) => p >= 40).length;
  const dryGap = longestDryStreak(precipProbabilities);

  const advisory = buildAdvisory(rainDays, dryGap, season, historicalRainRate, precipProbabilities);

  return {
    ...advisory,
    rainDaysAhead: rainDays,
    longestDryGap: dryGap,
    historicalRainRate: historicalRainRate >= 0 ? historicalRainRate : 0,
    season,
  };
}
