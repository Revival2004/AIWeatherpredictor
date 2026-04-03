# FarmPal — Complete Feature Documentation

**Version:** April 2026  
**Platform:** Android (Expo)  
**Languages:** English, Swahili, Kikuyu  
**Target users:** Kenyan smallholder farmers

---

## What FarmPal Is

FarmPal is an AI weather prediction app built specifically for Kenyan farmers. Unlike generic weather apps that show the same forecast for an entire county, FarmPal predicts rain at **farm level** — using your exact GPS coordinates, your farm's elevation, local barometric pressure from your phone, and 10 years of historical weather data from 69 locations across Kenya.

The system learns continuously and silently from what the surrounding environment actually records — no buttons to press, no questions to answer.

---

## How It Is Different From Other Weather Apps

| Feature | Generic weather apps | FarmPal |
|---|---|---|
| Location accuracy | County-wide (9–50 km grid) | Farm-level GPS coordinates |
| Elevation awareness | No | Yes — valley vs hilltop treated differently |
| Local pressure | Satellite estimate | Phone barometer (on supported devices) |
| Kenya-specific training | No | 5.8M rows, 69 Kenyan locations, 2015–2024 |
| Learns from real outcomes | No | Yes — compares every prediction against actuals |
| Seasonal calendar | No | Kenya crop calendar with long/short rains |
| Works offline | No | Yes — last data cached for offline use |
| Language | English only | English, Swahili, Kikuyu |
| Storm timeline | No | Hourly rain probability for today |

---

## Feature Guide

---

### 1. Home Screen — Weather Dashboard

**What it shows:**
- Current temperature, humidity, wind speed, and atmospheric pressure
- An AI rain prediction with confidence percentage ("Rain likely — 82% confident")
- A farming tip tailored to the current conditions
- Alerts for storms, frost risk, or heat stress

**Why it works:**  
The prediction is produced by an ensemble of three machine learning models — Logistic Regression, Random Forest, and Gradient Boosting — that all vote on the outcome. When all three agree, confidence is high. The inputs include temperature, humidity, pressure, wind speed, weather code, GPS latitude, GPS longitude, and farm elevation. These are the same features used by professional meteorological systems.

**Current accuracy:** 77.4% for 6-hour rain prediction. This improves each month as the system learns from real outcomes.

---

### 2. Automatic GPS Location Detection

**What it does:**  
Every time you open the app, it silently checks your GPS in the background — no popups, no permission screens. It compares the new GPS reading against your last known farm location.

- If you have moved less than 5 km: nothing changes, your saved location stays
- If you have moved more than 5 km: the app automatically updates to your current location and shows a brief green banner "Location updated — your farm moved, showing new area"

**Why this matters:**  
A farmer who moves from their Nakuru farm to check on a plot in Kericho gets Kericho predictions automatically without touching any settings. A farmer walking around their own farm does not trigger unwanted updates.

**If GPS is unavailable:** The app falls back to your last saved location silently. No error shown.

---

### 3. Location Picker

**What it does:**  
The map pin button in the top right corner of the home screen lets you manually set your location by:

- Tapping on a map
- Searching from a list of 69 Kenyan farming locations

**Why it exists:**  
For farmers who share a phone, or who want to check conditions at a market destination before travelling.

---

### 4. Phone Barometer Integration

**What it does:**  
On phones that have a built-in barometric pressure sensor (most mid-range and flagship Android phones — Tecno Camon series, Samsung A-series, Infinix Hot 12 and above), FarmPal reads the local pressure every 30 seconds.

- If pressure is dropping: blue banner appears — "Pressure falling on your farm — rain may be approaching" with the exact hPa reading
- If pressure is rising: green banner — "Pressure rising — conditions improving"
- The actual pressure reading is sent to the prediction engine and blended (80% local phone / 20% satellite) to produce a more accurate result

**Why this matters:**  
A satellite covers a 9 km grid. A valley on the Aberdare slopes, a ridge above Kericho, a depression near Kitale — these can have pressure 10–15 hPa different from the nearest weather station. The phone barometer captures that difference. On phones without the sensor, nothing changes and no error is shown.

---

### 5. Today's Rain Timeline

**What it does:**  
A scrollable row of hourly cards for the current day, showing:

- Rain probability percentage for each hour (6am to 10pm)
- Colour coding: blue = likely rain, grey = dry
- "NOW" badge on the current hour
- A plain-language summary sentence at the top ("Rain most likely between 2pm and 5pm")

**Why it works:**  
Each hour is predicted by blending the Python ML ensemble (70% weight) with Open-Meteo's hourly forecast (30% weight). This means the local model's knowledge of your farm's microclimate shapes the prediction, while Open-Meteo provides the large-scale atmospheric context.

---

### 6. Storm Alerts

**What it does:**  
When rain probability crosses 70%, the app sends a local push notification: "Rain likely at [your location] — [probability]%". This works even when the app is closed.

**Why it is set at 70%:**  
Below 70%, conditions are uncertain and alerting would cause too many false alarms. At 70%+, the ensemble's track record shows rain occurs in roughly 80% of cases.

---

### 7. Community Insights

**What it does:**  
Shows what other farmers in your area are seeing — aggregated anonymously by region. Includes recent weather observations from nearby locations in the database.

---

### 8. Crop Calendar

**What it does:**  
A seasonal guide showing which crops to plant, tend, or harvest by month — aligned to Kenya's two rain seasons:

- **Long rains:** March to May (main season — maize, beans, potatoes)
- **Short rains:** October to December (second season — sorghum, millet, vegetables)

The calendar is location-aware. A farmer near Kisumu (Lake Victoria zone, two reliable rain seasons) sees different guidance than a farmer in Garissa (ASAL zone, unpredictable rains, drought-tolerant crops).

---

### 9. Offline Mode

**What it does:**  
When your phone loses internet connection, the app automatically switches to the last cached prediction. A brown banner appears: "Showing cached data · [X] minutes ago".

**What is cached:**  
The full weather prediction, rain probability, and today's timeline are all saved to local storage every time a successful fetch completes. The cache is location-specific — data from Nakuru and data from Eldoret are stored separately.

**What does not work offline:**  
Community insights (requires live database query). Everything else functions normally.

---

### 10. Language Support

**What it does:**  
Tap the language button in the home screen header to switch between English, Swahili, and Kikuyu. All UI text, farming tips, and alert messages are translated.

**Why three languages:**  
English is the administrative language of Kenya. Swahili is the national language used in markets and daily communication. Kikuyu is the most widely spoken first language in Central Kenya and the Rift Valley highlands — the two most agriculturally productive regions in the country.

---

### 11. Stats Screen

**What it shows:**

- **Prediction accuracy:** Percentage of past predictions that matched what actually happened
- **Total predictions made**
- **Model ensemble breakdown:** Accuracy of Logistic Regression, Random Forest, and Gradient Boosting separately
- **Observations collected:** Total weather readings in the database
- **Training samples:** Records used in the last model training

**Collect Now button:**  
Manually triggers a weather data collection for all tracked locations instead of waiting for the next hourly automatic run. Useful after coming back online from offline mode.

---

## How the System Learns (Automatic, No Input Required)

This is the core of how FarmPal improves over time without any farmer involvement:

```
Step 1 — Prediction made
  App requests weather → ML ensemble predicts "Rain" with 78% confidence
  Prediction saved to database: location, time, what was predicted

Step 2 — Automatic comparison (runs every hour)
  After the prediction time passes, the system fetches what
  Open-Meteo's ERA5 reanalysis recorded as actually happening
  at that location and time (ERA5 is satellite + station data
  merged into a historical record — what actually occurred, not a forecast)

Step 3 — Marked correct or wrong
  "We said rain" vs "ERA5 says weathercode 61 (moderate rain)"
  → Prediction marked CORRECT
  "We said dry" vs "ERA5 says weathercode 3 (overcast)"
  → Prediction marked CORRECT
  "We said rain" vs "ERA5 says weathercode 1 (clear sky)"
  → Prediction marked WRONG

Step 4 — Monthly retrain (1st of every month, 2am)
  All accumulated correct/wrong pairs across all 69 locations
  are used to retrain the ensemble
  The three models update their internal weights
  Accuracy improves — projected ~0.5% per month
```

**The more farmers use FarmPal across Kenya, the more predictions are made, the more comparisons are recorded, and the more accurate the model becomes for every farmer — including new ones.**

---

## Accuracy Trajectory

| Time from launch | Expected ensemble accuracy |
|---|---|
| Launch (today) | 77.4% |
| 3 months | ~79% |
| 6 months | ~81% |
| 1 year | ~83–85% |

For context, the Kenya Meteorological Department achieves approximately 65–70% accuracy for county-level rain prediction. FarmPal predicts at farm level with higher or comparable accuracy.

---

## Data & Privacy

- **No personal data is collected.** GPS coordinates are used only to fetch the weather for your location. They are not stored linked to your identity.
- **Weather readings are stored anonymously** with only coordinates, not any user identifier.
- **Barometer readings** are used only to improve your prediction in the current session and are not uploaded to any external service.
- **Language preference** is stored only on your phone.

---

## Supported Devices

- **Android:** API 26+ (Android 8.0 and above)
- **Barometer:** Tecno Camon 20+, Samsung A32/A52/A72/S-series, Infinix Hot 12+, Xiaomi mid-range+
- **No barometer:** Predictions still work at full accuracy using satellite pressure data
- **Offline:** Works anywhere in Kenya with no internet — uses last cached data

---

## Coverage — 69 Kenyan Locations

The model is trained on data from the following regions:

**Central Highlands:** Nairobi, Nakuru, Nyeri, Muranga, Thika, Kiambu, Nanyuki, Embu, Meru, Karatina, Kerugoya, Othaya

**Rift Valley:** Eldoret, Kericho, Kitale, Naivasha, Narok, Bomet, Sotik, Kapenguria, Iten, Kabarnet, Maralal

**Western Kenya:** Kisumu, Kakamega, Bungoma, Mumias, Vihiga, Siaya, Migori, Homabay, Oyugis, Webuye

**Coast:** Mombasa, Malindi, Kilifi, Lamu, Kwale, Ukunda, Voi, Taveta, Shimba Hills

**Eastern:** Machakos, Kitui, Makueni, Garissa, Isiolo, Moyale, Wajir, Mandera, Marsabit

**North Rift:** Lodwar, Turkana, Lokichar

**South:** Amboseli, Kajiado, Namanga

Every location has 10 years of hourly historical records (2015–2024) — approximately 87,600 readings per location.
