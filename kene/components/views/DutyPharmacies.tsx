"use client";

import { useMemo, useState } from "react";
import { useStore } from "../store";
import { Badge, Card, cn } from "../ui";
import PharmacyMap, { type PharmacyMapMarker } from "../PharmacyMap";
import {
  IconAlert,
  IconChevronRight,
  IconClock,
  IconClose,
  IconCrosshair,
  IconList,
  IconMap,
  IconMapPin,
  IconNavigation,
  IconPhone,
  IconSearch,
  IconStar,
  IconWhatsApp,
} from "../icons";
import {
  LEVEL_META,
  dutyPharmacies,
  openingLabel,
  publicPharmacies,
  stockLevel,
} from "@/lib/engine";
import { distanceLabel, fcfa, timeAgo, waLink } from "@/lib/format";
import { mapsDirectionsLink } from "@/lib/geo";
import type { Medicine, StockItem } from "@/lib/types";

export default function DutyPharmacies() {
  const {
    state,
    userLocation,
    locationStatus,
    requestLocation,
    clearLocation,
    favoritePharmacyIds,
    toggleFavoritePharmacy,
  } = useStore();

  const [quartier, setQuartier] = useState("Tous");
  const [query, setQuery] = useState("");
  const [display, setDisplay] = useState<"list" | "map">("list");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const allDuty = useMemo(
    () => dutyPharmacies(state, { userLocation }),
    [state, userLocation],
  );
  const quartiers = useMemo(
    () => [
      "Tous",
      ...Array.from(new Set(publicPharmacies(state).map((pharmacy) => pharmacy.quartier))),
    ],
    [state],
  );

  const rows = useMemo(
    () => dutyPharmacies(state, { quartier, query, userLocation }),
    [state, quartier, query, userLocation],
  );

  const inStockByPharmacy = useMemo(() => {
    const medicineById = new Map(state.medicines.map((item) => [item.id, item]));
    const grouped = new Map<string, Array<{ medicine: Medicine; stock: StockItem }>>();
    for (const item of state.stock) {
      if (item.quantity <= 0) continue;
      const medicine = medicineById.get(item.medicineId);
      if (!medicine) continue;
      const bucket = grouped.get(item.pharmacyId) ?? [];
      bucket.push({ medicine, stock: item });
      grouped.set(item.pharmacyId, bucket);
    }
    for (const bucket of grouped.values()) {
      bucket.sort((a, b) => a.medicine.name.localeCompare(b.medicine.name));
    }
    return grouped;
  }, [state.medicines, state.stock]);

  const toggleExpanded = (pharmacyId: string) => {
    setExpandedIds((previous) =>
      previous.includes(pharmacyId)
        ? previous.filter((id) => id !== pharmacyId)
        : [...previous, pharmacyId],
    );
  };

  const mapMarkers = useMemo<PharmacyMapMarker[]>(
    () =>
      rows.map(({ pharmacy, distanceKm, inStockCount, matchingMedicines }) => ({
        pharmacy,
        distanceKm,
        badgeText: "De garde · 24 h/24",
        badgeTone: "green",
        subtitle:
          matchingMedicines.length > 0
            ? `${matchingMedicines.length} médicament(s) trouvé(s) · ${pharmacy.dutyNote || `${inStockCount} réf. en stock`}`
            : pharmacy.dutyNote || `${inStockCount} références en stock`,
        waText: query.trim()
          ? `Bonjour, êtes-vous bien de garde et avez-vous « ${query.trim()} » disponible ? (via Kéné)`
          : `Bonjour, je confirme votre permanence de garde avant de passer. (via Kéné)`,
      })),
    [rows, query],
  );

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl bg-ink-900 px-6 py-7 text-white shadow-lift">
        <div className="hero-grid absolute inset-0 opacity-40" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-brand-200">
              <IconClock className="h-3.5 w-3.5" />
              Permanence 24 h/24 · Abidjan
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              {allDuty.length} pharmacie{allDuty.length > 1 ? "s" : ""} de garde
              <span className="block text-brand-300">
                signalée{allDuty.length > 1 ? "s" : ""} ouverte{allDuty.length > 1 ? "s" : ""} maintenant
              </span>
            </h2>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-300">
              Trouvez les pharmacies de garde ouvertes 24 h/24 autour de vous, consultez
              les références en stock et lancez l&apos;itinéraire ou l&apos;appel
              directement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {userLocation ? (
              <div className="flex items-center gap-2 rounded-xl border border-brand-400/40 bg-brand-500/20 px-3.5 py-2.5">
                <IconCrosshair className="h-4 w-4 text-brand-300" />
                <span className="text-xs font-semibold text-brand-100">
                  Trié par votre position GPS
                </span>
                <button
                  type="button"
                  onClick={requestLocation}
                  className="rounded-lg bg-white/15 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-white/25"
                >
                  Actualiser
                </button>
                <button
                  type="button"
                  onClick={clearLocation}
                  aria-label="Effacer ma position GPS"
                  className="rounded-lg p-1 text-slate-300 transition hover:bg-white/15 hover:text-white"
                >
                  <IconClose className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={requestLocation}
                disabled={locationStatus === "locating"}
                className="btn bg-brand-400 px-4 py-3 text-xs font-semibold text-ink-900 hover:bg-brand-300 disabled:opacity-60"
              >
                <IconCrosshair className="h-4 w-4" />
                {locationStatus === "locating"
                  ? "Localisation en cours…"
                  : "Trouver la plus proche de moi"}
              </button>
            )}
          </div>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              aria-label="Chercher un médicament disponible en garde"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Médicament ou commune en garde (ex. paracétamol, amoxicilline)…"
              className="input py-2 pl-9 text-xs"
            />
          </div>

          <select
            aria-label="Filtrer par commune"
            value={quartier}
            onChange={(event) => setQuartier(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 focus:border-brand-400 focus:outline-none"
          >
            {quartiers.map((item) => (
              <option key={item} value={item}>
                {item === "Tous" ? "Toutes les communes" : item}
              </option>
            ))}
          </select>

          <div
            role="group"
            aria-label="Affichage liste ou carte"
            className="ml-auto inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold"
          >
            <button
              type="button"
              onClick={() => setDisplay("list")}
              aria-pressed={display === "list"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition",
                display === "list"
                  ? "bg-white text-ink-900 shadow-sm"
                  : "text-slate-500 hover:text-ink-900",
              )}
            >
              <IconList className="h-3.5 w-3.5" />
              Liste
            </button>
            <button
              type="button"
              onClick={() => setDisplay("map")}
              aria-pressed={display === "map"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition",
                display === "map"
                  ? "bg-white text-ink-900 shadow-sm"
                  : "text-slate-500 hover:text-ink-900",
              )}
            >
              <IconMap className="h-3.5 w-3.5" />
              Carte
            </button>
          </div>
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium text-ink-900">
            Aucune pharmacie de garde ne correspond à ce filtre
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
            Élargissez la commune ou effacez la recherche de médicament. En cas
            d&apos;urgence vitale, appelez le SAMU au 185.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setQuartier("Tous");
                setQuery("");
              }}
              className="btn-secondary text-xs"
            >
              Voir toutes les pharmacies de garde
            </button>
            <a href="tel:185" className="btn-primary text-xs">
              Appeler le SAMU 185
            </a>
          </div>
        </Card>
      ) : display === "map" ? (
        <PharmacyMap markers={mapMarkers} userLocation={userLocation} />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {rows.map(({ pharmacy, distanceKm, inStockCount, matchingMedicines }) => {
            const isFav = favoritePharmacyIds.includes(pharmacy.id);
            const isExpanded = expandedIds.includes(pharmacy.id);
            const catalogItems = inStockByPharmacy.get(pharmacy.id) ?? [];

            return (
              <Card key={pharmacy.id} className="flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-ink-900">
                          {pharmacy.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => toggleFavoritePharmacy(pharmacy.id)}
                          aria-pressed={isFav}
                          aria-label={
                            isFav
                              ? `Retirer ${pharmacy.name} des favorites`
                              : `Ajouter ${pharmacy.name} aux favorites`
                          }
                          className={cn(
                            "rounded-lg p-1 transition",
                            isFav
                              ? "text-sun-500 hover:bg-sun-50"
                              : "text-slate-400 hover:bg-slate-100 hover:text-sun-500",
                          )}
                        >
                          <IconStar filled={isFav} className="h-4 w-4" />
                        </button>
                        <Badge tone="green">{openingLabel(pharmacy)}</Badge>
                      </div>

                      <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 font-medium text-ink-900">
                          <IconMapPin className="h-3.5 w-3.5 text-brand-600" />
                          {pharmacy.quartier} · {distanceLabel(distanceKm)}
                        </span>
                        <span>{inStockCount} références en stock</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{pharmacy.address}</p>
                    </div>
                  </div>

                  {pharmacy.dutyNote ? (
                    <div className="mt-3 rounded-xl bg-brand-50 px-3.5 py-2 text-xs font-medium text-brand-800">
                      {pharmacy.dutyNote}
                    </div>
                  ) : null}

                  {matchingMedicines.length > 0 ? (
                    <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/70">
                      {matchingMedicines.slice(0, 4).map(({ medicine, stock }) => (
                        <li
                          key={medicine.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink-900">
                              {medicine.name}
                            </p>
                            <p className="truncate text-[10px] text-slate-500">
                              {medicine.dci} · {stock.quantity} en rayon ·{" "}
                              {timeAgo(stock.updatedAt)}
                            </p>
                          </div>
                          <span className="shrink-0 font-semibold text-brand-700">
                            {fcfa(stock.price)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {catalogItems.length > 0 ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(pharmacy.id)}
                        aria-expanded={isExpanded}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-ink-900 transition hover:border-brand-300 hover:bg-brand-50/60"
                      >
                        <IconChevronRight
                          className={cn(
                            "h-3.5 w-3.5 text-brand-600 transition-transform",
                            isExpanded && "rotate-90",
                          )}
                        />
                        {isExpanded
                          ? `Masquer les médicaments (${catalogItems.length})`
                          : `Voir les médicaments en stock (${catalogItems.length})`}
                      </button>

                      {isExpanded ? (
                        <ul className="scroll-thin mt-2 max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60">
                          {catalogItems.map(({ medicine, stock }) => {
                            const level = stockLevel(stock);
                            const meta = LEVEL_META[level];
                            return (
                              <li
                                key={medicine.id}
                                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium text-ink-900">
                                    {medicine.name}
                                  </p>
                                  <p className="truncate text-[10px] text-slate-500">
                                    {medicine.dci} · {medicine.form}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge tone={meta.tone}>
                                    {level === "low"
                                      ? `${meta.label} (${stock.quantity})`
                                      : meta.label}
                                  </Badge>
                                  <span className="font-semibold text-ink-900">
                                    {fcfa(stock.price)}
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                  <a
                    href={mapsDirectionsLink(pharmacy, userLocation)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary flex-1 px-4 py-2.5 text-xs sm:flex-none"
                  >
                    <IconNavigation className="h-4 w-4" />
                    Itinéraire GPS
                  </a>
                  <a
                    href={`tel:${pharmacy.phone.replace(/\s/g, "")}`}
                    className="btn-secondary flex-1 px-4 py-2.5 text-xs sm:flex-none"
                  >
                    <IconPhone className="h-4 w-4" />
                    Appeler
                  </a>
                  <a
                    href={waLink(
                      pharmacy.whatsapp,
                      query.trim()
                        ? `Bonjour, êtes-vous bien de garde et avez-vous « ${query.trim()} » disponible ? (via Kéné)`
                        : `Bonjour, je confirme votre permanence de garde avant de passer. (via Kéné)`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="btn flex-1 bg-[#25D366] px-4 py-2.5 text-xs text-ink-900 hover:bg-[#1FB855] sm:flex-none"
                  >
                    <IconWhatsApp className="h-4 w-4" />
                    WhatsApp
                  </a>
                  {pharmacy.updatedAt ? (
                    <span className="ml-auto text-[11px] text-slate-500">
                      Maj {timeAgo(pharmacy.updatedAt)}
                    </span>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-sun-200 bg-sun-50 px-4 py-3">
        <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-sun-600" />
        <p className="text-[11px] leading-relaxed text-sun-800">
          Les permanences et stocks sont déclarés par chaque officine. Appelez la
          pharmacie avant de vous déplacer la nuit. En cas d&apos;urgence vitale,
          appelez le <strong>185 (SAMU)</strong>.
        </p>
      </div>
    </div>
  );
}
