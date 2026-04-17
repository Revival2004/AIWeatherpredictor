import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import {
  getGetLocationsQueryKey,
  type TrackedLocation,
  useGetLocations,
} from "@/lib/api-client";

const TRACKED_LOCATIONS_CACHE_PREFIX = "farmpal_tracked_locations_v1_";

function getCacheKey(farmerId?: number | null): string {
  return `${TRACKED_LOCATIONS_CACHE_PREFIX}${farmerId ?? "anonymous"}`;
}

function sortLocations(locations: TrackedLocation[]): TrackedLocation[] {
  return [...locations].sort((a, b) => {
    const activeDelta = Number(b.active) - Number(a.active);
    if (activeDelta !== 0) {
      return activeDelta;
    }

    return new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime();
  });
}

function mergeLocationList(
  locations: TrackedLocation[],
  nextLocation: TrackedLocation,
): TrackedLocation[] {
  return sortLocations([
    nextLocation,
    ...locations.filter((location) => location.id !== nextLocation.id),
  ]);
}

export function useTrackedLocationsCache(options?: {
  enabled?: boolean;
  farmerId?: number | null;
}) {
  const enabled = options?.enabled ?? true;
  const cacheKey = getCacheKey(options?.farmerId);
  const [cachedLocations, setCachedLocations] = useState<TrackedLocation[]>([]);
  const query = useGetLocations({
    query: {
      queryKey: getGetLocationsQueryKey(),
      staleTime: 30 * 1000,
      enabled,
    },
  });

  const persistLocations = useCallback((next: TrackedLocation[]) => {
    const normalized = sortLocations(next);
    setCachedLocations(normalized);
    AsyncStorage.setItem(cacheKey, JSON.stringify(normalized)).catch(() => {});
  }, [cacheKey]);

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(cacheKey)
      .then((raw) => {
        if (!active) {
          return;
        }

        if (raw) {
          try {
            const parsed = JSON.parse(raw) as TrackedLocation[];
            if (Array.isArray(parsed)) {
              setCachedLocations(sortLocations(parsed));
            }
          } catch {}
        }
      });

    return () => {
      active = false;
    };
  }, [cacheKey]);

  useEffect(() => {
    if (query.data?.locations) {
      persistLocations(query.data.locations);
    }
  }, [persistLocations, query.data?.locations]);

  const locations = query.data?.locations ?? cachedLocations;
  const hasFallbackLocations = !query.data?.locations && cachedLocations.length > 0;
  const isLoading = query.isLoading && locations.length === 0;

  const upsertLocation = useCallback((nextLocation: TrackedLocation) => {
    setCachedLocations((previous) => {
      const next = mergeLocationList(previous, nextLocation);
      AsyncStorage.setItem(cacheKey, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [cacheKey]);

  const removeLocation = useCallback((locationId: number) => {
    setCachedLocations((previous) => {
      const next = previous.filter((location) => location.id !== locationId);
      AsyncStorage.setItem(cacheKey, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [cacheKey]);

  const replaceLocations = useCallback((nextLocations: TrackedLocation[]) => {
    persistLocations(nextLocations);
  }, [persistLocations]);

  return {
    locations,
    hasFallbackLocations,
    isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    replaceLocations,
    upsertLocation,
    removeLocation,
  };
}
