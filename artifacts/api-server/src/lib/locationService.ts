/**
 * Location Service — manages tracked locations that get auto-collected hourly.
 */

import {
  addLocationRecord,
  deleteLocationRecord,
  listActiveLocations,
  listLocations,
  updateLocationRecord,
} from "./store.js";

export async function addLocation(
  name: string,
  latitude: number,
  longitude: number,
  options?: {
    elevation?: number | null;
    cropType?: string | null;
    plantingDate?: string | null;
  },
) {
  return addLocationRecord({
    name,
    latitude,
    longitude,
    elevation: options?.elevation ?? null,
    cropType: options?.cropType ?? null,
    plantingDate: options?.plantingDate ?? null,
    active: true,
  });
}

export async function getLocations() {
  return listLocations();
}

export async function getActiveLocations() {
  return listActiveLocations();
}

export async function updateLocation(
  id: number,
  patch: {
    elevation?: number | null;
    cropType?: string | null;
    plantingDate?: string | null;
    active?: boolean;
  },
) {
  return updateLocationRecord(id, patch);
}

export async function deactivateLocation(id: number) {
  return updateLocationRecord(id, { active: false });
}

export async function activateLocation(id: number) {
  return updateLocationRecord(id, { active: true });
}

export async function deleteLocation(id: number) {
  return deleteLocationRecord(id);
}
