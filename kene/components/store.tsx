"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AppState,
  BulkImportSummary,
  DemoAccount,
  EmergencyUnit,
  Hospital,
  Pharmacy,
  ProfessionalType,
  SessionInfo,
  UserLocation,
  VerificationStatus,
} from "@/lib/types";
import {
  getPwaSnapshot,
  subscribePwa,
  triggerPwaInstall,
} from "./PwaManager";

interface ActionResult {
  ok: boolean;
  error?: string;
}

interface BulkImportResult extends ActionResult {
  summary?: BulkImportSummary;
}

type LocationStatus =
  | "idle"
  | "locating"
  | "granted"
  | "denied"
  | "unsupported";

interface PatientPrefs {
  favoritePharmacyIds: string[];
  recentSearches: string[];
  preferredQuartier: string;
}

interface CachedStateRecord {
  state: AppState;
  cachedAt: string;
}

const PREFS_KEY = "kene_patient_prefs_v1";
const CACHE_KEY = "kene_cached_state_v1";
const LOCATION_KEY = "kene_user_location_v1";

const DEFAULT_PREFS: PatientPrefs = {
  favoritePharmacyIds: [],
  recentSearches: [],
  preferredQuartier: "Tous",
};

interface StoreValue {
  state: AppState;
  session: SessionInfo | null;
  claimedEstablishmentIds: string[];
  demoAccounts: DemoAccount[];
  recoveryCode: string | null;
  dismissRecoveryCode: () => void;
  saving: boolean;
  isOffline: boolean;
  cachedAt: string | null;
  toast: string | null;
  notify: (message: string) => void;
  refresh: () => Promise<void>;
  userLocation: UserLocation | null;
  locationStatus: LocationStatus;
  requestLocation: () => void;
  clearLocation: () => void;
  canInstallPwa: boolean;
  isPwaInstalled: boolean;
  installPwa: () => Promise<boolean>;
  favoritePharmacyIds: string[];
  toggleFavoritePharmacy: (pharmacyId: string) => void;
  recentSearches: string[];
  addRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
  preferredQuartier: string;
  setPreferredQuartier: (quartier: string) => void;
  clearPatientPrefs: () => void;
  updatePharmacy: (
    pharmacyId: string,
    patch: Partial<
      Pick<
        Pharmacy,
        | "name"
        | "quartier"
        | "address"
        | "phone"
        | "whatsapp"
        | "openFrom"
        | "openTo"
        | "dutyNote"
        | "licenseNumber"
        | "latitude"
        | "longitude"
      >
    >,
  ) => void;
  updateStock: (
    pharmacyId: string,
    medicineId: string,
    patch: { price?: number; quantity?: number },
    immediate?: boolean,
  ) => void;
  addStockMedicine: (
    pharmacyId: string,
    input: {
      medicineId?: string;
      name?: string;
      dci?: string;
      form?: string;
      category?: string;
      price: number;
      quantity: number;
    },
  ) => Promise<ActionResult>;
  removeStockItem: (pharmacyId: string, medicineId: string) => void;
  publishStock: (pharmacyId: string) => void;
  toggleDuty: (pharmacyId: string) => void;
  bulkImportStock: (
    pharmacyId: string,
    rows: Array<{
      name: string;
      dci?: string;
      form?: string;
      category?: string;
      price: number;
      quantity: number;
    }>,
  ) => Promise<BulkImportResult>;
  setPharmacyVerification: (
    pharmacyId: string,
    status: VerificationStatus,
  ) => Promise<ActionResult>;
  updateHospital: (hospitalId: string, patch: Partial<Hospital>) => void;
  updateUnit: (
    hospitalId: string,
    unitId: string,
    patch: Partial<
      Pick<EmergencyUnit, "label" | "totalBeds" | "occupiedBeds" | "waitingMinutes">
    >,
    immediate?: boolean,
  ) => void;
  addUnit: (
    hospitalId: string,
    input: {
      label: string;
      totalBeds: number;
      occupiedBeds: number;
      waitingMinutes: number;
    },
  ) => Promise<ActionResult>;
  removeUnit: (hospitalId: string, unitId: string) => void;
  publishBeds: (hospitalId: string) => void;
  signIn: (email: string, accessCode: string) => Promise<ActionResult>;
  signUp: (input: {
    type: ProfessionalType;
    email: string;
    accessCode: string;
    managerName: string;
    role: string;
    existingEstablishmentId?: string;
    name: string;
    quartier: string;
    address: string;
    phone: string;
    licenseNumber?: string;
  }) => Promise<ActionResult>;
  signOut: () => Promise<void>;
  changeAccessCode: (current: string, next: string) => Promise<ActionResult>;
  recoverAccessCode: (
    email: string,
    recoveryCode: string,
    newCode: string,
  ) => Promise<ActionResult>;
  resetDemo: () => Promise<void>;
}

interface ApiPayload {
  state: AppState;
  session?: SessionInfo | null;
  claimedEstablishmentIds?: string[];
  demoAccounts?: DemoAccount[];
  recoveryCode?: string;
  newRecoveryCode?: string;
  summary?: BulkImportSummary;
}

interface ApiResult {
  ok: boolean;
  status: number;
  error?: string;
  data?: ApiPayload;
}

interface DebouncedEntry {
  timer: ReturnType<typeof setTimeout>;
  run: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

const nowISO = () => new Date().toISOString();

const clamp = (value: number, min: number, max: number) =>
  Math.min(
    max,
    Math.max(min, Math.round(Number.isFinite(value) ? value : min)),
  );

function readPatientPrefs(): PatientPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<PatientPrefs>;
    return {
      favoritePharmacyIds: Array.isArray(parsed.favoritePharmacyIds)
        ? parsed.favoritePharmacyIds.filter(
            (id): id is string => typeof id === "string",
          )
        : [],
      recentSearches: Array.isArray(parsed.recentSearches)
        ? parsed.recentSearches.filter(
            (term): term is string => typeof term === "string",
          )
        : [],
      preferredQuartier:
        typeof parsed.preferredQuartier === "string" && parsed.preferredQuartier.trim()
          ? parsed.preferredQuartier
          : "Tous",
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function writePatientPrefs(prefs: PatientPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Stockage local indisponible
  }
}

function readCachedState(): CachedStateRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedStateRecord>;
    if (!parsed.state || !Array.isArray(parsed.state.pharmacies)) return null;
    return {
      state: parsed.state,
      cachedAt: typeof parsed.cachedAt === "string" ? parsed.cachedAt : nowISO(),
    };
  } catch {
    return null;
  }
}

function writeCachedState(state: AppState): string {
  const stamped = nowISO();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ state, cachedAt: stamped }),
      );
    } catch {
      // Ignorer
    }
  }
  return stamped;
}

function readSavedLocation(): UserLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserLocation>;
    if (
      typeof parsed.lat === "number" &&
      typeof parsed.lng === "number" &&
      Number.isFinite(parsed.lat) &&
      Number.isFinite(parsed.lng)
    ) {
      return { lat: parsed.lat, lng: parsed.lng };
    }
    return null;
  } catch {
    return null;
  }
}

function writeSavedLocation(location: UserLocation | null) {
  if (typeof window === "undefined") return;
  try {
    if (location) {
      window.sessionStorage.setItem(LOCATION_KEY, JSON.stringify(location));
    } else {
      window.sessionStorage.removeItem(LOCATION_KEY);
    }
  } catch {
    // Ignorer
  }
}

async function api(path: string, init?: RequestInit): Promise<ApiResult> {
  try {
    const response = await fetch(path, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error:
          (data as { error?: string } | null)?.error ??
          "Le serveur n'a pas pu traiter la demande.",
      };
    }
    return { ok: true, status: response.status, data: data as ApiPayload };
  } catch {
    return {
      ok: false,
      status: 0,
      error: "Connexion au serveur impossible. Vérifiez votre réseau.",
    };
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [claimed, setClaimed] = useState<string[]>([]);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<PatientPrefs>(DEFAULT_PREFS);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [pwaState, setPwaState] = useState(() => getPwaSnapshot());

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounced = useRef<Map<string, DebouncedEntry>>(new Map());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const lastSyncAt = useRef(0);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }, []);

  const apply = useCallback((payload: ApiPayload) => {
    if (payload.state) {
      setState(payload.state);
      const stamped = writeCachedState(payload.state);
      setCachedAt(stamped);
    }
    if ("session" in payload) setSession(payload.session ?? null);
    if (payload.claimedEstablishmentIds) {
      setClaimed(payload.claimedEstablishmentIds);
    }
    if (payload.demoAccounts) setDemoAccounts(payload.demoAccounts);
    setIsOffline(false);
    lastSyncAt.current = Date.now();
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    const result = await api("/api/state");
    if (!result.ok || !result.data) {
      const cached = readCachedState();
      if (cached) {
        setState(cached.state);
        setCachedAt(cached.cachedAt);
        setIsOffline(true);
        return;
      }
      setLoadError(result.error ?? "Chargement impossible.");
      return;
    }
    apply(result.data);
  }, [apply]);

  const refresh = useCallback(async () => {
    if (pending.current > 0 || debounced.current.size > 0) return;
    const result = await api("/api/state");
    if (result.ok && result.data) {
      apply(result.data);
    } else if (result.status === 0 || result.status === 503) {
      setIsOffline(true);
    }
  }, [apply]);

  useEffect(() => {
    setPrefs(readPatientPrefs());
    const savedLoc = readSavedLocation();
    if (savedLoc) {
      setUserLocation(savedLoc);
      setLocationStatus("granted");
    }
    setPwaState(getPwaSnapshot());
    const unsubPwa = subscribePwa(() => setPwaState(getPwaSnapshot()));
    void load();
    return unsubPwa;
  }, [load]);

  useEffect(() => {
    const maybeSync = () => {
      if (document.visibilityState !== "visible") return;
      if (pending.current > 0 || debounced.current.size > 0) return;
      if (Date.now() - lastSyncAt.current < 15_000) return;
      void refresh();
    };
    const onOffline = () => setIsOffline(true);
    const onOnline = () => {
      setIsOffline(false);
      void refresh();
    };
    document.addEventListener("visibilitychange", maybeSync);
    window.addEventListener("focus", maybeSync);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", maybeSync);
      window.removeEventListener("focus", maybeSync);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [refresh]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      for (const entry of debounced.current.values()) {
        clearTimeout(entry.timer);
      }
      debounced.current.clear();
    },
    [],
  );

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocationStatus("unsupported");
      notify("La géolocalisation n'est pas prise en charge sur cet appareil.");
      return;
    }
    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: UserLocation = {
          lat: Math.round(position.coords.latitude * 100000) / 100000,
          lng: Math.round(position.coords.longitude * 100000) / 100000,
        };
        setUserLocation(next);
        setLocationStatus("granted");
        writeSavedLocation(next);
        notify("Position GPS activée — distances recalculées.");
      },
      (error) => {
        setLocationStatus("denied");
        notify(
          error.code === 1
            ? "Autorisation GPS refusée par le navigateur."
            : "Position GPS indisponible pour le moment.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, [notify]);

  const clearLocation = useCallback(() => {
    setUserLocation(null);
    setLocationStatus("idle");
    writeSavedLocation(null);
  }, []);

  const installPwa = useCallback(async () => {
    const installed = await triggerPwaInstall();
    setPwaState(getPwaSnapshot());
    if (installed) {
      notify("Kéné a été ajouté à votre écran d'accueil.");
    }
    return installed;
  }, [notify]);

  const updatePrefs = useCallback(
    (updater: (previous: PatientPrefs) => PatientPrefs) => {
      setPrefs((previous) => {
        const next = updater(previous);
        writePatientPrefs(next);
        return next;
      });
    },
    [],
  );

  const toggleFavoritePharmacy = useCallback<StoreValue["toggleFavoritePharmacy"]>(
    (pharmacyId) => {
      updatePrefs((previous) => {
        const exists = previous.favoritePharmacyIds.includes(pharmacyId);
        return {
          ...previous,
          favoritePharmacyIds: exists
            ? previous.favoritePharmacyIds.filter((id) => id !== pharmacyId)
            : [...previous.favoritePharmacyIds, pharmacyId],
        };
      });
    },
    [updatePrefs],
  );

  const addRecentSearch = useCallback<StoreValue["addRecentSearch"]>(
    (term) => {
      const clean = term.trim();
      if (!clean) return;
      updatePrefs((previous) => ({
        ...previous,
        recentSearches: [
          clean,
          ...previous.recentSearches.filter(
            (item) => item.toLowerCase() !== clean.toLowerCase(),
          ),
        ].slice(0, 6),
      }));
    },
    [updatePrefs],
  );

  const clearRecentSearches = useCallback(() => {
    updatePrefs((previous) => ({ ...previous, recentSearches: [] }));
  }, [updatePrefs]);

  const setPreferredQuartier = useCallback<StoreValue["setPreferredQuartier"]>(
    (quartier) => {
      updatePrefs((previous) => ({
        ...previous,
        preferredQuartier: quartier.trim() || "Tous",
      }));
    },
    [updatePrefs],
  );

  const clearPatientPrefs = useCallback(() => {
    setPrefs(DEFAULT_PREFS);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(PREFS_KEY);
      } catch {
        // Ignorer
      }
    }
  }, []);

  const cancelDebounce = useCallback((key: string) => {
    const entry = debounced.current.get(key);
    if (!entry) return;
    clearTimeout(entry.timer);
    debounced.current.delete(key);
  }, []);

  const cancelDebouncePrefix = useCallback((prefix: string) => {
    for (const [key, entry] of debounced.current.entries()) {
      if (key.startsWith(prefix)) {
        clearTimeout(entry.timer);
        debounced.current.delete(key);
      }
    }
  }, []);

  const flushDebouncePrefix = useCallback((prefix: string) => {
    const pendingRuns: (() => void)[] = [];
    for (const [key, entry] of debounced.current.entries()) {
      if (key.startsWith(prefix)) {
        clearTimeout(entry.timer);
        debounced.current.delete(key);
        pendingRuns.push(entry.run);
      }
    }
    for (const run of pendingRuns) run();
  }, []);

  const clearAllDebounced = useCallback(() => {
    for (const entry of debounced.current.values()) {
      clearTimeout(entry.timer);
    }
    debounced.current.clear();
  }, []);

  const enqueueAction = useCallback(
    (
      action: string,
      payload: Record<string, unknown> = {},
      options?: { silentError?: boolean; applyImmediately?: boolean },
    ): Promise<ActionResult & { data?: ApiPayload }> => {
      pending.current += 1;
      setSaving(true);
      const task = queue.current.then(
        async (): Promise<ActionResult & { data?: ApiPayload }> => {
          const result = await api("/api/actions", {
            method: "POST",
            body: JSON.stringify({ action, ...payload }),
          });
          pending.current = Math.max(0, pending.current - 1);
          setSaving(pending.current > 0);

          if (!result.ok) {
            if (result.status === 0 || result.status === 503) setIsOffline(true);
            if (result.status === 401) setSession(null);
            const error = result.error ?? "Modification refusée.";
            if (!options?.silentError) {
              notify(error);
              const refreshed = await api("/api/state");
              if (refreshed.ok && refreshed.data) apply(refreshed.data);
              else if (result.status === 403) void load();
            } else if (result.status === 401 || result.status === 403) {
              void load();
            }
            return { ok: false, error };
          }

          if (
            result.data &&
            (options?.applyImmediately ||
              (pending.current === 0 && debounced.current.size === 0))
          ) {
            apply(result.data);
          }
          return { ok: true, data: result.data };
        },
      );
      queue.current = task.then(
        () => undefined,
        () => undefined,
      );
      return task;
    },
    [apply, load, notify],
  );

  const mutate = useCallback(
    (
      action: string,
      payload: Record<string, unknown> = {},
      optimistic?: (previous: AppState) => AppState,
      cancelKey?: string,
    ) => {
      if (cancelKey) cancelDebounce(cancelKey);
      if (optimistic) {
        setState((previous) => (previous ? optimistic(previous) : previous));
      }
      void enqueueAction(action, payload);
    },
    [cancelDebounce, enqueueAction],
  );

  const mutateDebounced = useCallback(
    (
      key: string,
      action: string,
      payload: Record<string, unknown> = {},
      optimistic?: (previous: AppState) => AppState,
      delayMs = 350,
    ) => {
      if (optimistic) {
        setState((previous) => (previous ? optimistic(previous) : previous));
      }
      cancelDebounce(key);
      const run = () => {
        debounced.current.delete(key);
        void enqueueAction(action, payload);
      };
      const timer = setTimeout(run, delayMs);
      debounced.current.set(key, { timer, run });
    },
    [cancelDebounce, enqueueAction],
  );

  const updatePharmacy = useCallback<StoreValue["updatePharmacy"]>(
    (pharmacyId, patch) => {
      const key = `pharmacy:${pharmacyId}:${Object.keys(patch).sort().join(",")}`;
      mutateDebounced(
        key,
        "updatePharmacy",
        { pharmacyId, patch },
        (previous) => ({
          ...previous,
          pharmacies: previous.pharmacies.map((pharmacy) =>
            pharmacy.id === pharmacyId
              ? { ...pharmacy, ...patch, updatedAt: nowISO() }
              : pharmacy,
          ),
        }),
      );
    },
    [mutateDebounced],
  );

  const updateStock = useCallback<StoreValue["updateStock"]>(
    (pharmacyId, medicineId, patch, immediate = false) => {
      const key = `stock:${pharmacyId}:${medicineId}:${Object.keys(patch).sort().join(",")}`;
      const optimistic = (previous: AppState): AppState => ({
        ...previous,
        stock: previous.stock.map((item) =>
          item.pharmacyId === pharmacyId && item.medicineId === medicineId
            ? {
                ...item,
                price:
                  patch.price !== undefined
                    ? Math.max(0, Math.round(patch.price))
                    : item.price,
                quantity:
                  patch.quantity !== undefined
                    ? Math.max(0, Math.round(patch.quantity))
                    : item.quantity,
                updatedAt: nowISO(),
              }
            : item,
        ),
      });
      if (immediate) {
        mutate("updateStock", { pharmacyId, medicineId, ...patch }, optimistic, key);
      } else {
        mutateDebounced(
          key,
          "updateStock",
          { pharmacyId, medicineId, ...patch },
          optimistic,
        );
      }
    },
    [mutate, mutateDebounced],
  );

  const addStockMedicine = useCallback<StoreValue["addStockMedicine"]>(
    async (pharmacyId, input) => {
      flushDebouncePrefix(`pharmacy:${pharmacyId}:`);
      flushDebouncePrefix(`stock:${pharmacyId}:`);
      const res = await enqueueAction(
        "addStockMedicine",
        { pharmacyId, ...input },
        { silentError: true, applyImmediately: true },
      );
      return { ok: res.ok, error: res.error };
    },
    [enqueueAction, flushDebouncePrefix],
  );

  const removeStockItem = useCallback<StoreValue["removeStockItem"]>(
    (pharmacyId, medicineId) => {
      cancelDebouncePrefix(`stock:${pharmacyId}:${medicineId}:`);
      mutate("removeStockItem", { pharmacyId, medicineId }, (previous) => ({
        ...previous,
        stock: previous.stock.filter(
          (item) =>
            !(item.pharmacyId === pharmacyId && item.medicineId === medicineId),
        ),
      }));
    },
    [cancelDebouncePrefix, mutate],
  );

  const publishStock = useCallback<StoreValue["publishStock"]>(
    (pharmacyId) => {
      flushDebouncePrefix(`pharmacy:${pharmacyId}:`);
      flushDebouncePrefix(`stock:${pharmacyId}:`);
      const stamped = nowISO();
      mutate("publishStock", { pharmacyId }, (previous) => ({
        ...previous,
        pharmacies: previous.pharmacies.map((pharmacy) =>
          pharmacy.id === pharmacyId
            ? { ...pharmacy, updatedAt: stamped }
            : pharmacy,
        ),
        stock: previous.stock.map((item) =>
          item.pharmacyId === pharmacyId
            ? { ...item, updatedAt: stamped }
            : item,
        ),
      }));
    },
    [flushDebouncePrefix, mutate],
  );

  const toggleDuty = useCallback(
    (pharmacyId: string) => {
      mutate("toggleDuty", { pharmacyId }, (previous) => ({
        ...previous,
        pharmacies: previous.pharmacies.map((pharmacy) =>
          pharmacy.id === pharmacyId
            ? { ...pharmacy, onDuty: !pharmacy.onDuty, updatedAt: nowISO() }
            : pharmacy,
        ),
      }));
    },
    [mutate],
  );

  const bulkImportStock = useCallback<StoreValue["bulkImportStock"]>(
    async (pharmacyId, rows) => {
      flushDebouncePrefix(`pharmacy:${pharmacyId}:`);
      flushDebouncePrefix(`stock:${pharmacyId}:`);
      const res = await enqueueAction(
        "bulkImportStock",
        { pharmacyId, rows },
        { silentError: true, applyImmediately: true },
      );
      return {
        ok: res.ok,
        summary: res.data?.summary,
        error: res.error,
      };
    },
    [enqueueAction, flushDebouncePrefix],
  );

  const setPharmacyVerification = useCallback<
    StoreValue["setPharmacyVerification"]
  >(
    async (pharmacyId, status) => {
      const res = await enqueueAction(
        "setPharmacyVerification",
        { pharmacyId, status },
        { silentError: true, applyImmediately: true },
      );
      return { ok: res.ok, error: res.error };
    },
    [enqueueAction],
  );

  const updateHospital = useCallback<StoreValue["updateHospital"]>(
    (hospitalId, patch) => {
      const key = `hospital:${hospitalId}:${Object.keys(patch).sort().join(",")}`;
      mutateDebounced(
        key,
        "updateHospital",
        { hospitalId, patch },
        (previous) => ({
          ...previous,
          hospitals: previous.hospitals.map((hospital) =>
            hospital.id === hospitalId
              ? { ...hospital, ...patch, updatedAt: nowISO() }
              : hospital,
          ),
        }),
      );
    },
    [mutateDebounced],
  );

  const updateUnit = useCallback<StoreValue["updateUnit"]>(
    (hospitalId, unitId, patch, immediate = false) => {
      const key = `unit:${hospitalId}:${unitId}:${Object.keys(patch).sort().join(",")}`;
      const optimistic = (previous: AppState): AppState => ({
        ...previous,
        hospitals: previous.hospitals.map((hospital) => {
          if (hospital.id !== hospitalId) return hospital;
          return {
            ...hospital,
            units: hospital.units.map((unit) => {
              if (unit.id !== unitId) return unit;
              const totalBeds =
                patch.totalBeds !== undefined
                  ? clamp(patch.totalBeds, 0, 999)
                  : unit.totalBeds;
              return {
                ...unit,
                label: patch.label !== undefined ? patch.label : unit.label,
                totalBeds,
                waitingMinutes:
                  patch.waitingMinutes !== undefined
                    ? clamp(patch.waitingMinutes, 0, 600)
                    : unit.waitingMinutes,
                occupiedBeds:
                  patch.occupiedBeds !== undefined
                    ? clamp(patch.occupiedBeds, 0, totalBeds)
                    : Math.min(unit.occupiedBeds, totalBeds),
              };
            }),
            updatedAt: nowISO(),
          };
        }),
      });
      if (immediate) {
        mutate("updateUnit", { hospitalId, unitId, patch }, optimistic, key);
      } else {
        mutateDebounced(
          key,
          "updateUnit",
          { hospitalId, unitId, patch },
          optimistic,
        );
      }
    },
    [mutate, mutateDebounced],
  );

  const addUnit = useCallback<StoreValue["addUnit"]>(
    async (hospitalId, input) => {
      flushDebouncePrefix(`hospital:${hospitalId}:`);
      flushDebouncePrefix(`unit:${hospitalId}:`);
      const res = await enqueueAction(
        "addUnit",
        { hospitalId, input },
        { silentError: true, applyImmediately: true },
      );
      return { ok: res.ok, error: res.error };
    },
    [enqueueAction, flushDebouncePrefix],
  );

  const removeUnit = useCallback(
    (hospitalId: string, unitId: string) => {
      cancelDebouncePrefix(`unit:${hospitalId}:${unitId}:`);
      mutate("removeUnit", { hospitalId, unitId }, (previous) => ({
        ...previous,
        hospitals: previous.hospitals.map((hospital) =>
          hospital.id === hospitalId
            ? {
                ...hospital,
                units: hospital.units.filter((unit) => unit.id !== unitId),
                updatedAt: nowISO(),
              }
            : hospital,
        ),
      }));
    },
    [cancelDebouncePrefix, mutate],
  );

  const publishBeds = useCallback(
    (hospitalId: string) => {
      flushDebouncePrefix(`hospital:${hospitalId}:`);
      flushDebouncePrefix(`unit:${hospitalId}:`);
      mutate("publishBeds", { hospitalId }, (previous) => ({
        ...previous,
        hospitals: previous.hospitals.map((hospital) =>
          hospital.id === hospitalId
            ? { ...hospital, updatedAt: nowISO() }
            : hospital,
        ),
      }));
    },
    [flushDebouncePrefix, mutate],
  );

  const authRequest = useCallback(
    async (
      body: Record<string, unknown>,
    ): Promise<{ result: ActionResult; data?: ApiPayload }> => {
      const response = await api("/api/auth", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!response.ok || !response.data) {
        return {
          result: {
            ok: false,
            error: response.error ?? "Opération impossible.",
          },
        };
      }
      apply(response.data);
      return { result: { ok: true }, data: response.data };
    },
    [apply],
  );

  const signIn = useCallback<StoreValue["signIn"]>(
    async (email, accessCode) =>
      (await authRequest({ action: "login", email, code: accessCode })).result,
    [authRequest],
  );

  const signUp = useCallback<StoreValue["signUp"]>(
    async (input) => {
      const { result, data } = await authRequest({
        action: "register",
        ...input,
      });
      if (result.ok && data?.recoveryCode) {
        setRecoveryCode(data.recoveryCode);
      }
      return result;
    },
    [authRequest],
  );

  const signOut = useCallback(async () => {
    clearAllDebounced();
    const result = await api("/api/auth", {
      method: "POST",
      body: JSON.stringify({ action: "logout" }),
    });
    if (result.ok && result.data) apply(result.data);
    else setSession(null);
  }, [apply, clearAllDebounced]);

  const changeAccessCode = useCallback<StoreValue["changeAccessCode"]>(
    async (current, next) => {
      const result = await api("/api/auth", {
        method: "POST",
        body: JSON.stringify({ action: "change-code", current, next }),
      });
      if (!result.ok || !result.data) {
        return { ok: false, error: result.error ?? "Modification impossible." };
      }
      apply(result.data);
      return { ok: true };
    },
    [apply],
  );

  const recoverAccessCode = useCallback<StoreValue["recoverAccessCode"]>(
    async (email, recoveryCodeInput, newCode) => {
      const response = await api("/api/auth", {
        method: "POST",
        body: JSON.stringify({
          action: "recover",
          email,
          recoveryCode: recoveryCodeInput,
          newCode,
        }),
      });
      if (!response.ok || !response.data) {
        return {
          ok: false,
          error: response.error ?? "Récupération impossible.",
        };
      }
      if (response.data.newRecoveryCode) {
        setRecoveryCode(response.data.newRecoveryCode);
      }
      return { ok: true };
    },
    [],
  );

  const dismissRecoveryCode = useCallback(() => {
    setRecoveryCode(null);
  }, []);

  const resetDemo = useCallback(async () => {
    clearAllDebounced();
    const result = await api("/api/actions", {
      method: "POST",
      body: JSON.stringify({ action: "resetDemo" }),
    });
    if (!result.ok || !result.data) {
      notify(result.error ?? "Réinitialisation impossible.");
      return;
    }
    apply(result.data);
    notify("Données de démonstration réinitialisées.");
  }, [apply, clearAllDebounced, notify]);

  const value = useMemo<StoreValue | null>(() => {
    if (!state) return null;
    return {
      state,
      session,
      claimedEstablishmentIds: claimed,
      demoAccounts,
      recoveryCode,
      dismissRecoveryCode,
      saving,
      isOffline,
      cachedAt,
      toast,
      notify,
      refresh,
      userLocation,
      locationStatus,
      requestLocation,
      clearLocation,
      canInstallPwa: pwaState.canInstall,
      isPwaInstalled: pwaState.isInstalled,
      installPwa,
      favoritePharmacyIds: prefs.favoritePharmacyIds,
      toggleFavoritePharmacy,
      recentSearches: prefs.recentSearches,
      addRecentSearch,
      clearRecentSearches,
      preferredQuartier: prefs.preferredQuartier,
      setPreferredQuartier,
      clearPatientPrefs,
      updatePharmacy,
      updateStock,
      addStockMedicine,
      removeStockItem,
      publishStock,
      toggleDuty,
      bulkImportStock,
      setPharmacyVerification,
      updateHospital,
      updateUnit,
      addUnit,
      removeUnit,
      publishBeds,
      signIn,
      signUp,
      signOut,
      changeAccessCode,
      recoverAccessCode,
      resetDemo,
    };
  }, [
    state,
    session,
    claimed,
    demoAccounts,
    recoveryCode,
    dismissRecoveryCode,
    saving,
    isOffline,
    cachedAt,
    toast,
    notify,
    refresh,
    userLocation,
    locationStatus,
    requestLocation,
    clearLocation,
    pwaState,
    installPwa,
    prefs,
    toggleFavoritePharmacy,
    addRecentSearch,
    clearRecentSearches,
    setPreferredQuartier,
    clearPatientPrefs,
    updatePharmacy,
    updateStock,
    addStockMedicine,
    removeStockItem,
    publishStock,
    toggleDuty,
    bulkImportStock,
    setPharmacyVerification,
    updateHospital,
    updateUnit,
    addUnit,
    removeUnit,
    publishBeds,
    signIn,
    signUp,
    signOut,
    changeAccessCode,
    recoverAccessCode,
    resetDemo,
  ]);

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand">
        {loadError ? (
          <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
            <p className="text-sm font-semibold text-ink-900">
              Kéné ne parvient pas à joindre le serveur
            </p>
            <p className="text-xs leading-relaxed text-slate-500">{loadError}</p>
            <button onClick={() => void load()} className="btn-primary text-xs">
              Réessayer
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <span className="h-9 w-9 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <p className="text-sm text-slate-500">Ouverture de Kéné…</p>
          </div>
        )}
      </div>
    );
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore doit être utilisé dans StoreProvider");
  return context;
}
