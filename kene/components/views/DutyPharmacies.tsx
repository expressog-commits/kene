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
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());

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
    <div className="space-y-6">
      <section
        aria-label="Pharmacies de garde 24h/24"
        className="rounded-3xl bg-brand-700 px-5 py-6 text-white shadow-soft sm:px-8 sm:py-7"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-[13px] font-semibold text-emerald-50">
              <span
                aria-hidden="true"
                className="h-2 w-2 animate-pulse rounded-full bg-emerald-300"
              />
              Permanence 24h/24 · Abidjan
            </span>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Pharmacies de garde 24h/24
            </h1>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-emerald-50/95">
              <strong className="font-bold tabular-nums text-white">
                {allDuty.length} pharmacie{allDuty.length > 1 ? "s" : ""}
              </strong>{" "}
              signalée{allDuty.length > 1 ? "s" : ""} ouverte
              {allDuty.length > 1 ? "s" : ""} maintenant. Consultez leurs stocks
              et contactez l&apos;officine avant de vous déplacer.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {userLocation ? (
              <div className="flex flex-wrap items-center gap-2.5 rounded-2xl bg-white px-4 py-2.5 text-slate-900 shadow-md">
                <IconCrosshair className="h-5 w-5 shrink-0 text-brand-700" />
                <span className="text-sm font-semibold text-slate-900">
                  Trié par votre position GPS
                </span>
                <button
                  type="button"
                  onClick={requestLocation}
                  className="min-h-[36px] rounded-xl bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-800 transition hover:bg-brand-100"
                >
                  Actualiser
                </button>
                <button
                  type="button"
                  onClick={clearLocation}
                  aria-label="Effacer ma position GPS"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <IconClose className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={requestLocation}
                disabled={locationStatus === "locating"}
                className="inline-flex h-12 items-center justify-center gap-2.5 rounded-xl bg-white px-5 text-[15px] font-semibold text-brand-800 shadow-md transition hover:bg-emerald-50 active:scale-[0.98] disabled:opacity-60"
              >
                <IconCrosshair className="h-5 w-5 shrink-0 text-brand-700" />
                {locationStatus === "locating"
                  ? "Localisation en cours…"
                  : "Trouver la plus proche de moi"}
              </button>
            )}
          </div>
        </div>
      </section>

      <Card className="rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-700" />
            <input
              type="search"
              aria-label="Chercher un médicament disponible en garde"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Médicament ou commune en garde (ex. paracétamol)…"
              className="input h-12 rounded-xl pl-11 pr-10 text-[15px]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <IconClose className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <select
            aria-label="Filtrer par commune"
            value={quartier}
            onChange={(event) => setQuartier(event.target.value)}
            className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] font-medium leading-snug text-slate-800 transition focus:border-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-100 sm:w-auto sm:min-w-[210px]"
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
              className="h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
            >
              Effacer les filtres
            </button>
          ) : null}

          <div
            role="group"
            aria-label="Affichage liste ou carte"
            className="ml-auto inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm lg:hidden"
          >
            <button
              type="button"
              onClick={() => setDisplay("list")}
              aria-pressed={display === "list"}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition",
                display === "list"
                  ? "bg-brand-700 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <IconList className="h-4 w-4" />
              Liste
            </button>
            <button
              type="button"
              onClick={() => setDisplay("map")}
              aria-pressed={display === "map"}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition",
                display === "map"
                  ? "bg-brand-700 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <IconMap className="h-4 w-4" />
              Carte
            </button>
          </div>
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="rounded-2xl p-8 text-center">
          <p className="text-lg font-bold text-slate-900">
            Aucune pharmacie de garde ne correspond à ce filtre
          </p>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-slate-600">
            Élargissez la commune ou effacez la recherche de médicament. En cas
            d&apos;urgence vitale, appelez le SAMU au 185.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setQuartier("Tous");
                setQuery("");
              }}
              className="btn-secondary h-12 rounded-xl px-5 text-[15px]"
            >
              Voir toutes les pharmacies de garde
            </button>
            <a
              href="tel:185"
              className="btn-primary h-12 rounded-xl px-5 text-[15px]"
            >
              Appeler le SAMU 185
            </a>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <h2 className="text-lg font-bold text-slate-900">
              <span className="tabular-nums">{rows.length}</span> pharmacie
              {rows.length > 1 ? "s" : ""} de garde
              {quartier !== "Tous" ? ` à ${quartier}` : ""}
            </h2>
          </div>

          {display === "map" ? (
            <div className="h-[65vh] min-h-[400px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-card lg:hidden">
              <PharmacyMap
                fillHeight
                markers={mapMarkers}
                userLocation={userLocation}
                activePharmacyId={activePharmacyId}
                onSelectPharmacy={handleSelectPharmacyFromMap}
              />
            </div>
          ) : null}

          <div className="lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:items-start lg:gap-6">
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
                    <article
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
                      className={cn(
                        "scroll-mt-24 rounded-2xl border bg-white p-5 shadow-card transition duration-150 sm:p-6",
                        isActive
                          ? "border-brand-500 ring-2 ring-brand-500/30 shadow-soft"
                          : "border-slate-200/90 hover:border-brand-500/60 hover:shadow-soft",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold leading-snug text-slate-900">
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
                                "inline-flex h-10 w-10 items-center justify-center rounded-xl transition",
                                isFav
                                  ? "text-sun-500 hover:bg-sun-50"
                                  : "text-slate-400 hover:bg-slate-100 hover:text-sun-500",
                              )}
                            >
                              <IconStar filled={isFav} className="h-5 w-5" />
                            </button>
                            <Badge tone="green" dot pulse>
                              {openingLabel(pharmacy)}
                            </Badge>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-base font-bold tabular-nums text-brand-700">
                            {inStockCount} médicament
                            {inStockCount > 1 ? "s" : ""}
                          </p>
                          <p className="text-sm text-slate-500">en stock</p>
                        </div>
                      </div>

                      <div className="mt-2.5 space-y-1">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-slate-700">
                          <span className="inline-flex items-center gap-1.5">
                            <IconMapPin className="h-4 w-4 shrink-0 text-brand-700" />
                            <span>{pharmacy.quartier}</span>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <strong className="font-semibold tabular-nums text-slate-900">
                              {distanceLabel(distanceKm)}
                            </strong>
                          </span>
                        </p>
                        <p className="text-sm leading-relaxed text-slate-600">
                          {pharmacy.address}
                        </p>
                      </div>

                      {pharmacy.dutyNote ? (
                        <div className="mt-3.5 rounded-xl border border-brand-200/70 bg-brand-50/70 px-4 py-2.5 text-sm font-medium text-brand-900">
                          {pharmacy.dutyNote}
                        </div>
                      ) : null}

                      {matchingMedicines.length > 0 ? (
                        <ul className="mt-3.5 divide-y divide-slate-200/70 rounded-xl border border-slate-200/80 bg-slate-50/90">
                          {matchingMedicines
                            .slice(0, 4)
                            .map(({ medicine, stock }) => (
                              <li
                                key={medicine.id}
                                className="flex items-center justify-between gap-3 px-4 py-3"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-[15px] font-semibold text-slate-900">
                                    {medicine.name}
                                  </p>
                                  <p className="truncate text-sm text-slate-600">
                                    {medicine.dci} ·{" "}
                                    <span className="tabular-nums">
                                      {stock.quantity}
                                    </span>{" "}
                                    en rayon · {timeAgo(stock.updatedAt)}
                                  </p>
                                </div>
                                <span className="shrink-0 text-base font-bold tabular-nums text-brand-700">
                                  {fcfa(stock.price)}
                                </span>
                              </li>
                            ))}
                        </ul>
                      ) : null}

                      {catalogItems.length > 0 ? (
                        <div className="mt-3.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleExpanded(pharmacy.id);
                            }}
                            aria-expanded={isExpanded}
                            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-900 transition hover:border-brand-300 hover:bg-brand-50/60"
                          >
                            <IconChevronRight
                              className={cn(
                                "h-4 w-4 text-brand-700 transition-transform",
                                isExpanded && "rotate-90",
                              )}
                            />
                            {isExpanded
                              ? `Masquer les médicaments (${catalogItems.length})`
                              : `Voir les médicaments en stock (${catalogItems.length})`}
                          </button>

                          {isExpanded ? (
                            <ul className="scroll-thin mt-2.5 max-h-64 divide-y divide-slate-200/70 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/80">
                              {catalogItems.map(({ medicine, stock }) => {
                                const level = stockLevel(stock);
                                const meta = LEVEL_META[level];
                                return (
                                  <li
                                    key={medicine.id}
                                    className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-[15px] font-semibold text-slate-900">
                                        {medicine.name}
                                      </p>
                                      <p className="truncate text-sm text-slate-600">
                                        {medicine.dci} · {medicine.form}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                      <Badge tone={meta.tone}>
                                        {level === "low"
                                          ? `${meta.label} (${stock.quantity})`
                                          : meta.label}
                                      </Badge>
                                      <span className="text-[15px] font-bold tabular-nums text-slate-900">
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

                      <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-slate-100 pt-4">
                        <a
                          href={mapsDirectionsLink(pharmacy, userLocation)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="btn-primary h-12 flex-1 rounded-xl px-5 text-[15px] sm:flex-none"
                        >
                          <IconNavigation className="h-4 w-4" />
                          Itinéraire
                        </a>
                        <a
                          href={`tel:${pharmacy.phone.replace(/\s/g, "")}`}
                          onClick={(event) => event.stopPropagation()}
                          className="btn-secondary h-12 flex-1 rounded-xl px-5 text-[15px] sm:flex-none"
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
                          onClick={(event) => event.stopPropagation()}
                          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-[15px] font-semibold text-emerald-900 transition hover:bg-emerald-100 active:scale-[0.98] sm:flex-none"
                        >
                          <IconWhatsApp className="h-4 w-4" />
                          WhatsApp
                        </a>
                        {pharmacy.updatedAt ? (
                          <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-slate-500">
                            <IconClock className="h-4 w-4 text-slate-400" />
                            Maj {timeAgo(pharmacy.updatedAt)}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  );
                },
              )}
            </div>

            <aside
              aria-label="Carte des pharmacies de garde"
              className="sticky top-[92px] hidden h-[calc(100vh-116px)] min-h-[480px] max-h-[780px] lg:block"
            >
              <div className="h-full rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-card">
                <PharmacyMap
                  fillHeight
                  markers={mapMarkers}
                  userLocation={userLocation}
                  activePharmacyId={activePharmacyId}
                  onSelectPharmacy={handleSelectPharmacyFromMap}
                />
              </div>
            </aside>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/85 px-4 py-3.5">
        <IconAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <p className="text-sm leading-relaxed text-amber-950">
          Les permanences et stocks sont déclarés par chaque officine. Appelez
          la pharmacie avant de vous déplacer la nuit. En cas d&apos;urgence
          vitale, appelez le <strong>185 (SAMU)</strong>.
        </p>
      </div>
    </div>
  );
}
