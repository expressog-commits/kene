import { effectiveDistanceKm } from "./geo";
import type {
  AppState,
  EmergencyUnit,
  Hospital,
  Medicine,
  Pharmacy,
  StockItem,
  StockLevel,
  UserLocation,
} from "./types";

export const DAY_MS = 86_400_000;

export function toDate(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const todayISO = () => toISO(new Date());

export function isOpen(pharmacy: Pharmacy, at: Date = new Date()): boolean {
  if (pharmacy.onDuty) return true;
  const hour = at.getHours() + at.getMinutes() / 60;
  if (pharmacy.openTo >= 24) return hour >= pharmacy.openFrom;
  return hour >= pharmacy.openFrom && hour < pharmacy.openTo;
}

export function stockLevel(item: StockItem): StockLevel {
  if (item.quantity <= 0) return "out";
  if (item.quantity <= 5) return "low";
  return "available";
}

export const LEVEL_META: Record<
  StockLevel,
  { label: string; tone: "green" | "amber" | "red" }
> = {
  available: { label: "En stock", tone: "green" },
  low: { label: "Stock faible", tone: "amber" },
  out: { label: "Rupture", tone: "red" },
};

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function queryTerms(query: string): string[] {
  return normalize(query.trim()).split(/\s+/).filter(Boolean);
}

function matchesMedicine(medicine: Medicine, terms: string[]): boolean {
  const haystack = normalize(
    `${medicine.name} ${medicine.dci} ${medicine.category} ${medicine.form}`,
  );
  return terms.every((term) => haystack.includes(term));
}

function parseIsoMs(iso?: string | null): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

function latestIso(dates: Array<string | undefined>): string | null {
  let bestIso: string | null = null;
  let bestMs = -1;
  for (const date of dates) {
    if (!date) continue;
    const ms = Date.parse(date);
    if (Number.isFinite(ms) && ms > bestMs) {
      bestMs = ms;
      bestIso = date;
    }
  }
  return bestIso;
}

export function publicPharmacies(state: AppState): Pharmacy[] {
  return state.pharmacies.filter(
    (pharmacy) => pharmacy.verificationStatus === "verified",
  );
}

export function findStock(
  state: AppState,
  pharmacyId: string,
  medicineId: string,
): StockItem | undefined {
  return state.stock.find(
    (item) => item.pharmacyId === pharmacyId && item.medicineId === medicineId,
  );
}

export interface SearchRow {
  pharmacy: Pharmacy;
  medicine: Medicine;
  stock: StockItem;
  level: StockLevel;
  open: boolean;
  distanceKm: number;
}

export interface SearchFilters {
  quartier: string;
  onlyOpen: boolean;
  onlyDuty: boolean;
  onlyInStock: boolean;
  sort: "distance" | "price" | "freshness";
}

function passesPharmacyFilters(
  pharmacy: Pharmacy,
  filters: Pick<SearchFilters, "quartier" | "onlyOpen" | "onlyDuty">,
): { matches: boolean; open: boolean } {
  if (pharmacy.verificationStatus !== "verified") {
    return { matches: false, open: false };
  }
  if (filters.quartier !== "Tous" && pharmacy.quartier !== filters.quartier) {
    return { matches: false, open: false };
  }
  const open = isOpen(pharmacy);
  if (filters.onlyOpen && !open) return { matches: false, open };
  if (filters.onlyDuty && !pharmacy.onDuty) return { matches: false, open };
  return { matches: true, open };
}

export function searchMedicine(
  state: AppState,
  query: string,
  filters: SearchFilters,
  userLocation?: UserLocation | null,
): SearchRow[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];

  const matches = state.medicines.filter((medicine) =>
    matchesMedicine(medicine, terms),
  );
  const ids = new Set(matches.map((medicine) => medicine.id));

  const rows: SearchRow[] = [];
  for (const item of state.stock) {
    if (!ids.has(item.medicineId)) continue;
    const level = stockLevel(item);
    if (filters.onlyInStock && level === "out") continue;

    const pharmacy = state.pharmacies.find((p) => p.id === item.pharmacyId);
    const medicine = state.medicines.find((m) => m.id === item.medicineId);
    if (!pharmacy || !medicine) continue;

    const check = passesPharmacyFilters(pharmacy, filters);
    if (!check.matches) continue;

    rows.push({
      pharmacy,
      medicine,
      stock: item,
      level,
      open: check.open,
      distanceKm: effectiveDistanceKm(pharmacy, userLocation),
    });
  }

  const levelWeight: Record<StockLevel, number> = { available: 0, low: 1, out: 2 };
  return rows.sort((a, b) => {
    const levelDiff = levelWeight[a.level] - levelWeight[b.level];
    if (levelDiff !== 0) return levelDiff;
    if (filters.sort === "price") {
      const priceDiff = a.stock.price - b.stock.price;
      if (priceDiff !== 0) return priceDiff;
    } else if (filters.sort === "freshness") {
      const timeDiff =
        parseIsoMs(b.stock.updatedAt) - parseIsoMs(a.stock.updatedAt);
      if (timeDiff !== 0) return timeDiff;
    }
    return a.distanceKm - b.distanceKm;
  });
}

export function suggestMedicines(
  state: AppState,
  query: string,
  limit = 6,
): Medicine[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const verifiedIds = new Set(publicPharmacies(state).map((p) => p.id));

  return state.medicines
    .filter((medicine) => matchesMedicine(medicine, terms))
    .map((medicine) => ({
      medicine,
      count: state.stock.filter(
        (item) =>
          item.medicineId === medicine.id &&
          item.quantity > 0 &&
          verifiedIds.has(item.pharmacyId),
      ).length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((entry) => entry.medicine);
}

export interface PharmacyListItem {
  medicine: Medicine;
  stock: StockItem | null;
  level: StockLevel;
}

export interface PharmacyListResult {
  pharmacy: Pharmacy;
  open: boolean;
  distanceKm: number;
  items: PharmacyListItem[];
  availableCount: number;
  totalRequested: number;
  complete: boolean;
  estimatedTotal: number;
  latestUpdate: string | null;
}

export function searchMedicineList(
  state: AppState,
  medicineIds: string[],
  filters: SearchFilters,
  userLocation?: UserLocation | null,
): PharmacyListResult[] {
  const uniqueIds: string[] = [];
  const seen = new Set<string>();
  for (const id of medicineIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    uniqueIds.push(id);
  }

  const requestedMedicines = uniqueIds
    .map((id) => state.medicines.find((medicine) => medicine.id === id))
    .filter((medicine): medicine is Medicine => Boolean(medicine));
  if (requestedMedicines.length === 0) return [];

  const results: PharmacyListResult[] = [];
  for (const pharmacy of state.pharmacies) {
    const check = passesPharmacyFilters(pharmacy, filters);
    if (!check.matches) continue;

    const items: PharmacyListItem[] = requestedMedicines.map((medicine) => {
      const stock = findStock(state, pharmacy.id, medicine.id) ?? null;
      const level: StockLevel = stock ? stockLevel(stock) : "out";
      return { medicine, stock, level };
    });

    const availableItems = items.filter(
      (item): item is PharmacyListItem & { stock: StockItem } =>
        item.stock !== null && item.level !== "out",
    );
    const availableCount = availableItems.length;
    if (filters.onlyInStock && availableCount === 0) continue;

    const totalRequested = requestedMedicines.length;
    const estimatedTotal = availableItems.reduce(
      (sum, item) => sum + item.stock.price,
      0,
    );
    const latestUpdate = latestIso(
      items.map((item) => item.stock?.updatedAt),
    );

    results.push({
      pharmacy,
      open: check.open,
      distanceKm: effectiveDistanceKm(pharmacy, userLocation),
      items,
      availableCount,
      totalRequested,
      complete: availableCount === totalRequested,
      estimatedTotal,
      latestUpdate,
    });
  }

  return results.sort((a, b) => {
    const completeDiff = Number(b.complete) - Number(a.complete);
    if (completeDiff !== 0) return completeDiff;
    if (b.availableCount !== a.availableCount) {
      return b.availableCount - a.availableCount;
    }
    if (filters.sort === "price") {
      const priceDiff = a.estimatedTotal - b.estimatedTotal;
      if (priceDiff !== 0) return priceDiff;
    } else if (filters.sort === "freshness") {
      const timeDiff =
        parseIsoMs(b.latestUpdate) - parseIsoMs(a.latestUpdate);
      if (timeDiff !== 0) return timeDiff;
    }
    return a.distanceKm - b.distanceKm;
  });
}

export function dutyPharmacies(
  state: AppState,
  filters?: {
    quartier?: string;
    query?: string;
    userLocation?: UserLocation | null;
  },
): Array<{
  pharmacy: Pharmacy;
  distanceKm: number;
  inStockCount: number;
  matchingMedicines: Array<{ medicine: Medicine; stock: StockItem }>;
}> {
  const terms = queryTerms(filters?.query ?? "");
  const rows: Array<{
    pharmacy: Pharmacy;
    distanceKm: number;
    inStockCount: number;
    matchingMedicines: Array<{ medicine: Medicine; stock: StockItem }>;
  }> = [];

  for (const pharmacy of publicPharmacies(state)) {
    if (!pharmacy.onDuty) continue;
    if (
      filters?.quartier &&
      filters.quartier !== "Tous" &&
      pharmacy.quartier !== filters.quartier
    ) {
      continue;
    }

    const inStock = state.stock.filter(
      (item) => item.pharmacyId === pharmacy.id && item.quantity > 0,
    );
    const matchingMedicines: Array<{ medicine: Medicine; stock: StockItem }> =
      [];

    if (terms.length > 0) {
      for (const item of inStock) {
        const medicine = state.medicines.find((m) => m.id === item.medicineId);
        if (medicine && matchesMedicine(medicine, terms)) {
          matchingMedicines.push({ medicine, stock: item });
        }
      }
      const pharmacyText = normalize(
        `${pharmacy.name} ${pharmacy.quartier} ${pharmacy.address} ${pharmacy.dutyNote}`,
      );
      const pharmacyMatches = terms.every((term) => pharmacyText.includes(term));
      if (matchingMedicines.length === 0 && !pharmacyMatches) {
        continue;
      }
    }

    rows.push({
      pharmacy,
      distanceKm: effectiveDistanceKm(pharmacy, filters?.userLocation),
      inStockCount: inStock.length,
      matchingMedicines,
    });
  }

  return rows.sort((a, b) => a.distanceKm - b.distanceKm);
}

export function priceRange(
  state: AppState,
  medicineId: string,
): { min: number; max: number; count: number } {
  const verifiedIds = new Set(publicPharmacies(state).map((p) => p.id));
  const prices = state.stock
    .filter(
      (item) =>
        item.medicineId === medicineId &&
        item.quantity > 0 &&
        verifiedIds.has(item.pharmacyId),
    )
    .map((item) => item.price);
  if (!prices.length) return { min: 0, max: 0, count: 0 };
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    count: prices.length,
  };
}

export const CATEGORIES = [
  "Paludisme",
  "Antibiotiques",
  "Douleur & fièvre",
  "Digestion",
  "Tension & diabète",
  "Respiratoire",
  "Grossesse & fer",
  "Hygiène",
] as const;

export function popularMedicines(state: AppState, limit = 8): Medicine[] {
  const verifiedIds = new Set(publicPharmacies(state).map((p) => p.id));
  return [...state.medicines]
    .map((medicine) => ({
      medicine,
      count: state.stock.filter(
        (item) =>
          item.medicineId === medicine.id &&
          item.quantity > 0 &&
          verifiedIds.has(item.pharmacyId),
      ).length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((entry) => entry.medicine);
}

export function pharmacyName(state: AppState, id: string): string {
  return state.pharmacies.find((pharmacy) => pharmacy.id === id)?.name ?? "Pharmacie";
}

export function medicineName(state: AppState, id: string): string {
  return state.medicines.find((medicine) => medicine.id === id)?.name ?? "Médicament";
}

export interface PharmacyOverview {
  inStock: StockItem[];
  lowStock: StockItem[];
  ruptures: StockItem[];
  items: number;
  lastUpdatedAt: string | null;
}

export function pharmacyOverview(
  state: AppState,
  pharmacyId: string,
): PharmacyOverview {
  const items = state.stock.filter((item) => item.pharmacyId === pharmacyId);
  const pharmacy = state.pharmacies.find((item) => item.id === pharmacyId);
  return {
    inStock: items.filter((item) => item.quantity > 0),
    lowStock: items.filter((item) => item.quantity > 0 && item.quantity <= 5),
    ruptures: items.filter((item) => item.quantity <= 0),
    items: items.length,
    lastUpdatedAt: latestIso([
      ...items.map((item) => item.updatedAt),
      pharmacy?.updatedAt,
    ]),
  };
}

export function openingLabel(pharmacy: Pharmacy): string {
  if (pharmacy.onDuty) return "De garde · 24 h/24";
  return `Ouvert ${pharmacy.openFrom} h – ${pharmacy.openTo} h`;
}

export type BedLevel = "open" | "tension" | "full";

export const BED_SERVICE_PRESETS = [
  "Urgences adultes",
  "Pédiatrie",
  "Maternité",
  "Réanimation",
  "Traumatologie",
  "Réanimation néonatale",
  "Consultations d'urgence",
] as const;

export const EMERGENCY_SERVICES = [
  "Toutes les urgences",
  ...BED_SERVICE_PRESETS,
] as const;

export function unitAvailable(unit: EmergencyUnit): number {
  return Math.max(0, unit.totalBeds - unit.occupiedBeds);
}

export function bedLevel(available: number, total: number): BedLevel {
  if (available <= 0) return "full";
  if (available <= 2 || available / Math.max(1, total) < 0.15) return "tension";
  return "open";
}

export const BED_META: Record<
  BedLevel,
  { label: string; tone: "green" | "amber" | "red" }
> = {
  open: { label: "Lits disponibles", tone: "green" },
  tension: { label: "Forte tension", tone: "amber" },
  full: { label: "Saturé", tone: "red" },
};

export interface HospitalRow {
  hospital: Hospital;
  units: EmergencyUnit[];
  available: number;
  total: number;
  wait: number | null;
  level: BedLevel;
}

export function filterHospitals(
  state: AppState,
  filters: { quartier: string; service: string; onlyAvailable: boolean },
): HospitalRow[] {
  const rows: HospitalRow[] = [];
  for (const hospital of state.hospitals) {
    if (filters.quartier !== "Tous" && hospital.quartier !== filters.quartier) {
      continue;
    }
    const units =
      filters.service === "Toutes les urgences"
        ? hospital.units
        : hospital.units.filter((unit) => unit.label === filters.service);
    if (units.length === 0) continue;

    const total = units.reduce((sum, unit) => sum + unit.totalBeds, 0);
    const available = units.reduce((sum, unit) => sum + unitAvailable(unit), 0);
    if (filters.onlyAvailable && available === 0) continue;

    const waits = units
      .filter((unit) => unitAvailable(unit) > 0)
      .map((unit) => unit.waitingMinutes)
      .filter((minutes) => minutes > 0);

    rows.push({
      hospital,
      units,
      total,
      available,
      wait: waits.length ? Math.min(...waits) : available > 0 ? 5 : null,
      level: bedLevel(available, total),
    });
  }

  return rows.sort((a, b) => {
    if (b.available !== a.available) return b.available - a.available;
    return a.hospital.distanceKm - b.hospital.distanceKm;
  });
}

export function serviceId(label: string, taken: string[]): string {
  const base =
    normalize(label)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "service";
  let id = base;
  let index = 2;
  while (taken.includes(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return id;
}

export interface HospitalStats {
  available: number;
  total: number;
  occupied: number;
  rate: number;
  full: EmergencyUnit[];
  tension: EmergencyUnit[];
  open: EmergencyUnit[];
  maxWait: number | null;
}

export function hospitalStats(hospital: Hospital): HospitalStats {
  const total = hospital.units.reduce((sum, unit) => sum + unit.totalBeds, 0);
  const available = hospital.units.reduce(
    (sum, unit) => sum + unitAvailable(unit),
    0,
  );
  const units = hospital.units;
  return {
    total,
    available,
    occupied: total - available,
    rate: total === 0 ? 0 : Math.round(((total - available) / total) * 100),
    full: units.filter((unit) => unitAvailable(unit) === 0),
    tension: units.filter(
      (unit) =>
        unitAvailable(unit) > 0 &&
        bedLevel(unitAvailable(unit), unit.totalBeds) === "tension",
    ),
    open: units.filter(
      (unit) =>
        unitAvailable(unit) > 0 &&
        bedLevel(unitAvailable(unit), unit.totalBeds) === "open",
    ),
    maxWait: units.length
      ? Math.max(...units.map((unit) => unit.waitingMinutes), 0)
      : null,
  };
}

export function emergencySummary(state: AppState): {
  available: number;
  total: number;
  centers: number;
} {
  let available = 0;
  let total = 0;
  let centers = 0;
  for (const hospital of state.hospitals) {
    const free = hospital.units.reduce(
      (sum, unit) => sum + unitAvailable(unit),
      0,
    );
    available += free;
    total += hospital.units.reduce((sum, unit) => sum + unit.totalBeds, 0);
    if (free > 0) centers += 1;
  }
  return { available, total, centers };
}

const OCR_STOPWORDS = new Set([
  "boite",
  "boites",
  "comprime",
  "comprimes",
  "cp",
  "gelule",
  "gelules",
  "gel",
  "flacon",
  "sachet",
  "sachets",
  "dosette",
  "dosettes",
  "inhalateur",
  "test",
  "unitaire",
  "mg",
  "ml",
  "ug",
  "matin",
  "midi",
  "soir",
  "nuit",
  "jour",
  "jours",
  "semaine",
  "pendant",
  "prendre",
  "prise",
  "prises",
  "avant",
  "apres",
  "repas",
  "ordonnance",
  "docteur",
  "clinique",
  "chu",
  "hopital",
  "patient",
  "abidjan",
  "adulte",
  "acide",
  "serum",
  "sels",
  "orale",
]);

const DISTINCTIVE_PHRASES = [
  "acide folique",
  "acide ascorbique",
  "serum physiologique",
  "sels de rehydratation",
] as const;

const PEDIATRIC_MARKERS_RE =
  /\b(sirop|pediatrique|enfant|nourrisson|buvable|100\s*ml)\b/;

function ocrNormalizeWord(word: string): string {
  const norm = normalize(word);
  const alphaMatches = norm.match(/[a-z]/g);
  const alphaCount = alphaMatches ? alphaMatches.length : 0;
  if (alphaCount >= 4 && !/^\d+$/.test(norm)) {
    return norm.replace(/0/g, "o").replace(/1/g, "l");
  }
  return norm;
}

function levenshteinAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;

  if (a.length === b.length) {
    let diffs = 0;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) {
        diffs += 1;
        if (diffs > 1) return false;
      }
    }
    return diffs <= 1;
  }

  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i += 1;
      j += 1;
    } else if (skipped) {
      return false;
    } else {
      skipped = true;
      j += 1;
    }
  }
  return true;
}

function extractMedicineSignature(medicine: Medicine): {
  keywords: string[];
  phrases: string[];
} {
  const collapsed = normalize(`${medicine.name} ${medicine.dci}`)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const tokens = collapsed ? collapsed.split(" ") : [];

  const keywordSet = new Set<string>();
  for (const token of tokens) {
    if (token === "sro" || token === "tdr") {
      keywordSet.add(token);
      continue;
    }
    if (
      token.length >= 4 &&
      !/^\d+$/.test(token) &&
      !OCR_STOPWORDS.has(token)
    ) {
      keywordSet.add(token);
    }
  }

  const phrases = DISTINCTIVE_PHRASES.filter((phrase) =>
    collapsed.includes(phrase),
  );

  return { keywords: [...keywordSet], phrases };
}

export function matchMedicinesFromText(
  state: AppState,
  rawText: string,
  limit = 8,
): Medicine[] {
  if (!rawText.trim() || limit <= 0) return [];

  const signatures = state.medicines.map((medicine) => ({
    medicine,
    ...extractMedicineSignature(medicine),
  }));

  const lines = rawText.split(/\r?\n|[;•]+/);
  const selected: Medicine[] = [];
  const seenIds = new Set<string>();

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const rawTokens = normalize(trimmed).match(/[a-z0-9]+/g) ?? [];
    if (rawTokens.length === 0) continue;

    const tokens = rawTokens.map(ocrNormalizeWord);
    const normalizedLine = tokens.join(" ");
    const hasPediatricMarker = PEDIATRIC_MARKERS_RE.test(normalizedLine);

    const lineMatches: Array<{ medicine: Medicine; score: number }> = [];

    for (const entry of signatures) {
      let score = 0;
      let hasFuzzyOrPhraseMatch = false;
      const matchedKeywords = new Set<string>();

      for (const phrase of entry.phrases) {
        if (normalizedLine.includes(phrase)) {
          score += 4;
          hasFuzzyOrPhraseMatch = true;
        }
      }

      for (const token of tokens) {
        if (entry.keywords.includes(token)) {
          score += 3;
          matchedKeywords.add(token);
        }
      }

      for (const token of tokens) {
        if (token.length < 6) continue;
        for (const keyword of entry.keywords) {
          if (keyword.length < 6 || matchedKeywords.has(keyword)) continue;
          if (levenshteinAtMostOne(token, keyword)) {
            score += 2;
            matchedKeywords.add(keyword);
            hasFuzzyOrPhraseMatch = true;
            break;
          }
        }
      }

      if (score > 0) {
        if (entry.medicine.id === "med_paracetamol_siro") {
          score += hasPediatricMarker ? 3 : -2;
        } else if (entry.medicine.id === "med_paracetamol") {
          score += hasPediatricMarker ? -2 : 1;
        }
      }

      const threshold = hasFuzzyOrPhraseMatch ? 2 : 3;
      if (score >= threshold) {
        lineMatches.push({ medicine: entry.medicine, score });
      }
    }

    const adultIdx = lineMatches.findIndex(
      (item) => item.medicine.id === "med_paracetamol",
    );
    const siroIdx = lineMatches.findIndex(
      (item) => item.medicine.id === "med_paracetamol_siro",
    );
    if (adultIdx !== -1 && siroIdx !== -1) {
      if (lineMatches[adultIdx].score >= lineMatches[siroIdx].score) {
        lineMatches.splice(siroIdx, 1);
      } else {
        lineMatches.splice(adultIdx, 1);
      }
    }

    lineMatches.sort((a, b) => b.score - a.score);

    for (const { medicine } of lineMatches) {
      if (seenIds.has(medicine.id)) continue;
      seenIds.add(medicine.id);
      selected.push(medicine);
      if (selected.length >= limit) {
        return selected;
      }
    }
  }

  return selected;
}
