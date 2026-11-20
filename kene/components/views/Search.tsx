"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ThreeHeroScene from "@/components/ThreeHeroScene";
import { useStore } from "../store";
import { Badge, Card, cn } from "../ui";
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
import type { Medicine, StockItem } from "@/lib/types";

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

  const [mode, setMode] = useState<SearchMode>("single");
  const [display, setDisplay] = useState<DisplayMode>("list");
  const [query, setQuery] = useState("");
  const [listQuery, setListQuery] = useState("");
  const [selectedMedicineIds, setSelectedMedicineIds] = useState<string[]>([]);
  const [expandedPharmacyIds, setExpandedPharmacyIds] = useState<string[]>([]);

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
    Boolean(query.trim());

  const resetAllFilters = () => {
    setQuery("");
    setQuartier("Tous");
    setOnlyDuty(false);
    setOnlyOpen(false);
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
        waText: `Bonjour, je vérifie la disponibilité de médicaments dans votre officine. (via Kéné)`,
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

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="grid items-center gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <div>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-ink-900">
                  Quel médicament cherchez-vous ?
                </h2>
                <p className="text-xs text-slate-500">
                  Trouvez en quelques secondes les pharmacies ouvertes et le prix.
                </p>
              </div>

              <div
                role="tablist"
                aria-label="Mode de recherche"
                className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-semibold sm:w-auto"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "single"}
                  onClick={() => setMode("single")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition",
                    mode === "single"
                      ? "bg-white text-ink-900 shadow-sm"
                      : "text-slate-500 hover:text-ink-900",
                  )}
                >
                  <IconSearch className="h-3.5 w-3.5" />
                  <span>Un médicament</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "list"}
                  onClick={() => setMode("list")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition",
                    mode === "list"
                      ? "bg-white text-ink-900 shadow-sm"
                      : "text-slate-500 hover:text-ink-900",
                  )}
                >
                  <IconList className="h-3.5 w-3.5" />
                  <span>Mon ordonnance</span>
                  {selectedMedicineIds.length > 0 ? (
                    <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {selectedMedicineIds.length}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>

            {mode === "single" ? (
              <>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (query.trim()) addRecentSearch(query);
                  }}
                  className="relative"
                >
                  <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
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
                    className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-20 text-sm text-ink-900 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        inputRef.current?.focus();
                      }}
                      aria-label="Effacer la recherche"
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-ink-900 sm:right-10"
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
                    className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:block"
                  >
                    /
                  </kbd>
                </form>

                {suggestions.length > 0 ? (
                  <div
                    onMouseDown={() => {
                      suppressBlurRef.current = true;
                    }}
                    className="mt-2.5 flex flex-wrap items-center gap-1.5"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Correspondances :
                    </span>
                    {suggestions.map((medicine) => {
                      const inList = selectedMedicineIds.includes(medicine.id);
                      return (
                        <div
                          key={medicine.id}
                          className="inline-flex items-center overflow-hidden rounded-full border border-slate-200 bg-white text-[11px]"
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
                              "border-l border-slate-200 px-2 py-1 text-[10px] font-semibold transition",
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
                ) : null}

                <div
                  onMouseDown={() => {
                    suppressBlurRef.current = true;
                  }}
                  className="mt-3 flex flex-wrap gap-1.5"
                >
                  {QUICK_SEARCHES.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => {
                        const next = term === query ? "" : term;
                        setQuery(next);
                        if (next) addRecentSearch(next);
                      }}
                      aria-pressed={query === term}
                      className={cn(
                        "rounded-full px-3 py-1 text-[11px] font-semibold transition",
                        query === term
                          ? "bg-ink-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                      )}
                    >
                      {term}
                    </button>
                  ))}
                </div>

                {recentSearches.length > 0 ? (
                  <div
                    onMouseDown={() => {
                      suppressBlurRef.current = true;
                    }}
                    className="mt-2.5 flex flex-wrap items-center gap-1.5"
                  >
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
                        <IconClock className="h-3 w-3" />
                        {term}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={clearRecentSearches}
                      className="px-1.5 py-1 text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-ink-900 hover:underline"
                    >
                      Effacer
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-brand-200/70 bg-brand-50/70 px-3.5 py-2.5 text-[11px] leading-relaxed text-brand-900">
                  Ajoutez les médicaments de votre ordonnance pour voir quelles
                  pharmacies disposent de tous vos produits en une seule course.
                </div>

                <div className="relative">
                  <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
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
                    className="w-full rounded-xl border border-slate-200 bg-white py-3.5 pl-12 pr-12 text-sm text-ink-900 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100"
                  />
                  <kbd
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 sm:block"
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
                            ? "border-brand-200 bg-brand-50 text-brand-700 opacity-75"
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

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
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
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedMedicines.map((medicine) => (
                        <span
                          key={medicine.id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-3 py-1 text-[11px] font-semibold text-white"
                        >
                          <span>{medicine.name}</span>
                          <button
                            type="button"
                            onClick={() => removeMedicineFromList(medicine.id)}
                            aria-label={`Retirer ${medicine.name}`}
                            className="rounded-full p-0.5 text-slate-300 transition hover:bg-white/15 hover:text-white"
                          >
                            <IconClose className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {selectedMedicines.length === 1 ? (
                    <p className="mt-2 text-[11px] font-medium text-sun-700">
                      Ajoutez encore au moins 1 médicament (2 à 8 recommandés) pour
                      comparer une liste complète.
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <ThreeHeroScene variant="banner" />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {userLocation ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-brand-500 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">
              <IconCrosshair className="h-3.5 w-3.5 text-brand-600" />
              Autour de moi (GPS)
              <button
                type="button"
                onClick={clearLocation}
                aria-label="Désactiver la position GPS"
                className="ml-1 rounded p-0.5 text-brand-700 transition hover:bg-brand-100"
              >
                <IconClose className="h-3 w-3" />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={requestLocation}
              disabled={locationStatus === "locating"}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-ink-900 transition hover:border-brand-400 hover:bg-brand-50/40 disabled:opacity-60"
            >
              <IconCrosshair className="h-3.5 w-3.5 text-brand-600" />
              {locationStatus === "locating" ? "Localisation…" : "Autour de moi"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setOnlyDuty((value) => !value)}
            aria-pressed={onlyDuty}
            className={cn(
              "rounded-xl border px-3 py-2 text-xs font-medium transition",
              onlyDuty
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            De garde 24h/24
          </button>

          <button
            type="button"
            onClick={() => setOnlyOpen((value) => !value)}
            aria-pressed={onlyOpen}
            className={cn(
              "rounded-xl border px-3 py-2 text-xs font-medium transition",
              onlyOpen
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            Ouvertes maintenant
          </button>

          <select
            aria-label="Commune"
            value={quartier}
            onChange={(event) => setQuartier(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 focus:border-brand-400 focus:outline-none"
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
              className="ml-auto rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-ink-900"
            >
              Réinitialiser
            </button>
          ) : null}
        </div>
      </Card>

      {mode === "single" ? (
        query.trim() ? (
          <>
            <p role="status" aria-live="polite" className="sr-only">
              {rows.length} pharmacie{rows.length > 1 ? "s" : ""} référence
              {rows.length > 1 ? "nt" : ""} « {query.trim()} », dont {openNow} ouverte
              {openNow > 1 ? "s" : ""} avec du stock.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-ink-900">{rows.length}</span>{" "}
                pharmacie{rows.length > 1 ? "s" : ""} référencent « {query.trim()} » ·{" "}
                <span className="font-semibold text-brand-700">{openNow}</span> ouverte
                {openNow > 1 ? "s" : ""} avec du stock
              </p>

              {rows.length > 0 ? (
                <div
                  role="group"
                  aria-label="Affichage des résultats"
                  className="inline-flex rounded-xl bg-white p-1 text-xs font-semibold shadow-card"
                >
                  <button
                    type="button"
                    onClick={() => setDisplay("list")}
                    aria-pressed={display === "list"}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition",
                      display === "list"
                        ? "bg-ink-900 text-white"
                        : "text-slate-600 hover:text-ink-900",
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
                        ? "bg-ink-900 text-white"
                        : "text-slate-600 hover:text-ink-900",
                    )}
                  >
                    <IconMap className="h-3.5 w-3.5" />
                    Carte
                  </button>
                </div>
              ) : null}
            </div>

            {rows.length === 0 ? (
              <Card className="p-8 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <IconPill className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-medium text-ink-900">
                  Aucune pharmacie ne correspond à votre recherche
                </p>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
                  Essayez le nom de la molécule (DCI), élargissez la commune ou contactez
                  directement une pharmacie de garde.
                </p>
              </Card>
            ) : display === "map" ? (
              <PharmacyMap markers={singleMapMarkers} userLocation={userLocation} />
            ) : (
              <div className="space-y-3">
                {rows.map(({ pharmacy, medicine, stock, level, open, distanceKm }) => {
                  const meta = LEVEL_META[level];
                  const isFav = favoritePharmacyIds.includes(pharmacy.id);
                  const inList = selectedMedicineIds.includes(medicine.id);
                  return (
                    <Card key={`${pharmacy.id}-${medicine.id}`} className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-ink-900">
                              {pharmacy.name}
                            </p>
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
                            <Badge tone={open ? "green" : "neutral"}>
                              {open
                                ? pharmacy.onDuty
                                  ? "De garde 24h/24"
                                  : "Ouvert"
                                : "Fermé"}
                            </Badge>
                            <Badge tone={meta.tone}>{meta.label}</Badge>
                          </div>
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <IconMapPin className="h-3.5 w-3.5" />
                              {pharmacy.quartier} · {distanceLabel(distanceKm)}
                            </span>
                            <span>{openingLabel(pharmacy)}</span>
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {pharmacy.address}
                          </p>
                          <p className="mt-2 text-xs text-slate-600">
                            <span className="font-medium text-ink-900">
                              {medicine.name}
                            </span>{" "}
                            · <span className="text-slate-500">DCI : {medicine.dci}</span>{" "}
                            · {medicine.form}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xl font-semibold text-ink-900">
                            {fcfa(stock.price)}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {level === "out"
                              ? "indisponible"
                              : level === "low"
                                ? `plus que ${stock.quantity} en rayon`
                                : `${stock.quantity} en rayon`}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                        <a
                          href={mapsDirectionsLink(pharmacy, userLocation)}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            "px-4 py-2 text-xs",
                            level !== "out" ? "btn-primary" : "btn-secondary",
                          )}
                        >
                          <IconNavigation className="h-3.5 w-3.5" />
                          Itinéraire
                        </a>
                        <a
                          href={`tel:${pharmacy.phone.replace(/\s/g, "")}`}
                          className="btn-secondary px-3 py-2 text-xs"
                        >
                          <IconPhone className="h-3.5 w-3.5" />
                          Appeler
                        </a>
                        <a
                          href={waLink(
                            pharmacy.whatsapp,
                            `Bonjour, avez-vous actuellement ${medicine.name} (${medicine.form}) en stock ? (vu sur Kéné)`,
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="btn bg-[#25D366] px-3 py-2 text-xs text-ink-900 hover:bg-[#1FB855]"
                        >
                          <IconWhatsApp className="h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                        <button
                          type="button"
                          onClick={() => addMedicineToList(medicine.id, true)}
                          className="btn-ghost px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                        >
                          <IconList className="h-3.5 w-3.5" />
                          {inList ? "Voir ma liste" : "+ Ma liste"}
                        </button>
                        <span className="ml-auto text-[11px] text-slate-500">
                          Déclaré {timeAgo(stock.updatedAt)}
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-ink-900">
                    Pharmacies vérifiées près de vous ({nearbyPharmacies.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Consultez directement les stocks déclarés, la carte et les contacts.
                  </p>
                </div>

                {nearbyPharmacies.length > 0 ? (
                  <div
                    role="group"
                    aria-label="Affichage des pharmacies près de vous"
                    className="inline-flex rounded-xl bg-white p-1 text-xs font-semibold shadow-card"
                  >
                    <button
                      type="button"
                      onClick={() => setDisplay("list")}
                      aria-pressed={display === "list"}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition",
                        display === "list"
                          ? "bg-ink-900 text-white"
                          : "text-slate-600 hover:text-ink-900",
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
                          ? "bg-ink-900 text-white"
                          : "text-slate-600 hover:text-ink-900",
                      )}
                    >
                      <IconMap className="h-3.5 w-3.5" />
                      Carte
                    </button>
                  </div>
                ) : null}
              </div>

              {nearbyPharmacies.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-sm font-medium text-ink-900">
                    Aucune pharmacie pour ces filtres
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Élargissez la commune ou réinitialisez les filtres ci-dessus.
                  </p>
                </Card>
              ) : display === "map" ? (
                <PharmacyMap markers={nearbyMapMarkers} userLocation={userLocation} />
              ) : (
                <div className="grid items-start gap-3 lg:grid-cols-2">
                  {nearbyPharmacies.map(
                    ({ pharmacy, open, distanceKm, inStockItems, latestUpdate }) => {
                      const isFav = favoritePharmacyIds.includes(pharmacy.id);
                      const isExpanded = expandedPharmacyIds.includes(pharmacy.id);
                      return (
                        <Card
                          key={pharmacy.id}
                          className="flex flex-col justify-between p-5"
                        >
                          <div>
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-ink-900">
                                    {pharmacy.name}
                                  </p>
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
                                  <Badge tone={open ? "green" : "neutral"}>
                                    {open
                                      ? pharmacy.onDuty
                                        ? "De garde 24h/24"
                                        : "Ouvert"
                                      : "Fermé"}
                                  </Badge>
                                </div>
                                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                  <span className="inline-flex items-center gap-1 font-medium text-ink-900">
                                    <IconMapPin className="h-3.5 w-3.5 text-brand-600" />
                                    {pharmacy.quartier} · {distanceLabel(distanceKm)}
                                  </span>
                                  <span>{openingLabel(pharmacy)}</span>
                                </p>
                                <p className="mt-1 text-[11px] text-slate-500">
                                  {pharmacy.address}
                                </p>
                              </div>

                              <div className="text-right">
                                <p className="text-sm font-semibold text-brand-700">
                                  {inStockItems.length} produits
                                </p>
                                <p className="text-[10px] text-slate-500">
                                  {latestUpdate ? timeAgo(latestUpdate) : "en stock"}
                                </p>
                              </div>
                            </div>

                            {inStockItems.length > 0 ? (
                              <div className="mt-3">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandedPharmacy(pharmacy.id)}
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
                                    ? `Masquer les médicaments (${inStockItems.length})`
                                    : `Voir les médicaments en stock (${inStockItems.length})`}
                                </button>

                                {isExpanded ? (
                                  <ul className="scroll-thin mt-2 max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60">
                                    {inStockItems.map(({ medicine, stock }) => {
                                      const level = stockLevel(stock);
                                      const meta = LEVEL_META[level];
                                      const inList = selectedMedicineIds.includes(
                                        medicine.id,
                                      );
                                      return (
                                        <li
                                          key={medicine.id}
                                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs"
                                        >
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setQuery(medicine.name);
                                              addRecentSearch(medicine.name);
                                            }}
                                            className="min-w-0 flex-1 text-left transition hover:text-brand-700"
                                          >
                                            <p className="truncate font-medium text-ink-900">
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
                                            <span className="font-semibold text-ink-900">
                                              {fcfa(stock.price)}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                addMedicineToList(medicine.id)
                                              }
                                              className={cn(
                                                "rounded-md border px-2 py-1 text-[10px] font-semibold transition",
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
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                            <a
                              href={mapsDirectionsLink(pharmacy, userLocation)}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-primary px-3.5 py-2 text-xs"
                            >
                              <IconNavigation className="h-3.5 w-3.5" />
                              Itinéraire
                            </a>
                            <a
                              href={`tel:${pharmacy.phone.replace(/\s/g, "")}`}
                              className="btn-secondary px-3 py-2 text-xs"
                            >
                              <IconPhone className="h-3.5 w-3.5" />
                              Appeler
                            </a>
                            <a
                              href={waLink(
                                pharmacy.whatsapp,
                                `Bonjour, je vérifie la disponibilité de médicaments dans votre officine. (via Kéné)`,
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="btn bg-[#25D366] px-3 py-2 text-xs text-ink-900 hover:bg-[#1FB855]"
                            >
                              <IconWhatsApp className="h-3.5 w-3.5" />
                              WhatsApp
                            </a>
                          </div>
                        </Card>
                      );
                    },
                  )}
                </div>
              )}
            </div>

            <Card className="border-brand-200/80 bg-gradient-to-r from-brand-50/70 via-white to-sun-50/60 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
                    <IconShield className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="amber">Publicité · Partenaire Santé</Badge>
                      <span className="text-[11px] font-medium text-slate-500">
                        Espace Publicitaire · Partenaire Santé
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-ink-900">
                      Prévention Paludisme &amp; Hydratation en Côte d&apos;Ivoire
                    </p>
                    <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-slate-600">
                      Retrouvez les tests rapides paludisme (TDR), moustiquaires imprégnées
                      et sachets de réhydratation orale (SRO) dans les pharmacies
                      partenaires d&apos;Abidjan.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("Paludisme");
                    addRecentSearch("Paludisme");
                  }}
                  className="btn-secondary shrink-0 whitespace-nowrap text-xs"
                >
                  Voir les produits disponibles
                </button>
              </div>
            </Card>

            <div>
              <h2 className="mb-3 text-sm font-semibold text-ink-900">
                Médicaments fréquents
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {popular.map((medicine) => {
                  const range = priceRange(state, medicine.id);
                  const inList = selectedMedicineIds.includes(medicine.id);
                  return (
                    <div
                      key={medicine.id}
                      className="card flex flex-col justify-between p-4 transition hover:border-brand-200"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setQuery(medicine.name);
                          addRecentSearch(medicine.name);
                        }}
                        className="text-left"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                          <IconPill className="h-[18px] w-[18px]" />
                        </span>
                        <p className="mt-3 text-sm font-semibold text-ink-900">
                          {medicine.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {medicine.dci} · {medicine.category}
                        </p>
                        <p className="mt-2 text-xs font-medium text-brand-700">
                          {range.count === 0
                            ? "indisponible"
                            : range.min === range.max
                              ? fcfaShort(range.min)
                              : `${fcfaShort(range.min)} – ${fcfaShort(range.max)}`}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {range.count} pharmacie{range.count > 1 ? "s" : ""} en stock
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => addMedicineToList(medicine.id)}
                        className="mt-3 inline-flex items-center gap-1 self-start rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-brand-50"
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
        <Card className="p-8 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <IconList className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-medium text-ink-900">
            Comparez plusieurs médicaments en une seule recherche
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
            Ajoutez de 2 à 8 médicaments ci-dessus pour voir quelles officines disposent de
            l&apos;ensemble de votre liste et estimer le montant total au comptoir.
          </p>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <p role="status" aria-live="polite" className="text-sm text-slate-600">
              <span className="font-semibold text-ink-900">{listResults.length}</span>{" "}
              pharmacie{listResults.length > 1 ? "s" : ""} comparée
              {listResults.length > 1 ? "s" : ""} pour{" "}
              <span className="font-semibold text-ink-900">
                {selectedMedicineIds.length}
              </span>{" "}
              médicament{selectedMedicineIds.length > 1 ? "s" : ""} ·{" "}
              <span className="font-semibold text-brand-700">
                {listResults.filter((item) => item.complete).length}
              </span>{" "}
              avec toute la liste
            </p>

            {listResults.length > 0 ? (
              <div
                role="group"
                aria-label="Affichage des résultats de la liste"
                className="inline-flex rounded-xl bg-white p-1 text-xs font-semibold shadow-card"
              >
                <button
                  type="button"
                  onClick={() => setDisplay("list")}
                  aria-pressed={display === "list"}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition",
                    display === "list"
                      ? "bg-ink-900 text-white"
                      : "text-slate-600 hover:text-ink-900",
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
                      ? "bg-ink-900 text-white"
                      : "text-slate-600 hover:text-ink-900",
                  )}
                >
                  <IconMap className="h-3.5 w-3.5" />
                  Carte
                </button>
              </div>
            ) : null}
          </div>

          {listResults.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm font-medium text-ink-900">
                Aucune pharmacie ne correspond à ces filtres
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
                Élargissez la commune ou réinitialisez vos filtres.
              </p>
            </Card>
          ) : display === "map" ? (
            <PharmacyMap markers={listMapMarkers} userLocation={userLocation} />
          ) : (
            <div className="space-y-3">
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
                const listSummary = selectedMedicines
                  .map((medicine) => `• ${medicine.name} (${medicine.form})`)
                  .join("\n");
                return (
                  <Card key={pharmacy.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-ink-900">
                            {pharmacy.name}
                          </p>
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
                          <Badge tone={open ? "green" : "neutral"}>
                            {open
                              ? pharmacy.onDuty
                                ? "De garde 24h/24"
                                : "Ouvert"
                              : "Fermé"}
                          </Badge>
                          <Badge
                            tone={
                              result.complete
                                ? "green"
                                : availableCount > 0
                                  ? "amber"
                                  : "red"
                            }
                          >
                            {result.complete
                              ? `Tout disponible · ${availableCount}/${totalRequested}`
                              : `${availableCount}/${totalRequested} disponible${
                                  availableCount > 1 ? "s" : ""
                                }`}
                          </Badge>
                        </div>

                        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <IconMapPin className="h-3.5 w-3.5" />
                            {pharmacy.quartier} · {distanceLabel(distanceKm)}
                          </span>
                          <span>{openingLabel(pharmacy)}</span>
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {pharmacy.address}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xl font-semibold text-ink-900">
                          {availableCount > 0 ? fcfa(result.estimatedTotal) : "—"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {result.complete
                            ? "Total estimé de la liste"
                            : availableCount > 0
                              ? "Total estimé (produits disponibles)"
                              : "Aucun produit disponible"}
                        </p>
                      </div>
                    </div>

                    <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/70">
                      {items.map((entry) => {
                        const meta = LEVEL_META[entry.level];
                        return (
                          <li
                            key={entry.medicine.id}
                            className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="font-medium text-ink-900">
                                {entry.medicine.name}
                              </span>
                              <span className="ml-1.5 text-[11px] text-slate-500">
                                ({entry.medicine.dci})
                              </span>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <Badge tone={meta.tone}>
                                {entry.level === "low" && entry.stock
                                  ? `${meta.label} (${entry.stock.quantity})`
                                  : meta.label}
                              </Badge>
                              <span className="w-24 text-right font-semibold text-ink-900">
                                {entry.stock && entry.level !== "out"
                                  ? fcfa(entry.stock.price)
                                  : "—"}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                      <a
                        href={mapsDirectionsLink(pharmacy, userLocation)}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          "px-4 py-2 text-xs",
                          availableCount > 0 ? "btn-primary" : "btn-secondary",
                        )}
                      >
                        <IconNavigation className="h-3.5 w-3.5" />
                        Itinéraire
                      </a>
                      <a
                        href={`tel:${pharmacy.phone.replace(/\s/g, "")}`}
                        className="btn-secondary px-3 py-2 text-xs"
                      >
                        <IconPhone className="h-3.5 w-3.5" />
                        Appeler
                      </a>
                      <a
                        href={waLink(
                          pharmacy.whatsapp,
                          `Bonjour, avez-vous ces médicaments disponibles actuellement (vu sur Kéné) ?\n${listSummary}`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="btn bg-[#25D366] px-3 py-2 text-xs text-ink-900 hover:bg-[#1FB855]"
                      >
                        <IconWhatsApp className="h-3.5 w-3.5" />
                        WhatsApp
                      </a>
                      <span className="ml-auto text-[11px] text-slate-500">
                        {result.latestUpdate
                          ? `Déclaré ${timeAgo(result.latestUpdate)}`
                          : "Aucune mise à jour récente"}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-sun-200 bg-sun-50 px-4 py-3">
        <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-sun-600" />
        <p className="text-[11px] leading-relaxed text-sun-800">
          Kéné n&apos;appartient pas au corps médical, ne vend pas et ne réserve pas de
          médicaments. Les prix et disponibilités sont déclaratifs. En cas d&apos;urgence
          vitale, appelez le <strong>185 (SAMU)</strong> ou rendez-vous au centre de
          santé le plus proche.
        </p>
      </div>
    </div>
  );
}
