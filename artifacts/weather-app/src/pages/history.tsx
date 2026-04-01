import React from "react";
import { useGetWeatherHistory } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getWeatherMeta, formatDate } from "@/lib/weather-utils";
import { Badge } from "@/components/ui/badge";
import { MapPin, History as HistoryIcon, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function History() {
  const { data: history, isLoading } = useGetWeatherHistory({ limit: 50 });

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <HistoryIcon className="h-8 w-8 text-primary" />
          History Log
        </h1>
        <p className="text-muted-foreground">
          A chronological record of atmospheric scans and AI predictions.
        </p>
      </div>

      <Card className="cockpit-panel border-none shadow-xl">
        <CardHeader className="bg-muted/20 border-b border-border/50">
          <CardTitle className="text-lg">Observation Database</CardTitle>
          <CardDescription>Last 50 recorded weather events across all locations</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !history || history.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <HistoryIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No records found in the database.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead className="text-right">Temp</TableHead>
                    <TableHead className="hidden md:table-cell">AI Prediction</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((record) => {
                    const meta = getWeatherMeta(record.weathercode);
                    const Icon = meta.icon;
                    return (
                      <TableRow key={record.id} className="cursor-default hover:bg-muted/30">
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {formatDate(record.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                            <MapPin className="h-3 w-3" />
                            {record.latitude.toFixed(2)}, {record.longitude.toFixed(2)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${meta.color}`} />
                            <span className="text-sm font-medium">{meta.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {record.temperature.toFixed(1)}°
                        </TableCell>
                        <TableCell className="hidden md:table-cell max-w-xs truncate text-sm" title={record.prediction}>
                          {record.prediction}
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {(record.confidence * 100).toFixed(0)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
