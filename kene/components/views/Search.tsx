"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { cn } from "../ui";
import PharmacyMap, { type PharmacyMapMarker } from "../PharmacyMap";
import PrescriptionPhotoPanel, {
  type PrescriptionPhotoData,
} from "../PrescriptionPhotoPanel";
import {
  IconCamera,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconClose,
  IconCrosshair,
  IconDownload,
  IconList,
  IconLogo,
  IconMap,
  IconMapPin,
  IconMic,
  IconNavigation,
  IconPharmacy,
  IconPhone,
  IconPill,
  IconPlus,
  IconSearch,
  IconSettings,
  IconShare,
  IconSmartphone,
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

interface SpeechRecognitionResultAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionResultAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  error?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

const MAX_LIST_ITEMS = 8;

const HEALTH_CHIPS: Array<{ label: string; search: string }> = [
  { label: "Paludisme", search: "Paludisme" },
  { label: "Fièvre & douleur", search: "Douleur fièvre" },
  { label: "Sirop enfant", search: "Sirop enfant" },
  { label: "Paracétamol", search: "Paracétamol" },
  { label: "Ventre & SRO", search: "Digestion" },
  { label: "Toux & rhume", search: "Respiratoire" },
  { label: "Grossesse & fer", search: "Grossesse" },
  { label: "Tension & diabète", search: "Tension" },
];

const CARD_PATTERN = {
  backgroundColor: "#0EA58C",
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(255,255,255,0.09) 0px, rgba(255,255,255,0.09) 10px, transparent 10px, transparent 22px), linear-gradient(135deg, #14B89A 0%, #0EA58C 52%, #088A75 100%)",
};

function humanOpeningStatus(pharmacy: Pharmacy): string {
  if (pharmacy.onDuty || (pharmacy.openFrom === 0 && pharmacy.openTo >= 24)) {
    return "24h/24";
  }
  if (isOpen(pharmacy)) return `Jusqu'à ${pharmacy.openTo}h`;
  return `Ouvre à ${pharmacy.openFrom}h`;
}

function PharmacyRowShell({
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
        "px-4 py-4 transition sm:px-5",
        isActive ? "bg-brand-50/50" : "hover:bg-slate-50/80",
        dimmed && "opacity-75",
      )}
    >
      {children}
    </article>
  );
}

function PharmacyRowHeader({
  pharmacy,
  open,
  distanceKm,
  isFav,
  onToggleFavorite,
  rightTop,
  rightBottom,
  rightTone = "brand",
}: {
  pharmacy: Pharmacy;
  open: boolean;
  distanceKm: number;
  isFav: boolean;
  onToggleFavorite: (pharmacyId: string) => void;
  rightTop: string;
  rightBottom?: string;
  rightTone?: "brand" | "green" | "amber" | "red" | "muted";
}) {
  const toneClass =
    rightTone === "green"
      ? "text-emerald-700"
      : rightTone === "amber"
        ? "text-amber-700"
        : rightTone === "red"
          ? "text-rose-700"
          : rightTone === "muted"
            ? "text-slate-500"
            : "text-brand-700";

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <h3 className="truncate text-base font-bold text-slate-900">
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
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
              isFav
                ? "text-sun-500 hover:bg-sun-50"
                : "text-slate-300 hover:bg-slate-100 hover:text-sun-500",
            )}
          >
            <IconStar filled={isFav} className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
              pharmacy.onDuty && open
                ? "bg-emerald-50 text-emerald-800"
                : open
                  ? "bg-brand-50 text-brand-800"
                  : "bg-slate-100 text-slate-600",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                open ? "bg-emerald-600" : "bg-slate-400",
              )}
            />
            {open
              ? pharmacy.onDuty
                ? "De garde 24h/24"
                : "Ouvert"
              : "Fermé"}
          </span>
          <span>{pharmacy.quartier}</span>
          <span aria-hidden="true">·</span>
          <span className="font-semibold tabular-nums text-slate-700">
            à {distanceLabel(distanceKm)}
          </span>
          <span aria-hidden="true">·</span>
          <span>{humanOpeningStatus(pharmacy)}</span>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className={cn("text-base font-extrabold tabular-nums", toneClass)}>
          {rightTop}
        </p>
        {rightBottom ? (
          <p className="mt-0.5 text-xs font-semibold tabular-nums text-slate-500">
            {rightBottom}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PharmacyRowActions({
  pharmacy,
  userLocation,
  primaryDirections = true,
  waText,
  shareDetail,
  prescriptionFile,
  onNotify,
  timestampText,
}: {
  pharmacy: Pharmacy;
  userLocation: UserLocation | null;
  primaryDirections?: boolean;
  waText: string;
  shareDetail?: string;
  prescriptionFile?: File | null;
  onNotify: (message: string) => void;
  timestampText: string;
}) {
  const mapsUrl = mapsDirectionsLink(pharmacy, userLocation);

  const handleShare = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const summary = shareDetail
      ? `${pharmacy.name} (${pharmacy.quartier}) · ${shareDetail} — ${mapsUrl}`
      : `${pharmacy.name} (${pharmacy.quartier}) — ${mapsUrl}`;

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        if (
          prescriptionFile &&
          navigator.canShare?.({ files: [prescriptionFile] })
        ) {
          await navigator.share({
            title: `${pharmacy.name} · Kéné`,
            text: summary,
            files: [prescriptionFile],
          });
        } else {
          await navigator.share({
            title: `${pharmacy.name} · Kéné`,
            text: summary,
          });
        }
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
      }
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);
        onNotify(
          prescriptionFile
            ? "Infos pharmacie copiées (joignez la photo si besoin)."
            : "Infos pharmacie copiées !",
        );
      } else {
        onNotify("Partage indisponible sur ce navigateur.");
      }
    } catch {
      onNotify("Copie impossible sur ce navigateur.");
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "inline-flex h-11 min-h-[44px] min-w-[96px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-[13px] font-bold transition active:scale-[0.98] sm:min-w-0 sm:flex-none",
          primaryDirections
            ? "bg-brand-700 text-white hover:bg-brand-800"
            : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
        )}
      >
        <IconNavigation className="h-4 w-4 shrink-0" />
        Itinéraire
      </a>
      <a
        href={`tel:${pharmacy.phone.replace(/\s/g, "")}`}
        onClick={(event) => event.stopPropagation()}
        className="inline-flex h-11 min-h-[44px] min-w-[96px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-800 transition hover:bg-slate-50 active:scale-[0.98] sm:min-w-0 sm:flex-none"
      >
        <IconPhone className="h-4 w-4 shrink-0" />
        Appeler
      </a>
      <a
        href={waLink(pharmacy.whatsapp, waText)}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="inline-flex h-11 min-h-[44px] min-w-[96px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-50 px-3 text-[13px] font-bold text-emerald-800 transition hover:bg-emerald-100 active:scale-[0.98] sm:min-w-0 sm:flex-none"
      >
        <IconWhatsApp className="h-4 w-4 shrink-0" />
        WhatsApp
      </a>
      <button
        type="button"
        onClick={(event) => void handleShare(event)}
        aria-label={
          prescriptionFile
            ? `Joindre l'ordonnance pour ${pharmacy.name}`
            : `Partager ${pharmacy.name}`
        }
        className="inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 active:scale-[0.98] sm:h-11 sm:min-h-[44px] sm:bg-white sm:text-[13px]"
      >
        <IconShare className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
        {prescriptionFile ? "Joindre ordonnance" : "Partager"}
      </button>
      <span className="ml-auto text-[11px] text-slate-400">
        {timestampText}
      </span>
    </div>
  );
}

export default function Search({
  initialQuery,
  onConsumeInitialQuery,
  initialOnlyDuty,
  onConsumeInitialOnlyDuty,
  initialTriggerGps,
  onConsumeInitialTriggerGps,
  onOpenSettings,
  onOpenAccount,
  accountLabel,
  isOffline,
  saving,
  canInstallPwa,
  onInstallPwa,
}: {
  initialQuery?: string;
  onConsumeInitialQuery?: () => void;
  initialOnlyDuty?: boolean;
  onConsumeInitialOnlyDuty?: () => void;
  initialTriggerGps?: boolean;
  onConsumeInitialTriggerGps?: () => void;
  onOpenSettings: () => void;
  onOpenAccount: () => void;
  accountLabel?: string | null;
  isOffline?: boolean;
  saving?: boolean;
  canInstallPwa?: boolean;
  onInstallPwa?: () => void;
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
  const mapSectionRef = useRef<HTMLElement>(null);

  const [mode, setMode] = useState<SearchMode>("single");
  const [display, setDisplay] = useState<DisplayMode>("list");
  const [query, setQuery] = useState("");
  const [listQuery, setListQuery] = useState("");
  const [selectedMedicineIds, setSelectedMedicineIds] = useState<string[]>([]);
  const [prescriptionPhoto, setPrescriptionPhoto] =
    useState<PrescriptionPhotoData | null>(null);
  const [cameraTrigger, setCameraTrigger] = useState(0);
  const [expandedPharmacyIds, setExpandedPharmacyIds] = useState<string[]>([]);
  const [hoveredPharmacyId, setHoveredPharmacyId] = useState<string | null>(null);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [showInstallPanel, setShowInstallPanel] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const modeRef = useRef<SearchMode>(mode);
  const selectedMedicineIdsRef = useRef<string[]>(selectedMedicineIds);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    selectedMedicineIdsRef.current = selectedMedicineIds;
  }, [selectedMedicineIds]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const handleVoiceSearch = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const speechWindow =
      typeof window !== "undefined" ? (window as WindowWithSpeech) : null;
    const SpeechRec =
      speechWindow?.SpeechRecognition ?? speechWindow?.webkitSpeechRecognition;

    if (!SpeechRec) {
      notify("La recherche vocale n'est pas disponible sur ce navigateur.");
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = "fr-FR";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript ?? "";
        const cleaned = transcript.replace(/[.,;!?]+$/g, "").trim();
        if (!cleaned) return;
        if (modeRef.current === "single") {
          setQuery(cleaned);
          addRecentSearch(cleaned);
        } else {
          setListQuery(cleaned);
        }
      };

      recognition.onerror = (event) => {
        setListening(false);
        recognitionRef.current = null;
        if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed"
        ) {
          notify("Autorisez le microphone pour utiliser la recherche vocale.");
        } else if (event.error === "no-speech") {
          notify("Aucune voix détectée. Réessayez.");
        } else if (event.error !== "aborted") {
          notify("Impossible de reconnaître la voix. Tapez votre recherche.");
        }
      };

      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      setListening(true);
      recognition.start();
    } catch {
      setListening(false);
      recognitionRef.current = null;
      notify("La recherche vocale n'est pas disponible sur ce navigateur.");
    }
  };

  const visiblePharmacies = useMemo(() => publicPharmacies(state), [state]);
  const dutyCount = useMemo(
    () => visiblePharmacies.filter((pharmacy) => pharmacy.onDuty).length,
    [visiblePharmacies],
  );
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
    if (!initialTriggerGps) return;
    requestLocation();
    onConsumeInitialTriggerGps?.();
  }, [initialTriggerGps, requestLocation, onConsumeInitialTriggerGps]);

  useEffect(() => {
    setHoveredPharmacyId(null);
    setSelectedPharmacyId(null);
  }, [mode]);

  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyDuty, setOnlyDuty] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sortBy, setSortBy] = useState<"distance" | "price">("distance");

  useEffect(() => {
    if (!initialOnlyDuty) return;
    setMode("single");
    setOnlyDuty(true);
    setOnlyFavorites(false);
    onConsumeInitialOnlyDuty?.();
  }, [initialOnlyDuty, onConsumeInitialOnlyDuty]);

  useEffect(() => {
    if (favoritePharmacyIds.length === 0 && onlyFavorites) {
      setOnlyFavorites(false);
    }
  }, [favoritePharmacyIds.length, onlyFavorites]);

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
      sort: sortBy,
    }),
    [quartier, onlyOpen, onlyDuty, sortBy],
  );

  const hasActiveFilters =
    Boolean(userLocation) ||
    onlyDuty ||
    onlyOpen ||
    onlyFavorites ||
    quartier !== "Tous" ||
    (mode === "single" && Boolean(query.trim()));

  const resetAllFilters = () => {
    setQuery("");
    setQuartier("Tous");
    setOnlyDuty(false);
    setOnlyOpen(false);
    setOnlyFavorites(false);
    setSortBy("distance");
    setSelectedPharmacyId(null);
    setHoveredPharmacyId(null);
    if (userLocation) clearLocation();
  };

  const inStockByPharmacy = useMemo(() => {
    const medicineById = new Map<string, Medicine>(
      state.medicines.map((medicine) => [medicine.id, medicine]),
    );
    const map = new Map<string, Array<{ medicine: Medicine; stock: StockItem }>>();
    for (const stock of state.stock) {
      if (stockLevel(stock) === "out") continue;
      const medicine = medicineById.get(stock.medicineId);
      if (!medicine) continue;
      const bucket = map.get(stock.pharmacyId);
      if (bucket) {
        bucket.push({ medicine, stock });
      } else {
        map.set(stock.pharmacyId, [{ medicine, stock }]);
      }
    }
    for (const entries of Array.from(map.values())) {
      entries.sort((a, b) => a.medicine.name.localeCompare(b.medicine.name, "fr"));
    }
    return map;
  }, [state.medicines, state.stock]);

  const nearbyPharmacies = useMemo(() => {
    return visiblePharmacies
      .filter((pharmacy) => {
        if (quartier !== "Tous" && pharmacy.quartier !== quartier) return false;
        const open = isOpen(pharmacy);
        if (onlyOpen && !open) return false;
        if (onlyDuty && !pharmacy.onDuty) return false;
        if (onlyFavorites && !favoritePharmacyIds.includes(pharmacy.id)) return false;
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
    onlyFavorites,
    favoritePharmacyIds,
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

  const rows = useMemo(() => {
    const base = searchMedicine(state, query, filters, userLocation);
    return onlyFavorites
      ? base.filter((row) => favoritePharmacyIds.includes(row.pharmacy.id))
      : base;
  }, [state, query, filters, userLocation, onlyFavorites, favoritePharmacyIds]);

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
    const base = searchMedicineList(state, selectedMedicineIds, filters, userLocation);
    return onlyFavorites
      ? base.filter((result) => favoritePharmacyIds.includes(result.pharmacy.id))
      : base;
  }, [state, selectedMedicineIds, filters, userLocation, onlyFavorites, favoritePharmacyIds]);

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
            subtitle: `${row.medicine.name} · ${openingLabel(row.pharmacy)}`,
            waText: `Bonjour, avez-vous actuellement ${row.medicine.name} (${row.medicine.form}) en stock ? (via Kéné)`,
          },
        });
      } else {
        existing.count += 1;
        existing.marker.subtitle = `${existing.count} présentations trouvées · ${openingLabel(row.pharmacy)}`;
      }
    }
    return Array.from(seen.values()).map((entry) => entry.marker);
  }, [rows]);

  const listMapMarkers = useMemo<PharmacyMapMarker[]>(() => {
    const listSummary = selectedMedicines
      .map((medicine) => `• ${medicine.name}`)
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

  const addMedicinesBatch = (ids: string[]) => {
    const validIds = new Set(state.medicines.map((item) => item.id));
    const current = selectedMedicineIdsRef.current;
    const seen = new Set(current);
    const toAdd: string[] = [];
    let alreadyCount = 0;
    let skippedOverLimit = 0;

    for (const id of ids) {
      if (!validIds.has(id)) continue;
      if (seen.has(id)) {
        alreadyCount += 1;
        continue;
      }
      if (current.length + toAdd.length >= MAX_LIST_ITEMS) {
        skippedOverLimit += 1;
        continue;
      }
      seen.add(id);
      toAdd.push(id);
    }

    if (toAdd.length > 0) {
      const nextIds = [...current, ...toAdd];
      selectedMedicineIdsRef.current = nextIds;
      setSelectedMedicineIds(nextIds);
      if (skippedOverLimit > 0) {
        notify(
          `${toAdd.length} médicament${toAdd.length > 1 ? "s" : ""} ajouté${toAdd.length > 1 ? "s" : ""} (limite de ${MAX_LIST_ITEMS} atteinte).`,
        );
      } else {
        notify(
          `${toAdd.length} médicament${toAdd.length > 1 ? "s" : ""} ajouté${toAdd.length > 1 ? "s" : ""} à votre ordonnance (${nextIds.length}/${MAX_LIST_ITEMS}).`,
        );
      }
      return;
    }

    if (current.length >= MAX_LIST_ITEMS && skippedOverLimit > 0) {
      notify(`Maximum ${MAX_LIST_ITEMS} médicaments par ordonnance.`);
    } else if (alreadyCount > 0) {
      notify(
        alreadyCount > 1
          ? "Ces médicaments sont déjà dans votre ordonnance."
          : "Ce médicament est déjà dans votre ordonnance.",
      );
    }
  };

  const removeMedicineFromList = (medicineId: string) => {
    setSelectedMedicineIds((previous) => previous.filter((id) => id !== medicineId));
  };

  const copySelectedList = () => {
    if (selectedMedicines.length === 0) return;
    const textList = selectedMedicines
      .map((medicine, idx) => `${idx + 1}. ${medicine.name} — ${medicine.form}`)
      .join("\n");
    void navigator.clipboard
      ?.writeText(`Ordonnance Kéné :\n${textList}`)
      .then(() => notify("Ordonnance copiée dans le presse-papier."))
      .catch(() => notify("Copie impossible sur ce navigateur."));
  };

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

  const feedTitle = useMemo(() => {
    if (mode === "list") {
      if (selectedMedicineIds.length === 0) {
        return "Sélectionnez vos médicaments";
      }
      if (listResults.length === 0) {
        return "Aucune pharmacie pour cette ordonnance";
      }
      if (completeListCount > 0) {
        return `${completeListCount} pharmacie${completeListCount > 1 ? "s ont" : " a"} tout en stock`;
      }
      return `${listResults.length} pharmacie${listResults.length > 1 ? "s" : ""} avec stock partiel`;
    }
    if (hasSingleQuery) {
      if (rows.length === 0) {
        return `Aucun résultat pour « ${query.trim()} »`;
      }
      return `${uniqueRowPharmacies} pharmacie${uniqueRowPharmacies > 1 ? "s ont" : " a"} « ${query.trim()} »`;
    }
    return `${nearbyPharmacies.length} pharmacie${nearbyPharmacies.length > 1 ? "s" : ""} vérifiée${nearbyPharmacies.length > 1 ? "s" : ""}`;
  }, [
    mode,
    selectedMedicineIds.length,
    listResults.length,
    completeListCount,
    hasSingleQuery,
    rows.length,
    uniqueRowPharmacies,
    query,
    nearbyPharmacies.length,
  ]);

  const handleToggleMapAction = () => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setDisplay("list");
      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      notify("La carte d'Abidjan est affichée à droite.");
      return;
    }
    setDisplay((prev) => (prev === "map" ? "list" : "map"));
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[460px_minmax(0,1fr)] lg:items-start lg:gap-6 lg:px-6 lg:py-6 xl:grid-cols-[500px_minmax(0,1fr)]">
        <div
          ref={resultsColumnRef}
          className="min-w-0 bg-white lg:overflow-hidden lg:rounded-[28px] lg:border lg:border-slate-200/80 lg:shadow-soft"
        >
          {/* 1. Top Vibrant Brand Header (Wave layout rhythm in Kéné emerald) */}
          <header className="bg-gradient-to-b from-[#045D56] to-[#066F66] px-4 pb-16 pt-4 text-white">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onOpenSettings}
                aria-label="Paramètres"
                title="Paramètres"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/15"
              >
                <IconSettings className="h-6 w-6" />
              </button>

              <div className="flex items-center gap-1.5">
                {isOffline ? (
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 text-xs font-semibold text-amber-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                    Hors-ligne
                  </span>
                ) : null}
                {saving ? (
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-white/15 px-2.5 text-xs font-semibold text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                    Sync…
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onOpenAccount}
                className="inline-flex h-9 max-w-[190px] shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-bold text-slate-900 shadow-sm transition hover:bg-emerald-50"
              >
                {accountLabel ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                    />
                    <span className="truncate">{accountLabel}</span>
                  </>
                ) : (
                  <>
                    <IconPharmacy className="h-3.5 w-3.5 shrink-0 text-brand-700" />
                    <span>Pharmacien</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-2 text-center">
              <h1 className="font-display text-lg font-bold tracking-tight text-white">
                {mode === "single"
                  ? "Kéné · Pharmacies d'Abidjan"
                  : "Mon ordonnance"}
              </h1>
              <p className="mt-0.5 text-xs font-medium text-emerald-100/90 tabular-nums">
                {visiblePharmacies.length} pharmacies · {dutyCount} de garde 24h/24
              </p>
            </div>
          </header>

          {/* 2. Floating Signature Focal Search Card */}
          <section
            aria-label="Recherche de médicaments"
            style={CARD_PATTERN}
            className="relative z-10 mx-4 -mt-12 rounded-[22px] border border-white/25 p-3.5 shadow-float"
          >
            <div className="rounded-2xl bg-white p-2 shadow-sm">
              {mode === "single" ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (query.trim()) addRecentSearch(query);
                  }}
                  className="flex h-[52px] items-center gap-1.5 px-1.5"
                >
                  <IconSearch className="h-5 w-5 shrink-0 text-brand-700" />
                  <input
                    ref={inputRef}
                    type="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    aria-label="Rechercher un médicament"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onBlur={() => {
                      if (suppressBlurRef.current) {
                        suppressBlurRef.current = false;
                        return;
                      }
                      if (query.trim().length >= 2) addRecentSearch(query);
                    }}
                    placeholder="Nom du médicament…"
                    className="min-w-0 flex-1 bg-transparent px-1.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none sm:text-base [&::-webkit-search-cancel-button]:hidden"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        inputRef.current?.focus();
                      }}
                      aria-label="Effacer la recherche"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <IconClose className="h-4 w-4" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("list");
                      setCameraTrigger((value) => value + 1);
                    }}
                    aria-label="Prendre en photo une ordonnance"
                    title="Scanner une ordonnance en photo"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition hover:bg-brand-100 active:scale-95 sm:h-11 sm:w-11"
                  >
                    <IconCamera className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleVoiceSearch}
                    aria-label="Rechercher à la voix"
                    aria-pressed={listening}
                    title={
                      listening
                        ? "Écoute en cours… touchez pour arrêter"
                        : "Rechercher à la voix"
                    }
                    className={cn(
                      "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition active:scale-95 sm:h-11 sm:w-11",
                      listening
                        ? "animate-pulse bg-rose-100 text-rose-600 ring-2 ring-rose-300"
                        : "bg-brand-50 text-brand-700 hover:bg-brand-100",
                    )}
                  >
                    <IconMic className="h-5 w-5" />
                  </button>
                </form>
              ) : (
                <div className="flex h-[52px] items-center gap-1.5 px-1.5">
                  <IconSearch className="h-5 w-5 shrink-0 text-brand-700" />
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
                    placeholder="Ajouter un médicament…"
                    className="min-w-0 flex-1 bg-transparent px-1.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none sm:text-base [&::-webkit-search-cancel-button]:hidden"
                  />
                  {listQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setListQuery("");
                        listInputRef.current?.focus();
                      }}
                      aria-label="Effacer la saisie d'ordonnance"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <IconClose className="h-4 w-4" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("list");
                      setCameraTrigger((value) => value + 1);
                    }}
                    aria-label="Prendre en photo une ordonnance"
                    title="Scanner une ordonnance en photo"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition hover:bg-brand-100 active:scale-95 sm:h-11 sm:w-11"
                  >
                    <IconCamera className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleVoiceSearch}
                    aria-label="Rechercher à la voix"
                    aria-pressed={listening}
                    title={
                      listening
                        ? "Écoute en cours… touchez pour arrêter"
                        : "Rechercher à la voix"
                    }
                    className={cn(
                      "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition active:scale-95 sm:h-11 sm:w-11",
                      listening
                        ? "animate-pulse bg-rose-100 text-rose-600 ring-2 ring-rose-300"
                        : "bg-brand-50 text-brand-700 hover:bg-brand-100",
                    )}
                  >
                    <IconMic className="h-5 w-5" />
                  </button>
                </div>
              )}

              <div className="mt-1 flex items-center justify-between gap-2 border-t border-slate-100 px-1.5 pt-1.5">
                <label className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <IconMapPin className="h-4 w-4 shrink-0 text-brand-700" />
                  <select
                    aria-label="Commune"
                    value={quartier}
                    onChange={(event) => setQuartier(event.target.value)}
                    className="max-w-[180px] truncate bg-transparent py-1.5 text-[13px] font-semibold leading-snug text-slate-800 focus:outline-none"
                  >
                    {quartiers.map((item) => (
                      <option key={item} value={item}>
                        {item === "Tous" ? "Tout Abidjan" : item}
                      </option>
                    ))}
                  </select>
                </label>

                {mode === "list" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCameraTrigger(0);
                      setMode("single");
                      requestAnimationFrame(() => inputRef.current?.focus());
                    }}
                    className="shrink-0 py-1 text-xs font-bold text-brand-700 transition hover:text-brand-800"
                  >
                    ← Recherche simple
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-white/95">
                Accès libre · Sans inscription
              </span>
              <IconLogo className="h-6 w-6 text-white/95" />
            </div>
          </section>

          {/* 3. White Rounded Sheet: Zero-Duplicate 2×4 Circular Pastel Icon Grid */}
          <section
            aria-label="Raccourcis rapides"
            className="-mt-4 rounded-t-[28px] bg-white px-4 pb-5 pt-8"
          >
            <div className="grid grid-cols-4 gap-x-2 gap-y-4">
              <button
                type="button"
                onClick={() => setOnlyDuty((value) => !value)}
                aria-pressed={onlyDuty}
                className="group flex min-w-0 flex-col items-center gap-1.5 text-center"
              >
                <span
                  className={cn(
                    "relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition group-active:scale-95",
                    onlyDuty && "ring-2 ring-brand-700 ring-offset-2",
                  )}
                >
                  <IconClock className="h-6 w-6" />
                  {dutyCount > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-700 px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-white">
                      {dutyCount}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs font-bold leading-tight text-slate-800">
                  De garde
                </span>
              </button>

              <button
                type="button"
                disabled={locationStatus === "locating"}
                onClick={() => {
                  if (userLocation) {
                    clearLocation();
                  } else {
                    requestLocation();
                  }
                }}
                aria-pressed={Boolean(userLocation)}
                className="group flex min-w-0 flex-col items-center gap-1.5 text-center disabled:opacity-60"
              >
                <span
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-sky-700 transition group-active:scale-95",
                    userLocation && "ring-2 ring-brand-700 ring-offset-2",
                    locationStatus === "locating" && "animate-pulse",
                  )}
                >
                  <IconCrosshair className="h-6 w-6" />
                </span>
                <span className="text-xs font-bold leading-tight text-slate-800">
                  {locationStatus === "locating" ? "GPS…" : "Autour de moi"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setOnlyOpen((value) => !value)}
                aria-pressed={onlyOpen}
                className="group flex min-w-0 flex-col items-center gap-1.5 text-center"
              >
                <span
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 transition group-active:scale-95",
                    onlyOpen && "ring-2 ring-brand-700 ring-offset-2",
                  )}
                >
                  <IconPharmacy className="h-6 w-6" />
                </span>
                <span className="text-xs font-bold leading-tight text-slate-800">
                  Ouvertes
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (mode === "single") {
                    setCameraTrigger(0);
                    setMode("list");
                    requestAnimationFrame(() => listInputRef.current?.focus());
                  } else {
                    setCameraTrigger(0);
                    setMode("single");
                  }
                }}
                aria-pressed={mode === "list"}
                className="group flex min-w-0 flex-col items-center gap-1.5 text-center"
              >
                <span
                  className={cn(
                    "relative flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-700 transition group-active:scale-95",
                    mode === "list" && "ring-2 ring-brand-700 ring-offset-2",
                  )}
                >
                  <IconList className="h-6 w-6" />
                  {selectedMedicineIds.length > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-violet-700 px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-white">
                      {selectedMedicineIds.length}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs font-bold leading-tight text-slate-800">
                  Ordonnance
                </span>
              </button>

              <button
                type="button"
                onClick={handleToggleMapAction}
                aria-pressed={display === "map"}
                className="group flex min-w-0 flex-col items-center gap-1.5 text-center"
              >
                <span
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-700 transition group-active:scale-95",
                    display === "map" && "ring-2 ring-brand-700 ring-offset-2",
                  )}
                >
                  <IconMap className="h-6 w-6" />
                </span>
                <span className="text-xs font-bold leading-tight text-slate-800">
                  Carte
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (favoritePharmacyIds.length === 0) {
                    notify(
                      "Touchez l'étoile d'une pharmacie pour l'ajouter à vos favoris.",
                    );
                    return;
                  }
                  setOnlyFavorites((value) => !value);
                }}
                aria-pressed={onlyFavorites}
                className="group flex min-w-0 flex-col items-center gap-1.5 text-center"
              >
                <span
                  className={cn(
                    "relative flex h-14 w-14 items-center justify-center rounded-full bg-pink-100 text-pink-600 transition group-active:scale-95",
                    onlyFavorites && "ring-2 ring-brand-700 ring-offset-2",
                  )}
                >
                  <IconStar filled={onlyFavorites} className="h-6 w-6" />
                  {favoritePharmacyIds.length > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-pink-600 px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-white">
                      {favoritePharmacyIds.length}
                    </span>
                  ) : null}
                </span>
                <span className="text-xs font-bold leading-tight text-slate-800">
                  Favoris
                </span>
              </button>

              <a
                href="tel:185"
                className="group flex min-w-0 flex-col items-center gap-1.5 text-center"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-700 transition group-active:scale-95">
                  <IconPhone className="h-6 w-6" />
                </span>
                <span className="text-xs font-bold leading-tight text-slate-800">
                  SAMU 185
                </span>
              </a>

              <button
                type="button"
                onClick={() => setShowInstallPanel((prev) => !prev)}
                aria-expanded={showInstallPanel}
                className="group flex min-w-0 flex-col items-center gap-1.5 text-center"
              >
                <span
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 transition group-active:scale-95",
                    showInstallPanel && "ring-2 ring-brand-700 ring-offset-2",
                  )}
                >
                  <IconSmartphone className="h-6 w-6" />
                </span>
                <span className="text-xs font-bold leading-tight text-slate-800">
                  Installer
                </span>
              </button>
            </div>

            {showInstallPanel ? (
              <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Installer Kéné sur votre téléphone
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Accès rapide même avec une faible connexion.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowInstallPanel(false)}
                    aria-label="Fermer le panneau d'installation"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-white hover:text-slate-800"
                  >
                    <IconClose className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  <a
                    href="/kene-android.apk"
                    download
                    className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98]"
                  >
                    <IconSmartphone className="h-5 w-5 shrink-0" />
                    <span>Télécharger pour Android (.apk)</span>
                  </a>

                  {canInstallPwa && onInstallPwa ? (
                    <button
                      type="button"
                      onClick={() => {
                        onInstallPwa();
                        setShowInstallPanel(false);
                      }}
                      className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50 active:scale-[0.98]"
                    >
                      <IconDownload className="h-4 w-4 shrink-0" />
                      <span>Ajouter à l&apos;écran d&apos;accueil</span>
                    </button>
                  ) : (
                    <p className="text-center text-[11px] text-slate-500">
                      Sur iPhone (Safari) : bouton Partager → Sur l&apos;écran d&apos;accueil.
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {/* Single-row horizontal everyday health chips or prescription selection */}
            {mode === "single" ? (
              !hasSingleQuery ? (
                <div className="mt-5">
                  <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
                    {HEALTH_CHIPS.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => {
                          setQuery(chip.search);
                          addRecentSearch(chip.search);
                        }}
                        className="inline-flex h-[38px] shrink-0 items-center rounded-full bg-slate-100 px-3.5 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-[0.98]"
                      >
                        {chip.label}
                      </button>
                    ))}
                    {recentSearches.length > 0 ? (
                      <button
                        type="button"
                        onClick={clearRecentSearches}
                        className="inline-flex h-[38px] shrink-0 items-center px-2.5 text-xs font-medium text-slate-400 hover:text-slate-700"
                      >
                        Effacer hist.
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : suggestions.length > 0 ? (
                <div className="mt-5">
                  <div
                    onMouseDown={() => {
                      suppressBlurRef.current = true;
                    }}
                    className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1"
                  >
                    {suggestions.map((medicine) => (
                      <button
                        key={medicine.id}
                        type="button"
                        onClick={() => {
                          setQuery(medicine.name);
                          addRecentSearch(medicine.name);
                        }}
                        className="inline-flex h-[38px] shrink-0 items-center rounded-full border border-brand-200 bg-brand-50 px-3.5 text-[13px] font-semibold text-brand-800 transition hover:bg-brand-100"
                      >
                        {medicine.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null
            ) : (
              <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                <PrescriptionPhotoPanel
                  medicinesState={state}
                  selectedMedicineIds={selectedMedicineIds}
                  photo={prescriptionPhoto}
                  autoOpenCameraTrigger={cameraTrigger}
                  onPhotoChange={setPrescriptionPhoto}
                  onAddMedicines={addMedicinesBatch}
                  onNotify={notify}
                />
                {selectedMedicines.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedMedicines.map((medicine) => (
                      <button
                        key={medicine.id}
                        type="button"
                        onClick={() => removeMedicineFromList(medicine.id)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-700 px-3 text-xs font-semibold text-white transition hover:bg-brand-800"
                      >
                        <span>{medicine.name}</span>
                        <IconClose className="h-3.5 w-3.5" />
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={copySelectedList}
                      className="inline-flex h-9 items-center rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Copier
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMedicineIds([])}
                      className="inline-flex h-9 items-center rounded-full px-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      Vider
                    </button>
                  </div>
                ) : null}

                <p className="text-xs font-medium text-slate-600">
                  Touchez les médicaments de votre ordonnance (jusqu&apos;à 8) :
                </p>

                <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
                  {listSuggestions.map((medicine) => {
                    const added = selectedMedicineIds.includes(medicine.id);
                    return (
                      <button
                        key={medicine.id}
                        type="button"
                        disabled={added}
                        onClick={() => {
                          addMedicineToList(medicine.id);
                          setListQuery("");
                        }}
                        className={cn(
                          "inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition",
                          added
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                        )}
                      >
                        {added ? (
                          <IconCheck className="h-3.5 w-3.5" />
                        ) : (
                          <IconPlus className="h-3.5 w-3.5" />
                        )}
                        <span>{medicine.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* 4. Wave Gray Section Divider */}
          <div aria-hidden="true" className="h-2.5 bg-[#F2F4F7]" />

          {/* 5. Clean Divided Pharmacy / Medicine List */}
          <section aria-label="Résultats" className="bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900">{feedTitle}</h2>
                {onlyDuty ? (
                  <p className="mt-0.5 text-xs font-medium text-brand-700">
                    Permanence 24 h/24 · Appelez avant de vous déplacer la nuit.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(mode === "single" && hasSingleQuery) ||
                (mode === "list" && selectedMedicineIds.length > 0) ? (
                  <div
                    role="group"
                    aria-label="Trier les pharmacies"
                    className="inline-flex items-center rounded-full bg-slate-100 p-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => setSortBy("distance")}
                      aria-pressed={sortBy === "distance"}
                      className={cn(
                        "inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold transition",
                        sortBy === "distance"
                          ? "bg-white text-brand-800 shadow-sm"
                          : "text-slate-600 hover:text-slate-900",
                      )}
                    >
                      Plus proche
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortBy("price")}
                      aria-pressed={sortBy === "price"}
                      className={cn(
                        "inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold transition",
                        sortBy === "price"
                          ? "bg-white text-brand-800 shadow-sm"
                          : "text-slate-600 hover:text-slate-900",
                      )}
                    >
                      Moins cher
                    </button>
                  </div>
                ) : null}
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="inline-flex h-8 items-center rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    Tout voir
                  </button>
                ) : null}
                {display === "map" && canShowMobileMap ? (
                  <button
                    type="button"
                    onClick={() => setDisplay("list")}
                    className="inline-flex h-8 items-center rounded-full bg-brand-700 px-3 text-xs font-semibold text-white lg:hidden"
                  >
                    ← Liste
                  </button>
                ) : null}
              </div>
            </div>

            {display === "map" && canShowMobileMap ? (
              <div className="p-3 lg:hidden">
                <div className="h-[440px] overflow-hidden rounded-2xl border border-slate-200">
                  <PharmacyMap
                    fillHeight
                    markers={activeMarkers}
                    userLocation={userLocation}
                    activePharmacyId={activePharmacyId}
                    onSelectPharmacy={handleSelectPharmacyFromMap}
                  />
                </div>
              </div>
            ) : null}

            <div className={cn(display === "map" && canShowMobileMap && "hidden lg:block")}>
              {mode === "list" ? (
                selectedMedicineIds.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <IconPill className="mx-auto h-7 w-7 text-slate-400" />
                    <p className="mt-2 text-sm font-bold text-slate-900">
                      Ajoutez les médicaments de votre ordonnance
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Nous classons en priorité les pharmacies qui disposent de toute
                      la liste.
                    </p>
                  </div>
                ) : listResults.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sm font-bold text-slate-900">
                      Aucune pharmacie pour ces filtres
                    </p>
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="mt-3 inline-flex h-9 items-center rounded-full bg-slate-100 px-4 text-xs font-semibold text-slate-800 hover:bg-slate-200"
                      >
                        Tout voir
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
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
                        .map((medicine) => `• ${medicine.name}`)
                        .join("\n");

                      return (
                        <PharmacyRowShell
                          key={pharmacy.id}
                          pharmacyId={pharmacy.id}
                          isActive={isActive}
                          onHover={setHoveredPharmacyId}
                          onSelect={setSelectedPharmacyId}
                        >
                          <PharmacyRowHeader
                            pharmacy={pharmacy}
                            open={open}
                            distanceKm={distanceKm}
                            isFav={isFav}
                            onToggleFavorite={toggleFavoritePharmacy}
                            rightTop={
                              availableCount > 0 ? fcfa(result.estimatedTotal) : "—"
                            }
                            rightBottom={
                              result.complete
                                ? `Tout dispo (${availableCount}/${totalRequested})`
                                : `${availableCount}/${totalRequested} dispo`
                            }
                            rightTone={
                              result.complete
                                ? "green"
                                : availableCount > 0
                                  ? "amber"
                                  : "red"
                            }
                          />

                          <ul className="mt-2.5 space-y-1.5 rounded-xl bg-slate-50/90 p-3 text-[13px]">
                            {items.map((entry) => (
                              <li
                                key={entry.medicine.id}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="truncate font-medium text-slate-800">
                                  {entry.medicine.name}
                                </span>
                                <span className="shrink-0 font-bold tabular-nums text-slate-900">
                                  {entry.stock && entry.level !== "out"
                                    ? fcfa(entry.stock.price)
                                    : "Rupture"}
                                </span>
                              </li>
                            ))}
                          </ul>

                          <PharmacyRowActions
                            pharmacy={pharmacy}
                            userLocation={userLocation}
                            primaryDirections={availableCount > 0}
                            waText={`Bonjour, avez-vous ces médicaments disponibles actuellement (vu sur Kéné) ?\n${listSummary}`}
                            shareDetail={
                              availableCount > 0
                                ? `Ordonnance ${availableCount}/${totalRequested} dispo (${fcfa(result.estimatedTotal)})`
                                : undefined
                            }
                            prescriptionFile={prescriptionPhoto?.file ?? null}
                            onNotify={notify}
                            timestampText={
                              result.latestUpdate
                                ? `${distanceLabel(distanceKm)} · ${timeAgo(result.latestUpdate)}`
                                : distanceLabel(distanceKm)
                            }
                          />
                        </PharmacyRowShell>
                      );
                    })}
                  </div>
                )
              ) : hasSingleQuery ? (
                rows.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <IconPill className="mx-auto h-7 w-7 text-slate-400" />
                    <p className="mt-2 text-sm font-bold text-slate-900">
                      Aucune pharmacie ne correspond à « {query.trim()} »
                    </p>
                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="mt-3 inline-flex h-9 items-center rounded-full bg-slate-100 px-4 text-xs font-semibold text-slate-800 hover:bg-slate-200"
                      >
                        Tout voir
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {rows.map(({ pharmacy, medicine, stock, level, open, distanceKm }) => {
                      const isFav = favoritePharmacyIds.includes(pharmacy.id);
                      const isActive = activePharmacyId === pharmacy.id;
                      const stockLabel =
                        level === "available"
                          ? "En stock"
                          : level === "low"
                            ? `Plus que ${stock.quantity}`
                            : "Rupture";
                      return (
                        <PharmacyRowShell
                          key={`${pharmacy.id}-${medicine.id}`}
                          pharmacyId={pharmacy.id}
                          isActive={isActive}
                          dimmed={level === "out"}
                          onHover={setHoveredPharmacyId}
                          onSelect={setSelectedPharmacyId}
                        >
                          <PharmacyRowHeader
                            pharmacy={pharmacy}
                            open={open}
                            distanceKm={distanceKm}
                            isFav={isFav}
                            onToggleFavorite={toggleFavoritePharmacy}
                            rightTop={fcfa(stock.price)}
                            rightBottom={stockLabel}
                            rightTone={
                              level === "available"
                                ? "green"
                                : level === "low"
                                  ? "amber"
                                  : "red"
                            }
                          />

                          <p className="mt-2 text-sm font-semibold text-slate-800">
                            {medicine.name}{" "}
                            <span className="font-normal text-slate-500">
                              · {medicine.form}
                            </span>
                          </p>

                          {pharmacy.onDuty && pharmacy.dutyNote ? (
                            <p className="mt-1.5 text-xs font-medium text-brand-700">
                              {pharmacy.dutyNote}
                            </p>
                          ) : null}

                          <PharmacyRowActions
                            pharmacy={pharmacy}
                            userLocation={userLocation}
                            primaryDirections={level !== "out"}
                            waText={`Bonjour, avez-vous actuellement ${medicine.name} (${medicine.form}) en stock ? (vu sur Kéné)`}
                            shareDetail={`${medicine.name} — ${fcfa(stock.price)}`}
                            onNotify={notify}
                            timestampText={`Déclaré ${timeAgo(stock.updatedAt)}`}
                          />
                        </PharmacyRowShell>
                      );
                    })}
                  </div>
                )
              ) : nearbyPharmacies.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm font-bold text-slate-900">
                    Aucune pharmacie pour ces filtres
                  </p>
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="mt-3 inline-flex h-9 items-center rounded-full bg-slate-100 px-4 text-xs font-semibold text-slate-800 hover:bg-slate-200"
                    >
                      Tout voir
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {nearbyPharmacies.map(
                    ({ pharmacy, open, distanceKm, inStockItems, latestUpdate }) => {
                      const isFav = favoritePharmacyIds.includes(pharmacy.id);
                      const isExpanded = expandedPharmacyIds.includes(pharmacy.id);
                      const isActive = activePharmacyId === pharmacy.id;

                      return (
                        <PharmacyRowShell
                          key={pharmacy.id}
                          pharmacyId={pharmacy.id}
                          isActive={isActive}
                          onHover={setHoveredPharmacyId}
                          onSelect={setSelectedPharmacyId}
                        >
                          <PharmacyRowHeader
                            pharmacy={pharmacy}
                            open={open}
                            distanceKm={distanceKm}
                            isFav={isFav}
                            onToggleFavorite={toggleFavoritePharmacy}
                            rightTop={`${inStockItems.length} en stock`}
                            rightTone="brand"
                          />

                          {pharmacy.onDuty && pharmacy.dutyNote ? (
                            <p className="mt-1.5 text-xs font-medium text-brand-700">
                              {pharmacy.dutyNote}
                            </p>
                          ) : null}

                          {inStockItems.length > 0 ? (
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleExpandedPharmacy(pharmacy.id);
                                }}
                                aria-expanded={isExpanded}
                                className="inline-flex min-h-[36px] items-center gap-1 py-1 text-[13px] font-semibold text-brand-700 hover:text-brand-800"
                              >
                                <span>
                                  {isExpanded
                                    ? "Masquer le stock"
                                    : `Voir les médicaments (${inStockItems.length})`}
                                </span>
                                <IconChevronRight
                                  className={cn(
                                    "h-3.5 w-3.5 transition-transform",
                                    isExpanded ? "-rotate-90" : "rotate-90",
                                  )}
                                />
                              </button>

                              {isExpanded ? (
                                <ul className="scroll-thin mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/70">
                                  {inStockItems.map(({ medicine, stock }) => (
                                    <li key={medicine.id}>
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setQuery(medicine.name);
                                          addRecentSearch(medicine.name);
                                        }}
                                        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] transition hover:bg-white"
                                      >
                                        <span className="truncate font-medium text-slate-800">
                                          {medicine.name}
                                        </span>
                                        <span className="shrink-0 font-bold tabular-nums text-brand-700">
                                          {fcfa(stock.price)}
                                        </span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ) : null}

                          <PharmacyRowActions
                            pharmacy={pharmacy}
                            userLocation={userLocation}
                            primaryDirections={open}
                            waText="Bonjour, je vérifie la disponibilité de médicaments dans votre officine. (via Kéné)"
                            onNotify={notify}
                            timestampText={
                              latestUpdate
                                ? `Mis à jour ${timeAgo(latestUpdate)}`
                                : "Horaires déclarés"
                            }
                          />
                        </PharmacyRowShell>
                      );
                    },
                  )}
                </div>
              )}
            </div>

            <footer className="border-t border-slate-100 px-4 py-5 text-center text-xs text-slate-400">
              Outil d&apos;information uniquement — aucune vente ni réservation
              médicale.
            </footer>
          </section>
        </div>

        {/* Desktop always-live Abidjan Google Maps */}
        <aside
          ref={mapSectionRef}
          aria-label="Carte interactive des pharmacies"
          className="hidden lg:sticky lg:top-6 lg:block lg:h-[calc(100vh-48px)] lg:min-h-[560px]"
        >
          <div className="h-full rounded-[28px] border border-slate-200/80 bg-white p-1.5 shadow-soft">
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
