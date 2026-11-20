"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type LType from "leaflet";
import { openingLabel } from "@/lib/engine";
import { distanceLabel, waLink } from "@/lib/format";
import { ABIDJAN_CENTER, mapsDirectionsLink } from "@/lib/geo";
import type { Pharmacy, UserLocation } from "@/lib/types";
import { cn } from "./ui";

export interface PharmacyMapMarker {
  pharmacy: Pharmacy;
  distanceKm: number;
  badgeText?: string;
  badgeTone?: "green" | "amber" | "red";
  priceLabel?: string;
  subtitle?: string;
  waText?: string;
}

const PIN_COLORS: Record<"green" | "amber" | "red", string> = {
  green: "#0B7E72",
  amber: "#D98B12",
  red: "#DC2626",
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
  const { pharmacy, distanceKm, badgeText, badgeTone = "green", priceLabel, subtitle, waText } =
    marker;
  const mapsUrl = mapsDirectionsLink(pharmacy, userLocation);
  const telHref = `tel:${pharmacy.phone.replace(/\s/g, "")}`;
  const pinColor = PIN_COLORS[badgeTone];

  const parts: string[] = [
    `<div style="min-width:210px;max-width:260px;font-family:inherit;color:#0B1F1D;">`,
    `<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">`,
    `<strong style="font-size:13px;line-height:1.3;">${escapeHtml(pharmacy.name)}</strong>`,
    priceLabel
      ? `<span style="font-size:12px;font-weight:700;white-space:nowrap;color:#0B1F1D;">${escapeHtml(priceLabel)}</span>`
      : "",
    `</div>`,
    `<p style="margin:4px 0 0;font-size:11px;color:#475569;">${escapeHtml(pharmacy.quartier)} · ${escapeHtml(distanceLabel(distanceKm))}</p>`,
    `<p style="margin:2px 0 0;font-size:11px;color:#64748b;">${escapeHtml(openingLabel(pharmacy))}</p>`,
    badgeText
      ? `<span style="display:inline-block;margin-top:6px;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;background:${pinColor}18;color:${pinColor};">${escapeHtml(badgeText)}</span>`
      : "",
    subtitle
      ? `<p style="margin:6px 0 0;font-size:11px;color:#334155;">${escapeHtml(subtitle)}</p>`
      : "",
    `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">`,
    `<a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer" style="background:#0B7E72;color:#ffffff;padding:5px 10px;border-radius:8px;font-size:11px;font-weight:600;text-decoration:none;">Itinéraire</a>`,
    `<a href="${escapeHtml(telHref)}" style="border:1px solid #cbd5e1;color:#0B1F1D;padding:5px 10px;border-radius:8px;font-size:11px;font-weight:600;text-decoration:none;">Appeler</a>`,
  ];

  if (waText) {
    parts.push(
      `<a href="${escapeHtml(waLink(pharmacy.whatsapp, waText))}" target="_blank" rel="noreferrer" style="background:#25D366;color:#0B1F1D;padding:5px 10px;border-radius:8px;font-size:11px;font-weight:600;text-decoration:none;">WhatsApp</a>`,
    );
  }

  parts.push(`</div></div>`);
  return parts.join("");
}

export default function PharmacyMap({
  markers,
  userLocation,
  onSelectPharmacy,
  className,
}: {
  markers: PharmacyMapMarker[];
  userLocation?: UserLocation | null;
  onSelectPharmacy?: (pharmacyId: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const layerRef = useRef<LType.LayerGroup | null>(null);
  const leafletRef = useRef<typeof LType | null>(null);
  const selectRef = useRef(onSelectPharmacy);
  selectRef.current = onSelectPharmacy;

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

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);

        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
      }

      const map = mapRef.current;
      const layer = layerRef.current;
      if (!map || !layer) return;

      layer.clearLayers();
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
            `<strong style="font-size:12px;color:#0B1F1D;">Votre position GPS</strong>`,
          )
          .addTo(layer);
        bounds.push([userLocation.lat, userLocation.lng]);
      }

      for (const entry of markers) {
        const { pharmacy, badgeTone = "green" } = entry;
        if (!Number.isFinite(pharmacy.latitude) || !Number.isFinite(pharmacy.longitude)) {
          continue;
        }
        const color = PIN_COLORS[badgeTone];
        const pinIcon = L.divIcon({
          className: "kene-pharmacy-pin",
          html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:999px 999px 999px 2px;transform:rotate(-45deg);background:${color};border:2.5px solid #ffffff;box-shadow:0 8px 18px rgba(11,31,29,0.35);"><span style="width:7px;height:7px;border-radius:999px;background:#ffffff;transform:rotate(45deg);"></span></span>`,
          iconSize: [26, 26],
          iconAnchor: [13, 25],
          popupAnchor: [0, -22],
        });

        const pin = L.marker([pharmacy.latitude, pharmacy.longitude], {
          icon: pinIcon,
        });
        pin.bindPopup(buildPopupHtml(entry, userLocation));
        pin.on("click", () => selectRef.current?.(pharmacy.id));
        pin.addTo(layer);
        bounds.push([pharmacy.latitude, pharmacy.longitude]);
      }

      if (bounds.length === 1) {
        map.setView(bounds[0], 14);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
      } else {
        map.setView([ABIDJAN_CENTER.lat, ABIDJAN_CENTER.lng], 12);
      }
    }

    void setup();

    return () => {
      cancelled = true;
    };
  }, [markers, userLocation]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    },
    [],
  );

  return (
    <div className="isolate space-y-2">
      <div
        ref={containerRef}
        aria-label="Carte des pharmacies à Abidjan"
        className={cn(
          "h-[360px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-card",
          className,
        )}
      />
      <div className="flex flex-wrap items-center gap-4 px-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
          En stock / de garde
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sun-500" />
          Stock faible / partiel
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
          Rupture
        </span>
        {userLocation ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
            Votre position
          </span>
        ) : null}
      </div>
    </div>
  );
}
