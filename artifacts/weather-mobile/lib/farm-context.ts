export type FarmUiLanguage = "en" | "sw" | "ki";
export type DashboardWorkStage = "planting" | "harvesting" | "weeding" | "spraying";

export const DASHBOARD_CROPS = [
  "General",
  "Corn",
  "Beans",
  "Wheat",
  "Tomatoes",
  "Potatoes",
  "Cabbages",
  "SukumaWiki",
  "Spinach",
  "Onions",
  "Watermelons",
  "Grapes",
  "Rice",
  "Lettuce",
  "Cotton",
  "Soybeans",
  "Citrus",
  "Sunflower",
] as const;

export type DashboardCropName = (typeof DASHBOARD_CROPS)[number];

export const DASHBOARD_WORK_STAGES: DashboardWorkStage[] = [
  "planting",
  "harvesting",
  "weeding",
  "spraying",
];

const CROP_LABELS: Record<DashboardCropName, Record<FarmUiLanguage, string>> = {
  General: { en: "Any crop", sw: "Zao lolote", ki: "Zao lolote" },
  Corn: { en: "Maize", sw: "Mahindi", ki: "Mahindi" },
  Beans: { en: "Beans", sw: "Maharagwe", ki: "Maharagwe" },
  Wheat: { en: "Wheat", sw: "Ngano", ki: "Ngano" },
  Tomatoes: { en: "Tomatoes", sw: "Nyanya", ki: "Nyanya" },
  Potatoes: { en: "Potatoes", sw: "Viazi", ki: "Viazi" },
  Cabbages: { en: "Cabbages", sw: "Kabichi", ki: "Kabichi" },
  SukumaWiki: { en: "Sukuma wiki", sw: "Sukuma wiki", ki: "Sukuma wiki" },
  Spinach: { en: "Spinach", sw: "Spinachi", ki: "Spinachi" },
  Onions: { en: "Onions", sw: "Vitunguu", ki: "Vitunguu" },
  Watermelons: { en: "Watermelons", sw: "Matikiti maji", ki: "Matikiti maji" },
  Grapes: { en: "Grapes", sw: "Zabibu", ki: "Zabibu" },
  Rice: { en: "Rice", sw: "Mchele", ki: "Mchele" },
  Lettuce: { en: "Lettuce", sw: "Saladi", ki: "Saladi" },
  Cotton: { en: "Cotton", sw: "Pamba", ki: "Pamba" },
  Soybeans: { en: "Soybeans", sw: "Soya", ki: "Soya" },
  Citrus: { en: "Citrus", sw: "Machungwa", ki: "Machungwa" },
  Sunflower: { en: "Sunflower", sw: "Alizeti", ki: "Alizeti" },
};

const WORK_STAGE_LABELS: Record<DashboardWorkStage, Record<FarmUiLanguage, string>> = {
  planting: { en: "Planting", sw: "Kupanda", ki: "Kupanda" },
  harvesting: { en: "Harvesting", sw: "Kuvuna", ki: "Kuvuna" },
  weeding: { en: "Weeding", sw: "Kupalilia", ki: "Kupalilia" },
  spraying: { en: "Spraying", sw: "Kunyunyizia", ki: "Kunyunyizia" },
};

type CropFamily = "general" | "grain" | "legume" | "leafy" | "fruit" | "root" | "cash";

const CROP_FAMILIES: Partial<Record<DashboardCropName, CropFamily>> = {
  Corn: "grain",
  Wheat: "grain",
  Rice: "grain",
  Sunflower: "grain",
  Beans: "legume",
  Soybeans: "legume",
  Cabbages: "leafy",
  SukumaWiki: "leafy",
  Spinach: "leafy",
  Lettuce: "leafy",
  Tomatoes: "fruit",
  Watermelons: "fruit",
  Grapes: "fruit",
  Citrus: "fruit",
  Potatoes: "root",
  Onions: "root",
  Cotton: "cash",
};

const CROP_ALIASES: Record<string, DashboardCropName> = {
  maize: "Corn",
  corn: "Corn",
  beans: "Beans",
  wheat: "Wheat",
  tomatoes: "Tomatoes",
  tomato: "Tomatoes",
  potatoes: "Potatoes",
  potato: "Potatoes",
  cabbages: "Cabbages",
  cabbage: "Cabbages",
  sukumawiki: "SukumaWiki",
  "sukuma wiki": "SukumaWiki",
  spinach: "Spinach",
  onions: "Onions",
  onion: "Onions",
  watermelons: "Watermelons",
  watermelon: "Watermelons",
  grapes: "Grapes",
  grape: "Grapes",
  rice: "Rice",
  lettuce: "Lettuce",
  cotton: "Cotton",
  soybeans: "Soybeans",
  soybean: "Soybeans",
  citrus: "Citrus",
  sunflower: "Sunflower",
  vegetables: "General",
  tea: "General",
  coffee: "General",
  pyrethrum: "General",
};

const FAMILY_STAGE_HINTS: Record<
  CropFamily,
  Record<DashboardWorkStage, Record<FarmUiLanguage, string>>
> = {
  general: {
    planting: {
      en: "Use this rain call to judge whether the topsoil will stay moist enough after you plant.",
      sw: "Tumia uamuzi huu kuona kama juu ya udongo utabaki na unyevu wa kutosha baada ya kupanda.",
      ki: "Tumia uamuzi huu kuona kama juu ya udongo utabaki na unyevu wa kutosha baada ya kupanda.",
    },
    harvesting: {
      en: "A dry window protects harvested produce from rot, staining, and storage losses.",
      sw: "Dirisha la ukavu hulinda mazao yaliyovunwa dhidi ya kuoza na hasara za hifadhi.",
      ki: "Dirisha la ukavu hulinda mazao yaliyovunwa dhidi ya kuoza na hasara za hifadhi.",
    },
    weeding: {
      en: "Weeding is easiest when the soil surface is soft but not sticky.",
      sw: "Kupalilia huwa rahisi wakati juu ya udongo ni laini lakini si ya matope.",
      ki: "Kupalilia huwa rahisi wakati juu ya udongo ni laini lakini si ya matope.",
    },
    spraying: {
      en: "Spray works best in calm, dry hours so the product stays on the crop.",
      sw: "Kunyunyizia hufanya kazi vizuri wakati kuna utulivu na ukavu ili dawa ishike kwenye zao.",
      ki: "Kunyunyizia hufanya kazi vizuri wakati kuna utulivu na ukavu ili dawa ishike kwenye zao.",
    },
  },
  grain: {
    planting: {
      en: "Seed needs steady moisture in the topsoil for even germination.",
      sw: "Mbegu zinahitaji unyevu wa kutosha kwenye juu ya udongo ili ziote kwa usawa.",
      ki: "Mbegu zinahitaji unyevu wa kutosha kwenye juu ya udongo ili ziote kwa usawa.",
    },
    harvesting: {
      en: "Dry weather helps grain, cobs, and heads dry well before storage.",
      sw: "Hali kavu husaidia nafaka na mahindi kukauka vizuri kabla ya kuhifadhi.",
      ki: "Hali kavu husaidia nafaka na mahindi kukauka vizuri kabla ya kuhifadhi.",
    },
    weeding: {
      en: "Early weeding protects yield most when rows are still opening up.",
      sw: "Kupalilia mapema hulinda mazao zaidi wakati mistari bado inafunguka.",
      ki: "Kupalilia mapema hulinda mazao zaidi wakati mistari bado inafunguka.",
    },
    spraying: {
      en: "Dry, calmer air improves spray sticking and reduces waste on cereals.",
      sw: "Hewa tulivu na ukavu huruhusu dawa kushika vizuri na kupunguza upotevu kwenye nafaka.",
      ki: "Hewa tulivu na ukavu huruhusu dawa kushika vizuri na kupunguza upotevu kwenye nafaka.",
    },
  },
  legume: {
    planting: {
      en: "Legume seed starts best when the seedbed stays evenly moist for the first days.",
      sw: "Mbegu za jamii ya kunde huanza vizuri kitanda cha mbegu kikibaki na unyevu sawa siku za mwanzo.",
      ki: "Mbegu za jamii ya kunde huanza vizuri kitanda cha mbegu kikibaki na unyevu sawa siku za mwanzo.",
    },
    harvesting: {
      en: "Harvesting in a dry window helps pods and seed stay clean and reduces mould risk.",
      sw: "Kuvuna wakati wa ukavu husaidia maganda na mbegu kubaki safi na hupunguza ukungu.",
      ki: "Kuvuna wakati wa ukavu husaidia maganda na mbegu kubaki safi na hupunguza ukungu.",
    },
    weeding: {
      en: "Keep weeds down early so beans and soybeans do not lose moisture and light.",
      sw: "Punguza magugu mapema ili maharagwe na soya yasipoteze unyevu na mwanga.",
      ki: "Punguza magugu mapema ili maharagwe na soya yasipoteze unyevu na mwanga.",
    },
    spraying: {
      en: "Spray in a dry, calm spell so leaves dry quickly and disease control holds.",
      sw: "Nyunyizia wakati wa ukavu na utulivu ili majani yakauke haraka na kinga ya magonjwa ishike.",
      ki: "Nyunyizia wakati wa ukavu na utulivu ili majani yakauke haraka na kinga ya magonjwa ishike.",
    },
  },
  leafy: {
    planting: {
      en: "Leafy crops start best in cool, moist soil without standing water.",
      sw: "Mboga za majani huanza vizuri kwenye udongo wenye unyevu wa kutosha bila maji kusimama.",
      ki: "Mboga za majani huanza vizuri kwenye udongo wenye unyevu wa kutosha bila maji kusimama.",
    },
    harvesting: {
      en: "Harvest leafy crops in a dry window to keep them fresh and reduce spoilage.",
      sw: "Vuna mboga za majani wakati wa ukavu ili zibaki safi na zisiharibike haraka.",
      ki: "Vuna mboga za majani wakati wa ukavu ili zibaki safi na zisiharibike haraka.",
    },
    weeding: {
      en: "Leafy vegetables lose speed fast when weeds compete for moisture and nutrients.",
      sw: "Mboga za majani hupungua kasi haraka magugu yakishindania unyevu na virutubisho.",
      ki: "Mboga za majani hupungua kasi haraka magugu yakishindania unyevu na virutubisho.",
    },
    spraying: {
      en: "Spray only when leaves can dry quickly so disease pressure does not rise.",
      sw: "Nyunyizia tu wakati majani yanaweza kukauka haraka ili shinikizo la magonjwa lisipande.",
      ki: "Nyunyizia tu wakati majani yanaweza kukauka haraka ili shinikizo la magonjwa lisipande.",
    },
  },
  fruit: {
    planting: {
      en: "Fruit crops need a moist start, but waterlogging can quickly damage young roots.",
      sw: "Mazao ya matunda yanahitaji mwanzo wenye unyevu, lakini maji mengi yanaweza kuharibu mizizi michanga.",
      ki: "Mazao ya matunda yanahitaji mwanzo wenye unyevu, lakini maji mengi yanaweza kuharibu mizizi michanga.",
    },
    harvesting: {
      en: "Dry harvest weather protects fruit quality, colour, and shelf life.",
      sw: "Hali kavu wakati wa kuvuna hulinda ubora, rangi, na muda wa kuhifadhi wa matunda.",
      ki: "Hali kavu wakati wa kuvuna hulinda ubora, rangi, na muda wa kuhifadhi wa matunda.",
    },
    weeding: {
      en: "Keep weeds down so fruit crops do not lose water and nutrients during filling.",
      sw: "Punguza magugu ili mazao ya matunda yasipoteze maji na virutubisho wakati wa kujaza.",
      ki: "Punguza magugu ili mazao ya matunda yasipoteze maji na virutubisho wakati wa kujaza.",
    },
    spraying: {
      en: "Fruit sprays hold best in calm weather when rain will not wash them off.",
      sw: "Dawa za matunda hushika vizuri zaidi wakati kuna utulivu na hakuna mvua ya kuosha.",
      ki: "Dawa za matunda hushika vizuri zaidi wakati kuna utulivu na hakuna mvua ya kuosha.",
    },
  },
  root: {
    planting: {
      en: "Root and bulb crops need moisture to establish, but soggy seedbeds can cause losses.",
      sw: "Mazao ya mizizi na vitunguu yanahitaji unyevu kuanza, lakini matope mengi huweza kuleta hasara.",
      ki: "Mazao ya mizizi na vitunguu yanahitaji unyevu kuanza, lakini matope mengi huweza kuleta hasara.",
    },
    harvesting: {
      en: "Lift roots and bulbs in a dry spell so skins cure better and storage lasts longer.",
      sw: "Ng'oa mizizi na vitunguu wakati wa ukavu ili ngozi zikauke vizuri na uhifadhi udumu zaidi.",
      ki: "Ng'oa mizizi na vitunguu wakati wa ukavu ili ngozi zikauke vizuri na uhifadhi udumu zaidi.",
    },
    weeding: {
      en: "Weed before the canopy closes so roots and bulbs do not lose space and nutrients.",
      sw: "Palilia kabla ya mazao kufunga nafasi ili mizizi na vitunguu visipoteze nafasi na virutubisho.",
      ki: "Palilia kabla ya mazao kufunga nafasi ili mizizi na vitunguu visipoteze nafasi na virutubisho.",
    },
    spraying: {
      en: "Choose a calm, dry period so sprays reach the crop instead of drifting away.",
      sw: "Chagua kipindi tulivu na kikavu ili dawa ifike kwenye zao badala ya kupeperuka.",
      ki: "Chagua kipindi tulivu na kikavu ili dawa ifike kwenye zao badala ya kupeperuka.",
    },
  },
  cash: {
    planting: {
      en: "Cash crops need a reliable start, so avoid planting into a weak rain signal.",
      sw: "Mazao ya biashara yanahitaji mwanzo wa kuaminika, kwa hivyo epuka kupanda kwenye ishara dhaifu ya mvua.",
      ki: "Mazao ya biashara yanahitaji mwanzo wa kuaminika, kwa hivyo epuka kupanda kwenye ishara dhaifu ya mvua.",
    },
    harvesting: {
      en: "Dry harvest conditions protect grade and reduce post-harvest losses.",
      sw: "Hali kavu ya kuvuna hulinda daraja la zao na hupunguza hasara baada ya kuvuna.",
      ki: "Hali kavu ya kuvuna hulinda daraja la zao na hupunguza hasara baada ya kuvuna.",
    },
    weeding: {
      en: "Keep the field clean early so the crop keeps feeding strongly.",
      sw: "Weka shamba safi mapema ili zao liendelee kujilisha vizuri.",
      ki: "Weka shamba safi mapema ili zao liendelee kujilisha vizuri.",
    },
    spraying: {
      en: "Time spray carefully because washed-off spray wastes money and weakens control.",
      sw: "Panga dawa kwa uangalifu kwa sababu dawa kuoshwa na mvua hupoteza pesa na hupunguza udhibiti.",
      ki: "Panga dawa kwa uangalifu kwa sababu dawa kuoshwa na mvua hupoteza pesa na hupunguza udhibiti.",
    },
  },
};

export function getDashboardCropLabel(crop: string, language: FarmUiLanguage): string {
  return CROP_LABELS[(normalizeCropName(crop) ?? "General")][language];
}

export function getDashboardWorkStageLabel(stage: DashboardWorkStage, language: FarmUiLanguage): string {
  return WORK_STAGE_LABELS[stage][language];
}

export function normalizeCropName(value?: string | null): DashboardCropName | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const directMatch = DASHBOARD_CROPS.find((crop) => crop === trimmed);
  if (directMatch) {
    return directMatch;
  }

  return CROP_ALIASES[trimmed.toLowerCase()] ?? null;
}

export function summarizeDashboardCrops(crops: string[], language: FarmUiLanguage): string {
  const normalized = crops
    .map((crop) => normalizeCropName(crop) ?? "General")
    .filter((crop, index, source) => source.indexOf(crop) === index);

  if (normalized.length === 0) {
    return CROP_LABELS.General[language];
  }

  if (normalized.length === 1) {
    return CROP_LABELS[normalized[0]][language];
  }

  if (normalized.length === 2) {
    return `${CROP_LABELS[normalized[0]][language]} ${
      language === "sw" ? "na" : "and"
    } ${CROP_LABELS[normalized[1]][language]}`;
  }

  const firstTwo = normalized.slice(0, 2).map((crop) => CROP_LABELS[crop][language]).join(", ");
  const extraCount = normalized.length - 2;
  return language === "sw"
    ? `${firstTwo} na mengine ${extraCount}`
    : `${firstTwo} and ${extraCount} more`;
}

function getPrimaryFamily(crops: string[]): CropFamily {
  const normalized = crops.map((crop) => normalizeCropName(crop)).filter(Boolean) as DashboardCropName[];
  const primary = normalized.find((crop) => crop !== "General");
  if (!primary) {
    return "general";
  }

  return CROP_FAMILIES[primary] ?? "general";
}

export function getCropStageHint(
  crops: string[],
  stage: DashboardWorkStage,
  language: FarmUiLanguage,
): string {
  const family = getPrimaryFamily(crops);
  return FAMILY_STAGE_HINTS[family][stage][language];
}
