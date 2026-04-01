import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, Sun, Wind } from "lucide-react";

export function getWeatherMeta(weathercode: number) {
  // WMO Weather interpretation codes
  // 0: Clear sky
  // 1, 2, 3: Mainly clear, partly cloudy, and overcast
  // 45, 48: Fog and depositing rime fog
  // 51, 53, 55: Drizzle: Light, moderate, and dense intensity
  // 56, 57: Freezing Drizzle: Light and dense intensity
  // 61, 63, 65: Rain: Slight, moderate and heavy intensity
  // 66, 67: Freezing Rain: Light and heavy intensity
  // 71, 73, 75: Snow fall: Slight, moderate, and heavy intensity
  // 77: Snow grains
  // 80, 81, 82: Rain showers: Slight, moderate, and violent
  // 85, 86: Snow showers slight and heavy
  // 95: Thunderstorm: Slight or moderate
  // 96, 99: Thunderstorm with slight and heavy hail
  
  switch (true) {
    case (weathercode === 0):
      return { icon: Sun, label: "Clear sky", color: "text-amber-500" };
    case (weathercode >= 1 && weathercode <= 3):
      return { icon: Cloud, label: "Partly cloudy", color: "text-gray-400" };
    case (weathercode >= 45 && weathercode <= 48):
      return { icon: CloudFog, label: "Fog", color: "text-slate-400" };
    case (weathercode >= 51 && weathercode <= 57):
      return { icon: CloudDrizzle, label: "Drizzle", color: "text-teal-400" };
    case (weathercode >= 61 && weathercode <= 67):
    case (weathercode >= 80 && weathercode <= 82):
      return { icon: CloudRain, label: "Rain", color: "text-blue-500" };
    case (weathercode >= 71 && weathercode <= 77):
    case (weathercode >= 85 && weathercode <= 86):
      return { icon: CloudSnow, label: "Snow", color: "text-sky-300" };
    case (weathercode >= 95 && weathercode <= 99):
      return { icon: CloudLightning, label: "Thunderstorm", color: "text-purple-500" };
    default:
      return { icon: Wind, label: "Unknown", color: "text-muted-foreground" };
  }
}

export function formatDate(dateInput: string | Date) {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}
