"use client";

import { useMemo, useRef, useState } from "react";
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
  const [hoveredPharmacyId, setHoveredPharmacyId] = useState<string | null>(null);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const allDuty = useMemo(
    () => dutyPharmacies(state, { userLocation }),
    [state, userLocation],
  );
  const quartiers = useMemo(
    () => [
      "Tous",
      ...Array.from(
        new Set(publicPharmacies(state).map((pharmacy) => pharmacy.quartier)),
      ),
    ],
    [state],
  );

  const rows = useMemo(
    () => dutyPharmacies(state, { quartier, query, userLocation }),
    [state, quartier, query, userLocation],
  );

  const inStockByPharmacy = useMemo(() => {
    const medicineById = new Map(state.medicines.map((item) => [item.id, item]));
    const grouped = new Map<
      string,
      Array<{ medicine: Medicine; stock: StockItem }>
    >();
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

  const rawActiveId = hoveredPharmacyId ?? selectedPharmacyId;
  const activePharmacyId = useMemo(
    () =>
      rawActiveId && rows.some((entry) => entry.pharmacy.id === rawActiveId)
        ? rawActiveId
        : null,
    [rawActiveId, rows],
  );

  const handleSelectPharmacyFromMap = (pharmacyId: string) => {
    setSelectedPharmacyId(pharmacyId);
    const cardNode = cardRefs.current.get(pharmacyId);
    if (cardNode) {
      cardNode.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const hasFilters = quartier !== "Tous" || query.trim().length > 0;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-brand-200/70 bg-gradient-to-br from-brand-50/80 via-white to-emerald-50/40 p-5 shadow-card sm:p-6">
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <Badge tone="green" dot pulse>
              Permanence 24 h/24 · Abidjan
            </Badge>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
              <span className="tabular-nums text-brand-700">
                {allDuty.length}
              </span>{" "}
              pharmacie{allDuty.length > 1 ? "s" : ""} de garde
              <span className="mt-0.5 block text-lg font-semibold text-slate-600 sm:text-xl">
                signalée{allDuty.length > 1 ? "s" : ""} ouverte
                {allDuty.length > 1 ? "s" : ""} maintenant
              </span>
            </h2>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-600 sm:text-[13px]">
              Trouvez les pharmacies de garde ouvertes 24 h/24 autour de vous,
              consultez les références en stock et lancez l&apos;itinéraire ou
              l&apos;appel directement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {userLocation ? (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand-200 bg-white/95 px-3.5 py-2.5 shadow-sm">
                <IconCrosshair className="h-4 w-4 text-brand-600" />
                <span className="text-xs font-semibold text-brand-800">
                  Trié par votre position GPS
                </span>
                <button
                  type="button"
                  onClick={requestLocation}
                  className="rounded-xl bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-800 transition hover:bg-brand-100"
                >
                  Actualiser
                </button>
                <button
                  type="button"
                  onClick={clearLocation}
                  aria-label="Effacer ma position GPS"
                  className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-ink-900"
                >
                  <IconClose className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={requestLocation}
                disabled={locationStatus === "locating"}
                className="btn-primary rounded-2xl px-5 py-3 text-xs font-semibold disabled:opacity-60"
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

      <Card className="rounded-2xl p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-600" />
            <input
              type="search"
              aria-label="Chercher un médicament disponible en garde"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Médicament ou commune en garde (ex. paracétamol, amoxicilline)…"
              className="input rounded-xl py-2 pl-10 pr-8 text-xs"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Effacer la recherche"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-ink-900"
              >
                <IconClose className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <select
            aria-label="Filtrer par commune"
            value={quartier}
            onChange={(event) => setQuartier(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
          >
            {quartiers.map((item) => (
              <option key={item} value={item}>
                {item === "Tous" ? "Toutes les communes" : item}
              </option>
            ))}
          </select>

          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setQuartier("Tous");
                setQuery("");
              }}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-ink-900"
            >
              Réinitialiser
            </button>
          ) : null}

          <div
            role="group"
            aria-label="Affichage liste ou carte"
            className="ml-auto inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold lg:hidden"
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
        <Card className="rounded-3xl p-8 text-center shadow-card">
          <p className="text-sm font-semibold text-ink-900">
            Aucune pharmacie de garde ne correspond à ce filtre
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">
            Élargissez la commune ou effacez la recherche de médicament. En cas
            d&apos;urgence vitale, appelez le SAMU au 185.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setQuartier("Tous");
                setQuery("");
              }}
              className="btn-secondary rounded-xl text-xs"
            >
              Voir toutes les pharmacies de garde
            </button>
            <a href="tel:185" className="btn-primary rounded-xl text-xs">
              Appeler le SAMU 185
            </a>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {display === "map" ? (
            <div className="h-[62vh] min-h-[380px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-card lg:hidden">
              <PharmacyMap
                fillHeight
                markers={mapMarkers}
                userLocation={userLocation}
                activePharmacyId={activePharmacyId}
                onSelectPharmacy={handleSelectPharmacyFromMap}
              />
            </div>
          ) : null}

          <div className="lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-start lg:gap-6">
            <div
              className={cn(
                "space-y-4",
                display === "map" && "hidden lg:block",
              )}
            >
              {rows.map(
                ({ pharmacy, distanceKm, inStockCount, matchingMedicines }) => {
                  const isFav = favoritePharmacyIds.includes(pharmacy.id);
                  const isExpanded = expandedIds.includes(pharmacy.id);
                  const isActive = activePharmacyId === pharmacy.id;
                  const catalogItems =
                    inStockByPharmacy.get(pharmacy.id) ?? [];

                  return (
                    <div
                      key={pharmacy.id}
                      ref={(node) => {
                        if (node) {
                          cardRefs.current.set(pharmacy.id, node);
                        } else {
                          cardRefs.current.delete(pharmacy.id);
                        }
                      }}
                      onMouseEnter={() => setHoveredPharmacyId(pharmacy.id)}
                      onMouseLeave={() =>
                        setHoveredPharmacyId((current) =>
                          current === pharmacy.id ? null : current,
                        )
                      }
                      onClick={() => setSelectedPharmacyId(pharmacy.id)}
                      className="scroll-mt-24"
                    >
                      <Card
                        className={cn(
                          "flex flex-col justify-between rounded-2xl p-5 transition duration-200",
                          isActive &&
                            "border-brand-400 ring-2 ring-brand-500/40 shadow-soft",
                        )}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-[15px] font-bold text-ink-900">
                                  {pharmacy.name}
                                </h3>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleFavoritePharmacy(pharmacy.id);
                                  }}
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
                                  <IconStar
                                    filled={isFav}
                                    className="h-4 w-4"
                                  />
                                </button>
                                <Badge tone="green" dot>
                                  {openingLabel(pharmacy)}
                                </Badge>
                              </div>

                              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-1 font-medium text-ink-900">
                                  <IconMapPin className="h-3.5 w-3.5 text-brand-600" />
                                  {pharmacy.quartier} ·{" "}
                                  <span className="font-semibold tabular-nums">
                                    {distanceLabel(distanceKm)}
                                  </span>
                                </span>
                                <span className="tabular-nums">
                                  {inStockCount} références en stock
                                </span>
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {pharmacy.address}
                              </p>
                            </div>
                          </div>

                          {pharmacy.dutyNote ? (
                            <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/70 px-3.5 py-2 text-xs font-medium text-brand-800">
                              {pharmacy.dutyNote}
                            </div>
                          ) : null}

                          {matchingMedicines.length > 0 ? (
                            <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/90">
                              {matchingMedicines
                                .slice(0, 4)
                                .map(({ medicine, stock }) => (
                                  <li
                                    key={medicine.id}
                                    className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate font-medium text-ink-900">
                                        {medicine.name}
                                      </p>
                                      <p className="truncate text-[10px] text-slate-500">
                                        {medicine.dci} ·{" "}
                                        <span className="tabular-nums">
                                          {stock.quantity}
                                        </span>{" "}
                                        en rayon · {timeAgo(stock.updatedAt)}
                                      </p>
                                    </div>
                                    <span className="shrink-0 font-semibold tabular-nums text-brand-700">
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
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 text-xs font-semibold text-ink-900 transition hover:border-brand-300 hover:bg-brand-50/60"
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
                                <ul className="scroll-thin mt-2 max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/70">
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
                                          <span className="font-semibold tabular-nums text-ink-900">
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
                            className="btn-primary flex-1 rounded-xl px-4 py-2.5 text-xs sm:flex-none"
                          >
                            <IconNavigation className="h-4 w-4" />
                            Itinéraire GPS
                          </a>
                          <a
                            href={`tel:${pharmacy.phone.replace(/\s/g, "")}`}
                            className="btn-secondary flex-1 rounded-xl px-4 py-2.5 text-xs sm:flex-none"
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
                            className="btn flex-1 rounded-xl border border-emerald-200/80 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 sm:flex-none"
                          >
                            <IconWhatsApp className="h-4 w-4" />
                            WhatsApp
                          </a>
                          {pharmacy.updatedAt ? (
                            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-500">
                              <IconClock className="h-3 w-3 text-slate-400" />
                              Maj {timeAgo(pharmacy.updatedAt)}
                            </span>
                          ) : null}
                        </div>
                      </Card>
                    </div>
                  );
                },
              )}
            </div>

            <div className="hidden lg:block sticky top-[84px] h-[calc(100vh-108px)] min-h-[480px] max-h-[780px]">
              <div className="h-full rounded-3xl border border-slate-200/80 bg-white p-2 shadow-card">
                <PharmacyMap
                  fillHeight
                  markers={mapMarkers}
                  userLocation={userLocation}
                  activePharmacyId={activePharmacyId}
                  onSelectPharmacy={handleSelectPharmacyFromMap}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/85 px-4 py-3.5">
        <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-[11px] leading-relaxed text-amber-900">
          Les permanences et stocks sont déclarés par chaque officine. Appelez
          la pharmacie avant de vous déplacer la nuit. En cas d&apos;urgence
          vitale, appelez le <strong>185 (SAMU)</strong>.
        </p>
      </div>
    </div>
  );
}
