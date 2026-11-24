"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { Badge, cn } from "../ui";
import PharmacyMap, { type PharmacyMapMarker } from "../PharmacyMap";
import {
  IconCheck,
  IconChevronRight,
  IconClock,
  IconClose,
  IconCrosshair,
  IconList,
  IconMap,
  IconMapPin,
  IconNavigation,
  IconPhone,
  IconPill,
  IconPlus,
  IconSearch,
  IconStar,
  IconWhatsApp,
} from "../icons";
import {
  LEVEL_META,
  isOpen,
  openingLabel,
  popularMedicines,
  publicPharmacies,
  searchMedicine,
  searchMedicineList,
  stockLevel,
  suggestMedicines,
  type SearchFilters,
} from "@/lib/engine";
import { distanceLabel, fcfa, timeAgo, waLink } from "@/lib/format";
import { effectiveDistanceKm, mapsDirectionsLink } from "@/lib/geo";
import type { Medicine, Pharmacy, StockItem, UserLocation } from "@/lib/types";

type SearchMode = "single" | "list";
type DisplayMode = "list" | "map";

const MAX_LIST_ITEMS = 8;

const QUICK_SEARCHES = [
  "Paracétamol",
  "Amoxicilline",
  "Paludisme",
  "Sirop enfant",
] as const;

function humanOpeningStatus(pharmacy: Pharmacy): string {
  if (pharmacy.onDuty || (pharmacy.openFrom === 0 && pharmacy.openTo >= 24)) {
    return "Ouvert 24h/24";
  }
  if (isOpen(pharmacy)) return `Ouvert jusqu'à ${pharmacy.openTo} h`;
  return `Fermé · Ouvre à ${pharmacy.openFrom} h`;
}

function DisplayToggle({
  display,
  onChange,
  ariaLabel,
}: {
  display: DisplayMode;
  onChange: (next: DisplayMode) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex shrink-0 rounded-xl border border-slate-200 bg-white p-1 shadow-sm lg:hidden"
    >
      <button
        type="button"
        onClick={() => onChange("list")}
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
        onClick={() => onChange("map")}
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
  );
}

function PharmacyCardShell({
  pharmacyId,
  isActive,
  dimmed = false,
  onHover,
  onSelect,
  children,
}: {
  pharmacyId: string;
  isActive: boolean;
  dimmed?: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <article
      data-pharmacy-id={pharmacyId}
      onMouseEnter={() => onHover(pharmacyId)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(pharmacyId)}
      className={cn(
        "rounded-2xl border bg-white p-5 transition sm:p-6",
        isActive
          ? "border-brand-500 ring-2 ring-brand-500/30 shadow-soft"
          : "border-slate-200/90 hover:border-brand-500/60 hover:shadow-soft",
        dimmed && "opacity-75",
      )}
    >
      {children}
    </article>
  );
}

function PharmacyCardHeader({
  pharmacy,
  open,
  isFav,
  onToggleFavorite,
  rightSlot,
}: {
  pharmacy: Pharmacy;
  open: boolean;
  isFav: boolean;
  onToggleFavorite: (pharmacyId: string) => void;
  rightSlot: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-[200px] flex-1">
        <div className="flex items-start gap-1.5">
          <h3 className="text-lg font-bold leading-snug text-slate-900">
            {pharmacy.name}
          </h3>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite(pharmacy.id);
            }}
            aria-pressed={isFav}
            aria-label={
              isFav
                ? `Retirer ${pharmacy.name} des favorites`
                : `Ajouter ${pharmacy.name} aux favorites`
            }
            className={cn(
              "-mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition",
              isFav
                ? "text-sun-500 hover:bg-sun-50"
                : "text-slate-400 hover:bg-slate-100 hover:text-sun-500",
            )}
          >
            <IconStar filled={isFav} className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-1.5">
          <Badge tone={open ? "green" : "neutral"} dot pulse={pharmacy.onDuty && open}>
            {open
              ? pharmacy.onDuty
                ? "De garde 24h/24"
                : "Ouvert"
              : "Fermé"}
          </Badge>
        </div>
      </div>

      <div className="shrink-0 sm:text-right">{rightSlot}</div>
    </div>
  );
}

function PharmacyCardMeta({
  pharmacy,
  distanceKm,
}: {
  pharmacy: Pharmacy;
  distanceKm: number;
}) {
  return (
    <div className="mt-3 space-y-1">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-slate-700">
        <span className="inline-flex items-center gap-1.5">
          <IconMapPin className="h-4 w-4 shrink-0 text-brand-700" />
          <span>{pharmacy.quartier}</span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <strong className="font-semibold tabular-nums text-slate-900">
            à {distanceLabel(distanceKm)}
          </strong>
        </span>
        <span aria-hidden="true" className="text-slate-300">
          ·
        </span>
        <span className="text-slate-600">{humanOpeningStatus(pharmacy)}</span>
      </p>
      <p className="text-sm text-slate-600">{pharmacy.address}</p>
    </div>
  );
}

function PharmacyCardFooter({
  pharmacy,
  userLocation,
  primaryDirections = true,
  waText,
  timestampText,
}: {
  pharmacy: Pharmacy;
  userLocation: UserLocation | null;
  primaryDirections?: boolean;
  waText: string;
  timestampText: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-slate-100 pt-4">
      <a
        href={mapsDirectionsLink(pharmacy, userLocation)}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "h-12 flex-1 px-5 text-[15px] sm:flex-none",
          primaryDirections ? "btn-primary" : "btn-secondary",
        )}
      >
        <IconNavigation className="h-4 w-4" />
        Itinéraire
      </a>
      <a
        href={`tel:${pharmacy.phone.replace(/\s/g, "")}`}
        onClick={(event) => event.stopPropagation()}
        className="btn-secondary h-12 flex-1 px-5 text-[15px] sm:flex-none"
      >
        <IconPhone className="h-4 w-4" />
        Appeler
      </a>
      <a
        href={waLink(pharmacy.whatsapp, waText)}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="inline-flex h-12 flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-[15px] font-semibold text-emerald-900 transition hover:bg-emerald-100 sm:flex-none"
      >
        <IconWhatsApp className="h-4 w-4" />
        WhatsApp
      </a>
      <span className="w-full text-[13px] text-slate-500 sm:ml-auto sm:w-auto">
        {timestampText}
      </span>
    </div>
  );
}

export default function Search({
  initialQuery,
  onConsumeInitialQuery,
}: {
  initialQuery?: string;
  onConsumeInitialQuery?: () => void;
}) {
  const {
    state,
    userLocation,
    locationStatus,
    requestLocation,
    clearLocation,
    favoritePharmacyIds,
    toggleFavoritePharmacy,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
    preferredQuartier,
    notify,
  } = useStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const listInputRef = useRef<HTMLInputElement>(null);
  const suppressBlurRef = useRef(false);
  const resultsColumnRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<SearchMode>("single");
  const [display, setDisplay] = useState<DisplayMode>("list");
  const [query, setQuery] = useState("");
  const [listQuery, setListQuery] = useState("");
  const [selectedMedicineIds, setSelectedMedicineIds] = useState<string[]>([]);
  const [expandedPharmacyIds, setExpandedPharmacyIds] = useState<string[]>([]);
  const [hoveredPharmacyId, setHoveredPharmacyId] = useState<string | null>(null);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);

  const visiblePharmacies = useMemo(() => publicPharmacies(state), [state]);
  const quartiers = useMemo(
    () => ["Tous", ...Array.from(new Set(visiblePharmacies.map((p) => p.quartier)))],
    [visiblePharmacies],
  );

  const [quartier, setQuartier] = useState(() =>
    quartiers.includes(preferredQuartier) ? preferredQuartier : "Tous",
  );
  const lastPreferred = useRef(preferredQuartier);

  useEffect(() => {
    if (preferredQuartier !== lastPreferred.current) {
      if (quartier === lastPreferred.current || quartier === "Tous") {
        setQuartier(quartiers.includes(preferredQuartier) ? preferredQuartier : "Tous");
      }
      lastPreferred.current = preferredQuartier;
    }
  }, [preferredQuartier, quartier, quartiers]);

  useEffect(() => {
    const incoming = initialQuery?.trim();
    if (!incoming) return;
    setMode("single");
    setQuery(incoming);
    addRecentSearch(incoming);
    onConsumeInitialQuery?.();
  }, [initialQuery, addRecentSearch, onConsumeInitialQuery]);

  useEffect(() => {
    setHoveredPharmacyId(null);
    setSelectedPharmacyId(null);
  }, [mode]);

  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyDuty, setOnlyDuty] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      if (mode === "single") {
        inputRef.current?.focus();
      } else {
        listInputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode]);

  const filters: SearchFilters = useMemo(
    () => ({
      quartier,
      onlyOpen,
      onlyDuty,
      onlyInStock: false,
      sort: "distance",
    }),
    [quartier, onlyOpen, onlyDuty],
  );

  const hasActiveFilters =
    Boolean(userLocation) ||
    onlyDuty ||
    onlyOpen ||
    quartier !== "Tous" ||
    (mode === "single" && Boolean(query.trim()));

  const resetAllFilters = () => {
    setQuery("");
    setQuartier("Tous");
    setOnlyDuty(false);
    setOnlyOpen(false);
    setSelectedPharmacyId(null);
    setHoveredPharmacyId(null);
    if (userLocation) clearLocation();
  };

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

  const nearbyPharmacies = useMemo(() => {
    return visiblePharmacies
      .filter((pharmacy) => {
        if (quartier !== "Tous" && pharmacy.quartier !== quartier) return false;
        const open = isOpen(pharmacy);
        if (onlyOpen && !open) return false;
        if (onlyDuty && !pharmacy.onDuty) return false;
        return true;
      })
      .map((pharmacy) => {
        const items = inStockByPharmacy.get(pharmacy.id) ?? [];
        let latestUpdate: string | null = pharmacy.updatedAt ?? null;
        let latestMs = latestUpdate ? Date.parse(latestUpdate) : 0;
        for (const entry of items) {
          const ms = Date.parse(entry.stock.updatedAt);
          if (Number.isFinite(ms) && ms > latestMs) {
            latestMs = ms;
            latestUpdate = entry.stock.updatedAt;
          }
        }
        return {
          pharmacy,
          open: isOpen(pharmacy),
          distanceKm: effectiveDistanceKm(pharmacy, userLocation),
          inStockItems: items,
          latestUpdate,
        };
      })
      .sort((a, b) => {
        if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
        const dutyDiff = Number(b.pharmacy.onDuty) - Number(a.pharmacy.onDuty);
        if (dutyDiff !== 0) return dutyDiff;
        return Number(b.open) - Number(a.open);
      });
  }, [
    visiblePharmacies,
    quartier,
    onlyOpen,
    onlyDuty,
    inStockByPharmacy,
    userLocation,
  ]);

  const nearbyMapMarkers = useMemo<PharmacyMapMarker[]>(
    () =>
      nearbyPharmacies.map(({ pharmacy, open, distanceKm, inStockItems }) => ({
        pharmacy,
        distanceKm,
        badgeText: pharmacy.onDuty
          ? "De garde 24h/24"
          : open
            ? "Ouvert"
            : "Fermé",
        badgeTone: open ? "green" : "amber",
        subtitle: `${inStockItems.length} médicament${inStockItems.length > 1 ? "s" : ""} en stock · ${openingLabel(pharmacy)}`,
        waText:
          "Bonjour, je vérifie la disponibilité de médicaments dans votre officine. (via Kéné)",
      })),
    [nearbyPharmacies],
  );

  const rows = useMemo(
    () => searchMedicine(state, query, filters, userLocation),
    [state, query, filters, userLocation],
  );

  const suggestions = useMemo(
    () => (query.trim() ? suggestMedicines(state, query, 6) : []),
    [state, query],
  );

  const popular = useMemo(() => popularMedicines(state, 8), [state]);

  const listSuggestions = useMemo(() => {
    if (listQuery.trim()) return suggestMedicines(state, listQuery, 8);
    return popular;
  }, [state, listQuery, popular]);

  const selectedMedicines = useMemo(
    () =>
      selectedMedicineIds
        .map((id) => state.medicines.find((medicine) => medicine.id === id))
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [selectedMedicineIds, state.medicines],
  );

  const listResults = useMemo(() => {
    if (selectedMedicineIds.length === 0) return [];
    return searchMedicineList(state, selectedMedicineIds, filters, userLocation);
  }, [state, selectedMedicineIds, filters, userLocation]);

  const singleMapMarkers = useMemo<PharmacyMapMarker[]>(() => {
    const seen = new Map<string, { marker: PharmacyMapMarker; count: number }>();
    for (const row of rows) {
      const existing = seen.get(row.pharmacy.id);
      if (!existing) {
        seen.set(row.pharmacy.id, {
          count: 1,
          marker: {
            pharmacy: row.pharmacy,
            distanceKm: row.distanceKm,
            badgeText: LEVEL_META[row.level].label,
            badgeTone:
              row.level === "available"
                ? "green"
                : row.level === "low"
                  ? "amber"
                  : "red",
            priceLabel: fcfa(row.stock.price),
            subtitle: `${row.medicine.name} · ${row.medicine.form}`,
            waText: `Bonjour, avez-vous actuellement ${row.medicine.name} (${row.medicine.form}) en stock ? (vu sur Kéné)`,
          },
        });
      } else {
        existing.count += 1;
        existing.marker.subtitle = `${existing.marker.subtitle?.split(" (+")[0]} (+${existing.count - 1} autre${existing.count > 2 ? "s" : ""})`;
      }
    }
    return Array.from(seen.values()).map((entry) => entry.marker);
  }, [rows]);

  const listMapMarkers = useMemo<PharmacyMapMarker[]>(() => {
    const listSummary = selectedMedicines
      .map((medicine) => `• ${medicine.name} (${medicine.form})`)
      .join("\n");
    return listResults.map((result) => ({
      pharmacy: result.pharmacy,
      distanceKm: result.distanceKm,
      badgeText: result.complete
        ? `Tout disponible · ${result.availableCount}/${result.totalRequested}`
        : `${result.availableCount}/${result.totalRequested} disponibles`,
      badgeTone: result.complete
        ? "green"
        : result.availableCount > 0
          ? "amber"
          : "red",
      priceLabel:
        result.availableCount > 0 ? fcfa(result.estimatedTotal) : undefined,
      subtitle: openingLabel(result.pharmacy),
      waText: `Bonjour, avez-vous ces médicaments disponibles actuellement (vu sur Kéné) ?\n${listSummary}`,
    }));
  }, [listResults, selectedMedicines]);

  const activeMarkers = useMemo<PharmacyMapMarker[]>(() => {
    if (mode === "single") {
      return query.trim() ? singleMapMarkers : nearbyMapMarkers;
    }
    return selectedMedicineIds.length > 0 ? listMapMarkers : nearbyMapMarkers;
  }, [
    mode,
    query,
    selectedMedicineIds.length,
    singleMapMarkers,
    nearbyMapMarkers,
    listMapMarkers,
  ]);

  const activePharmacyId = useMemo(() => {
    const candidate = hoveredPharmacyId ?? selectedPharmacyId;
    if (!candidate) return null;
    return activeMarkers.some((marker) => marker.pharmacy.id === candidate)
      ? candidate
      : null;
  }, [hoveredPharmacyId, selectedPharmacyId, activeMarkers]);

  const handleSelectPharmacyFromMap = (pharmacyId: string) => {
    setSelectedPharmacyId(pharmacyId);
    const container = resultsColumnRef.current;
    if (!container) return;
    const escaped =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(pharmacyId)
        : pharmacyId;
    const target = container.querySelector<HTMLElement>(
      `[data-pharmacy-id="${escaped}"]`,
    );
    target?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const toggleExpandedPharmacy = (pharmacyId: string) => {
    setExpandedPharmacyIds((previous) =>
      previous.includes(pharmacyId)
        ? previous.filter((id) => id !== pharmacyId)
        : [...previous, pharmacyId],
    );
  };

  const addMedicineToList = (medicineId: string) => {
    const medicine = state.medicines.find((item) => item.id === medicineId);
    if (!medicine) return;

    if (selectedMedicineIds.includes(medicineId)) {
      notify(`${medicine.name} est déjà dans votre ordonnance.`);
      return;
    }

    if (selectedMedicineIds.length >= MAX_LIST_ITEMS) {
      notify(`Maximum ${MAX_LIST_ITEMS} médicaments par ordonnance.`);
      return;
    }

    setSelectedMedicineIds((previous) => [...previous, medicineId]);
    notify(
      `${medicine.name} ajouté (${selectedMedicineIds.length + 1}/${MAX_LIST_ITEMS}).`,
    );
  };

  const removeMedicineFromList = (medicineId: string) => {
    setSelectedMedicineIds((previous) => previous.filter((id) => id !== medicineId));
  };

  const copySelectedList = () => {
    if (selectedMedicines.length === 0) return;
    const textList = selectedMedicines
      .map(
        (medicine, idx) =>
          `${idx + 1}. ${medicine.name} — ${medicine.form}`,
      )
      .join("\n");
    void navigator.clipboard
      ?.writeText(`Ordonnance Kéné :\n${textList}`)
      .then(() => notify("Ordonnance copiée dans le presse-papier."))
      .catch(() => notify("Copie impossible sur ce navigateur."));
  };

  const openNow = rows.filter((row) => row.open && row.level !== "out").length;
  const uniqueRowPharmacies = useMemo(
    () => new Set(rows.map((row) => row.pharmacy.id)).size,
    [rows],
  );
  const hasSingleQuery = Boolean(query.trim());
  const canShowMobileMap =
    (mode === "single" &&
      (hasSingleQuery ? rows.length > 0 : nearbyPharmacies.length > 0)) ||
    (mode === "list" &&
      selectedMedicineIds.length > 0 &&
      listResults.length > 0);
  const completeListCount = listResults.filter((item) => item.complete).length;

  return (
    <div className="space-y-6">
      <section
        aria-label="Recherche de médicaments et filtres"
        className="rounded-3xl bg-brand-700 px-5 py-6 text-white shadow-card sm:px-8 sm:py-7"
      >
        <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {mode === "single"
            ? "Quel médicament cherchez-vous ?"
            : "Chercher toute une ordonnance"}
        </h1>

        {mode === "single" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (query.trim()) addRecentSearch(query);
            }}
            className="mt-4 flex h-14 items-center rounded-2xl bg-white p-1.5 shadow-lg"
          >
            <IconSearch className="ml-2.5 h-5 w-5 shrink-0 text-brand-700" />
            <input
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              aria-label="Rechercher un médicament"
              aria-describedby="search-shortcut"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onBlur={() => {
                if (suppressBlurRef.current) {
                  suppressBlurRef.current = false;
                  return;
                }
                if (query.trim().length >= 2) addRecentSearch(query);
              }}
              placeholder="Ex : Paracétamol, Amoxicilline…"
              className="min-w-0 flex-1 bg-transparent px-3 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            <span id="search-shortcut" className="sr-only">
              Appuyez sur la barre oblique pour revenir à la recherche.
            </span>

            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Effacer la recherche"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <IconClose className="h-5 w-5" />
              </button>
            ) : null}

            <div className="hidden shrink-0 items-center sm:flex">
              <span aria-hidden="true" className="mx-1.5 h-7 w-px bg-slate-200" />
              <select
                aria-label="Commune"
                value={quartier}
                onChange={(event) => setQuartier(event.target.value)}
                className="h-11 max-w-[180px] rounded-xl bg-transparent px-3 py-2.5 text-sm font-semibold leading-snug text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {quartiers.map((item) => (
                  <option key={item} value={item} className="bg-white text-slate-900">
                    {item === "Tous" ? "Tout Abidjan" : item}
                  </option>
                ))}
              </select>

              <span aria-hidden="true" className="mx-1.5 h-7 w-px bg-slate-200" />

              {userLocation ? (
                <button
                  type="button"
                  onClick={clearLocation}
                  aria-label="Désactiver la position GPS"
                  className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-50 px-3.5 text-sm font-semibold text-brand-800 transition hover:bg-brand-100"
                >
                  <IconCrosshair className="h-4 w-4 text-brand-700" />
                  <span>GPS actif</span>
                  <IconClose className="h-4 w-4 text-brand-700" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={locationStatus === "locating"}
                  className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-60"
                >
                  <IconCrosshair className="h-4 w-4" />
                  <span>
                    {locationStatus === "locating" ? "Localisation…" : "Autour de moi"}
                  </span>
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="mt-4 flex h-14 items-center rounded-2xl bg-white p-1.5 shadow-lg">
            <IconSearch className="ml-2.5 h-5 w-5 shrink-0 text-brand-700" />
            <input
              ref={listInputRef}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              aria-label="Ajouter un médicament à votre ordonnance"
              value={listQuery}
              onChange={(event) => setListQuery(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  listQuery.trim() &&
                  listSuggestions[0] &&
                  !selectedMedicineIds.includes(listSuggestions[0].id)
                ) {
                  event.preventDefault();
                  addMedicineToList(listSuggestions[0].id);
                  setListQuery("");
                }
              }}
              placeholder="Ajouter 2 à 8 médicaments (nom ou forme)…"
              className="min-w-0 flex-1 bg-transparent px-3 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {listQuery ? (
              <button
                type="button"
                onClick={() => {
                  setListQuery("");
                  listInputRef.current?.focus();
                }}
                aria-label="Effacer la saisie d'ordonnance"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <IconClose className="h-5 w-5" />
              </button>
            ) : null}

            <div className="hidden shrink-0 items-center sm:flex">
              <span aria-hidden="true" className="mx-1.5 h-7 w-px bg-slate-200" />
              <select
                aria-label="Commune"
                value={quartier}
                onChange={(event) => setQuartier(event.target.value)}
                className="h-11 max-w-[180px] rounded-xl bg-transparent px-3 py-2.5 text-sm font-semibold leading-snug text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {quartiers.map((item) => (
                  <option key={item} value={item} className="bg-white text-slate-900">
                    {item === "Tous" ? "Tout Abidjan" : item}
                  </option>
                ))}
              </select>

              <span aria-hidden="true" className="mx-1.5 h-7 w-px bg-slate-200" />

              {userLocation ? (
                <button
                  type="button"
                  onClick={clearLocation}
                  aria-label="Désactiver la position GPS"
                  className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-50 px-3.5 text-sm font-semibold text-brand-800 transition hover:bg-brand-100"
                >
                  <IconCrosshair className="h-4 w-4 text-brand-700" />
                  <span>GPS actif</span>
                  <IconClose className="h-4 w-4 text-brand-700" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={locationStatus === "locating"}
                  className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-60"
                >
                  <IconCrosshair className="h-4 w-4" />
                  <span>
                    {locationStatus === "locating" ? "Localisation…" : "Autour de moi"}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyOpen((value) => !value)}
            aria-pressed={onlyOpen}
            className={cn(
              "inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition",
              onlyOpen
                ? "bg-white text-brand-800 shadow-sm"
                : "border border-white/25 bg-white/15 text-white hover:bg-white/25",
            )}
          >
            Ouvertes
          </button>

          <button
            type="button"
            onClick={() => setOnlyDuty((value) => !value)}
            aria-pressed={onlyDuty}
            className={cn(
              "inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition",
              onlyDuty
                ? "bg-white text-brand-800 shadow-sm"
                : "border border-white/25 bg-white/15 text-white hover:bg-white/25",
            )}
          >
            De garde 24h/24
          </button>

          {userLocation ? (
            <button
              type="button"
              onClick={clearLocation}
              aria-label="Désactiver la position GPS"
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-brand-800 shadow-sm sm:hidden"
            >
              <IconCrosshair className="h-4 w-4 text-brand-700" />
              <span>Autour de moi</span>
              <IconClose className="h-4 w-4 text-brand-700" />
            </button>
          ) : (
            <button
              type="button"
              onClick={requestLocation}
              disabled={locationStatus === "locating"}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-4 text-sm font-semibold text-white transition hover:bg-white/25 disabled:opacity-60 sm:hidden"
            >
              <IconCrosshair className="h-4 w-4" />
              <span>
                {locationStatus === "locating" ? "Localisation…" : "Autour de moi"}
              </span>
            </button>
          )}

          <select
            aria-label="Commune"
            value={quartier}
            onChange={(event) => setQuartier(event.target.value)}
            className="min-h-[40px] rounded-full border border-white/25 bg-white/15 px-4 py-2.5 text-sm font-semibold leading-snug text-white focus:outline-none focus:ring-2 focus:ring-white sm:hidden"
          >
            {quartiers.map((item) => (
              <option key={item} value={item} className="bg-white text-slate-900">
                {item === "Tous" ? "Tout Abidjan" : item}
              </option>
            ))}
          </select>

          {mode === "single" ? (
            <button
              type="button"
              onClick={() => {
                setMode("list");
                requestAnimationFrame(() => listInputRef.current?.focus());
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-emerald-50 transition hover:bg-white/15 hover:text-white sm:ml-auto"
            >
              {selectedMedicineIds.length > 0
                ? `Mon ordonnance (${selectedMedicineIds.length})`
                : "+ Chercher toute une ordonnance"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("single");
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-4 text-sm font-semibold text-white transition hover:bg-white/25 sm:ml-auto"
            >
              ← Recherche simple
            </button>
          )}
        </div>

        {mode === "single" ? (
          hasSingleQuery ? (
            suggestions.length > 0 ? (
              <div
                onMouseDown={() => {
                  suppressBlurRef.current = true;
                }}
                className="mt-4 flex flex-wrap items-center gap-2"
              >
                {suggestions.map((medicine) => (
                  <button
                    key={medicine.id}
                    type="button"
                    onClick={() => {
                      setQuery(medicine.name);
                      addRecentSearch(medicine.name);
                    }}
                    className="inline-flex min-h-[38px] items-center rounded-full bg-white px-3.5 py-1.5 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-emerald-50"
                  >
                    {medicine.name}
                  </button>
                ))}
              </div>
            ) : null
          ) : (
            <div
              onMouseDown={() => {
                suppressBlurRef.current = true;
              }}
              className="mt-4 space-y-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                {QUICK_SEARCHES.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setQuery(term);
                      addRecentSearch(term);
                    }}
                    className="inline-flex min-h-[38px] items-center rounded-full border border-white/20 bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-white/25"
                  >
                    {term}
                  </button>
                ))}
              </div>

              {recentSearches.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-emerald-100">
                    Récentes :
                  </span>
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => {
                        setQuery(term);
                        addRecentSearch(term);
                      }}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-brand-800/80 px-3.5 py-1 text-sm font-medium text-white transition hover:bg-brand-800"
                    >
                      <IconClock className="h-3.5 w-3.5 text-emerald-200" />
                      {term}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={clearRecentSearches}
                    className="px-2 py-1 text-sm font-medium text-emerald-100 underline-offset-2 transition hover:text-white hover:underline"
                  >
                    Effacer
                  </button>
                </div>
              ) : null}
            </div>
          )
        ) : (
          <div className="mt-4 space-y-3 border-t border-white/15 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-emerald-100">
                {listQuery.trim() ? "Ajouter :" : "Ajouts rapides :"}
              </span>
              {listSuggestions.map((medicine) => {
                const selected = selectedMedicineIds.includes(medicine.id);
                const full = selectedMedicineIds.length >= MAX_LIST_ITEMS;
                return (
                  <button
                    key={medicine.id}
                    type="button"
                    disabled={selected || full}
                    onClick={() => {
                      addMedicineToList(medicine.id);
                      setListQuery("");
                    }}
                    className={cn(
                      "inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                      selected
                        ? "border-white/30 bg-white/25 text-white opacity-80"
                        : "border-white/20 bg-white/15 text-white hover:bg-white/25 disabled:opacity-50",
                    )}
                  >
                    {selected ? (
                      <IconCheck className="h-4 w-4" />
                    ) : (
                      <IconPlus className="h-4 w-4" />
                    )}
                    <span>{medicine.name}</span>
                  </button>
                );
              })}
            </div>

            {selectedMedicines.length === 0 ? (
              <p className="text-sm text-emerald-50">
                Sélectionnez 2 à 8 médicaments pour trouver les pharmacies disposant de
                toute votre ordonnance.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    Votre ordonnance ({selectedMedicines.length}/{MAX_LIST_ITEMS}) :
                  </span>
                  {selectedMedicines.map((medicine) => (
                    <span
                      key={medicine.id}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-white pl-3.5 pr-2 py-1 text-sm font-semibold text-brand-800 shadow-sm"
                    >
                      <span>{medicine.name}</span>
                      <button
                        type="button"
                        onClick={() => removeMedicineFromList(medicine.id)}
                        aria-label={`Retirer ${medicine.name}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-brand-700 transition hover:bg-brand-50 hover:text-brand-900"
                      >
                        <IconClose className="h-4 w-4" />
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={copySelectedList}
                    className="px-2 py-1 text-sm font-semibold text-emerald-50 underline-offset-2 hover:text-white hover:underline"
                  >
                    Copier
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMedicineIds([])}
                    className="px-2 py-1 text-sm font-medium text-emerald-100 underline-offset-2 hover:text-white hover:underline"
                  >
                    Vider
                  </button>
                </div>

                {selectedMedicines.length === 1 ? (
                  <p className="text-sm font-medium text-amber-200">
                    Ajoutez encore au moins 1 médicament (2 à 8 recommandés) pour comparer
                    toute votre ordonnance.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        )}
      </section>

      <div className="lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:items-start lg:gap-6">
        <div ref={resultsColumnRef} className="min-w-0 space-y-4">
          {mode === "single" ? (
            hasSingleQuery ? (
              <>
                <p role="status" aria-live="polite" className="sr-only">
                  {rows.length} pharmacie{rows.length > 1 ? "s" : ""} référence
                  {rows.length > 1 ? "nt" : ""} « {query.trim()} », dont {openNow}{" "}
                  ouverte{openNow > 1 ? "s" : ""} avec du stock.
                </p>

                <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                  <h2 className="text-lg font-bold text-slate-900">
                    {rows.length === 0
                      ? `Aucune pharmacie pour « ${query.trim()} »`
                      : uniqueRowPharmacies === rows.length
                        ? `${uniqueRowPharmacies} pharmacie${uniqueRowPharmacies > 1 ? "s ont" : " a"} « ${query.trim()} »`
                        : `${uniqueRowPharmacies} pharmacie${uniqueRowPharmacies > 1 ? "s ont" : " a"} « ${query.trim()} » · ${rows.length} présentations`}
                  </h2>

                  <div className="flex items-center gap-2">
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="inline-flex h-11 items-center rounded-xl px-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 hover:text-brand-800"
                      >
                        Effacer les filtres
                      </button>
                    ) : null}
                    {rows.length > 0 ? (
                      <DisplayToggle
                        display={display}
                        onChange={setDisplay}
                        ariaLabel="Affichage des résultats"
                      />
                    ) : null}
                  </div>
                </div>

                {rows.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center shadow-card">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                      <IconPill className="h-6 w-6" />
                    </span>
                    <p className="mt-3 text-base font-bold text-slate-900">
                      Aucune pharmacie ne correspond à votre recherche
                    </p>
                    <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">
                      Essayez le nom de la molécule, choisissez « Tout Abidjan » ou
                      contactez une pharmacie de garde.
                    </p>
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="btn-secondary mt-5 h-12 px-5 text-[15px]"
                      >
                        Effacer les filtres
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <>
                    {display === "map" ? (
                      <div className="h-[65vh] min-h-[400px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-card lg:hidden">
                        <PharmacyMap
                          fillHeight
                          markers={activeMarkers}
                          userLocation={userLocation}
                          activePharmacyId={activePharmacyId}
                          onSelectPharmacy={handleSelectPharmacyFromMap}
                        />
                      </div>
                    ) : null}

                    <div
                      className={cn(
                        "space-y-4",
                        display === "map" && canShowMobileMap && "hidden lg:block",
                      )}
                    >
                      {rows.map(
                        ({ pharmacy, medicine, stock, level, open, distanceKm }) => {
                          const isFav = favoritePharmacyIds.includes(pharmacy.id);
                          const isActive = activePharmacyId === pharmacy.id;
                          return (
                            <PharmacyCardShell
                              key={`${pharmacy.id}-${medicine.id}`}
                              pharmacyId={pharmacy.id}
                              isActive={isActive}
                              dimmed={level === "out"}
                              onHover={setHoveredPharmacyId}
                              onSelect={setSelectedPharmacyId}
                            >
                              <PharmacyCardHeader
                                pharmacy={pharmacy}
                                open={open}
                                isFav={isFav}
                                onToggleFavorite={toggleFavoritePharmacy}
                                rightSlot={
                                  <>
                                    <p
                                      className={cn(
                                        "text-2xl font-extrabold tabular-nums tracking-tight",
                                        level === "out"
                                          ? "text-slate-500"
                                          : "text-brand-700",
                                      )}
                                    >
                                      {fcfa(stock.price)}
                                    </p>
                                    <p
                                      className={cn(
                                        "mt-0.5 text-sm font-semibold tabular-nums",
                                        level === "available"
                                          ? "text-emerald-700"
                                          : level === "low"
                                            ? "text-amber-700"
                                            : "text-rose-700",
                                      )}
                                    >
                                      {level === "available"
                                        ? "En stock"
                                        : level === "low"
                                          ? `Plus que ${stock.quantity} boîte${stock.quantity > 1 ? "s" : ""}`
                                          : "Rupture"}
                                    </p>
                                  </>
                                }
                              />

                              <PharmacyCardMeta
                                pharmacy={pharmacy}
                                distanceKm={distanceKm}
                              />

                              <p className="mt-2.5 text-[15px] font-medium text-slate-800">
                                {medicine.name}{" "}
                                <span className="font-normal text-slate-600">
                                  · {medicine.form}
                                </span>
                              </p>

                              <PharmacyCardFooter
                                pharmacy={pharmacy}
                                userLocation={userLocation}
                                primaryDirections={level !== "out"}
                                waText={`Bonjour, avez-vous actuellement ${medicine.name} (${medicine.form}) en stock ? (vu sur Kéné)`}
                                timestampText={`Déclaré ${timeAgo(stock.updatedAt)}`}
                              />
                            </PharmacyCardShell>
                          );
                        },
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                  <h2 className="text-lg font-bold text-slate-900">
                    {nearbyPharmacies.length} pharmacie
                    {nearbyPharmacies.length > 1 ? "s" : ""} vérifiée
                    {nearbyPharmacies.length > 1 ? "s" : ""}
                  </h2>

                  <div className="flex items-center gap-2">
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="inline-flex h-11 items-center rounded-xl px-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 hover:text-brand-800"
                      >
                        Effacer les filtres
                      </button>
                    ) : null}
                    {nearbyPharmacies.length > 0 ? (
                      <DisplayToggle
                        display={display}
                        onChange={setDisplay}
                        ariaLabel="Affichage des pharmacies vérifiées"
                      />
                    ) : null}
                  </div>
                </div>

                {nearbyPharmacies.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center shadow-card">
                    <p className="text-base font-bold text-slate-900">
                      Aucune pharmacie pour ces filtres
                    </p>
                    <p className="mt-1.5 text-sm text-slate-600">
                      Élargissez la commune ou effacez les filtres ci-dessus.
                    </p>
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="btn-secondary mt-5 h-12 px-5 text-[15px]"
                      >
                        Effacer les filtres
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <>
                    {display === "map" ? (
                      <div className="h-[65vh] min-h-[400px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-card lg:hidden">
                        <PharmacyMap
                          fillHeight
                          markers={activeMarkers}
                          userLocation={userLocation}
                          activePharmacyId={activePharmacyId}
                          onSelectPharmacy={handleSelectPharmacyFromMap}
                        />
                      </div>
                    ) : null}

                    <div
                      className={cn(
                        "space-y-4",
                        display === "map" && canShowMobileMap && "hidden lg:block",
                      )}
                    >
                      {nearbyPharmacies.map(
                        ({
                          pharmacy,
                          open,
                          distanceKm,
                          inStockItems,
                          latestUpdate,
                        }) => {
                          const isFav = favoritePharmacyIds.includes(pharmacy.id);
                          const isExpanded = expandedPharmacyIds.includes(pharmacy.id);
                          const isActive = activePharmacyId === pharmacy.id;
                          return (
                            <PharmacyCardShell
                              key={pharmacy.id}
                              pharmacyId={pharmacy.id}
                              isActive={isActive}
                              onHover={setHoveredPharmacyId}
                              onSelect={setSelectedPharmacyId}
                            >
                              <PharmacyCardHeader
                                pharmacy={pharmacy}
                                open={open}
                                isFav={isFav}
                                onToggleFavorite={toggleFavoritePharmacy}
                                rightSlot={
                                  <p className="text-base font-bold tabular-nums text-brand-700 sm:text-lg">
                                    {inStockItems.length} médicament
                                    {inStockItems.length > 1 ? "s" : ""} en stock
                                  </p>
                                }
                              />

                              <PharmacyCardMeta
                                pharmacy={pharmacy}
                                distanceKm={distanceKm}
                              />

                              {inStockItems.length > 0 ? (
                                <div className="mt-4">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleExpandedPharmacy(pharmacy.id);
                                    }}
                                    aria-expanded={isExpanded}
                                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:bg-brand-50/70 hover:text-brand-800"
                                  >
                                    <span>
                                      {isExpanded
                                        ? `Masquer les médicaments (${inStockItems.length})`
                                        : `Voir les médicaments en stock (${inStockItems.length})`}
                                    </span>
                                    <IconChevronRight
                                      className={cn(
                                        "h-4 w-4 text-brand-700 transition-transform",
                                        isExpanded ? "-rotate-90" : "rotate-90",
                                      )}
                                    />
                                  </button>

                                  {isExpanded ? (
                                    <ul className="scroll-thin mt-3 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                                      {inStockItems.map(({ medicine, stock }) => {
                                        const level = stockLevel(stock);
                                        return (
                                          <li key={medicine.id}>
                                            <button
                                              type="button"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                setQuery(medicine.name);
                                                addRecentSearch(medicine.name);
                                              }}
                                              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-brand-50/60"
                                            >
                                              <div className="min-w-0 flex-1">
                                                <p className="truncate text-[15px] font-medium text-slate-900">
                                                  {medicine.name}
                                                </p>
                                                <p
                                                  className={cn(
                                                    "text-[13px] font-medium",
                                                    level === "low"
                                                      ? "text-amber-700"
                                                      : "text-slate-600",
                                                  )}
                                                >
                                                  {level === "low"
                                                    ? `Plus que ${stock.quantity} boîte${stock.quantity > 1 ? "s" : ""}`
                                                    : "En stock"}
                                                </p>
                                              </div>
                                              <span className="shrink-0 text-[15px] font-bold tabular-nums text-brand-700">
                                                {fcfa(stock.price)}
                                              </span>
                                            </button>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  ) : null}
                                </div>
                              ) : null}

                              <PharmacyCardFooter
                                pharmacy={pharmacy}
                                userLocation={userLocation}
                                waText="Bonjour, je vérifie la disponibilité de médicaments dans votre officine. (via Kéné)"
                                timestampText={
                                  latestUpdate
                                    ? `Mis à jour ${timeAgo(latestUpdate)}`
                                    : "Stock déclaré"
                                }
                              />
                            </PharmacyCardShell>
                          );
                        },
                      )}
                    </div>
                  </>
                )}
              </>
            )
          ) : selectedMedicineIds.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center shadow-card">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <IconList className="h-6 w-6" />
              </span>
              <p className="mt-3 text-base font-bold text-slate-900">
                Comparez plusieurs médicaments en une seule fois
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">
                Ajoutez de 2 à 8 médicaments ci-dessus pour voir quelles pharmacies
                disposent de toute votre ordonnance et estimer le total.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <h2 role="status" aria-live="polite" className="text-lg font-bold text-slate-900">
                  {listResults.length} pharmacie{listResults.length > 1 ? "s" : ""} ·{" "}
                  {completeListCount} avec toute l&apos;ordonnance
                </h2>

                <div className="flex items-center gap-2">
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="inline-flex h-11 items-center rounded-xl px-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 hover:text-brand-800"
                    >
                      Effacer les filtres
                    </button>
                  ) : null}
                  {listResults.length > 0 ? (
                    <DisplayToggle
                      display={display}
                      onChange={setDisplay}
                      ariaLabel="Affichage des résultats de l'ordonnance"
                    />
                  ) : null}
                </div>
              </div>

              {listResults.length === 0 ? (
                <div className="rounded-2xl border border-slate-200/90 bg-white p-8 text-center shadow-card">
                  <p className="text-base font-bold text-slate-900">
                    Aucune pharmacie ne correspond à ces filtres
                  </p>
                  <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">
                    Élargissez la commune ou effacez vos filtres.
                  </p>
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="btn-secondary mt-5 h-12 px-5 text-[15px]"
                    >
                      Effacer les filtres
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  {display === "map" ? (
                    <div className="h-[65vh] min-h-[400px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-card lg:hidden">
                      <PharmacyMap
                        fillHeight
                        markers={activeMarkers}
                        userLocation={userLocation}
                        activePharmacyId={activePharmacyId}
                        onSelectPharmacy={handleSelectPharmacyFromMap}
                      />
                    </div>
                  ) : null}

                  <div
                    className={cn(
                      "space-y-4",
                      display === "map" && canShowMobileMap && "hidden lg:block",
                    )}
                  >
                    {listResults.map((result) => {
                      const {
                        pharmacy,
                        open,
                        distanceKm,
                        items,
                        availableCount,
                        totalRequested,
                      } = result;
                      const isFav = favoritePharmacyIds.includes(pharmacy.id);
                      const isActive = activePharmacyId === pharmacy.id;
                      const listSummary = selectedMedicines
                        .map((medicine) => `• ${medicine.name} (${medicine.form})`)
                        .join("\n");
                      return (
                        <PharmacyCardShell
                          key={pharmacy.id}
                          pharmacyId={pharmacy.id}
                          isActive={isActive}
                          dimmed={availableCount === 0}
                          onHover={setHoveredPharmacyId}
                          onSelect={setSelectedPharmacyId}
                        >
                          <PharmacyCardHeader
                            pharmacy={pharmacy}
                            open={open}
                            isFav={isFav}
                            onToggleFavorite={toggleFavoritePharmacy}
                            rightSlot={
                              <>
                                <p
                                  className={cn(
                                    "text-2xl font-extrabold tabular-nums tracking-tight",
                                    availableCount > 0
                                      ? "text-brand-700"
                                      : "text-slate-500",
                                  )}
                                >
                                  {availableCount > 0
                                    ? fcfa(result.estimatedTotal)
                                    : "—"}
                                </p>
                                <p
                                  className={cn(
                                    "mt-0.5 text-sm font-semibold tabular-nums",
                                    result.complete
                                      ? "text-emerald-700"
                                      : availableCount > 0
                                        ? "text-amber-700"
                                        : "text-rose-700",
                                  )}
                                >
                                  {result.complete
                                    ? `Tout disponible (${availableCount}/${totalRequested})`
                                    : availableCount > 0
                                      ? `${availableCount}/${totalRequested} disponible${availableCount > 1 ? "s" : ""}`
                                      : "Aucun produit disponible"}
                                </p>
                              </>
                            }
                          />

                          <PharmacyCardMeta
                            pharmacy={pharmacy}
                            distanceKm={distanceKm}
                          />

                          <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100 pt-1">
                            {items.map((entry) => (
                              <li
                                key={entry.medicine.id}
                                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                              >
                                <span className="font-medium text-slate-800">
                                  {entry.medicine.name}
                                </span>
                                <div className="flex items-center gap-3">
                                  <span
                                    className={cn(
                                      "font-semibold",
                                      entry.level === "available"
                                        ? "text-emerald-700"
                                        : entry.level === "low"
                                          ? "text-amber-700"
                                          : "text-rose-700",
                                    )}
                                  >
                                    {entry.level === "available"
                                      ? "En stock"
                                      : entry.level === "low" && entry.stock
                                        ? `Plus que ${entry.stock.quantity}`
                                        : "Rupture"}
                                  </span>
                                  <span className="w-24 text-right font-bold tabular-nums text-slate-900">
                                    {entry.stock && entry.level !== "out"
                                      ? fcfa(entry.stock.price)
                                      : "—"}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>

                          <PharmacyCardFooter
                            pharmacy={pharmacy}
                            userLocation={userLocation}
                            primaryDirections={availableCount > 0}
                            waText={`Bonjour, avez-vous ces médicaments disponibles actuellement (vu sur Kéné) ?\n${listSummary}`}
                            timestampText={
                              result.latestUpdate
                                ? `Déclaré ${timeAgo(result.latestUpdate)}`
                                : "Aucune mise à jour récente"
                            }
                          />
                        </PharmacyCardShell>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          <div
            className={cn(
              "rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6",
              display === "map" && canShowMobileMap && "hidden lg:block",
            )}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Badge tone="amber">Publicité</Badge>
                <p className="mt-2.5 text-base font-bold text-slate-900">
                  Prévention Paludisme &amp; Hydratation en Côte d&apos;Ivoire
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                  Retrouvez les tests rapides paludisme (TDR), moustiquaires imprégnées
                  et sachets de réhydratation orale (SRO) dans les pharmacies
                  partenaires d&apos;Abidjan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMode("single");
                  setQuery("Paludisme");
                  addRecentSearch("Paludisme");
                }}
                className="btn-secondary h-12 shrink-0 whitespace-nowrap px-5 text-[15px]"
              >
                Voir les produits
              </button>
            </div>
          </div>
        </div>

        <aside
          aria-label="Carte interactive des pharmacies"
          className="hidden lg:block sticky top-[92px] h-[calc(100vh-116px)] min-h-[480px] max-h-[780px]"
        >
          <div className="h-full rounded-2xl border border-slate-200/90 bg-white p-1.5 shadow-card">
            <PharmacyMap
              fillHeight
              markers={activeMarkers}
              userLocation={userLocation}
              activePharmacyId={activePharmacyId}
              onSelectPharmacy={handleSelectPharmacyFromMap}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
