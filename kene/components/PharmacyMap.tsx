"use client";

import "leaflet/dist/leaflet.css";
import { type MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import type LType from "leaflet";
import { openingLabel } from "@/lib/engine";
import { distanceLabel, waLink } from "@/lib/format";
import { ABIDJAN_CENTER, mapsDirectionsLink } from "@/lib/geo";
import type { Pharmacy, UserLocation } from "@/lib/types";
import { cn } from "./ui";

type MapStyle = "roadmap" | "hybrid" | "embed";
type TileMapStyle = "roadmap" | "hybrid";

export interface PharmacyMapMarker {
  pharmacy: Pharmacy;
  distanceKm: number;
  badgeText?: string;
  badgeTone?: "green" | "amber" | "red";
  priceLabel?: string;
  subtitle?: string;
  waText?: string;
}

export interface PharmacyMapProps {
  markers: PharmacyMapMarker[];
  userLocation?: UserLocation | null;
  activePharmacyId?: string | null;
  fillHeight?: boolean;
  onSelectPharmacy?: (pharmacyId: string) => void;
  className?: string;
}

const PIN_COLORS: Record<"green" | "amber" | "red", string> = {
  green: "#045D56",
  amber: "#B45309",
  red: "#BE123C",
};

const POPUP_BADGE_STYLES: Record<"green" | "amber" | "red", { bg: string; fg: string }> = {
  green: { bg: "#ECFDF5", fg: "#065F46" },
  amber: { bg: "#FFFBEB", fg: "#92400E" },
  red: { bg: "#FFF1F2", fg: "#9F1239" },
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPopupHtml(
  marker: PharmacyMapMarker,
  userLocation?: UserLocation | null,
): string {
  const {
    pharmacy,
    distanceKm,
    badgeText,
    badgeTone = "green",
    priceLabel,
    subtitle,
    waText,
  } = marker;
  const mapsUrl = mapsDirectionsLink(pharmacy, userLocation);
  const telHref = `tel:${pharmacy.phone.replace(/\s/g, "")}`;
  const badgePalette = POPUP_BADGE_STYLES[badgeTone];

  const parts: string[] = [
    `<div style="min-width:240px;max-width:290px;font-family:inherit;color:#0F172A;">`,
    `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">`,
    `<strong style="font-size:14px;font-weight:700;line-height:1.35;color:#0F172A;">${escapeHtml(pharmacy.name)}</strong>`,
    priceLabel
      ? `<span style="font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;color:#045D56;">${escapeHtml(priceLabel)}</span>`
      : "",
    `</div>`,
    `<p style="margin:6px 0 0;font-size:13px;line-height:1.4;color:#334155;">${escapeHtml(pharmacy.quartier)} · <strong style="color:#0F172A;">${escapeHtml(distanceLabel(distanceKm))}</strong></p>`,
    `<p style="margin:3px 0 0;font-size:13px;line-height:1.4;color:#475569;">${escapeHtml(openingLabel(pharmacy))}</p>`,
    badgeText
      ? `<span style="display:inline-block;margin-top:8px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;background:${badgePalette.bg};color:${badgePalette.fg};">${escapeHtml(badgeText)}</span>`
      : "",
    subtitle
      ? `<p style="margin:8px 0 0;font-size:13px;line-height:1.4;color:#334155;">${escapeHtml(subtitle)}</p>`
      : "",
    `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">`,
    `<a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;justify-content:center;background:#045D56;color:#ffffff;padding:8px 12px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;">Itinéraire</a>`,
    `<a href="${escapeHtml(telHref)}" style="display:inline-flex;align-items:center;justify-content:center;border:1.5px solid #cbd5e1;background:#ffffff;color:#0F172A;padding:8px 12px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;">Appeler</a>`,
  ];

  if (waText) {
    parts.push(
      `<a href="${escapeHtml(waLink(pharmacy.whatsapp, waText))}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;justify-content:center;background:#ECFDF5;color:#065F46;border:1px solid #A7F3D0;padding:8px 12px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;">WhatsApp</a>`,
    );
  }

  parts.push(`</div></div>`);
  return parts.join("");
}

function buildPinIcon(
  L: typeof LType,
  entry: PharmacyMapMarker,
  isActive: boolean,
): LType.DivIcon {
  const { badgeTone = "green", priceLabel } = entry;
  const toneColor = PIN_COLORS[badgeTone];

  if (priceLabel) {
    const dotColor = isActive ? "#FFFFFF" : toneColor;
    const pillStyle = isActive
      ? "background:#045D56;color:#FFFFFF;border:2px solid #FFFFFF;box-shadow:0 12px 26px -6px rgba(4,93,86,0.52),0 0 0 3px rgba(4,93,86,0.28);"
      : "background:#FFFFFF;color:#0F172A;border:2px solid #045D56;box-shadow:0 6px 16px -4px rgba(15,23,42,0.2),0 1px 3px rgba(15,23,42,0.08);";

    return L.divIcon({
      className: "kene-price-pin",
      html: `<div style="position:relative;width:max-content;pointer-events:auto;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:9999px;font-family:inherit;font-size:13px;font-weight:700;line-height:1.15;white-space:nowrap;font-variant-numeric:tabular-nums;transform-origin:bottom center;transform:translate(-50%,-100%) scale(${isActive ? "1.12" : "1"});transition:transform 160ms ease,background-color 160ms ease,box-shadow 160ms ease;${pillStyle}"><span style="width:7px;height:7px;border-radius:9999px;flex-shrink:0;background:${dotColor};"></span><span>${escapeHtml(priceLabel)}</span></div>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
      popupAnchor: [0, -38],
    });
  }

  const circleShadow = isActive
    ? "box-shadow:0 10px 24px -4px rgba(4,93,86,0.48),0 0 0 5px rgba(4,93,86,0.26);"
    : "box-shadow:0 6px 16px -4px rgba(15,23,42,0.28);";

  return L.divIcon({
    className: "kene-pharmacy-pin",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;cursor:pointer;"><span style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px;background:${toneColor};border:2.5px solid #FFFFFF;transform:scale(${isActive ? "1.14" : "1"});transition:transform 160ms ease,box-shadow 160ms ease;${circleShadow}"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round"/></svg></span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

function MapLegend({
  floating,
  showUserLocation,
}: {
  floating: boolean;
  showUserLocation: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs font-medium text-slate-700",
        floating
          ? "pointer-events-none absolute bottom-3 left-3 z-[400] rounded-full border border-slate-200/90 bg-white/95 px-3.5 py-2 shadow-soft backdrop-blur-md"
          : "px-1",
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-brand-700" />
        En stock / de garde
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-amber-600" />
        Stock faible / partiel
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-700" />
        Rupture
      </span>
      {showUserLocation ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
          Votre position
        </span>
      ) : null}
    </div>
  );
}

function applyMapBounds(map: LType.Map, bounds: LType.LatLngTuple[]) {
  if (bounds.length === 1) {
    map.setView(bounds[0], 14);
  } else if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  } else {
    map.setView([ABIDJAN_CENTER.lat, ABIDJAN_CENTER.lng], 12);
  }
}

function mountGoogleTileLayer(
  L: typeof LType,
  map: LType.Map,
  style: TileMapStyle,
  tileLayerRef: MutableRefObject<LType.TileLayer | null>,
  mapRef: MutableRefObject<LType.Map | null>,
) {
  if (tileLayerRef.current) {
    tileLayerRef.current.off();
    map.removeLayer(tileLayerRef.current);
    tileLayerRef.current = null;
  }

  const tileUrl =
    style === "hybrid"
      ? "https://mt{s}.google.com/vt/lyrs=y&hl=fr&x={x}&y={y}&z={z}"
      : "https://mt{s}.google.com/vt/lyrs=m&hl=fr&x={x}&y={y}&z={z}";

  const googleLayer = L.tileLayer(tileUrl, {
    subdomains: ["0", "1", "2", "3"],
    maxZoom: 20,
    attribution: "© Google Maps",
  });

  let failedTiles = 0;
  let fellBack = false;

  googleLayer.on("tileerror", () => {
    if (fellBack || tileLayerRef.current !== googleLayer) return;
    failedTiles += 1;
    if (failedTiles >= 4 && mapRef.current) {
      fellBack = true;
      googleLayer.off();
      mapRef.current.removeLayer(googleLayer);
      const osmFallback = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
        },
      ).addTo(mapRef.current);
      tileLayerRef.current = osmFallback;
    }
  });

  googleLayer.addTo(map);
  tileLayerRef.current = googleLayer;
}

function GoogleMapsControlBar({
  mapStyle,
  onChangeStyle,
  externalGoogleMapsUrl,
}: {
  mapStyle: MapStyle;
  onChangeStyle: (style: MapStyle) => void;
  externalGoogleMapsUrl: string;
}) {
  return (
    <div className="absolute right-3 top-3 z-[400] flex max-w-[calc(100%-52px)] flex-wrap items-center justify-end gap-1.5">
      <div
        role="group"
        aria-label="Mode d'affichage Google Maps"
        className="inline-flex items-center gap-0.5 rounded-xl border border-slate-200/90 bg-white/95 p-1 shadow-soft backdrop-blur"
      >
        <button
          type="button"
          onClick={() => onChangeStyle("roadmap")}
          aria-pressed={mapStyle === "roadmap"}
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-xs font-bold leading-none transition",
            mapStyle === "roadmap"
              ? "bg-brand-700 text-white shadow-sm"
              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          Plan
        </button>
        <button
          type="button"
          onClick={() => onChangeStyle("hybrid")}
          aria-pressed={mapStyle === "hybrid"}
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-xs font-bold leading-none transition",
            mapStyle === "hybrid"
              ? "bg-brand-700 text-white shadow-sm"
              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          Satellite
        </button>
        <button
          type="button"
          onClick={() => onChangeStyle("embed")}
          aria-pressed={mapStyle === "embed"}
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-xs font-bold leading-none transition",
            mapStyle === "embed"
              ? "bg-brand-700 text-white shadow-sm"
              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
          )}
        >
          Google Maps
        </button>
      </div>

      <a
        href={externalGoogleMapsUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white/95 px-2.5 py-2 text-xs font-bold leading-none text-brand-700 shadow-soft backdrop-blur transition hover:bg-white hover:text-brand-800"
      >
        Ouvrir ↗
      </a>
    </div>
  );
}

export default function PharmacyMap({
  markers,
  userLocation,
  activePharmacyId = null,
  fillHeight = false,
  onSelectPharmacy,
  className,
}: PharmacyMapProps) {
  const [mapStyle, setMapStyle] = useState<MapStyle>("roadmap");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const tileLayerRef = useRef<LType.TileLayer | null>(null);
  const appliedTileStyleRef = useRef<TileMapStyle | null>(null);
  const layerRef = useRef<LType.LayerGroup | null>(null);
  const leafletRef = useRef<typeof LType | null>(null);
  const boundsRef = useRef<LType.LatLngTuple[]>([]);
  const markerMapRef = useRef<
    Map<string, { marker: LType.Marker; entry: PharmacyMapMarker }>
  >(new Map());
  const selectRef = useRef(onSelectPharmacy);
  selectRef.current = onSelectPharmacy;
  const activeIdRef = useRef(activePharmacyId);
  activeIdRef.current = activePharmacyId;
  const prevActiveIdRef = useRef<string | null>(activePharmacyId);
  const mapStyleRef = useRef<MapStyle>(mapStyle);
  mapStyleRef.current = mapStyle;
  const prevMapStyleRef = useRef<MapStyle>(mapStyle);

  const activeMarker = useMemo(
    () =>
      activePharmacyId
        ? markers.find((entry) => entry.pharmacy.id === activePharmacyId) ?? null
        : null,
    [activePharmacyId, markers],
  );

  const embedUrl = useMemo(() => {
    if (
      activeMarker &&
      Number.isFinite(activeMarker.pharmacy.latitude) &&
      Number.isFinite(activeMarker.pharmacy.longitude) &&
      (activeMarker.pharmacy.latitude !== 0 || activeMarker.pharmacy.longitude !== 0)
    ) {
      const { latitude, longitude, name } = activeMarker.pharmacy;
      return `https://maps.google.com/maps?q=${latitude},${longitude}+(${encodeURIComponent(name)})&hl=fr&z=16&output=embed`;
    }
    return "https://maps.google.com/maps?q=5.3484,-4.0124&hl=fr&z=12&output=embed";
  }, [activeMarker]);

  const externalGoogleMapsUrl = useMemo(() => {
    if (activeMarker) {
      return mapsDirectionsLink(activeMarker.pharmacy, userLocation);
    }
    return "https://www.google.com/maps/search/?api=1&query=5.3484,-4.0124";
  }, [activeMarker, userLocation]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (mapStyleRef.current !== "embed") {
        mapRef.current?.invalidateSize({ animate: false });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      const mod = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      const L = mod.default;
      leafletRef.current = L;

      if (!mapRef.current) {
        const map = L.map(containerRef.current, {
          center: [ABIDJAN_CENTER.lat, ABIDJAN_CENTER.lng],
          zoom: 12,
          scrollWheelZoom: false,
        });

        const initialTileStyle: TileMapStyle =
          mapStyleRef.current === "hybrid" ? "hybrid" : "roadmap";
        mountGoogleTileLayer(L, map, initialTileStyle, tileLayerRef, mapRef);
        appliedTileStyleRef.current = initialTileStyle;

        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;

        requestAnimationFrame(() => {
          if (!cancelled && mapStyleRef.current !== "embed") {
            map.invalidateSize({ animate: false });
          }
        });
      }

      const map = mapRef.current;
      const layer = layerRef.current;
      if (!map || !layer) return;

      layer.clearLayers();
      markerMapRef.current.clear();
      const bounds: LType.LatLngTuple[] = [];

      if (userLocation) {
        const userIcon = L.divIcon({
          className: "kene-user-pin",
          html: `<span style="display:block;width:16px;height:16px;border-radius:999px;background:#2563EB;border:3px solid #ffffff;box-shadow:0 0 0 6px rgba(37,99,235,0.22);"></span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
          .bindPopup(
            `<strong style="font-size:13px;color:#0F172A;">Votre position GPS</strong>`,
          )
          .addTo(layer);
        bounds.push([userLocation.lat, userLocation.lng]);
      }

      for (const entry of markers) {
        const { pharmacy } = entry;
        if (!Number.isFinite(pharmacy.latitude) || !Number.isFinite(pharmacy.longitude)) {
          continue;
        }
        const isActive = pharmacy.id === activeIdRef.current;
        const pinIcon = buildPinIcon(L, entry, isActive);

        const pin = L.marker([pharmacy.latitude, pharmacy.longitude], {
          icon: pinIcon,
          zIndexOffset: isActive ? 1000 : 0,
        });
        pin.bindPopup(buildPopupHtml(entry, userLocation));
        pin.on("click", () => selectRef.current?.(pharmacy.id));
        pin.addTo(layer);
        markerMapRef.current.set(pharmacy.id, { marker: pin, entry });
        bounds.push([pharmacy.latitude, pharmacy.longitude]);
      }

      boundsRef.current = bounds;
      if (mapStyleRef.current !== "embed") {
        applyMapBounds(map, bounds);
      }
      prevActiveIdRef.current = activeIdRef.current;
    }

    void setup();

    return () => {
      cancelled = true;
    };
  }, [markers, userLocation]);

  useEffect(() => {
    const prevStyle = prevMapStyleRef.current;
    prevMapStyleRef.current = mapStyle;

    if (mapStyle === "embed") return;

    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (appliedTileStyleRef.current !== mapStyle) {
      mountGoogleTileLayer(L, map, mapStyle, tileLayerRef, mapRef);
      appliedTileStyleRef.current = mapStyle;
    }

    if (prevStyle === "embed") {
      requestAnimationFrame(() => {
        if (!mapRef.current || mapStyleRef.current === "embed") return;
        mapRef.current.invalidateSize({ animate: false });
        applyMapBounds(mapRef.current, boundsRef.current);
      });
    }
  }, [mapStyle]);

  useEffect(() => {
    const L = leafletRef.current;
    const prevId = prevActiveIdRef.current;
    prevActiveIdRef.current = activePharmacyId;
    if (!L || prevId === activePharmacyId) return;

    if (prevId) {
      const previous = markerMapRef.current.get(prevId);
      if (previous) {
        previous.marker.setIcon(buildPinIcon(L, previous.entry, false));
        previous.marker.setZIndexOffset(0);
      }
    }

    if (activePharmacyId) {
      const next = markerMapRef.current.get(activePharmacyId);
      if (next) {
        next.marker.setIcon(buildPinIcon(L, next.entry, true));
        next.marker.setZIndexOffset(1000);
      }
    }
  }, [activePharmacyId]);

  useEffect(() => {
    const markerMap = markerMapRef.current;
    return () => {
      markerMap.clear();
      tileLayerRef.current?.off();
      tileLayerRef.current = null;
      appliedTileStyleRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  if (fillHeight) {
    return (
      <div className={cn("relative isolate h-full w-full", className)}>
        <div
          ref={containerRef}
          aria-label="Carte des pharmacies à Abidjan"
          className={cn(
            "h-full min-h-[420px] w-full overflow-hidden rounded-2xl bg-slate-100",
            mapStyle === "embed" && "hidden",
          )}
        />
        {mapStyle === "embed" ? (
          <iframe
            title="Carte Google Maps Abidjan"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={embedUrl}
            className="h-full min-h-[420px] w-full rounded-2xl border-0"
            allowFullScreen
          />
        ) : null}
        <GoogleMapsControlBar
          mapStyle={mapStyle}
          onChangeStyle={setMapStyle}
          externalGoogleMapsUrl={externalGoogleMapsUrl}
        />
        {mapStyle !== "embed" ? (
          <MapLegend floating showUserLocation={Boolean(userLocation)} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="isolate space-y-2">
      <div
        className={cn(
          "relative h-[360px] w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-card",
          className,
        )}
      >
        <div
          ref={containerRef}
          aria-label="Carte des pharmacies à Abidjan"
          className={cn("h-full w-full", mapStyle === "embed" && "hidden")}
        />
        {mapStyle === "embed" ? (
          <iframe
            title="Carte Google Maps Abidjan"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={embedUrl}
            className="h-full min-h-[420px] w-full rounded-2xl border-0"
            allowFullScreen
          />
        ) : null}
        <GoogleMapsControlBar
          mapStyle={mapStyle}
          onChangeStyle={setMapStyle}
          externalGoogleMapsUrl={externalGoogleMapsUrl}
        />
      </div>
      <MapLegend floating={false} showUserLocation={Boolean(userLocation)} />
    </div>
  );
}
