export interface KenyaTown {
  name: string;
  lat: number;
  lon: number;
}

export interface KenyaSubCounty {
  name: string;
  lat: number;
  lon: number;
  towns: KenyaTown[];
}

export interface KenyaCounty {
  id: number;
  name: string;
  region: string;
  lat: number;
  lon: number;
  subCounties: KenyaSubCounty[];
}

export const KENYA_COUNTIES: KenyaCounty[] = [
  // ── COAST ──────────────────────────────────────────────────────────────
  {
    id: 1, name: "Mombasa", region: "Coast", lat: -4.0435, lon: 39.6682,
    subCounties: [
      { name: "Mvita", lat: -4.0561, lon: 39.6617, towns: [
        { name: "Mvita Town", lat: -4.0561, lon: 39.6617 },
        { name: "Tudor", lat: -4.0368, lon: 39.6693 },
        { name: "Tononoka", lat: -4.0530, lon: 39.6553 },
        { name: "Shimanzi/Ganjoni", lat: -4.0490, lon: 39.6629 },
      ]},
      { name: "Nyali", lat: -3.9973, lon: 39.7198, towns: [
        { name: "Nyali", lat: -3.9973, lon: 39.7198 },
        { name: "Frere Town", lat: -4.0150, lon: 39.7098 },
        { name: "Ziwa la Ng'ombe", lat: -3.9850, lon: 39.7150 },
        { name: "Kongowea", lat: -3.9800, lon: 39.7300 },
      ]},
      { name: "Kisauni", lat: -3.9600, lon: 39.7000, towns: [
        { name: "Kisauni", lat: -3.9600, lon: 39.7000 },
        { name: "Mjambere", lat: -3.9700, lon: 39.6900 },
        { name: "Jomvu Kuu", lat: -3.9700, lon: 39.7200 },
        { name: "Bamburi", lat: -3.9450, lon: 39.7310 },
      ]},
      { name: "Likoni", lat: -4.0870, lon: 39.6600, towns: [
        { name: "Likoni", lat: -4.0870, lon: 39.6600 },
        { name: "Shika Adabu", lat: -4.0750, lon: 39.6670 },
        { name: "Bofu", lat: -4.0950, lon: 39.6530 },
        { name: "Mtongwe", lat: -4.0820, lon: 39.6450 },
      ]},
      { name: "Changamwe", lat: -4.0250, lon: 39.6350, towns: [
        { name: "Port Reitz", lat: -4.0350, lon: 39.6250 },
        { name: "Kipevu", lat: -4.0420, lon: 39.6290 },
        { name: "Airport", lat: -4.0347, lon: 39.5943 },
        { name: "Changamwe", lat: -4.0200, lon: 39.6380 },
      ]},
    ],
  },
  {
    id: 2, name: "Kwale", region: "Coast", lat: -4.1735, lon: 39.4527,
    subCounties: [
      { name: "Msambweni", lat: -4.4695, lon: 39.4836, towns: [
        { name: "Msambweni", lat: -4.4695, lon: 39.4836 },
        { name: "Gazi", lat: -4.4300, lon: 39.5100 },
        { name: "Ukunda", lat: -4.2900, lon: 39.5700 },
        { name: "Diani", lat: -4.3350, lon: 39.5740 },
      ]},
      { name: "Matuga", lat: -4.1735, lon: 39.4527, towns: [
        { name: "Kwale Town", lat: -4.1735, lon: 39.4527 },
        { name: "Shimba Hills", lat: -4.2330, lon: 39.4130 },
        { name: "Kinango", lat: -4.1370, lon: 39.3190 },
      ]},
      { name: "Lungalunga", lat: -4.5539, lon: 39.1036, towns: [
        { name: "Lungalunga", lat: -4.5539, lon: 39.1036 },
        { name: "Shimoni", lat: -4.6450, lon: 39.3810 },
        { name: "Vanga", lat: -4.6520, lon: 39.2060 },
      ]},
      { name: "Kinango", lat: -4.1370, lon: 39.3190, towns: [
        { name: "Kinango", lat: -4.1370, lon: 39.3190 },
        { name: "Samburu", lat: -4.2200, lon: 39.1800 },
        { name: "Mackinnon Road", lat: -3.7419, lon: 39.0514 },
      ]},
    ],
  },
  {
    id: 3, name: "Kilifi", region: "Coast", lat: -3.5107, lon: 39.9093,
    subCounties: [
      { name: "Kilifi North", lat: -3.4000, lon: 39.8500, towns: [
        { name: "Kilifi Town", lat: -3.5107, lon: 39.9093 },
        { name: "Malindi", lat: -3.2175, lon: 40.1169 },
        { name: "Watamu", lat: -3.3667, lon: 40.0167 },
      ]},
      { name: "Kilifi South", lat: -3.6300, lon: 39.8500, towns: [
        { name: "Mariakani", lat: -3.8600, lon: 39.7600 },
        { name: "Kaloleni", lat: -3.7831, lon: 39.8486 },
        { name: "Rabai", lat: -3.9178, lon: 39.7843 },
      ]},
      { name: "Ganze", lat: -3.0667, lon: 39.5167, towns: [
        { name: "Ganze", lat: -3.0667, lon: 39.5167 },
        { name: "Bamba", lat: -3.2667, lon: 39.5167 },
      ]},
      { name: "Magarini", lat: -3.0333, lon: 40.0000, towns: [
        { name: "Magarini", lat: -3.0333, lon: 40.0000 },
        { name: "Mambrui", lat: -3.1000, lon: 40.1333 },
        { name: "Marafa", lat: -3.0667, lon: 39.9167 },
      ]},
      { name: "Malindi", lat: -3.2175, lon: 40.1169, towns: [
        { name: "Malindi Town", lat: -3.2175, lon: 40.1169 },
        { name: "Shella", lat: -3.1000, lon: 40.1167 },
        { name: "Mtangani", lat: -3.2333, lon: 40.0667 },
      ]},
    ],
  },
  {
    id: 4, name: "Tana River", region: "Coast", lat: -1.4879, lon: 40.0673,
    subCounties: [
      { name: "Garsen", lat: -2.2700, lon: 40.1200, towns: [
        { name: "Garsen", lat: -2.2700, lon: 40.1200 },
        { name: "Wema", lat: -2.1000, lon: 40.3500 },
        { name: "Kipini", lat: -2.5333, lon: 40.5167 },
      ]},
      { name: "Galole", lat: -1.4879, lon: 40.0673, towns: [
        { name: "Hola", lat: -1.4879, lon: 40.0673 },
        { name: "Madogo", lat: -1.2000, lon: 40.1000 },
      ]},
      { name: "Bura", lat: -1.1000, lon: 39.9500, towns: [
        { name: "Bura", lat: -1.1000, lon: 39.9500 },
        { name: "Bangale", lat: -1.0500, lon: 40.0000 },
      ]},
    ],
  },
  {
    id: 5, name: "Lamu", region: "Coast", lat: -2.2686, lon: 40.9020,
    subCounties: [
      { name: "Lamu East", lat: -2.2686, lon: 40.9020, towns: [
        { name: "Lamu Town", lat: -2.2686, lon: 40.9020 },
        { name: "Shela", lat: -2.2900, lon: 40.9183 },
        { name: "Matondoni", lat: -2.2500, lon: 40.8667 },
      ]},
      { name: "Lamu West", lat: -2.0167, lon: 40.9500, towns: [
        { name: "Mokowe", lat: -2.1167, lon: 40.9000 },
        { name: "Hindi", lat: -2.1167, lon: 40.9167 },
        { name: "Mpeketoni", lat: -2.0000, lon: 40.9167 },
        { name: "Witu", lat: -2.3833, lon: 40.4333 },
      ]},
    ],
  },
  {
    id: 6, name: "Taita-Taveta", region: "Coast", lat: -3.4057, lon: 38.5776,
    subCounties: [
      { name: "Voi", lat: -3.3967, lon: 38.5560, towns: [
        { name: "Voi Town", lat: -3.3967, lon: 38.5560 },
        { name: "Mwatate", lat: -3.5040, lon: 38.3770 },
        { name: "Bura", lat: -3.4500, lon: 38.5000 },
      ]},
      { name: "Taveta", lat: -3.3989, lon: 37.6763, towns: [
        { name: "Taveta", lat: -3.3989, lon: 37.6763 },
        { name: "Holili", lat: -3.4167, lon: 37.6833 },
        { name: "Njukini", lat: -3.4500, lon: 37.7167 },
      ]},
      { name: "Wundanyi", lat: -3.3964, lon: 38.3573, towns: [
        { name: "Wundanyi", lat: -3.3964, lon: 38.3573 },
        { name: "Ngerenyi", lat: -3.4000, lon: 38.3333 },
        { name: "Werugha", lat: -3.4500, lon: 38.3333 },
      ]},
      { name: "Mwatate", lat: -3.5040, lon: 38.3770, towns: [
        { name: "Mwatate", lat: -3.5040, lon: 38.3770 },
        { name: "Mlolongo", lat: -3.4833, lon: 38.3333 },
        { name: "Kishamba", lat: -3.5000, lon: 38.2500 },
      ]},
    ],
  },
  // ── NORTH EASTERN ─────────────────────────────────────────────────────
  {
    id: 7, name: "Garissa", region: "North Eastern", lat: -0.4532, lon: 39.6463,
    subCounties: [
      { name: "Garissa Township", lat: -0.4532, lon: 39.6463, towns: [
        { name: "Garissa Town", lat: -0.4532, lon: 39.6463 },
        { name: "Iftin", lat: -0.4400, lon: 39.6600 },
        { name: "Galbet", lat: -0.4700, lon: 39.6300 },
      ]},
      { name: "Fafi", lat: -0.8000, lon: 40.2000, towns: [
        { name: "Bura", lat: -0.8000, lon: 40.2000 },
        { name: "Nanighi", lat: -0.7500, lon: 40.1500 },
      ]},
      { name: "Ijara", lat: -1.5500, lon: 40.5000, towns: [
        { name: "Ijara", lat: -1.5500, lon: 40.5000 },
        { name: "Sangailu", lat: -1.4000, lon: 40.5500 },
      ]},
      { name: "Lagdera", lat: -0.2000, lon: 40.5000, towns: [
        { name: "Modogashe", lat: -0.2000, lon: 40.5000 },
        { name: "Kotile", lat: -0.3000, lon: 40.4000 },
      ]},
    ],
  },
  {
    id: 8, name: "Wajir", region: "North Eastern", lat: 1.7469, lon: 40.0572,
    subCounties: [
      { name: "Wajir North", lat: 2.5000, lon: 40.0000, towns: [
        { name: "Bute", lat: 2.5000, lon: 40.0000 },
        { name: "Gurar", lat: 2.3000, lon: 40.1000 },
      ]},
      { name: "Wajir East", lat: 1.7469, lon: 40.0572, towns: [
        { name: "Wajir Town", lat: 1.7469, lon: 40.0572 },
        { name: "Habaswein", lat: 1.0167, lon: 39.5000 },
      ]},
      { name: "Wajir South", lat: 1.2000, lon: 40.3000, towns: [
        { name: "Griftu", lat: 1.2000, lon: 40.3000 },
        { name: "Tarbaj", lat: 1.7167, lon: 40.8333 },
      ]},
      { name: "Wajir West", lat: 1.7000, lon: 39.5000, towns: [
        { name: "Eldas", lat: 1.7000, lon: 39.5000 },
        { name: "Kutulo", lat: 1.8000, lon: 39.4000 },
      ]},
    ],
  },
  {
    id: 9, name: "Mandera", region: "North Eastern", lat: 3.9374, lon: 41.8569,
    subCounties: [
      { name: "Mandera East", lat: 3.9374, lon: 41.8569, towns: [
        { name: "Mandera Town", lat: 3.9374, lon: 41.8569 },
        { name: "Township", lat: 3.9400, lon: 41.8600 },
      ]},
      { name: "Mandera West", lat: 3.5000, lon: 41.2000, towns: [
        { name: "Takaba", lat: 3.5000, lon: 41.2000 },
        { name: "Moyale", lat: 3.5233, lon: 39.0533 },
      ]},
      { name: "Mandera North", lat: 4.1167, lon: 41.9000, towns: [
        { name: "Rhamu", lat: 4.1167, lon: 41.9000 },
        { name: "Dandu", lat: 4.0000, lon: 41.7000 },
      ]},
      { name: "Mandera South", lat: 3.5000, lon: 41.8500, towns: [
        { name: "Elwak", lat: 3.5000, lon: 41.8500 },
        { name: "Leheley", lat: 3.7000, lon: 41.5000 },
      ]},
    ],
  },
  // ── EASTERN ───────────────────────────────────────────────────────────
  {
    id: 10, name: "Marsabit", region: "Eastern", lat: 2.3284, lon: 37.9897,
    subCounties: [
      { name: "Marsabit Central", lat: 2.3284, lon: 37.9897, towns: [
        { name: "Marsabit Town", lat: 2.3284, lon: 37.9897 },
        { name: "Songa", lat: 2.3000, lon: 37.9500 },
        { name: "Sagante", lat: 2.3500, lon: 38.0500 },
      ]},
      { name: "Moyale", lat: 3.5233, lon: 39.0533, towns: [
        { name: "Moyale Town", lat: 3.5233, lon: 39.0533 },
        { name: "Butiye", lat: 3.4500, lon: 38.9500 },
        { name: "Sololo", lat: 3.3500, lon: 38.7667 },
      ]},
      { name: "North Horr", lat: 3.3267, lon: 37.0647, towns: [
        { name: "North Horr", lat: 3.3267, lon: 37.0647 },
        { name: "Maikona", lat: 2.8333, lon: 37.6000 },
        { name: "Turbi", lat: 2.9333, lon: 37.6667 },
      ]},
      { name: "Saku", lat: 2.3000, lon: 38.0000, towns: [
        { name: "Karare", lat: 2.3500, lon: 37.9667 },
        { name: "Badasa", lat: 2.2667, lon: 37.9833 },
      ]},
    ],
  },
  {
    id: 11, name: "Isiolo", region: "Eastern", lat: 0.3535, lon: 37.5820,
    subCounties: [
      { name: "Isiolo North", lat: 0.3535, lon: 37.5820, towns: [
        { name: "Isiolo Town", lat: 0.3535, lon: 37.5820 },
        { name: "Wabera", lat: 0.3600, lon: 37.5900 },
        { name: "Bulla Pesa", lat: 0.3700, lon: 37.6000 },
        { name: "Ngare Mara", lat: 0.4000, lon: 37.6500 },
      ]},
      { name: "Isiolo South", lat: 0.0000, lon: 38.0000, towns: [
        { name: "Merti", lat: 1.0833, lon: 38.1167 },
        { name: "Garbatulla", lat: 0.4333, lon: 38.5333 },
        { name: "Kinna", lat: 0.1500, lon: 38.2000 },
      ]},
    ],
  },
  {
    id: 12, name: "Meru", region: "Eastern", lat: 0.0500, lon: 37.6496,
    subCounties: [
      { name: "Imenti North", lat: 0.0500, lon: 37.6496, towns: [
        { name: "Meru Town", lat: 0.0500, lon: 37.6496 },
        { name: "Nkubu", lat: -0.1167, lon: 37.6000 },
        { name: "Githongo", lat: 0.0667, lon: 37.7000 },
        { name: "Timau", lat: 0.0833, lon: 37.2667 },
      ]},
      { name: "Imenti South", lat: -0.1200, lon: 37.6200, towns: [
        { name: "Nchiru", lat: -0.0500, lon: 37.6333 },
        { name: "Kiirua", lat: -0.1500, lon: 37.6833 },
        { name: "Igoji", lat: -0.1667, lon: 37.7167 },
      ]},
      { name: "Buuri", lat: 0.2000, lon: 37.3500, towns: [
        { name: "Timau", lat: 0.0833, lon: 37.2667 },
        { name: "Nanyuki (border)", lat: 0.0167, lon: 37.0833 },
        { name: "Buuri", lat: 0.2000, lon: 37.4000 },
      ]},
      { name: "Tigania East", lat: 0.3167, lon: 37.9333, towns: [
        { name: "Kangeta", lat: 0.2667, lon: 37.9667 },
        { name: "Maua", lat: 0.2333, lon: 37.9500 },
        { name: "Mikinduri", lat: 0.3333, lon: 37.8333 },
      ]},
      { name: "Tigania West", lat: 0.2000, lon: 37.8000, towns: [
        { name: "Muthara", lat: 0.1833, lon: 37.7833 },
        { name: "Kianjai", lat: 0.2000, lon: 37.8500 },
      ]},
      { name: "Igembe South", lat: 0.3833, lon: 37.9667, towns: [
        { name: "Maua", lat: 0.2333, lon: 37.9500 },
        { name: "Mutuati", lat: 0.3667, lon: 37.9500 },
      ]},
      { name: "Igembe North", lat: 0.4500, lon: 38.0833, towns: [
        { name: "Amwathi", lat: 0.4167, lon: 38.0833 },
        { name: "Laare", lat: 0.3833, lon: 38.0500 },
      ]},
    ],
  },
  {
    id: 13, name: "Tharaka-Nithi", region: "Eastern", lat: -0.2980, lon: 37.8786,
    subCounties: [
      { name: "Tharaka North", lat: -0.1000, lon: 37.9500, towns: [
        { name: "Marimanti", lat: -0.1000, lon: 37.9500 },
        { name: "Nkondi", lat: -0.0667, lon: 38.0167 },
      ]},
      { name: "Tharaka South", lat: -0.3000, lon: 37.9000, towns: [
        { name: "Gatunga", lat: -0.3000, lon: 37.9000 },
        { name: "Mukothima", lat: -0.3167, lon: 37.8833 },
      ]},
      { name: "Chuka/Igambang'ombe", lat: -0.3100, lon: 37.6500, towns: [
        { name: "Chuka Town", lat: -0.3100, lon: 37.6500 },
        { name: "Igoji", lat: -0.2167, lon: 37.7167 },
        { name: "Ishiara", lat: -0.3833, lon: 37.7500 },
      ]},
      { name: "Maara", lat: -0.4000, lon: 37.7000, towns: [
        { name: "Nchini", lat: -0.3667, lon: 37.7333 },
        { name: "Tunyai", lat: -0.4167, lon: 37.7167 },
        { name: "Kibiri", lat: -0.4500, lon: 37.7500 },
      ]},
    ],
  },
  {
    id: 14, name: "Embu", region: "Eastern", lat: -0.5310, lon: 37.4500,
    subCounties: [
      { name: "Embu East", lat: -0.5310, lon: 37.4500, towns: [
        { name: "Embu Town", lat: -0.5310, lon: 37.4500 },
        { name: "Kiritiri", lat: -0.5000, lon: 37.5833 },
        { name: "Ena", lat: -0.5833, lon: 37.5500 },
      ]},
      { name: "Embu West", lat: -0.4833, lon: 37.4000, towns: [
        { name: "Kavutiri", lat: -0.4833, lon: 37.4000 },
        { name: "Ruguru", lat: -0.5167, lon: 37.3833 },
      ]},
      { name: "Manyatta", lat: -0.5500, lon: 37.4667, towns: [
        { name: "Manyatta", lat: -0.5500, lon: 37.4667 },
        { name: "Mbeti North", lat: -0.5333, lon: 37.5000 },
      ]},
      { name: "Runyenjes", lat: -0.5667, lon: 37.5833, towns: [
        { name: "Runyenjes", lat: -0.5667, lon: 37.5833 },
        { name: "Kagaari North", lat: -0.5500, lon: 37.6000 },
        { name: "Kagaari South", lat: -0.5833, lon: 37.6167 },
      ]},
    ],
  },
  {
    id: 15, name: "Kitui", region: "Eastern", lat: -1.3761, lon: 38.0125,
    subCounties: [
      { name: "Kitui Central", lat: -1.3761, lon: 38.0125, towns: [
        { name: "Kitui Town", lat: -1.3761, lon: 38.0125 },
        { name: "Miambani", lat: -1.3833, lon: 38.0500 },
        { name: "Township", lat: -1.3700, lon: 38.0000 },
      ]},
      { name: "Kitui South", lat: -2.2000, lon: 38.2000, towns: [
        { name: "Mutomo", lat: -1.8333, lon: 38.2000 },
        { name: "Ikutha", lat: -2.2000, lon: 38.2000 },
        { name: "Nguumo", lat: -2.0000, lon: 38.1500 },
      ]},
      { name: "Kitui Rural", lat: -1.5000, lon: 38.1000, towns: [
        { name: "Matinyani", lat: -1.5000, lon: 38.1000 },
        { name: "Kwa Vonza/Yatta", lat: -1.5500, lon: 38.0000 },
      ]},
      { name: "Kitui West", lat: -1.3000, lon: 37.7000, towns: [
        { name: "Mwingi", lat: -1.0250, lon: 38.0568 },
        { name: "Nguni", lat: -1.3000, lon: 37.7500 },
      ]},
      { name: "Mwingi North", lat: -0.9000, lon: 38.1000, towns: [
        { name: "Mwingi Town", lat: -1.0250, lon: 38.0568 },
        { name: "Tseikuru", lat: -0.8500, lon: 38.3500 },
      ]},
      { name: "Mwingi Central", lat: -1.0500, lon: 38.0500, towns: [
        { name: "Mwingi", lat: -1.0250, lon: 38.0568 },
        { name: "Kyuso", lat: -0.9500, lon: 38.2667 },
        { name: "Mumoni", lat: -0.9167, lon: 37.9167 },
      ]},
    ],
  },
  {
    id: 16, name: "Machakos", region: "Eastern", lat: -1.5177, lon: 37.2634,
    subCounties: [
      { name: "Machakos Town", lat: -1.5177, lon: 37.2634, towns: [
        { name: "Machakos Town", lat: -1.5177, lon: 37.2634 },
        { name: "Muvuti", lat: -1.5000, lon: 37.2500 },
        { name: "Kalama", lat: -1.5500, lon: 37.2833 },
        { name: "Athi River", lat: -1.4550, lon: 36.9779 },
      ]},
      { name: "Kathiani", lat: -1.4500, lon: 37.3500, towns: [
        { name: "Kathiani", lat: -1.4500, lon: 37.3500 },
        { name: "Mitaboni", lat: -1.4167, lon: 37.4167 },
        { name: "Upper Kaewa", lat: -1.4833, lon: 37.3833 },
      ]},
      { name: "Mavoko", lat: -1.4550, lon: 36.9779, towns: [
        { name: "Athi River", lat: -1.4550, lon: 36.9779 },
        { name: "Mlolongo", lat: -1.3667, lon: 36.9500 },
        { name: "Syokimau", lat: -1.3500, lon: 36.9667 },
      ]},
      { name: "Yatta", lat: -1.1500, lon: 37.5000, towns: [
        { name: "Yatta", lat: -1.1500, lon: 37.5000 },
        { name: "Matuu", lat: -1.2833, lon: 37.4167 },
        { name: "Ikombe", lat: -1.1000, lon: 37.7500 },
      ]},
      { name: "Masinga", lat: -1.2333, lon: 37.7833, towns: [
        { name: "Masinga", lat: -1.2333, lon: 37.7833 },
        { name: "Ekalakala", lat: -1.1833, lon: 37.8167 },
      ]},
    ],
  },
  {
    id: 17, name: "Makueni", region: "Eastern", lat: -1.8036, lon: 37.6244,
    subCounties: [
      { name: "Makueni", lat: -1.8036, lon: 37.6244, towns: [
        { name: "Wote", lat: -1.7868, lon: 37.6353 },
        { name: "Makueni Town", lat: -1.8036, lon: 37.6244 },
        { name: "Nunguni", lat: -1.8333, lon: 37.5833 },
      ]},
      { name: "Kibwezi West", lat: -2.4167, lon: 37.9833, towns: [
        { name: "Kibwezi", lat: -2.4167, lon: 37.9833 },
        { name: "Makindu", lat: -2.2767, lon: 37.8317 },
        { name: "Sultan Hamud", lat: -2.0333, lon: 37.7167 },
      ]},
      { name: "Kibwezi East", lat: -2.5000, lon: 38.1500, towns: [
        { name: "Mtito Andei", lat: -2.6831, lon: 38.1740 },
        { name: "Kambu", lat: -2.5500, lon: 38.0833 },
      ]},
      { name: "Kaiti", lat: -1.6500, lon: 37.5000, towns: [
        { name: "Tawa", lat: -1.6167, lon: 37.4667 },
        { name: "Kilungu", lat: -1.7000, lon: 37.3833 },
      ]},
      { name: "Mbooni", lat: -1.6500, lon: 37.5500, towns: [
        { name: "Mbooni", lat: -1.6500, lon: 37.5500 },
        { name: "Tulimani", lat: -1.7000, lon: 37.5167 },
        { name: "Kathonzweni", lat: -1.7500, lon: 37.6333 },
      ]},
    ],
  },
  // ── CENTRAL ───────────────────────────────────────────────────────────
  {
    id: 18, name: "Nyandarua", region: "Central", lat: -0.1800, lon: 36.3672,
    subCounties: [
      { name: "Ol Kalou", lat: -0.2667, lon: 36.3833, towns: [
        { name: "Ol Kalou", lat: -0.2667, lon: 36.3833 },
        { name: "Mirangine", lat: -0.3167, lon: 36.2667 },
      ]},
      { name: "Kinangop", lat: -0.6167, lon: 36.6167, towns: [
        { name: "Engineer", lat: -0.6167, lon: 36.6167 },
        { name: "Njabini", lat: -0.6833, lon: 36.6500 },
        { name: "North Kinangop", lat: -0.5333, lon: 36.6167 },
      ]},
      { name: "Kipipiri", lat: -0.2000, lon: 36.4500, towns: [
        { name: "Kipipiri", lat: -0.2000, lon: 36.4500 },
        { name: "Wanjohi", lat: -0.3500, lon: 36.5333 },
      ]},
      { name: "Ndaragwa", lat: 0.1333, lon: 36.7167, towns: [
        { name: "Ndaragwa", lat: 0.1333, lon: 36.7167 },
        { name: "Shamata", lat: 0.0333, lon: 36.7167 },
      ]},
      { name: "Ol Joro Orok", lat: -0.0167, lon: 36.5667, towns: [
        { name: "Ol Joro Orok", lat: -0.0167, lon: 36.5667 },
        { name: "Gathanji", lat: -0.0833, lon: 36.5833 },
      ]},
    ],
  },
  {
    id: 19, name: "Nyeri", region: "Central", lat: -0.4203, lon: 36.9478,
    subCounties: [
      { name: "Nyeri Town", lat: -0.4203, lon: 36.9478, towns: [
        { name: "Nyeri Town", lat: -0.4203, lon: 36.9478 },
        { name: "Ruring'u", lat: -0.4500, lon: 36.9333 },
        { name: "Gatitu/Muruguru", lat: -0.4000, lon: 36.9667 },
        { name: "Kiganjo", lat: -0.5167, lon: 36.9833 },
      ]},
      { name: "Mathira East", lat: -0.2667, lon: 37.0500, towns: [
        { name: "Karatina", lat: -0.4843, lon: 37.1309 },
        { name: "Mukurweini", lat: -0.5333, lon: 37.0833 },
      ]},
      { name: "Mathira West", lat: -0.2833, lon: 36.9833, towns: [
        { name: "Chaka", lat: -0.2833, lon: 36.9833 },
        { name: "Mahiga", lat: -0.2333, lon: 37.0000 },
      ]},
      { name: "Tetu", lat: -0.4833, lon: 36.7333, towns: [
        { name: "Wamagana", lat: -0.4833, lon: 36.7333 },
        { name: "Dedan Kimathi University", lat: -0.4667, lon: 36.7500 },
      ]},
      { name: "Kieni East", lat: -0.1667, lon: 37.0500, towns: [
        { name: "Mweiga", lat: -0.2167, lon: 37.0167 },
        { name: "Naro Moru", lat: -0.1833, lon: 37.0333 },
        { name: "Muthengari", lat: -0.1333, lon: 37.0833 },
      ]},
      { name: "Mukurweini", lat: -0.5333, lon: 37.0833, towns: [
        { name: "Mukurweini", lat: -0.5333, lon: 37.0833 },
        { name: "Giakanja", lat: -0.5167, lon: 37.0667 },
      ]},
    ],
  },
  {
    id: 20, name: "Kirinyaga", region: "Central", lat: -0.5570, lon: 37.2493,
    subCounties: [
      { name: "Kirinyaga Central", lat: -0.5570, lon: 37.2493, towns: [
        { name: "Kerugoya", lat: -0.5000, lon: 37.2833 },
        { name: "Kutus", lat: -0.5500, lon: 37.3000 },
        { name: "Kianyaga", lat: -0.5167, lon: 37.3333 },
      ]},
      { name: "Gichugu", lat: -0.5833, lon: 37.3167, towns: [
        { name: "Kagio", lat: -0.5833, lon: 37.3167 },
        { name: "Ng'araria", lat: -0.5667, lon: 37.2667 },
      ]},
      { name: "Ndia", lat: -0.5167, lon: 37.2333, towns: [
        { name: "Sagana", lat: -0.6689, lon: 37.2057 },
        { name: "Makutano", lat: -0.5000, lon: 37.2500 },
      ]},
      { name: "Mwea East", lat: -0.7000, lon: 37.4000, towns: [
        { name: "Mwea", lat: -0.7000, lon: 37.4000 },
        { name: "Wanguru", lat: -0.7167, lon: 37.4500 },
        { name: "Thiba", lat: -0.6833, lon: 37.3500 },
      ]},
    ],
  },
  {
    id: 21, name: "Murang'a", region: "Central", lat: -0.7180, lon: 37.1527,
    subCounties: [
      { name: "Murang'a Town", lat: -0.7180, lon: 37.1527, towns: [
        { name: "Murang'a Town", lat: -0.7180, lon: 37.1527 },
        { name: "Maragua", lat: -0.7500, lon: 37.1500 },
        { name: "Makuyu", lat: -0.9000, lon: 37.2833 },
      ]},
      { name: "Kiharu", lat: -0.7167, lon: 37.1333, towns: [
        { name: "Wangige", lat: -0.7167, lon: 37.1333 },
        { name: "Kahumbu", lat: -0.7333, lon: 37.1500 },
      ]},
      { name: "Kandara", lat: -0.9500, lon: 37.0000, towns: [
        { name: "Kandara", lat: -0.9500, lon: 37.0000 },
        { name: "Gaichanjiru", lat: -0.9167, lon: 37.0167 },
        { name: "Rwathia", lat: -0.9833, lon: 36.9667 },
      ]},
      { name: "Kangema", lat: -0.6333, lon: 36.9167, towns: [
        { name: "Kangema", lat: -0.6333, lon: 36.9167 },
        { name: "Kanyenyaini", lat: -0.6167, lon: 36.9333 },
      ]},
      { name: "Mathioya", lat: -0.7500, lon: 36.9167, towns: [
        { name: "Gituamba", lat: -0.7500, lon: 36.9167 },
        { name: "Kiru", lat: -0.7333, lon: 36.9000 },
      ]},
      { name: "Gatanga", lat: -0.9000, lon: 37.1667, towns: [
        { name: "Gatanga", lat: -0.9000, lon: 37.1667 },
        { name: "Ithanga", lat: -0.9333, lon: 37.2333 },
        { name: "Kakuzi/Mitubiri", lat: -0.9667, lon: 37.2000 },
      ]},
    ],
  },
  {
    id: 22, name: "Kiambu", region: "Central", lat: -1.0318, lon: 36.8325,
    subCounties: [
      { name: "Kiambu Town", lat: -1.0318, lon: 36.8325, towns: [
        { name: "Kiambu Town", lat: -1.0318, lon: 36.8325 },
        { name: "Ndumberi", lat: -1.0167, lon: 36.8167 },
        { name: "Riabai", lat: -1.0000, lon: 36.8500 },
      ]},
      { name: "Thika Town", lat: -1.0332, lon: 37.0693, towns: [
        { name: "Thika Town", lat: -1.0332, lon: 37.0693 },
        { name: "Kamenu", lat: -1.0167, lon: 37.0833 },
        { name: "Hospital", lat: -1.0333, lon: 37.0667 },
        { name: "Gatuanyaga", lat: -1.0667, lon: 37.0833 },
      ]},
      { name: "Ruiru", lat: -1.1497, lon: 36.9606, towns: [
        { name: "Ruiru Town", lat: -1.1497, lon: 36.9606 },
        { name: "Gitothua", lat: -1.1333, lon: 37.0000 },
        { name: "Kahawa Wendani", lat: -1.1667, lon: 36.9333 },
      ]},
      { name: "Limuru", lat: -1.1133, lon: 36.6449, towns: [
        { name: "Limuru Town", lat: -1.1133, lon: 36.6449 },
        { name: "Tigoni", lat: -1.1333, lon: 36.6833 },
        { name: "Kikuyu", lat: -1.2465, lon: 36.6647 },
      ]},
      { name: "Lari", lat: -0.9167, lon: 36.5667, towns: [
        { name: "Kijabe", lat: -0.9167, lon: 36.5667 },
        { name: "Uplands", lat: -0.9667, lon: 36.6167 },
        { name: "Kinale", lat: -1.0000, lon: 36.5833 },
      ]},
      { name: "Kabete", lat: -1.2303, lon: 36.7366, towns: [
        { name: "Kabete", lat: -1.2303, lon: 36.7366 },
        { name: "Muguga", lat: -1.2167, lon: 36.6500 },
        { name: "Nyathuna", lat: -1.1833, lon: 36.7000 },
      ]},
      { name: "Githunguri", lat: -1.0167, lon: 36.7333, towns: [
        { name: "Githunguri", lat: -1.0167, lon: 36.7333 },
        { name: "Githiga", lat: -0.9833, lon: 36.7833 },
      ]},
    ],
  },
  // ── RIFT VALLEY ───────────────────────────────────────────────────────
  {
    id: 23, name: "Turkana", region: "Rift Valley", lat: 3.1222, lon: 35.5960,
    subCounties: [
      { name: "Lodwar", lat: 3.1222, lon: 35.5960, towns: [
        { name: "Lodwar Town", lat: 3.1222, lon: 35.5960 },
        { name: "Nakwamoru", lat: 3.1000, lon: 35.6000 },
      ]},
      { name: "Turkana Central", lat: 3.5000, lon: 35.5000, towns: [
        { name: "Lodwar", lat: 3.1222, lon: 35.5960 },
        { name: "Lokichar", lat: 2.4000, lon: 35.7167 },
      ]},
      { name: "Turkana North", lat: 4.5000, lon: 35.8000, towns: [
        { name: "Lokichoggio", lat: 4.5650, lon: 34.3543 },
        { name: "Kakuma", lat: 3.7167, lon: 34.8833 },
      ]},
      { name: "Turkana East", lat: 3.0000, lon: 36.5000, towns: [
        { name: "Baragoi", lat: 1.7833, lon: 36.7833 },
        { name: "South Horr", lat: 2.1000, lon: 36.9167 },
      ]},
      { name: "Loima", lat: 2.5000, lon: 35.2500, towns: [
        { name: "Loima", lat: 2.5000, lon: 35.2500 },
        { name: "Turkwel", lat: 2.2000, lon: 35.3000 },
      ]},
    ],
  },
  {
    id: 24, name: "West Pokot", region: "Rift Valley", lat: 1.2500, lon: 35.1167,
    subCounties: [
      { name: "Kapenguria", lat: 1.2381, lon: 35.1117, towns: [
        { name: "Kapenguria", lat: 1.2381, lon: 35.1117 },
        { name: "Makutano", lat: 1.2167, lon: 35.1333 },
        { name: "Siyoi", lat: 1.2500, lon: 35.0833 },
      ]},
      { name: "Sigor", lat: 1.5000, lon: 35.4167, towns: [
        { name: "Sigor", lat: 1.5000, lon: 35.4167 },
        { name: "Chesegon", lat: 1.4833, lon: 35.4167 },
      ]},
      { name: "Kacheliba", lat: 1.4000, lon: 34.8000, towns: [
        { name: "Kacheliba", lat: 1.4000, lon: 34.8000 },
        { name: "Orwa", lat: 1.3500, lon: 34.9000 },
      ]},
      { name: "Pokot South", lat: 0.8500, lon: 35.5500, towns: [
        { name: "Chepareria", lat: 0.9167, lon: 35.3500 },
        { name: "Ortum", lat: 1.2167, lon: 35.3167 },
      ]},
    ],
  },
  {
    id: 25, name: "Samburu", region: "Rift Valley", lat: 1.1000, lon: 36.6833,
    subCounties: [
      { name: "Samburu North", lat: 1.7500, lon: 37.2500, towns: [
        { name: "Baragoi", lat: 1.7833, lon: 36.7833 },
        { name: "Wamba", lat: 0.9833, lon: 37.3333 },
      ]},
      { name: "Samburu East", lat: 0.8000, lon: 37.5500, towns: [
        { name: "Archer's Post", lat: 0.6500, lon: 37.6500 },
        { name: "Wamba", lat: 0.9833, lon: 37.3333 },
      ]},
      { name: "Samburu Central", lat: 1.1000, lon: 36.6833, towns: [
        { name: "Maralal", lat: 1.0989, lon: 36.6988 },
        { name: "Loosuk", lat: 1.0500, lon: 36.8167 },
      ]},
    ],
  },
  {
    id: 26, name: "Trans-Nzoia", region: "Rift Valley", lat: 1.0566, lon: 35.0006,
    subCounties: [
      { name: "Kiminini", lat: 1.1000, lon: 34.9833, towns: [
        { name: "Kitale Town", lat: 1.0155, lon: 35.0062 },
        { name: "Kiminini", lat: 1.1000, lon: 34.9833 },
        { name: "Sirende", lat: 1.1333, lon: 34.9833 },
      ]},
      { name: "Saboti", lat: 1.1667, lon: 34.8333, towns: [
        { name: "Saboti", lat: 1.1667, lon: 34.8333 },
        { name: "Matisi", lat: 1.0833, lon: 34.8833 },
      ]},
      { name: "Kwanza", lat: 1.0000, lon: 35.1500, towns: [
        { name: "Kwanza", lat: 1.0000, lon: 35.1500 },
        { name: "Kaplamai", lat: 0.9833, lon: 35.2167 },
      ]},
      { name: "Endebess", lat: 1.1833, lon: 35.0667, towns: [
        { name: "Endebess", lat: 1.1833, lon: 35.0667 },
        { name: "Tuwani", lat: 1.2167, lon: 35.1167 },
      ]},
    ],
  },
  {
    id: 27, name: "Uasin Gishu", region: "Rift Valley", lat: 0.5143, lon: 35.2698,
    subCounties: [
      { name: "Kapseret", lat: 0.4167, lon: 35.2667, towns: [
        { name: "Eldoret Town", lat: 0.5143, lon: 35.2698 },
        { name: "Langas", lat: 0.4833, lon: 35.2833 },
        { name: "Pioneer", lat: 0.5167, lon: 35.2500 },
        { name: "Racecourse", lat: 0.5333, lon: 35.2667 },
      ]},
      { name: "Moiben", lat: 0.6500, lon: 35.3000, towns: [
        { name: "Moiben", lat: 0.6500, lon: 35.3000 },
        { name: "Tembelio", lat: 0.7000, lon: 35.2667 },
        { name: "Ziwa", lat: 0.6167, lon: 35.3500 },
      ]},
      { name: "Turbo", lat: 0.6167, lon: 35.0500, towns: [
        { name: "Turbo", lat: 0.6167, lon: 35.0500 },
        { name: "Huruma", lat: 0.5833, lon: 35.0500 },
      ]},
      { name: "Ainabkoi", lat: 0.4167, lon: 35.3667, towns: [
        { name: "Ainabkoi", lat: 0.4167, lon: 35.3667 },
        { name: "Kimumu", lat: 0.4833, lon: 35.3167 },
        { name: "Burnt Forest", lat: 0.4167, lon: 35.4833 },
      ]},
    ],
  },
  {
    id: 28, name: "Elgeyo-Marakwet", region: "Rift Valley", lat: 0.8006, lon: 35.4695,
    subCounties: [
      { name: "Iten/Soy", lat: 0.6722, lon: 35.5108, towns: [
        { name: "Iten", lat: 0.6722, lon: 35.5108 },
        { name: "Tambach", lat: 0.8333, lon: 35.5167 },
      ]},
      { name: "Marakwet East", lat: 1.0500, lon: 35.5167, towns: [
        { name: "Kapsowar", lat: 0.9500, lon: 35.5667 },
        { name: "Chesoi", lat: 1.0833, lon: 35.6167 },
      ]},
      { name: "Marakwet West", lat: 1.0000, lon: 35.4500, towns: [
        { name: "Tot", lat: 1.1667, lon: 35.7167 },
        { name: "Siyoi", lat: 0.9167, lon: 35.4500 },
      ]},
      { name: "Keiyo South", lat: 0.5000, lon: 35.5000, towns: [
        { name: "Kapcherop", lat: 0.5000, lon: 35.5000 },
        { name: "Sergoit", lat: 0.5667, lon: 35.4833 },
      ]},
    ],
  },
  {
    id: 29, name: "Nandi", region: "Rift Valley", lat: 0.1833, lon: 35.2833,
    subCounties: [
      { name: "Chesumei", lat: 0.0833, lon: 35.2667, towns: [
        { name: "Nandi Hills", lat: 0.1019, lon: 35.1830 },
        { name: "Kemeloi-Maraba", lat: 0.0500, lon: 35.2167 },
      ]},
      { name: "Nandi Hills", lat: 0.1019, lon: 35.1830, towns: [
        { name: "Nandi Hills Town", lat: 0.1019, lon: 35.1830 },
        { name: "Kabiyet", lat: 0.1500, lon: 35.1167 },
      ]},
      { name: "Aldai", lat: 0.0000, lon: 35.1500, towns: [
        { name: "Kobujoi", lat: -0.0167, lon: 35.0833 },
        { name: "Kaptumo", lat: 0.0500, lon: 35.2167 },
      ]},
      { name: "Mosop", lat: 0.3000, lon: 35.5000, towns: [
        { name: "Kabiyet", lat: 0.1500, lon: 35.1167 },
        { name: "Chemundu", lat: 0.2833, lon: 35.5000 },
      ]},
      { name: "Emgwen", lat: 0.2833, lon: 35.3167, towns: [
        { name: "Kapsabet", lat: 0.2040, lon: 35.1046 },
        { name: "Chepterwai", lat: 0.2500, lon: 35.2167 },
      ]},
    ],
  },
  {
    id: 30, name: "Baringo", region: "Rift Valley", lat: 0.4671, lon: 35.9738,
    subCounties: [
      { name: "Baringo Central", lat: 0.4671, lon: 35.9738, towns: [
        { name: "Kabarnet", lat: 0.4919, lon: 35.7424 },
        { name: "Tenges", lat: 0.5167, lon: 35.8167 },
        { name: "Sacho", lat: 0.5000, lon: 35.8667 },
      ]},
      { name: "Baringo North", lat: 1.2000, lon: 36.0500, towns: [
        { name: "Eldama Ravine", lat: 0.0478, lon: 35.7231 },
        { name: "Mogotio", lat: 0.1667, lon: 35.9167 },
        { name: "Nginyang", lat: 1.2000, lon: 36.0500 },
      ]},
      { name: "Baringo South", lat: 0.0478, lon: 35.7231, towns: [
        { name: "Eldama Ravine", lat: 0.0478, lon: 35.7231 },
        { name: "Mochongoi", lat: 0.0167, lon: 35.7000 },
      ]},
      { name: "Tiaty", lat: 1.3000, lon: 36.4500, towns: [
        { name: "Chemolingot", lat: 1.2833, lon: 36.2000 },
        { name: "Kolowa", lat: 1.4167, lon: 36.4333 },
      ]},
    ],
  },
  {
    id: 31, name: "Laikipia", region: "Rift Valley", lat: 0.3604, lon: 36.7819,
    subCounties: [
      { name: "Laikipia West", lat: 0.4000, lon: 36.5500, towns: [
        { name: "Nyahururu", lat: 0.0352, lon: 36.3642 },
        { name: "Ndaragwa", lat: 0.1333, lon: 36.7167 },
      ]},
      { name: "Laikipia North", lat: 0.7000, lon: 37.0000, towns: [
        { name: "Rumuruti", lat: 0.2723, lon: 36.5353 },
        { name: "Mutaro", lat: 0.6167, lon: 37.0667 },
      ]},
      { name: "Laikipia East", lat: 0.0167, lon: 37.0833, towns: [
        { name: "Nanyuki", lat: 0.0167, lon: 37.0833 },
        { name: "Naro Moru", lat: -0.1833, lon: 37.0333 },
      ]},
    ],
  },
  {
    id: 32, name: "Nakuru", region: "Rift Valley", lat: -0.3031, lon: 36.0800,
    subCounties: [
      { name: "Nakuru Town East", lat: -0.2803, lon: 36.0666, towns: [
        { name: "Nakuru CBD", lat: -0.2803, lon: 36.0666 },
        { name: "Biashara", lat: -0.2700, lon: 36.0700 },
        { name: "Kivumbini", lat: -0.2600, lon: 36.0900 },
        { name: "Flamingo", lat: -0.2900, lon: 36.0600 },
      ]},
      { name: "Nakuru Town West", lat: -0.3100, lon: 36.0600, towns: [
        { name: "Kaptembwo", lat: -0.3100, lon: 36.0600 },
        { name: "Rhoda", lat: -0.3000, lon: 36.0700 },
        { name: "Barut", lat: -0.3200, lon: 36.0800 },
      ]},
      { name: "Naivasha", lat: -0.7167, lon: 36.4333, towns: [
        { name: "Naivasha Town", lat: -0.7167, lon: 36.4333 },
        { name: "Hells Gate", lat: -0.8833, lon: 36.3833 },
        { name: "Gilgil", lat: -0.4924, lon: 36.3222 },
        { name: "Kongoni", lat: -0.5500, lon: 36.5500 },
      ]},
      { name: "Rongai", lat: -0.2000, lon: 35.8333, towns: [
        { name: "Rongai Town", lat: -0.2000, lon: 35.8333 },
        { name: "Solai", lat: 0.0333, lon: 36.1333 },
        { name: "Menengai West", lat: -0.2167, lon: 36.0667 },
      ]},
      { name: "Subukia", lat: -0.0167, lon: 36.1000, towns: [
        { name: "Subukia", lat: -0.0167, lon: 36.1000 },
        { name: "Waseges", lat: 0.0333, lon: 36.1333 },
      ]},
      { name: "Bahati", lat: -0.1833, lon: 36.1833, towns: [
        { name: "Bahati", lat: -0.1833, lon: 36.1833 },
        { name: "Dundori", lat: -0.1167, lon: 36.2833 },
        { name: "Lanet", lat: -0.2500, lon: 36.1333 },
      ]},
      { name: "Kuresoi North", lat: -0.3667, lon: 35.7833, towns: [
        { name: "Molo", lat: -0.2501, lon: 35.7316 },
        { name: "Marioshoni", lat: -0.3000, lon: 35.7833 },
      ]},
      { name: "Kuresoi South", lat: -0.5833, lon: 35.6667, towns: [
        { name: "Olenguruone", lat: -0.4667, lon: 35.6167 },
        { name: "Kuresoi", lat: -0.5833, lon: 35.6667 },
      ]},
    ],
  },
  {
    id: 33, name: "Narok", region: "Rift Valley", lat: -1.0823, lon: 35.8709,
    subCounties: [
      { name: "Narok Town", lat: -1.0823, lon: 35.8709, towns: [
        { name: "Narok Town", lat: -1.0823, lon: 35.8709 },
        { name: "Nkareta", lat: -1.1167, lon: 35.8667 },
        { name: "Suswa", lat: -1.1667, lon: 36.3167 },
      ]},
      { name: "Narok North", lat: -1.0000, lon: 35.6500, towns: [
        { name: "Ololulung'a", lat: -1.0000, lon: 35.6500 },
        { name: "Melili", lat: -0.9500, lon: 35.7333 },
      ]},
      { name: "Narok South", lat: -1.8000, lon: 35.7000, towns: [
        { name: "Kilgoris", lat: -1.0100, lon: 34.8914 },
        { name: "Loliondo (border)", lat: -2.0000, lon: 35.6000 },
      ]},
      { name: "Narok West", lat: -1.0833, lon: 35.6167, towns: [
        { name: "Aitong", lat: -1.3333, lon: 35.1833 },
        { name: "Mara (Masai Mara)", lat: -1.5000, lon: 35.1500 },
      ]},
      { name: "Narok East", lat: -0.7000, lon: 36.0000, towns: [
        { name: "Ntulele", lat: -0.8167, lon: 35.9667 },
        { name: "Olkiramatian", lat: -1.6000, lon: 36.2000 },
      ]},
    ],
  },
  {
    id: 34, name: "Kajiado", region: "Rift Valley", lat: -1.8528, lon: 36.7819,
    subCounties: [
      { name: "Kajiado Central", lat: -1.8528, lon: 36.7819, towns: [
        { name: "Kajiado Town", lat: -1.8528, lon: 36.7819 },
        { name: "Isinya", lat: -1.7000, lon: 36.8833 },
        { name: "Imaroro", lat: -1.9333, lon: 36.7167 },
      ]},
      { name: "Kajiado North", lat: -1.4167, lon: 36.7000, towns: [
        { name: "Ngong", lat: -1.3667, lon: 36.6500 },
        { name: "Kiserian", lat: -1.4167, lon: 36.7000 },
        { name: "Ongata Rongai", lat: -1.3942, lon: 36.7456 },
      ]},
      { name: "Kajiado East", lat: -1.7000, lon: 37.2000, towns: [
        { name: "Mashuru", lat: -1.7000, lon: 37.2000 },
        { name: "Ilbisil", lat: -1.7500, lon: 37.1667 },
      ]},
      { name: "Kajiado West", lat: -1.8000, lon: 36.2500, towns: [
        { name: "Magadi", lat: -1.8833, lon: 36.2833 },
        { name: "Ewuaso Ng'iro", lat: -2.0000, lon: 36.3167 },
      ]},
      { name: "Loitokitok", lat: -2.9000, lon: 37.5167, towns: [
        { name: "Loitokitok", lat: -2.9000, lon: 37.5167 },
        { name: "Rombo", lat: -2.9500, lon: 37.6000 },
      ]},
    ],
  },
  {
    id: 35, name: "Kericho", region: "Rift Valley", lat: -0.3686, lon: 35.2864,
    subCounties: [
      { name: "Kericho Town", lat: -0.3686, lon: 35.2864, towns: [
        { name: "Kericho Town", lat: -0.3686, lon: 35.2864 },
        { name: "Kapkugerwet", lat: -0.3500, lon: 35.2833 },
        { name: "Ainamoi", lat: -0.3833, lon: 35.3000 },
      ]},
      { name: "Bureti", lat: -0.5667, lon: 35.1667, towns: [
        { name: "Litein", lat: -0.5667, lon: 35.1667 },
        { name: "Roret", lat: -0.5833, lon: 35.2000 },
      ]},
      { name: "Belgut", lat: -0.2667, lon: 35.3333, towns: [
        { name: "Londiani", lat: -0.1500, lon: 35.5833 },
        { name: "Fort Ternan", lat: -0.2167, lon: 35.3500 },
      ]},
      { name: "Kipkelion East", lat: -0.1500, lon: 35.5833, towns: [
        { name: "Londiani", lat: -0.1500, lon: 35.5833 },
        { name: "Kipkelion", lat: -0.1667, lon: 35.6000 },
      ]},
    ],
  },
  {
    id: 36, name: "Bomet", region: "Rift Valley", lat: -0.7878, lon: 35.3421,
    subCounties: [
      { name: "Bomet Central", lat: -0.7878, lon: 35.3421, towns: [
        { name: "Bomet Town", lat: -0.7878, lon: 35.3421 },
        { name: "Ndaraweta", lat: -0.7667, lon: 35.3500 },
      ]},
      { name: "Sotik", lat: -0.7167, lon: 35.1500, towns: [
        { name: "Sotik", lat: -0.7167, lon: 35.1500 },
        { name: "Mulot", lat: -0.7167, lon: 35.0667 },
      ]},
      { name: "Chepalungu", lat: -1.0167, lon: 35.4000, towns: [
        { name: "Sigor", lat: -1.0167, lon: 35.4000 },
        { name: "Merigi", lat: -0.9500, lon: 35.3833 },
      ]},
      { name: "Konoin", lat: -0.9167, lon: 35.2167, towns: [
        { name: "Longisa", lat: -0.9167, lon: 35.2167 },
        { name: "Kimulot", lat: -0.9500, lon: 35.1500 },
      ]},
    ],
  },
  // ── WESTERN ───────────────────────────────────────────────────────────
  {
    id: 37, name: "Kakamega", region: "Western", lat: 0.2827, lon: 34.7519,
    subCounties: [
      { name: "Kakamega Central", lat: 0.2827, lon: 34.7519, towns: [
        { name: "Kakamega Town", lat: 0.2827, lon: 34.7519 },
        { name: "Butsotso North", lat: 0.2667, lon: 34.7667 },
        { name: "Butsotso East", lat: 0.2833, lon: 34.7833 },
        { name: "Butsotso South", lat: 0.2500, lon: 34.7667 },
      ]},
      { name: "Lugari", lat: 0.5167, lon: 34.9167, towns: [
        { name: "Lugari", lat: 0.5167, lon: 34.9167 },
        { name: "Mautuma", lat: 0.5000, lon: 34.9000 },
        { name: "Lumakanda", lat: 0.4500, lon: 34.9333 },
      ]},
      { name: "Lurambi", lat: 0.2667, lon: 34.7333, towns: [
        { name: "Sheywe", lat: 0.2833, lon: 34.7333 },
        { name: "Mahiakalo", lat: 0.3000, lon: 34.7333 },
        { name: "Ikolomani", lat: 0.2000, lon: 34.7667 },
      ]},
      { name: "Navakholo", lat: 0.3167, lon: 34.6167, towns: [
        { name: "Navakholo", lat: 0.3167, lon: 34.6167 },
        { name: "Namamali", lat: 0.2833, lon: 34.5833 },
      ]},
      { name: "Malava", lat: 0.4667, lon: 34.8667, towns: [
        { name: "Malava", lat: 0.4667, lon: 34.8667 },
        { name: "Shirere", lat: 0.4833, lon: 34.8500 },
        { name: "Chemuche", lat: 0.4333, lon: 34.9000 },
      ]},
      { name: "Shinyalu", lat: 0.2333, lon: 34.8667, towns: [
        { name: "Shinyalu", lat: 0.2333, lon: 34.8667 },
        { name: "Buyangu", lat: 0.2833, lon: 34.9000 },
      ]},
      { name: "Khwisero", lat: 0.1000, lon: 34.7000, towns: [
        { name: "Khwisero", lat: 0.1000, lon: 34.7000 },
        { name: "East Kabras", lat: 0.1333, lon: 34.7500 },
      ]},
    ],
  },
  {
    id: 38, name: "Vihiga", region: "Western", lat: 0.0778, lon: 34.7119,
    subCounties: [
      { name: "Vihiga", lat: 0.0778, lon: 34.7119, towns: [
        { name: "Vihiga Town", lat: 0.0778, lon: 34.7119 },
        { name: "Luanda", lat: 0.0833, lon: 34.6500 },
        { name: "Mbale", lat: 0.0667, lon: 34.7000 },
      ]},
      { name: "Sabatia", lat: 0.1167, lon: 34.7333, towns: [
        { name: "Sabatia", lat: 0.1167, lon: 34.7333 },
        { name: "Chavakali", lat: 0.1000, lon: 34.7333 },
      ]},
      { name: "Emuhaya", lat: 0.0333, lon: 34.6833, towns: [
        { name: "Emuhaya", lat: 0.0333, lon: 34.6833 },
        { name: "Ebusiloli", lat: 0.0167, lon: 34.7167 },
      ]},
      { name: "Hamisi", lat: 0.1500, lon: 34.8000, towns: [
        { name: "Hamisi", lat: 0.1500, lon: 34.8000 },
        { name: "Shiru", lat: 0.1833, lon: 34.8167 },
      ]},
    ],
  },
  {
    id: 39, name: "Bungoma", region: "Western", lat: 0.5635, lon: 34.5606,
    subCounties: [
      { name: "Bungoma North", lat: 0.7000, lon: 34.6000, towns: [
        { name: "Chwele", lat: 0.7000, lon: 34.6000 },
        { name: "Kamukuywa", lat: 0.6500, lon: 34.6500 },
      ]},
      { name: "Bungoma East", lat: 0.5635, lon: 34.5606, towns: [
        { name: "Bungoma Town", lat: 0.5635, lon: 34.5606 },
        { name: "Khalaba", lat: 0.5500, lon: 34.5833 },
        { name: "Musikoma", lat: 0.5833, lon: 34.6000 },
      ]},
      { name: "Kanduyi", lat: 0.5333, lon: 34.5500, towns: [
        { name: "Musikoma", lat: 0.5833, lon: 34.6000 },
        { name: "Township", lat: 0.5635, lon: 34.5606 },
      ]},
      { name: "Kimilili", lat: 0.7917, lon: 34.7136, towns: [
        { name: "Kimilili", lat: 0.7917, lon: 34.7136 },
        { name: "Kibingei", lat: 0.8167, lon: 34.7000 },
      ]},
      { name: "Sirisia", lat: 0.5167, lon: 34.4833, towns: [
        { name: "Sirisia", lat: 0.5167, lon: 34.4833 },
        { name: "Namwela", lat: 0.5000, lon: 34.4667 },
      ]},
      { name: "Mt Elgon", lat: 1.1000, lon: 34.7667, towns: [
        { name: "Cheptais", lat: 1.0167, lon: 34.7333 },
        { name: "Kapsokwony", lat: 0.9833, lon: 34.8000 },
      ]},
    ],
  },
  {
    id: 40, name: "Busia", region: "Western", lat: 0.4604, lon: 34.1112,
    subCounties: [
      { name: "Busia Town", lat: 0.4604, lon: 34.1112, towns: [
        { name: "Busia Town", lat: 0.4604, lon: 34.1112 },
        { name: "Teso North (Malaba)", lat: 0.6333, lon: 34.2833 },
      ]},
      { name: "Butula", lat: 0.3833, lon: 34.2667, towns: [
        { name: "Butula", lat: 0.3833, lon: 34.2667 },
        { name: "Port Victoria", lat: 0.1000, lon: 34.0833 },
      ]},
      { name: "Samia", lat: 0.2167, lon: 34.1333, towns: [
        { name: "Funyula", lat: 0.2167, lon: 34.1333 },
        { name: "Nambale", lat: 0.3333, lon: 34.1833 },
      ]},
      { name: "Teso North", lat: 0.6333, lon: 34.2833, towns: [
        { name: "Malaba", lat: 0.6333, lon: 34.2833 },
        { name: "Amagoro", lat: 0.5667, lon: 34.2167 },
      ]},
    ],
  },
  // ── NYANZA ────────────────────────────────────────────────────────────
  {
    id: 41, name: "Siaya", region: "Nyanza", lat: 0.0607, lon: 34.2878,
    subCounties: [
      { name: "Siaya Town", lat: 0.0607, lon: 34.2878, towns: [
        { name: "Siaya Town", lat: 0.0607, lon: 34.2878 },
        { name: "Karemo", lat: 0.0833, lon: 34.3167 },
      ]},
      { name: "Rarieda", lat: -0.0167, lon: 34.3000, towns: [
        { name: "Ndori", lat: -0.0167, lon: 34.3000 },
        { name: "Uyoma", lat: -0.0833, lon: 34.4167 },
        { name: "Yimbo East", lat: 0.0333, lon: 34.4000 },
      ]},
      { name: "Gem", lat: 0.1167, lon: 34.2000, towns: [
        { name: "Yala", lat: 0.1167, lon: 34.5333 },
        { name: "Uhanya", lat: 0.1167, lon: 34.2000 },
      ]},
      { name: "Ugenya", lat: 0.2167, lon: 34.3167, towns: [
        { name: "Ukwala", lat: 0.2167, lon: 34.3167 },
        { name: "Ugenya", lat: 0.2333, lon: 34.3500 },
      ]},
      { name: "Ugunja", lat: 0.1833, lon: 34.2667, towns: [
        { name: "Ugunja", lat: 0.1833, lon: 34.2667 },
        { name: "Sigomre", lat: 0.1667, lon: 34.2833 },
      ]},
      { name: "Bondo", lat: 0.0000, lon: 34.2667, towns: [
        { name: "Bondo Town", lat: 0.0000, lon: 34.2667 },
        { name: "Madiany", lat: -0.0333, lon: 34.2833 },
      ]},
    ],
  },
  {
    id: 42, name: "Kisumu", region: "Nyanza", lat: -0.0917, lon: 34.7679,
    subCounties: [
      { name: "Kisumu Central", lat: -0.0917, lon: 34.7679, towns: [
        { name: "Kisumu CBD", lat: -0.0917, lon: 34.7679 },
        { name: "Milimani", lat: -0.1000, lon: 34.7833 },
        { name: "Shauri Moyo", lat: -0.0833, lon: 34.7500 },
      ]},
      { name: "Kisumu East", lat: -0.0667, lon: 34.8333, towns: [
        { name: "Kondele", lat: -0.0667, lon: 34.8333 },
        { name: "Nyalenda A", lat: -0.1000, lon: 34.8167 },
        { name: "Kolwa Central", lat: -0.0500, lon: 34.8667 },
      ]},
      { name: "Kisumu West", lat: -0.1167, lon: 34.7333, towns: [
        { name: "Mamboleo", lat: -0.1167, lon: 34.7333 },
        { name: "South West Kisumu", lat: -0.1333, lon: 34.7167 },
      ]},
      { name: "Muhoroni", lat: -0.1500, lon: 35.1833, towns: [
        { name: "Muhoroni", lat: -0.1500, lon: 35.1833 },
        { name: "Chemilil", lat: -0.2000, lon: 35.1333 },
        { name: "Kibigori", lat: -0.2167, lon: 35.0667 },
      ]},
      { name: "Nyando", lat: -0.2000, lon: 35.0000, towns: [
        { name: "Ahero", lat: -0.1667, lon: 34.9167 },
        { name: "Awasi", lat: -0.2000, lon: 35.0000 },
        { name: "Miwani", lat: -0.2167, lon: 35.0167 },
      ]},
      { name: "Nyakach", lat: -0.3000, lon: 34.9333, towns: [
        { name: "Nyakach", lat: -0.3000, lon: 34.9333 },
        { name: "Katito", lat: -0.3667, lon: 34.9833 },
      ]},
    ],
  },
  {
    id: 43, name: "Homa Bay", region: "Nyanza", lat: -0.5167, lon: 34.4569,
    subCounties: [
      { name: "Homa Bay Town", lat: -0.5167, lon: 34.4569, towns: [
        { name: "Homa Bay Town", lat: -0.5167, lon: 34.4569 },
        { name: "Rang'ala", lat: -0.5333, lon: 34.4833 },
      ]},
      { name: "Rachuonyo North", lat: -0.4167, lon: 34.5333, towns: [
        { name: "Kendu Bay", lat: -0.3667, lon: 34.6500 },
        { name: "Ogenya", lat: -0.4167, lon: 34.5333 },
      ]},
      { name: "Rachuonyo South", lat: -0.6000, lon: 34.6333, towns: [
        { name: "Oyugis", lat: -0.5000, lon: 34.7333 },
        { name: "Ndhiwa", lat: -0.7500, lon: 34.6833 },
      ]},
      { name: "Mbita", lat: -0.4333, lon: 34.2167, towns: [
        { name: "Mbita", lat: -0.4333, lon: 34.2167 },
        { name: "Rusinga Island", lat: -0.4000, lon: 34.1833 },
        { name: "Sindo", lat: -0.5167, lon: 34.1667 },
      ]},
      { name: "Suba North", lat: -0.7000, lon: 34.2000, towns: [
        { name: "Mfangano Island", lat: -0.4667, lon: 33.9833 },
        { name: "Gwassi", lat: -0.7000, lon: 34.2000 },
      ]},
      { name: "Kabondo Kasipul", lat: -0.4500, lon: 34.5667, towns: [
        { name: "Kabondo", lat: -0.4500, lon: 34.5667 },
        { name: "Kasipul", lat: -0.5500, lon: 34.5500 },
      ]},
    ],
  },
  {
    id: 44, name: "Migori", region: "Nyanza", lat: -1.0634, lon: 34.4733,
    subCounties: [
      { name: "Migori Town", lat: -1.0634, lon: 34.4733, towns: [
        { name: "Migori Town", lat: -1.0634, lon: 34.4733 },
        { name: "Piny Owacho", lat: -1.0500, lon: 34.4833 },
      ]},
      { name: "Rongo", lat: -0.8833, lon: 34.6000, towns: [
        { name: "Rongo", lat: -0.8833, lon: 34.6000 },
        { name: "Kabuoch", lat: -0.8667, lon: 34.5833 },
      ]},
      { name: "Awendo", lat: -0.9167, lon: 34.7000, towns: [
        { name: "Awendo", lat: -0.9167, lon: 34.7000 },
        { name: "Sony Sugar", lat: -0.9500, lon: 34.7167 },
      ]},
      { name: "Uriri", lat: -0.9333, lon: 34.5333, towns: [
        { name: "Uriri", lat: -0.9333, lon: 34.5333 },
        { name: "Sori", lat: -0.9500, lon: 34.5000 },
      ]},
      { name: "Nyatike", lat: -1.2000, lon: 34.3333, towns: [
        { name: "Muhuru Bay", lat: -1.2000, lon: 34.0833 },
        { name: "Macalder", lat: -1.2667, lon: 34.3333 },
        { name: "Nyatike", lat: -1.2000, lon: 34.3333 },
      ]},
      { name: "Kuria East", lat: -1.2667, lon: 34.6167, towns: [
        { name: "Kehancha", lat: -1.2667, lon: 34.6167 },
        { name: "Ntimaru", lat: -1.3833, lon: 34.7500 },
      ]},
      { name: "Kuria West", lat: -1.3333, lon: 34.5167, towns: [
        { name: "Isebania", lat: -1.3333, lon: 34.5167 },
        { name: "Kegonga", lat: -1.3167, lon: 34.5833 },
      ]},
    ],
  },
  {
    id: 45, name: "Kisii", region: "Nyanza", lat: -0.6817, lon: 34.7658,
    subCounties: [
      { name: "Kisii Central", lat: -0.6817, lon: 34.7658, towns: [
        { name: "Kisii Town", lat: -0.6817, lon: 34.7658 },
        { name: "Menyinkwa", lat: -0.6667, lon: 34.7833 },
        { name: "Daraja Mbili", lat: -0.6833, lon: 34.7500 },
      ]},
      { name: "Gucha", lat: -0.8000, lon: 34.7000, towns: [
        { name: "Suneka", lat: -0.8000, lon: 34.7000 },
        { name: "Ogembo", lat: -0.8833, lon: 34.7667 },
        { name: "Manga", lat: -0.7000, lon: 34.7167 },
      ]},
      { name: "Masaba North", lat: -0.5833, lon: 34.8333, towns: [
        { name: "Nyamache", lat: -0.5833, lon: 34.8333 },
        { name: "Ikonge", lat: -0.6167, lon: 34.8167 },
      ]},
      { name: "Kitutu Masaba", lat: -0.7333, lon: 34.8333, towns: [
        { name: "Keroka", lat: -0.7333, lon: 34.8333 },
        { name: "Itibo", lat: -0.7667, lon: 34.8667 },
      ]},
      { name: "Bomachoge Borabu", lat: -0.9167, lon: 34.8167, towns: [
        { name: "Ogembo", lat: -0.8833, lon: 34.7667 },
        { name: "Nyamarambe", lat: -0.9167, lon: 34.8167 },
      ]},
      { name: "Bonchari", lat: -0.7500, lon: 34.6500, towns: [
        { name: "Mokomoni", lat: -0.7500, lon: 34.6500 },
        { name: "Nyaigama", lat: -0.7833, lon: 34.6167 },
      ]},
    ],
  },
  {
    id: 46, name: "Nyamira", region: "Nyanza", lat: -0.5671, lon: 34.9346,
    subCounties: [
      { name: "Nyamira Town", lat: -0.5671, lon: 34.9346, towns: [
        { name: "Nyamira Town", lat: -0.5671, lon: 34.9346 },
        { name: "Magwagwa", lat: -0.5500, lon: 34.9500 },
      ]},
      { name: "Borabu", lat: -0.7000, lon: 35.0000, towns: [
        { name: "Masaba", lat: -0.7000, lon: 35.0000 },
        { name: "Rigoma", lat: -0.7333, lon: 35.0333 },
      ]},
      { name: "Manga", lat: -0.6167, lon: 34.8667, towns: [
        { name: "Manga", lat: -0.6167, lon: 34.8667 },
        { name: "Bosamaro", lat: -0.6000, lon: 34.9000 },
      ]},
      { name: "Masaba North", lat: -0.5000, lon: 34.9833, towns: [
        { name: "Nyamaiya", lat: -0.5000, lon: 34.9833 },
        { name: "Gesima", lat: -0.4833, lon: 35.0167 },
      ]},
    ],
  },
  // ── NAIROBI ───────────────────────────────────────────────────────────
  {
    id: 47, name: "Nairobi", region: "Nairobi", lat: -1.2921, lon: 36.8219,
    subCounties: [
      { name: "Westlands", lat: -1.2680, lon: 36.8120, towns: [
        { name: "Westlands", lat: -1.2680, lon: 36.8120 },
        { name: "Parklands", lat: -1.2600, lon: 36.8200 },
        { name: "Kangemi", lat: -1.2500, lon: 36.7500 },
        { name: "Mountain View", lat: -1.2833, lon: 36.7833 },
      ]},
      { name: "Dagoretti North", lat: -1.2979, lon: 36.7388, towns: [
        { name: "Kawangware", lat: -1.2833, lon: 36.7667 },
        { name: "Riruta", lat: -1.2979, lon: 36.7388 },
        { name: "Uthiru", lat: -1.2833, lon: 36.7333 },
      ]},
      { name: "Lang'ata", lat: -1.3549, lon: 36.7449, towns: [
        { name: "Karen", lat: -1.3333, lon: 36.7000 },
        { name: "Nairobi West", lat: -1.3167, lon: 36.8167 },
        { name: "South C", lat: -1.3167, lon: 36.8333 },
        { name: "Mugumoini", lat: -1.3500, lon: 36.7833 },
      ]},
      { name: "Kibra", lat: -1.3132, lon: 36.7842, towns: [
        { name: "Kibra", lat: -1.3132, lon: 36.7842 },
        { name: "Laini Saba", lat: -1.3100, lon: 36.7900 },
        { name: "Makina", lat: -1.3200, lon: 36.7800 },
        { name: "Woodley", lat: -1.3000, lon: 36.7833 },
      ]},
      { name: "Roysambu", lat: -1.2211, lon: 36.8754, towns: [
        { name: "Githurai", lat: -1.1833, lon: 36.9167 },
        { name: "Roysambu", lat: -1.2211, lon: 36.8754 },
        { name: "Zimmerman", lat: -1.2000, lon: 36.8833 },
        { name: "Kahawa West", lat: -1.1833, lon: 36.9000 },
      ]},
      { name: "Kasarani", lat: -1.2255, lon: 36.8977, towns: [
        { name: "Kasarani", lat: -1.2255, lon: 36.8977 },
        { name: "Mwiki", lat: -1.2000, lon: 36.9333 },
        { name: "Njiru", lat: -1.2333, lon: 36.9667 },
        { name: "Clay City", lat: -1.2167, lon: 36.9167 },
      ]},
      { name: "Embakasi Central", lat: -1.2967, lon: 36.9182, towns: [
        { name: "Kayole", lat: -1.2967, lon: 36.9182 },
        { name: "Komarock", lat: -1.2667, lon: 36.9500 },
        { name: "Matopeni", lat: -1.3000, lon: 36.9333 },
      ]},
      { name: "Embakasi North", lat: -1.2729, lon: 36.9028, towns: [
        { name: "Dandora", lat: -1.2583, lon: 36.9083 },
        { name: "Kariobangi North", lat: -1.2583, lon: 36.8833 },
        { name: "Lucky Summer", lat: -1.2500, lon: 36.8833 },
      ]},
      { name: "Embakasi South", lat: -1.3254, lon: 36.9142, towns: [
        { name: "Pipeline", lat: -1.3167, lon: 36.9167 },
        { name: "Imara Daima", lat: -1.3333, lon: 36.9333 },
        { name: "Kwa Njenga", lat: -1.3333, lon: 36.9000 },
      ]},
      { name: "Embakasi East", lat: -1.3075, lon: 36.9342, towns: [
        { name: "Utawala", lat: -1.3000, lon: 36.9667 },
        { name: "Mihang'o", lat: -1.2833, lon: 36.9667 },
        { name: "Lower Savanna", lat: -1.3167, lon: 36.9833 },
      ]},
      { name: "Embakasi West", lat: -1.2999, lon: 36.8754, towns: [
        { name: "Umoja", lat: -1.2833, lon: 36.9000 },
        { name: "Mowlem", lat: -1.2833, lon: 36.9333 },
        { name: "Kariobangi South", lat: -1.2833, lon: 36.8833 },
      ]},
      { name: "Makadara", lat: -1.3033, lon: 36.8566, towns: [
        { name: "Viwandani", lat: -1.3000, lon: 36.8667 },
        { name: "Harambee", lat: -1.2900, lon: 36.8333 },
        { name: "Makongeni", lat: -1.2967, lon: 36.8566 },
      ]},
      { name: "Kamukunji", lat: -1.2782, lon: 36.8491, towns: [
        { name: "Eastleigh", lat: -1.2728, lon: 36.8598 },
        { name: "Pumwani", lat: -1.2800, lon: 36.8500 },
        { name: "Airbase", lat: -1.2667, lon: 36.8500 },
      ]},
      { name: "Starehe", lat: -1.2847, lon: 36.8275, towns: [
        { name: "Nairobi CBD", lat: -1.2921, lon: 36.8219 },
        { name: "Pangani", lat: -1.2700, lon: 36.8333 },
        { name: "Ngara", lat: -1.2700, lon: 36.8167 },
        { name: "Ziwani", lat: -1.2833, lon: 36.8167 },
      ]},
      { name: "Mathare", lat: -1.2606, lon: 36.8531, towns: [
        { name: "Mathare", lat: -1.2606, lon: 36.8531 },
        { name: "Huruma", lat: -1.2500, lon: 36.8500 },
        { name: "Mabatini", lat: -1.2583, lon: 36.8583 },
      ]},
    ],
  },
];

/** Flatten all counties into searchable entries */
export interface LocationSearchResult {
  displayName: string;    // e.g. "Nairobi › Westlands › Kangemi"
  county: string;
  subCounty: string;
  town: string;
  lat: number;
  lon: number;
}

export function searchLocations(query: string): LocationSearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: LocationSearchResult[] = [];

  for (const county of KENYA_COUNTIES) {
    if (results.length >= 50) break;
    for (const sub of county.subCounties) {
      for (const town of sub.towns) {
        if (
          town.name.toLowerCase().includes(q) ||
          sub.name.toLowerCase().includes(q) ||
          county.name.toLowerCase().includes(q)
        ) {
          results.push({
            displayName: `${town.name} · ${sub.name} · ${county.name}`,
            county: county.name,
            subCounty: sub.name,
            town: town.name,
            lat: town.lat,
            lon: town.lon,
          });
          if (results.length >= 50) break;
        }
      }
      if (results.length >= 50) break;
    }
  }
  return results;
}
