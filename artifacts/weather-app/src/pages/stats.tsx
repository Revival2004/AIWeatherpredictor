import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Activity, Droplets, Thermometer, Wind, PieChart as PieChartIcon, Loader2, Database } from "lucide-react";
import { 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { useAdminSession } from "@/contexts/admin-session";
import { getAdminStats } from "@/lib/admin-api";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function Stats() {
  const { token } = useAdminSession();
  const { data: stats, isLoading } = useQuery({
    enabled: Boolean(token),
    queryKey: ["admin-stats", token],
    queryFn: () => getAdminStats(token ?? ""),
  });
  const DEGREE = "\u00B0";

  const chartData = useMemo(() => {
    if (!stats?.predictionBreakdown) return [];
    
    return Object.entries(stats.predictionBreakdown)
      .map(([name, value]) => ({
        name: name.length > 20 ? name.substring(0, 20) + "..." : name,
        fullLabel: name,
        value: Number(value)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // Top 8 predictions
  }, [stats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Unable to load statistics.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 mb-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <LineChart className="h-8 w-8 text-primary" />
          Analytics Dashboard
        </h1>
        <p className="text-muted-foreground">
          Aggregated climate data, model trends, and store health for the live system.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="cockpit-panel border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Total Readings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono font-bold">{stats.totalReadings}</div>
          </CardContent>
        </Card>

        <Card className="cockpit-panel border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-red-500" />
              Avg Temperature
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono font-bold">
              {stats.avgTemperature !== null ? stats.avgTemperature.toFixed(1) : "--"}
              <span className="text-xl text-muted-foreground ml-1">{DEGREE}C</span>
            </div>
          </CardContent>
        </Card>

        <Card className="cockpit-panel border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wind className="h-4 w-4 text-secondary" />
              Avg Wind Speed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono font-bold">
              {stats.avgWindspeed !== null ? stats.avgWindspeed.toFixed(1) : "--"}
              <span className="text-xl text-muted-foreground ml-1">km/h</span>
            </div>
          </CardContent>
        </Card>

        <Card className="cockpit-panel border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-500" />
              Avg Humidity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono font-bold">
              {stats.avgHumidity !== null ? stats.avgHumidity.toFixed(0) : "--"}
              <span className="text-xl text-muted-foreground ml-1">%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="cockpit-panel border-none shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Data Store Status
          </CardTitle>
          <CardDescription>Current persistence mode for the live backend.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/50 bg-background/70 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Mode</div>
            <div className="mt-2 text-lg font-semibold capitalize">{stats.store.mode}</div>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/70 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ready</div>
            <div className="mt-2 text-lg font-semibold">{stats.store.ready ? "Healthy" : "Needs attention"}</div>
          </div>
          <div className="rounded-xl border border-border/50 bg-background/70 p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Configured</div>
            <div className="mt-2 text-lg font-semibold">{stats.store.configured ? "Yes" : "No"}</div>
          </div>
          {stats.store.error ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 sm:col-span-3">
              {stats.store.error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="cockpit-panel border-none shadow-xl mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-primary" />
            Prediction Distribution
          </CardTitle>
          <CardDescription>Most common recent atmospheric assessments</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div className="h-[400px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis dataKey="name" type="category" width={150} tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      borderColor: 'hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-md)'
                    }}
                    formatter={(value: number) => [`${value} readings`, 'Count']}
                    labelFormatter={(label) => {
                      const item = chartData.find(d => d.name === label);
                      return item ? item.fullLabel : label;
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Not enough data to generate chart
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


