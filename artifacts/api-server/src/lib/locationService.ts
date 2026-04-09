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
  farmerId: number | null,
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
    farmerId,
    elevation: options?.elevation ?? null,
    cropType: options?.cropType ?? null,
    plantingDate: options?.plantingDate ?? null,
    active: true,
  });
}

export async function getLocations(farmerId?: number | null) {
  return await listLocations({ farmerId });
}

export async function getActiveLocations(farmerId?: number | null) {
  return await listActiveLocations({ farmerId });
}

export async function updateLocation(
  id: number,
  farmerId: number | null | undefined,
  patch: {
    elevation?: number | null;
    cropType?: string | null;
    plantingDate?: string | null;
    active?: boolean;
  },
) {
  return await updateLocationRecord(id, patch, { farmerId });
}

export async function deactivateLocation(id: number, farmerId?: number | null) {
  return await updateLocationRecord(id, { active: false }, { farmerId });
}

export async function activateLocation(id: number, farmerId?: number | null) {
  return await updateLocationRecord(id, { active: true }, { farmerId });
}

export async function deleteLocation(id: number, farmerId?: number | null) {
  return await deleteLocationRecord(id, { farmerId });
}
