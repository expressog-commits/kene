import { mapsLink } from "./format";
import type { UserLocation } from "./types";

export const ABIDJAN_CENTER: UserLocation = { lat: 5.3484, lng: -4.0124 };

export const COMMUNE_COORDS: Record<string, UserLocation> = {
  Plateau: { lat: 5.3235, lng: -4.0211 },
  Cocody: { lat: 5.3601, lng: -3.9873 },
  Yopougon: { lat: 5.3455, lng: -4.0856 },
  Marcory: { lat: 5.3029, lng: -3.9896 },
  Adjamé: { lat: 5.3516, lng: -4.0235 },
  Abobo: { lat: 5.4161, lng: -4.0159 },
  Koumassi: { lat: 5.2919, lng: -3.9522 },
  Treichville: { lat: 5.3055, lng: -4.0067 },
  "Port-Bouët": { lat: 5.2572, lng: -3.9301 },
  Bingerville: { lat: 5.3558, lng: -3.8906 },
};

function normalizeGeoKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function coordsForQuartier(quartier: string): UserLocation {
  const key = normalizeGeoKey(quartier);
  for (const [commune, coords] of Object.entries(COMMUNE_COORDS)) {
    if (normalizeGeoKey(commune) === key) {
      return { ...coords };
    }
  }
  return { ...ABIDJAN_CENTER };
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineKm(a: UserLocation, b: UserLocation): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const dist = 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
  return Math.round(dist * 10) / 10;
}

function isValidLocation(loc?: UserLocation | null): loc is UserLocation {
  return Boolean(
    loc &&
      Number.isFinite(loc.lat) &&
      Number.isFinite(loc.lng) &&
      Math.abs(loc.lat) <= 90 &&
      Math.abs(loc.lng) <= 180,
  );
}

export function effectiveDistanceKm(
  item: { latitude: number; longitude: number; distanceKm: number },
  userLocation?: UserLocation | null,
): number {
  if (
    isValidLocation(userLocation) &&
    Number.isFinite(item.latitude) &&
    Number.isFinite(item.longitude) &&
    (item.latitude !== 0 || item.longitude !== 0)
  ) {
    return haversineKm(userLocation, {
      lat: item.latitude,
      lng: item.longitude,
    });
  }
  return item.distanceKm;
}

export function mapsDirectionsLink(
  item: {
    name: string;
    address: string;
    quartier?: string;
    latitude?: number;
    longitude?: number;
  },
  userLocation?: UserLocation | null,
): string {
  if (
    typeof item.latitude === "number" &&
    typeof item.longitude === "number" &&
    Number.isFinite(item.latitude) &&
    Number.isFinite(item.longitude) &&
    (item.latitude !== 0 || item.longitude !== 0)
  ) {
    const base = `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`;
    if (isValidLocation(userLocation)) {
      return `${base}&origin=${userLocation.lat},${userLocation.lng}`;
    }
    return base;
  }
  return mapsLink(item.name, item.address, item.quartier);
}
