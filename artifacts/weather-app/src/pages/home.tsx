import React, { useEffect, useMemo, useState } from "react";
import { 
  useGetWeather, 
  getGetWeatherQueryKey, 
  useGetWeatherHistory,
  getGetWeatherHistoryQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MapPin, Thermometer, Wind, Droplets, Activity, Loader2, AlertCircle, Compass, History } from "lucide-react";
import { getWeatherMeta, formatDate } from "@/lib/weather-utils";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminSession } from "@/contexts/admin-session";

const LAST_LOCATION_KEY = "farmpal_admin_last_location_v1";
const DEGREE = "\u00B0";

type Coordinates = {
  lat: number;
  lon: number;
};

function loadSavedLocation(): Coordinates | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LAST_LOCATION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Coordinates;
    if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lon)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function Home() {
  const [location, setLocation] = useState<Coordinates | null>(() => loadSavedLocation());
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const queryClient = useQueryClient();
  const { token } = useAdminSession();
  const historyParams = useMemo(
    () => (location ? { limit: 5, lat: location.lat, lon: location.lon } : { limit: 5 }),
    [location],
  );

  const { data: weatherData, isLoading: isLoadingWeather, error: weatherError } = useGetWeather(
    location!,
    {
      query: {
        enabled: !!location,
        queryKey: getGetWeatherQueryKey(location!)
      }
    }
  );

  const { data: historyData } = useGetWeatherHistory(
    historyParams,
    {
      query: {
        queryKey: getGetWeatherHistoryQueryKey(historyParams)
      }
    }
  );

  useEffect(() => {
    if (weatherData?.recordId) {
      queryClient.invalidateQueries({ queryKey: getGetWeatherHistoryQueryKey(historyParams) });
      queryClient.invalidateQueries({ queryKey: ["/api/weather/stats"] });
      if (token) {
        queryClient.invalidateQueries({ queryKey: ["admin-stats", token] });
        queryClient.invalidateQueries({ queryKey: ["admin-history", token] });
      }
    }
  }, [historyParams, queryClient, token, weatherData?.recordId]);

  useEffect(() => {
    if (typeof window === "undefined" || !location) {
      return;
    }

    window.localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(location));
  }, [location]);

  const handleGetWeather = () => {
    setIsLocating(true);
    setGeoError(null);
    
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
        setIsLocating(false);
      },
      (error) => {
        console.error(error);
        setGeoError("Unable to retrieve your location. Please check permissions.");
        setIsLocating(false);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleManualLocation = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const lat = Number.parseFloat(manualLat);
    const lon = Number.parseFloat(manualLon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setGeoError("Enter a valid latitude and longitude to load weather manually.");
      return;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setGeoError("Latitude must be between -90 and 90, and longitude between -180 and 180.");
      return;
    }

    setGeoError(null);
    setLocation({ lat, lon });
  };

  const isFetching = isLocating || isLoadingWeather;

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
      
      {!location && !weatherData && !isFetching && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 shadow-lg shadow-primary/5">
            <MapPin className="h-10 w-10" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Farm conditions at the exact field you care about
          </h2>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Use device location for the fastest scan, or enter coordinates manually when GPS is blocked.
          </p>
          <Button
            size="lg"
            className="rounded-full px-8 py-6 text-lg h-auto shadow-xl hover:shadow-primary/25 transition-all"
            onClick={handleGetWeather}
          >
            <MapPin className="mr-2 h-5 w-5" />
            Use Device Location
          </Button>
          <Card className="w-full max-w-xl border-border/60 bg-card/70 text-left shadow-xl">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Compass className="h-4 w-4 text-primary" />
                Manual coordinate fallback
              </div>
              <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={handleManualLocation}>
                <Input
                  inputMode="decimal"
                  placeholder="Latitude"
                  value={manualLat}
                  onChange={(event) => setManualLat(event.target.value)}
                />
                <Input
                  inputMode="decimal"
                  placeholder="Longitude"
                  value={manualLon}
                  onChange={(event) => setManualLon(event.target.value)}
                />
                <Button type="submit">Load</Button>
              </form>
              <p className="text-xs text-muted-foreground">
                Example: Nairobi CBD is approximately -1.2864, 36.8172.
              </p>
            </CardContent>
          </Card>
          {geoError && (
            <p className="text-sm text-destructive flex items-center gap-2 mt-4 bg-destructive/10 px-4 py-2 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              {geoError}
            </p>
          )}
        </div>
      )}

      {isFetching && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <h3 className="text-xl font-medium">
            {isLocating ? "Acquiring satellite lock..." : "Analyzing atmospheric data..."}
          </h3>
          <p className="text-muted-foreground text-sm font-mono animate-pulse">
            CALCULATING AI PREDICTION MODELS
          </p>
        </div>
      )}

      {weatherError && !isFetching && (
        <div className="p-8 rounded-2xl bg-destructive/10 border border-destructive/20 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h3 className="text-xl font-bold text-destructive">Could not load field conditions</h3>
          <p className="text-muted-foreground">
            We could not retrieve the latest weather for this location. Check connectivity or try another scan.
          </p>
          <Button variant="outline" onClick={handleGetWeather}>Retry Scan</Button>
        </div>
      )}

      {weatherData && !isFetching && (
        <div className="space-y-8 animate-in zoom-in-95 duration-500">
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-sm font-mono text-muted-foreground mb-1 flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                {weatherData.location.lat.toFixed(4)}{DEGREE}, {weatherData.location.lon.toFixed(4)}{DEGREE}
              </p>
              <h2 className="text-3xl font-bold">Current Conditions</h2>
            </div>
            <Button variant="outline" size="sm" onClick={handleGetWeather} className="w-fit">
              <Activity className="mr-2 h-4 w-4" />
              Rescan Area
            </Button>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Primary Weather Card */}
            <div className="md:col-span-4 cockpit-panel p-8 flex flex-col justify-between relative">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                {React.createElement(getWeatherMeta(weatherData.weather.weathercode).icon, {
                  className: "w-48 h-48"
                })}
              </div>
              
              <div className="space-y-2 z-10">
                <div className="flex items-center gap-3">
                  {React.createElement(getWeatherMeta(weatherData.weather.weathercode).icon, {
                    className: `w-8 h-8 ${getWeatherMeta(weatherData.weather.weathercode).color}`
                  })}
                  <span className="text-xl font-medium">
                    {getWeatherMeta(weatherData.weather.weathercode).label}
                  </span>
                </div>
                <div className="text-7xl font-mono tracking-tighter font-bold py-4">
                  {weatherData.weather.temperature.toFixed(1)}{DEGREE}
                </div>
                <div className="text-sm font-mono text-muted-foreground">
                  OBSERVATION: {formatDate(weatherData.weather.time)}
                </div>
              </div>
            </div>

            {/* AI Prediction Card */}
            <div className="md:col-span-8 cockpit-panel p-8 bg-primary/5 border-primary/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-primary uppercase tracking-widest flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Field outlook
                    {weatherData.prediction.modelVersion && weatherData.prediction.modelVersion !== "rules" && (
                      <span className={`text-xs px-2 py-0.5 rounded font-bold tracking-wide ${
                        weatherData.prediction.modelVersion === "pattern-learned"
                          ? "bg-primary/20 text-primary"
                          : "bg-secondary/20 text-secondary"
                      }`}>
                        {weatherData.prediction.modelVersion === "pattern-learned" ? "LEARNED" : "LEARNING"}
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2 text-sm font-mono">
                    <span className="text-muted-foreground">CONFIDENCE:</span>
                    <span className="text-primary font-bold">{(weatherData.prediction.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
                
                <div className="mb-2">
                  <Progress value={weatherData.prediction.confidence * 100} className="h-1 bg-primary/10" />
                </div>
                
                <p className="text-2xl md:text-3xl font-medium leading-snug mt-6 text-foreground">
                  "{weatherData.prediction.prediction}"
                </p>
              </div>
              
              <div className="mt-8 pt-6 border-t border-border/50">
                <p className="text-sm text-muted-foreground font-mono leading-relaxed">
                  <span className="text-foreground font-bold mr-2">WHY:</span>
                  {weatherData.prediction.reasoning}
                </p>
                {(weatherData.prediction.dataPoints ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground/60 font-mono mt-3">
                    Informed by {weatherData.prediction.dataPoints} historical readings · model: {weatherData.prediction.modelVersion}
                  </p>
                )}
              </div>
            </div>

            {/* Metrics Row */}
            <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="cockpit-panel p-6 flex items-start gap-4">
                <div className="p-3 bg-secondary/10 text-secondary rounded-lg">
                  <Wind className="w-6 h-6" />
                </div>
                <div>
                  <div className="stat-label mb-1">Wind Speed</div>
                  <div className="stat-value">{weatherData.weather.windspeed} <span className="text-base text-muted-foreground">km/h</span></div>
                </div>
              </div>
              
              <div className="cockpit-panel p-6 flex items-start gap-4">
                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-lg">
                  <Droplets className="w-6 h-6" />
                </div>
                <div>
                  <div className="stat-label mb-1">Humidity</div>
                  <div className="stat-value">{weatherData.weather.humidity}<span className="text-base text-muted-foreground">%</span></div>
                </div>
              </div>
              
              <div className="cockpit-panel p-6 flex items-start gap-4">
                <div className="p-3 bg-red-500/10 text-red-500 rounded-lg">
                  <Thermometer className="w-6 h-6" />
                </div>
                <div>
                  <div className="stat-label mb-1">Temperature</div>
                  <div className="stat-value">{weatherData.weather.temperature.toFixed(1)}<span className="text-base text-muted-foreground">{DEGREE}C</span></div>
                </div>
              </div>
              
              <div className="cockpit-panel p-6 flex items-start gap-4">
                <div className="p-3 bg-teal-500/10 text-teal-500 rounded-lg">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <div className="stat-label mb-1">Pressure</div>
                  <div className="stat-value">{weatherData.weather.pressure}<span className="text-base text-muted-foreground">hPa</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Strip */}
      <div className="pt-8">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-muted-foreground" />
          Recent Readings
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {!historyData ? (
            Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
          ) : historyData.length === 0 ? (
            <div className="col-span-full p-8 text-center text-muted-foreground cockpit-panel">
              No historical readings yet. Scan your area to begin logging.
            </div>
          ) : (
            historyData.map((record) => (
              <div key={record.id} className="cockpit-panel p-4 flex flex-col justify-between h-full bg-card/60">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-mono text-muted-foreground">
                    {new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {React.createElement(getWeatherMeta(record.weathercode).icon, {
                    className: `w-5 h-5 ${getWeatherMeta(record.weathercode).color}`
                  })}
                </div>
                <div>
                  <div className="text-2xl font-mono font-bold mb-1">{record.temperature.toFixed(1)}{DEGREE}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2" title={record.prediction}>
                    {record.prediction}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}




