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
  return await addLocationRecord({
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
  return await listLocations();
}

export async function getActiveLocations() {
  return await listActiveLocations();
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
  return await updateLocationRecord(id, patch);
}

export async function deactivateLocation(id: number) {
  return await updateLocationRecord(id, { active: false });
}

export async function activateLocation(id: number) {
  return await updateLocationRecord(id, { active: true });
}

export async function deleteLocation(id: number) {
  return await deleteLocationRecord(id);
}
