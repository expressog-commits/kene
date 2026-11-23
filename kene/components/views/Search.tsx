"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { Badge, cn } from "../ui";
import PharmacyMap, { type PharmacyMapMarker } from "../PharmacyMap";
import {
  IconAlert,
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
  IconShield,
  IconStar,
  IconWhatsApp,
} from "../icons";
import {
  LEVEL_META,
  isOpen,
  openingLabel,
  popularMedicines,
  priceRange,
  publicPharmacies,
  searchMedicine,
  searchMedicineList,
  stockLevel,
  suggestMedicines,
  type SearchFilters,
} from "@/lib/engine";
import { distanceLabel, fcfa, fcfaShort, timeAgo, waLink } from "@/lib/format";
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
  "Sérum physiologique",
] as const;

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
      className="inline-flex shrink-0 rounded-full border border-slate-200/80 bg-slate-100/90 p-1 text-xs font-semibold lg:hidden"
    >
      <button
        type="button"
        onClick={() => onChange("list")}
        aria-pressed={display === "list"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition",
          display === "list"
            ? "bg-white text-ink-900 shadow-sm"
            : "text-slate-600 hover:text-ink-900",
        )}
      >
        <IconList className="h-3.5 w-3.5" />
        Liste
      </button>
      <button
        type="button"
        onClick={() => onChange("map")}
        aria-pressed={display === "map"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition",
          display === "map"
            ? "bg-white text-ink-900 shadow-sm"
            : "text-slate-600 hover:text-ink-900",
        )}
      >
        <IconMap className="h-3.5 w-3.5" />
        Carte
      </button>
    </div>
  );
}

function PharmacyCardShell({
  pharmacyId,
  isActive,
  onHover,
  onSelect,
  children,
}: {
  pharmacyId: string;
  isActive: boolean;
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
        "rounded-2xl border bg-white p-4 shadow-card transition-all duration-150 sm:p-5",
        isActive
          ? "border-brand-400 ring-2 ring-brand-500/40 shadow-soft"
          : "border-slate-200/80 hover:border-slate-300",
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
  extraBadge,
  rightSlot,
}: {
  pharmacy: Pharmacy;
  open: boolean;
  isFav: boolean;
  onToggleFavorite: (pharmacyId: string) => void;
  extraBadge?: ReactNode;
  rightSlot: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-bold tracking-tight text-ink-900">
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
              "rounded-lg p-1 transition",
              isFav
                ? "text-sun-500 hover:bg-sun-50"
                : "text-slate-400 hover:bg-slate-100 hover:text-sun-500",
            )}
          >
            <IconStar filled={isFav} className="h-4 w-4" />
          </button>
          <Badge tone={open ? "green" : "neutral"} dot pulse={pharmacy.onDuty && open}>
            {open
              ? pharmacy.onDuty
                ? "De garde 24h/24"
                : "Ouvert"
              : "Fermé"}
          </Badge>
          {extraBadge}
        </div>
      </div>

      <div className="shrink-0 text-right">{rightSlot}</div>
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
    <div className="mt-2 space-y-1">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1">
          <IconMapPin className="h-3.5 w-3.5 text-brand-600" />
          <span>{pharmacy.quartier}</span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <strong className="font-semibold tabular-nums text-ink-900">
            {distanceLabel(distanceKm)}
          </strong>
        </span>
        <span aria-hidden="true" className="text-slate-300">
          ·
        </span>
        <span className="text-slate-500">{openingLabel(pharmacy)}</span>
      </p>
      <p className="text-[11px] leading-snug text-slate-500">{pharmacy.address}</p>
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
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3.5">
      <a
        href={mapsDirectionsLink(pharmacy, userLocation)}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "rounded-xl px-4 py-2 text-xs",
          primaryDirections ? "btn-primary" : "btn-secondary",
        )}
      >
        <IconNavigation className="h-3.5 w-3.5" />
        Itinéraire
      </a>
      <a
        href={`tel:${pharmacy.phone.replace(/\s/g, "")}`}
        onClick={(event) => event.stopPropagation()}
        className="btn-secondary rounded-xl px-3.5 py-2 text-xs"
      >
        <IconPhone className="h-3.5 w-3.5" />
        Appeler
      </a>
      <a
        href={waLink(pharmacy.whatsapp, waText)}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="btn rounded-xl border border-emerald-200/80 bg-emerald-50 px-3.5 py-2 text-xs text-emerald-800 hover:bg-emerald-100"
      >
        <IconWhatsApp className="h-3.5 w-3.5" />
        WhatsApp
      </a>
      <span className="ml-auto text-[11px] text-slate-500">{timestampText}</span>
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
        subtitle: `${inStockItems.length} produits en stock · ${openingLabel(pharmacy)}`,
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
            subtitle: `${row.medicine.name} (${row.medicine.dci})`,
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

  const addMedicineToList = (medicineId: string, switchToList = false) => {
    const medicine = state.medicines.find((item) => item.id === medicineId);
    if (!medicine) return;

    if (selectedMedicineIds.includes(medicineId)) {
      if (switchToList) {
        setMode("list");
      } else {
        notify(`${medicine.name} est déjà dans votre liste.`);
      }
      return;
    }

    if (selectedMedicineIds.length >= MAX_LIST_ITEMS) {
      notify(`Maximum ${MAX_LIST_ITEMS} médicaments par liste.`);
      if (switchToList) setMode("list");
      return;
    }

    setSelectedMedicineIds((previous) => [...previous, medicineId]);
    if (switchToList) {
      setMode("list");
      notify(`${medicine.name} ajouté à votre liste.`);
    } else {
      notify(
        `${medicine.name} ajouté (${selectedMedicineIds.length + 1}/${MAX_LIST_ITEMS}).`,
      );
    }
  };

  const removeMedicineFromList = (medicineId: string) => {
    setSelectedMedicineIds((previous) => previous.filter((id) => id !== medicineId));
  };

  const copySelectedList = () => {
    if (selectedMedicines.length === 0) return;
    const textList = selectedMedicines
      .map(
        (medicine, idx) =>
          `${idx + 1}. ${medicine.name} (${medicine.dci}) — ${medicine.form}`,
      )
      .join("\n");
    void navigator.clipboard
      ?.writeText(`Liste Kéné :\n${textList}`)
      .then(() => notify("Liste copiée dans le presse-papier."))
      .catch(() => notify("Copie impossible sur ce navigateur."));
  };

  const openNow = rows.filter((row) => row.open && row.level !== "out").length;
  const hasSingleQuery = Boolean(query.trim());
  const canShowMobileMap =
    (mode === "single" &&
      (hasSingleQuery ? rows.length > 0 : nearbyPharmacies.length > 0)) ||
    (mode === "list" &&
      selectedMedicineIds.length > 0 &&
      listResults.length > 0);

  return (
    <div className="space-y-5">
      <section
        aria-label="Recherche de médicaments et filtres"
        className="rounded-3xl border border-slate-200/80 bg-gradient-to-br from-brand-50/45 via-white to-white p-4 shadow-card sm:p-5"
      >
        <div className="mb-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-base font-bold tracking-tight text-ink-900 sm:text-lg">
              Trouvez votre médicament à Abidjan
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Stocks déclarés, prix officiels et pharmacies ouvertes près de vous.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Mode de recherche"
            className="inline-grid grid-cols-2 gap-1 self-start rounded-full bg-slate-100/90 p-1 text-xs font-semibold sm:self-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "single"}
              onClick={() => setMode("single")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 transition",
                mode === "single"
                  ? "bg-white text-ink-900 shadow-sm"
                  : "text-slate-600 hover:text-ink-900",
              )}
            >
              <IconSearch className="h-3.5 w-3.5 text-brand-600" />
              <span>Un médicament</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "list"}
              onClick={() => setMode("list")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 transition",
                mode === "list"
                  ? "bg-white text-ink-900 shadow-sm"
                  : "text-slate-600 hover:text-ink-900",
              )}
            >
              <IconList className="h-3.5 w-3.5 text-brand-600" />
              <span>Mon ordonnance</span>
              {selectedMedicineIds.length > 0 ? (
                <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
                  {selectedMedicineIds.length}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {mode === "single" ? (
          <div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (query.trim()) addRecentSearch(query);
              }}
              className="relative"
            >
              <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-600" />
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
                placeholder="Paracétamol, amoxicilline, artéméther, sirop…"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-20 text-[15px] text-ink-900 shadow-sm placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 sm:h-[52px] [&::-webkit-search-cancel-button]:hidden"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Effacer la recherche"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-ink-900 sm:right-11"
                >
                  <IconClose className="h-4 w-4" />
                </button>
              ) : null}
              <span id="search-shortcut" className="sr-only">
                Appuyez sur la barre oblique pour revenir à ce champ depuis
                n&apos;importe quelle page.
              </span>
              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 sm:block"
              >
                /
              </kbd>
            </form>

            {hasSingleQuery ? (
              suggestions.length > 0 ? (
                <div
                  onMouseDown={() => {
                    suppressBlurRef.current = true;
                  }}
                  className="mt-3 flex flex-wrap items-center gap-1.5"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Correspondances :
                  </span>
                  {suggestions.map((medicine) => {
                    const inList = selectedMedicineIds.includes(medicine.id);
                    return (
                      <div
                        key={medicine.id}
                        className="inline-flex items-center overflow-hidden rounded-full border border-slate-200 bg-white text-[11px] shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setQuery(medicine.name);
                            addRecentSearch(medicine.name);
                          }}
                          className="px-2.5 py-1 font-medium text-ink-900 transition hover:bg-slate-50"
                        >
                          {medicine.name}{" "}
                          <span className="text-slate-500">· {medicine.dci}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => addMedicineToList(medicine.id)}
                          aria-label={`Ajouter ${medicine.name} à ma liste`}
                          className={cn(
                            "border-l border-slate-200 px-2.5 py-1 text-[10px] font-semibold transition",
                            inList
                              ? "bg-brand-50 text-brand-700"
                              : "text-brand-700 hover:bg-brand-50",
                          )}
                        >
                          {inList ? "Dans la liste" : "+ Liste"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null
            ) : (
              <div
                onMouseDown={() => {
                  suppressBlurRef.current = true;
                }}
                className="mt-3 space-y-2.5"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Recherches fréquentes :
                  </span>
                  {QUICK_SEARCHES.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => {
                        setQuery(term);
                        addRecentSearch(term);
                      }}
                      className="rounded-full border border-slate-200/80 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/70 hover:text-brand-800"
                    >
                      {term}
                    </button>
                  ))}
                </div>

                {recentSearches.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
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
                        className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-800 transition hover:bg-brand-100"
                      >
                        <IconClock className="h-3 w-3 text-brand-600" />
                        {term}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={clearRecentSearches}
                      className="px-2 py-1 text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-ink-900 hover:underline"
                    >
                      Effacer
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl border border-brand-200/70 bg-brand-50/60 px-3.5 py-2.5 text-xs leading-relaxed text-brand-900">
              Ajoutez les médicaments de votre ordonnance pour repérer en un coup
              d&apos;œil les pharmacies disposant de toute votre liste.
            </div>

            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-600" />
              <input
                ref={listInputRef}
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                aria-label="Ajouter un médicament à la liste"
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
                placeholder="Ajouter 2 à 8 médicaments (nom, DCI ou forme)…"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-20 text-[15px] text-ink-900 shadow-sm placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 sm:h-[52px] [&::-webkit-search-cancel-button]:hidden"
              />
              {listQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setListQuery("");
                    listInputRef.current?.focus();
                  }}
                  aria-label="Effacer la recherche de liste"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-ink-900 sm:right-11"
                >
                  <IconClose className="h-4 w-4" />
                </button>
              ) : null}
              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 sm:block"
              >
                /
              </kbd>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
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
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                      selected
                        ? "border-brand-200 bg-brand-50 text-brand-700 opacity-80"
                        : "border-slate-200 bg-white text-ink-900 hover:border-brand-300 hover:bg-brand-50/50 disabled:opacity-50",
                    )}
                  >
                    {selected ? (
                      <IconCheck className="h-3 w-3 text-brand-600" />
                    ) : (
                      <IconPlus className="h-3 w-3 text-brand-600" />
                    )}
                    <span>{medicine.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/75 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Votre liste ({selectedMedicines.length}/{MAX_LIST_ITEMS} médicaments)
                </p>
                {selectedMedicines.length > 0 ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={copySelectedList}
                      className="text-[11px] font-semibold text-brand-700 underline-offset-2 hover:underline"
                    >
                      Copier ma liste
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMedicineIds([])}
                      className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-red-600 hover:underline"
                    >
                      Vider
                    </button>
                  </div>
                ) : null}
              </div>

              {selectedMedicines.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  Sélectionnez entre 2 et 8 médicaments ci-dessus pour comparer les
                  pharmacies capables de fournir toute votre liste.
                </p>
              ) : (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {selectedMedicines.map((medicine) => (
                    <span
                      key={medicine.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1 text-[11px] font-semibold text-white shadow-sm"
                    >
                      <span>{medicine.name}</span>
                      <button
                        type="button"
                        onClick={() => removeMedicineFromList(medicine.id)}
                        aria-label={`Retirer ${medicine.name}`}
                        className="rounded-full p-0.5 text-white/80 transition hover:bg-white/20 hover:text-white"
                      >
                        <IconClose className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {selectedMedicines.length === 1 ? (
                <p className="mt-2 text-[11px] font-medium text-sun-700">
                  Ajoutez encore au moins 1 médicament (2 à 8 recommandés) pour comparer
                  une liste complète.
                </p>
              ) : null}
            </div>
          </div>
        )}

        <div className="mt-3.5 flex items-center gap-2 overflow-x-auto border-t border-slate-100/90 pt-3.5 pb-0.5 no-scrollbar sm:flex-wrap">
          {userLocation ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-brand-500 bg-brand-50 px-3.5 py-1.5 text-xs font-semibold text-brand-800">
              <IconCrosshair className="h-3.5 w-3.5 text-brand-600" />
              Autour de moi (GPS)
              <button
                type="button"
                onClick={clearLocation}
                aria-label="Désactiver la position GPS"
                className="ml-0.5 rounded-full p-0.5 text-brand-700 transition hover:bg-brand-100"
              >
                <IconClose className="h-3 w-3" />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={requestLocation}
              disabled={locationStatus === "locating"}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-900 transition hover:border-brand-400 hover:bg-brand-50/50 disabled:opacity-60"
            >
              <IconCrosshair className="h-3.5 w-3.5 text-brand-600" />
              {locationStatus === "locating" ? "Localisation…" : "Autour de moi"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setOnlyOpen((value) => !value)}
            aria-pressed={onlyOpen}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
              onlyOpen
                ? "border-brand-500 bg-brand-50 font-semibold text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-ink-900",
            )}
          >
            Ouvertes maintenant
          </button>

          <button
            type="button"
            onClick={() => setOnlyDuty((value) => !value)}
            aria-pressed={onlyDuty}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
              onlyDuty
                ? "border-brand-500 bg-brand-50 font-semibold text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-ink-900",
            )}
          >
            De garde 24h/24
          </button>

          <select
            aria-label="Commune"
            value={quartier}
            onChange={(event) => setQuartier(event.target.value)}
            className="shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition focus:border-brand-400 focus:outline-none"
          >
            {quartiers.map((item) => (
              <option key={item} value={item}>
                {item === "Tous" ? "Toutes communes" : item}
              </option>
            ))}
          </select>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetAllFilters}
              className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:text-ink-900 sm:ml-auto"
            >
              Réinitialiser
            </button>
          ) : null}
        </div>
      </section>

      <div className="lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-start lg:gap-6">
        <div ref={resultsColumnRef} className="min-w-0 space-y-4">
          {mode === "single" ? (
            hasSingleQuery ? (
              <>
                <p role="status" aria-live="polite" className="sr-only">
                  {rows.length} pharmacie{rows.length > 1 ? "s" : ""} référence
                  {rows.length > 1 ? "nt" : ""} « {query.trim()} », dont {openNow}{" "}
                  ouverte{openNow > 1 ? "s" : ""} avec du stock.
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <p className="text-sm text-slate-600">
                    <span className="font-bold tabular-nums text-ink-900">
                      {rows.length}
                    </span>{" "}
                    pharmacie{rows.length > 1 ? "s" : ""} référencent « {query.trim()} » ·{" "}
                    <span className="font-bold tabular-nums text-brand-700">
                      {openNow}
                    </span>{" "}
                    ouverte{openNow > 1 ? "s" : ""} avec du stock
                  </p>

                  {rows.length > 0 ? (
                    <DisplayToggle
                      display={display}
                      onChange={setDisplay}
                      ariaLabel="Affichage des résultats"
                    />
                  ) : null}
                </div>

                {rows.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-card">
                    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <IconPill className="h-5 w-5" />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-ink-900">
                      Aucune pharmacie ne correspond à votre recherche
                    </p>
                    <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
                      Essayez le nom de la molécule (DCI), élargissez la commune ou
                      contactez directement une pharmacie de garde.
                    </p>
                  </div>
                ) : (
                  <>
                    {display === "map" ? (
                      <div className="h-[62vh] min-h-[380px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-card lg:hidden">
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
                        "space-y-3",
                        display === "map" && canShowMobileMap && "hidden lg:block",
                      )}
                    >
                      {rows.map(
                        ({ pharmacy, medicine, stock, level, open, distanceKm }) => {
                          const meta = LEVEL_META[level];
                          const isFav = favoritePharmacyIds.includes(pharmacy.id);
                          const inList = selectedMedicineIds.includes(medicine.id);
                          const isActive = activePharmacyId === pharmacy.id;
                          return (
                            <PharmacyCardShell
                              key={`${pharmacy.id}-${medicine.id}`}
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
                                extraBadge={
                                  <Badge tone={meta.tone} dot>
                                    {meta.label}
                                  </Badge>
                                }
                                rightSlot={
                                  <>
                                    <p className="text-lg font-bold tracking-tight tabular-nums text-ink-900 sm:text-xl">
                                      {fcfa(stock.price)}
                                    </p>
                                    <p className="text-[11px] font-medium tabular-nums text-slate-500">
                                      {level === "out"
                                        ? "indisponible"
                                        : level === "low"
                                          ? `plus que ${stock.quantity} en rayon`
                                          : `${stock.quantity} en rayon`}
                                    </p>
                                  </>
                                }
                              />

                              <PharmacyCardMeta
                                pharmacy={pharmacy}
                                distanceKm={distanceKm}
                              />

                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50/90 px-3.5 py-2.5 text-xs">
                                <p className="min-w-0 text-slate-600">
                                  <span className="font-semibold text-ink-900">
                                    {medicine.name}
                                  </span>{" "}
                                  ·{" "}
                                  <span className="text-slate-500">
                                    DCI : {medicine.dci}
                                  </span>{" "}
                                  · {medicine.form}
                                </p>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    addMedicineToList(medicine.id, true);
                                  }}
                                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-brand-50"
                                >
                                  <IconList className="h-3 w-3" />
                                  {inList ? "Voir ma liste" : "+ Ma liste"}
                                </button>
                              </div>

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
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div>
                    <h2 className="text-sm font-bold text-ink-900">
                      Pharmacies vérifiées près de vous (
                      <span className="tabular-nums">{nearbyPharmacies.length}</span>)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Consultez directement les stocks déclarés, la carte et les contacts.
                    </p>
                  </div>

                  {nearbyPharmacies.length > 0 ? (
                    <DisplayToggle
                      display={display}
                      onChange={setDisplay}
                      ariaLabel="Affichage des pharmacies près de vous"
                    />
                  ) : null}
                </div>

                {nearbyPharmacies.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-card">
                    <p className="text-sm font-semibold text-ink-900">
                      Aucune pharmacie pour ces filtres
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Élargissez la commune ou réinitialisez les filtres ci-dessus.
                    </p>
                  </div>
                ) : (
                  <>
                    {display === "map" ? (
                      <div className="h-[62vh] min-h-[380px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-card lg:hidden">
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
                        "space-y-3",
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
                                  <>
                                    <p className="text-base font-bold tabular-nums text-brand-700">
                                      {inStockItems.length} produit
                                      {inStockItems.length > 1 ? "s" : ""}
                                    </p>
                                    <p className="text-[11px] text-slate-500">
                                      en stock
                                    </p>
                                  </>
                                }
                              />

                              <PharmacyCardMeta
                                pharmacy={pharmacy}
                                distanceKm={distanceKm}
                              />

                              {inStockItems.length > 0 ? (
                                <div className="mt-3">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleExpandedPharmacy(pharmacy.id);
                                    }}
                                    aria-expanded={isExpanded}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50/90 px-3 py-1.5 text-xs font-semibold text-ink-900 transition hover:border-brand-300 hover:bg-brand-50/60"
                                  >
                                    <IconChevronRight
                                      className={cn(
                                        "h-3.5 w-3.5 text-brand-600 transition-transform",
                                        isExpanded && "rotate-90",
                                      )}
                                    />
                                    {isExpanded
                                      ? `Masquer les médicaments (${inStockItems.length})`
                                      : `Voir les médicaments en stock (${inStockItems.length})`}
                                  </button>

                                  {isExpanded ? (
                                    <ul className="scroll-thin mt-2.5 max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50/80">
                                      {inStockItems.map(({ medicine, stock }) => {
                                        const level = stockLevel(stock);
                                        const meta = LEVEL_META[level];
                                        const inList = selectedMedicineIds.includes(
                                          medicine.id,
                                        );
                                        return (
                                          <li
                                            key={medicine.id}
                                            className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                                          >
                                            <button
                                              type="button"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                setQuery(medicine.name);
                                                addRecentSearch(medicine.name);
                                              }}
                                              className="min-w-0 flex-1 text-left transition hover:text-brand-700"
                                            >
                                              <p className="truncate font-semibold text-ink-900">
                                                {medicine.name}
                                              </p>
                                              <p className="truncate text-[10px] text-slate-500">
                                                {medicine.dci} · {meta.label}
                                                {level === "low"
                                                  ? ` (${stock.quantity})`
                                                  : ""}
                                              </p>
                                            </button>
                                            <div className="flex items-center gap-2">
                                              <span className="font-semibold tabular-nums text-ink-900">
                                                {fcfa(stock.price)}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={(event) => {
                                                  event.stopPropagation();
                                                  addMedicineToList(medicine.id);
                                                }}
                                                className={cn(
                                                  "rounded-lg border px-2 py-1 text-[10px] font-semibold transition",
                                                  inList
                                                    ? "border-brand-200 bg-brand-50 text-brand-700"
                                                    : "border-slate-200 bg-white text-brand-700 hover:border-brand-300 hover:bg-brand-50",
                                                )}
                                              >
                                                {inList ? "Ajouté" : "+ Ma liste"}
                                              </button>
                                            </div>
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

                <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-r from-brand-50/55 via-white to-amber-50/45 p-4 shadow-card sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-brand-700">
                        <IconShield className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="amber" dot>
                            Publicité · Partenaire Santé
                          </Badge>
                          <span className="text-[11px] font-medium text-slate-500">
                            Espace sponsorisé
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-bold text-ink-900">
                          Prévention Paludisme &amp; Hydratation en Côte d&apos;Ivoire
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                          Retrouvez les tests rapides paludisme (TDR), moustiquaires
                          imprégnées et sachets de réhydratation orale (SRO) dans les
                          pharmacies partenaires d&apos;Abidjan.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("Paludisme");
                        addRecentSearch("Paludisme");
                      }}
                      className="btn-secondary shrink-0 whitespace-nowrap rounded-xl text-xs"
                    >
                      Voir les produits disponibles
                    </button>
                  </div>
                </div>

                <div>
                  <h2 className="mb-3 px-1 text-sm font-bold text-ink-900">
                    Médicaments fréquents
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {popular.map((medicine) => {
                      const range = priceRange(state, medicine.id);
                      const inList = selectedMedicineIds.includes(medicine.id);
                      return (
                        <div
                          key={medicine.id}
                          className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card transition hover:border-brand-200"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setQuery(medicine.name);
                              addRecentSearch(medicine.name);
                            }}
                            className="text-left"
                          >
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                              <IconPill className="h-[18px] w-[18px]" />
                            </span>
                            <p className="mt-3 text-sm font-bold text-ink-900">
                              {medicine.name}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {medicine.dci} · {medicine.category}
                            </p>
                            <p className="mt-2 text-xs font-bold tabular-nums text-brand-700">
                              {range.count === 0
                                ? "indisponible"
                                : range.min === range.max
                                  ? fcfaShort(range.min)
                                  : `${fcfaShort(range.min)} – ${fcfaShort(range.max)}`}
                            </p>
                            <p className="text-[11px] tabular-nums text-slate-500">
                              {range.count} pharmacie{range.count > 1 ? "s" : ""} en stock
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => addMedicineToList(medicine.id)}
                            className={cn(
                              "mt-3 inline-flex items-center gap-1 self-start rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition",
                              inList
                                ? "border-brand-200 bg-brand-50 text-brand-700"
                                : "border-slate-200 bg-white text-brand-700 hover:border-brand-300 hover:bg-brand-50",
                            )}
                          >
                            {inList ? (
                              <>
                                <IconCheck className="h-3 w-3" />
                                Dans la liste
                              </>
                            ) : (
                              <>
                                <IconPlus className="h-3 w-3" />
                                Ajouter à ma liste
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )
          ) : selectedMedicineIds.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-card">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <IconList className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink-900">
                Comparez plusieurs médicaments en une seule recherche
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
                Ajoutez de 2 à 8 médicaments ci-dessus pour voir quelles officines
                disposent de l&apos;ensemble de votre liste et estimer le montant total
                au comptoir.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <p role="status" aria-live="polite" className="text-sm text-slate-600">
                  <span className="font-bold tabular-nums text-ink-900">
                    {listResults.length}
                  </span>{" "}
                  pharmacie{listResults.length > 1 ? "s" : ""} comparée
                  {listResults.length > 1 ? "s" : ""} pour{" "}
                  <span className="font-bold tabular-nums text-ink-900">
                    {selectedMedicineIds.length}
                  </span>{" "}
                  médicament{selectedMedicineIds.length > 1 ? "s" : ""} ·{" "}
                  <span className="font-bold tabular-nums text-brand-700">
                    {listResults.filter((item) => item.complete).length}
                  </span>{" "}
                  avec toute la liste
                </p>

                {listResults.length > 0 ? (
                  <DisplayToggle
                    display={display}
                    onChange={setDisplay}
                    ariaLabel="Affichage des résultats de la liste"
                  />
                ) : null}
              </div>

              {listResults.length === 0 ? (
                <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-card">
                  <p className="text-sm font-semibold text-ink-900">
                    Aucune pharmacie ne correspond à ces filtres
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
                    Élargissez la commune ou réinitialisez vos filtres.
                  </p>
                </div>
              ) : (
                <>
                  {display === "map" ? (
                    <div className="h-[62vh] min-h-[380px] overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-card lg:hidden">
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
                      "space-y-3",
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
                          onHover={setHoveredPharmacyId}
                          onSelect={setSelectedPharmacyId}
                        >
                          <PharmacyCardHeader
                            pharmacy={pharmacy}
                            open={open}
                            isFav={isFav}
                            onToggleFavorite={toggleFavoritePharmacy}
                            extraBadge={
                              <Badge
                                tone={
                                  result.complete
                                    ? "green"
                                    : availableCount > 0
                                      ? "amber"
                                      : "red"
                                }
                                dot
                              >
                                {result.complete
                                  ? `Tout disponible · ${availableCount}/${totalRequested}`
                                  : `${availableCount}/${totalRequested} disponible${
                                      availableCount > 1 ? "s" : ""
                                    }`}
                              </Badge>
                            }
                            rightSlot={
                              <>
                                <p className="text-lg font-bold tracking-tight tabular-nums text-ink-900 sm:text-xl">
                                  {availableCount > 0
                                    ? fcfa(result.estimatedTotal)
                                    : "—"}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {result.complete
                                    ? "Total estimé de la liste"
                                    : availableCount > 0
                                      ? "Total estimé (disponibles)"
                                      : "Aucun produit disponible"}
                                </p>
                              </>
                            }
                          />

                          <PharmacyCardMeta
                            pharmacy={pharmacy}
                            distanceKm={distanceKm}
                          />

                          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200/70 bg-slate-50/90">
                            {items.map((entry) => {
                              const meta = LEVEL_META[entry.level];
                              return (
                                <li
                                  key={entry.medicine.id}
                                  className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="font-semibold text-ink-900">
                                      {entry.medicine.name}
                                    </span>
                                    <span className="ml-1.5 text-[11px] text-slate-500">
                                      ({entry.medicine.dci})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2.5">
                                    <Badge tone={meta.tone} dot>
                                      {entry.level === "low" && entry.stock
                                        ? `${meta.label} (${entry.stock.quantity})`
                                        : meta.label}
                                    </Badge>
                                    <span className="w-24 text-right font-semibold tabular-nums text-ink-900">
                                      {entry.stock && entry.level !== "out"
                                        ? fcfa(entry.stock.price)
                                        : "—"}
                                    </span>
                                  </div>
                                </li>
                              );
                            })}
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
        </div>

        <aside
          aria-label="Carte interactive des pharmacies"
          className="hidden lg:block sticky top-[84px] h-[calc(100vh-108px)] min-h-[480px] max-h-[780px]"
        >
          <div className="h-full rounded-3xl border border-slate-200/80 bg-white p-2 shadow-card">
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

      <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3">
        <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-[11px] leading-relaxed text-amber-900">
          Kéné n&apos;appartient pas au corps médical, ne vend pas et ne réserve pas de
          médicaments. Les prix et disponibilités sont déclaratifs. En cas d&apos;urgence
          vitale, appelez le <strong>185 (SAMU)</strong> ou rendez-vous au centre de
          santé le plus proche.
        </p>
      </div>
    </div>
  );
}
