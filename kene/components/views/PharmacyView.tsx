"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store";
import { Badge, Card, Toggle, cn } from "../ui";
import {
  IconAlert,
  IconCheck,
  IconClock,
  IconCrosshair,
  IconDownload,
  IconList,
  IconLogout,
  IconMinus,
  IconPhone,
  IconPill,
  IconPlus,
  IconSearch,
  IconShield,
  IconTrash,
  IconUpload,
} from "../icons";
import { parseStockCsv, STOCK_CSV_TEMPLATE } from "@/lib/csv";
import {
  CATEGORIES,
  LEVEL_META,
  openingLabel,
  pharmacyOverview,
  stockLevel,
} from "@/lib/engine";
import { timeAgo } from "@/lib/format";
import type { BulkImportSummary } from "@/lib/types";

type PharmacyTab = "stock" | "csv" | "profile";

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function PharmacyView() {
  const {
    state,
    session,
    updatePharmacy,
    updateStock,
    addStockMedicine,
    bulkImportStock,
    removeStockItem,
    publishStock,
    toggleDuty,
    signOut,
    notify,
  } = useStore();

  const pharmacyId =
    session?.type === "pharmacy" ? session.establishmentId : "";
  const pharmacy = state.pharmacies.find((item) => item.id === pharmacyId);

  const [activeTab, setActiveTab] = useState<PharmacyTab>("stock");
  const [stockFilter, setStockFilter] = useState<
    "toutes" | "alerte" | "en_stock"
  >("toutes");
  const [query, setQuery] = useState("");

  const [nameInput, setNameInput] = useState(() => pharmacy?.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [openFromInput, setOpenFromInput] = useState(() =>
    String(pharmacy?.openFrom ?? 8),
  );
  const [openToInput, setOpenToInput] = useState(() =>
    String(pharmacy?.openTo ?? 20),
  );
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [latInput, setLatInput] = useState(() =>
    String(pharmacy?.latitude ?? 5.3484),
  );
  const [lngInput, setLngInput] = useState(() =>
    String(pharmacy?.longitude ?? -4.0124),
  );
  const [coordsError, setCoordsError] = useState<string | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);

  const [csvText, setCsvText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<BulkImportSummary | null>(
    null,
  );

  const [addMode, setAddMode] = useState<"catalog" | "custom">("catalog");
  const [selectedMedicineId, setSelectedMedicineId] = useState("");
  const [customName, setCustomName] = useState("");
  const [customDci, setCustomDci] = useState("");
  const [customForm, setCustomForm] = useState("");
  const [customCategory, setCustomCategory] = useState<string>(CATEGORIES[0]);
  const [addPrice, setAddPrice] = useState("1500");
  const [addQuantity, setAddQuantity] = useState("10");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (!pharmacy) return;
    setNameInput(pharmacy.name);
    setNameError(null);
  }, [pharmacy?.id, pharmacy?.name]);

  useEffect(() => {
    if (!pharmacy) return;
    setOpenFromInput(String(pharmacy.openFrom));
    setOpenToInput(String(pharmacy.openTo));
    setHoursError(null);
  }, [pharmacy?.id, pharmacy?.openFrom, pharmacy?.openTo]);

  useEffect(() => {
    if (!pharmacy) return;
    setLatInput(String(pharmacy.latitude));
    setLngInput(String(pharmacy.longitude));
    setCoordsError(null);
  }, [pharmacy?.id, pharmacy?.latitude, pharmacy?.longitude]);

  const csvPreview = useMemo(
    () => (csvText.trim() ? parseStockCsv(csvText) : null),
    [csvText],
  );

  const overview = useMemo(
    () => pharmacyOverview(state, pharmacyId),
    [state, pharmacyId],
  );

  const pharmacyStockIds = useMemo(
    () =>
      new Set(
        state.stock
          .filter((item) => item.pharmacyId === pharmacyId)
          .map((item) => item.medicineId),
      ),
    [state.stock, pharmacyId],
  );

  const availableCatalog = useMemo(
    () =>
      state.medicines
        .filter((medicine) => !pharmacyStockIds.has(medicine.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state.medicines, pharmacyStockIds],
  );

  const effectiveMedicine =
    availableCatalog.find((medicine) => medicine.id === selectedMedicineId) ??
    availableCatalog[0] ??
    null;

  useEffect(() => {
    if (addMode === "catalog" && effectiveMedicine) {
      setAddPrice(String(effectiveMedicine.basePrice));
    }
  }, [addMode, effectiveMedicine]);

  const stockRows = useMemo(() => {
    const term = normalizeText(query.trim());
    return state.stock
      .filter((item) => item.pharmacyId === pharmacyId)
      .map((item) => ({
        item,
        medicine: state.medicines.find((m) => m.id === item.medicineId),
        level: stockLevel(item),
      }))
      .filter(
        (
          entry,
        ): entry is {
          item: (typeof state.stock)[number];
          medicine: (typeof state.medicines)[number];
          level: ReturnType<typeof stockLevel>;
        } => Boolean(entry.medicine),
      )
      .filter(({ medicine, level }) => {
        if (stockFilter === "alerte" && level === "available") return false;
        if (stockFilter === "en_stock" && level === "out") return false;
        if (!term) return true;
        return (
          normalizeText(medicine.name).includes(term) ||
          normalizeText(medicine.dci).includes(term) ||
          normalizeText(medicine.category).includes(term)
        );
      })
      .sort((a, b) => {
        const weight = { out: 0, low: 1, available: 2 };
        const diff = weight[a.level] - weight[b.level];
        if (diff !== 0) return diff;
        return a.medicine.name.localeCompare(b.medicine.name);
      });
  }, [state.stock, state.medicines, pharmacyId, query, stockFilter]);

  if (!session || session.type !== "pharmacy" || !pharmacy) return null;

  const handleHoursChange = (nextFromRaw: string, nextToRaw: string) => {
    setOpenFromInput(nextFromRaw);
    setOpenToInput(nextToRaw);
    if (nextFromRaw.trim() === "" || nextToRaw.trim() === "") {
      setHoursError(
        "Indiquez des heures d'ouverture (0–23) et de fermeture (1–24).",
      );
      return;
    }
    const from = Number(nextFromRaw);
    const to = Number(nextToRaw);
    if (!Number.isInteger(from) || from < 0 || from > 23) {
      setHoursError("L'heure d'ouverture doit être comprise entre 0 et 23.");
      return;
    }
    if (!Number.isInteger(to) || to < 1 || to > 24) {
      setHoursError("L'heure de fermeture doit être comprise entre 1 et 24.");
      return;
    }
    if (to <= from) {
      setHoursError(
        "L'heure de fermeture doit être supérieure à l'heure d'ouverture.",
      );
      return;
    }
    setHoursError(null);
    updatePharmacy(pharmacy.id, { openFrom: from, openTo: to });
  };

  const handleCoordsChange = (nextLatRaw: string, nextLngRaw: string) => {
    setLatInput(nextLatRaw);
    setLngInput(nextLngRaw);
    if (nextLatRaw.trim() === "" || nextLngRaw.trim() === "") {
      setCoordsError("Indiquez la latitude et la longitude GPS.");
      return;
    }
    const lat = Number(nextLatRaw);
    const lng = Number(nextLngRaw);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      setCoordsError(
        "Coordonnées GPS invalides (latitude -90 à 90, longitude -180 à 180).",
      );
      return;
    }
    setCoordsError(null);
    updatePharmacy(pharmacy.id, {
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
    });
  };

  const captureGpsPosition = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      const msg = "La géolocalisation n'est pas supportée par ce navigateur.";
      setCoordsError(msg);
      notify(msg);
      return;
    }
    if (gpsBusy) return;
    setGpsBusy(true);
    setCoordsError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setLatInput(String(lat));
        setLngInput(String(lng));
        setGpsBusy(false);
        updatePharmacy(pharmacy.id, { latitude: lat, longitude: lng });
        notify("Position GPS de l'officine enregistrée.");
      },
      () => {
        setGpsBusy(false);
        setCoordsError(
          "Impossible de récupérer votre position GPS. Vérifiez l'autorisation du navigateur.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const downloadCsvTemplate = () => {
    const blob = new Blob([STOCK_CSV_TEMPLATE], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "modele-stock-kene.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleBulkImport = async () => {
    if (importBusy || !csvPreview || csvPreview.rows.length === 0) return;
    setImportError(null);
    setImportSummary(null);
    setImportBusy(true);
    const result = await bulkImportStock(pharmacy.id, csvPreview.rows);
    setImportBusy(false);
    if (!result.ok) {
      const message = result.error ?? "Import CSV impossible.";
      setImportError(message);
      notify(message);
      return;
    }
    const summary = result.summary ?? null;
    setImportSummary(summary);
    if (summary) {
      notify(
        `Import terminé : ${summary.imported} ajoutée(s), ${summary.updated} mise(s) à jour.`,
      );
      if (summary.skipped === 0 && summary.errors.length === 0) {
        setCsvText("");
      }
    } else {
      notify("Stock importé.");
    }
  };

  const handleAddMedicine = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (addBusy) return;
    setAddError(null);

    const parsedPrice = Number(addPrice);
    const parsedQuantity = Number(addQuantity);
    if (
      !Number.isFinite(parsedPrice) ||
      parsedPrice < 0 ||
      parsedPrice > 1_000_000
    ) {
      setAddError("Indiquez un prix valide en FCFA (0 à 1 000 000).");
      return;
    }
    if (
      !Number.isFinite(parsedQuantity) ||
      parsedQuantity < 0 ||
      parsedQuantity > 99_999
    ) {
      setAddError("Indiquez une quantité valide (0 à 99 999).");
      return;
    }

    const price = Math.round(parsedPrice);
    const quantity = Math.round(parsedQuantity);

    if (addMode === "catalog") {
      if (!effectiveMedicine) {
        setAddError(
          "Toutes les références du catalogue sont déjà dans votre stock.",
        );
        return;
      }
      setAddBusy(true);
      const result = await addStockMedicine(pharmacy.id, {
        medicineId: effectiveMedicine.id,
        price,
        quantity,
      });
      setAddBusy(false);
      if (!result.ok) {
        setAddError(result.error ?? "Impossible d'ajouter ce médicament.");
        return;
      }
      notify(`${effectiveMedicine.name} ajouté à votre stock.`);
      setSelectedMedicineId("");
      setAddPrice("1500");
      setAddQuantity("10");
      return;
    }

    const name = customName.trim();
    const dci = customDci.trim();
    const form = customForm.trim();
    if (!name || !dci || !form) {
      setAddError("Renseignez le nom, la DCI et la forme du médicament.");
      return;
    }

    setAddBusy(true);
    const result = await addStockMedicine(pharmacy.id, {
      name,
      dci,
      form,
      category: customCategory,
      price,
      quantity,
    });
    setAddBusy(false);
    if (!result.ok) {
      setAddError(result.error ?? "Impossible de créer cette référence.");
      return;
    }
    notify(`${name} ajouté au catalogue et à votre stock.`);
    setCustomName("");
    setCustomDci("");
    setCustomForm("");
    setCustomCategory(CATEGORIES[0]);
    setAddPrice("1500");
    setAddQuantity("10");
  };

  const alertCount = overview.ruptures.length + overview.lowStock.length;
  const hasProfileErrors = Boolean(nameError || hoursError || coordsError);

  const tabs: Array<{
    key: PharmacyTab;
    label: string;
    icon: typeof IconPill;
    badge?: string;
    hasAlert?: boolean;
  }> = [
    {
      key: "stock",
      label: "Stock & Prix",
      icon: IconPill,
      badge: String(overview.items),
    },
    {
      key: "csv",
      label: "Import CSV / Excel",
      icon: IconUpload,
      badge: csvPreview?.rows.length ? String(csvPreview.rows.length) : undefined,
    },
    {
      key: "profile",
      label: "Fiche & GPS",
      icon: IconCrosshair,
      hasAlert: hasProfileErrors,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-brand-200/70 bg-gradient-to-r from-brand-50/90 via-white to-emerald-50/50 px-4 py-3 text-xs text-brand-900 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge tone="green" dot>
            Officine active · Visible des patients
          </Badge>
          <span className="text-[11px] font-medium text-brand-800">
            Responsable : {session.managerName}
          </span>
        </div>
        {pharmacy.licenseNumber ? (
          <span className="font-mono text-[11px] font-semibold text-brand-800">
            Agrément : {pharmacy.licenseNumber}
          </span>
        ) : null}
      </div>

      <Card className="rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <IconShield className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-ink-900">
                {pharmacy.name}
              </p>
              <p className="mt-0.5 break-words text-xs text-slate-500">
                {pharmacy.address} · {pharmacy.quartier}
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                <span>
                  {openingLabel(pharmacy)} · {pharmacy.phone}
                </span>
                <span className="inline-flex items-center gap-1">
                  <IconClock className="h-3.5 w-3.5" />
                  {overview.lastUpdatedAt
                    ? `maj ${timeAgo(overview.lastUpdatedAt)}`
                    : "aucune mise à jour"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            <div className="flex items-center justify-between gap-2.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2 sm:justify-start">
              <span className="text-xs font-semibold text-ink-900">
                De garde 24h/24
              </span>
              <Toggle
                checked={pharmacy.onDuty}
                onChange={() => {
                  toggleDuty(pharmacy.id);
                  notify(
                    pharmacy.onDuty
                      ? "Vous n'êtes plus signalée de garde."
                      : "Vous apparaissez maintenant de garde, 24 h/24.",
                  );
                }}
                label="De garde 24h/24"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                publishStock(pharmacy.id);
                notify(
                  "Stock publié — vos disponibilités sont actualisées pour les patients.",
                );
              }}
              className="btn-primary w-full whitespace-nowrap rounded-xl text-xs sm:w-auto"
            >
              <IconCheck className="h-4 w-4" />
              Publier mon stock
            </button>

            <button
              type="button"
              onClick={() => {
                void signOut();
                notify("Déconnecté de l'espace pharmacie.");
              }}
              className="btn-secondary w-full whitespace-nowrap rounded-xl text-xs sm:w-auto"
            >
              <IconLogout className="h-4 w-4" />
              Se déconnecter
            </button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
        {[
          {
            label: "Références en stock",
            value: String(overview.inStock.length),
            sub: `sur ${overview.items}`,
            tone:
              overview.inStock.length > 0
                ? ("green" as const)
                : ("amber" as const),
          },
          {
            label: "Produits en rupture",
            value: String(overview.ruptures.length),
            sub: "indisponibles",
            tone:
              overview.ruptures.length > 0
                ? ("red" as const)
                : ("green" as const),
          },
          {
            label: "Stock faible",
            value: String(overview.lowStock.length),
            sub: "5 unités ou moins",
            tone:
              overview.lowStock.length > 0
                ? ("amber" as const)
                : ("green" as const),
          },
          {
            label: "Dernière mise à jour",
            value: overview.lastUpdatedAt
              ? timeAgo(overview.lastUpdatedAt)
              : "—",
            sub: "stock déclaré",
            tone: "neutral" as const,
          },
        ].map((card) => (
          <Card key={card.label} className="rounded-2xl p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {card.label}
            </p>
            <div className="mt-2.5 flex flex-wrap items-end justify-between gap-2">
              <p className="text-xl font-bold tracking-tight tabular-nums text-ink-900 sm:text-2xl">
                {card.value}
              </p>
              <Badge tone={card.tone}>{card.sub}</Badge>
            </div>
          </Card>
        ))}
      </div>

      {alertCount > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3.5 text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <IconAlert className="h-5 w-5" />
            </span>
            <p className="text-xs sm:text-sm">
              <span className="font-semibold tabular-nums">
                {alertCount} références
              </span>{" "}
              à réapprovisionner ou vérifier — signalez vos retours en stock dès
              réception.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveTab("stock");
              setStockFilter("alerte");
            }}
            className="btn w-full shrink-0 rounded-xl border border-amber-300/80 bg-white px-4 py-2 text-xs font-semibold text-amber-950 shadow-sm hover:bg-amber-100/60 sm:w-auto"
          >
            Voir les alertes
          </button>
        </div>
      ) : null}

      <div
        role="tablist"
        aria-label="Sections de l'espace pharmacie"
        className="grid grid-cols-1 gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-card sm:grid-cols-3"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition",
                isSelected
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-ink-900",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
              {tab.badge ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums",
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-700",
                  )}
                >
                  {tab.badge}
                </span>
              ) : null}
              {tab.hasAlert ? (
                <span
                  aria-label="Erreur de saisie"
                  className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {activeTab === "stock" ? (
        <div role="tabpanel" className="space-y-4">
          <Card className="flex flex-col rounded-3xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-ink-900">Mon stock</h2>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Modifiez les prix en FCFA et les quantités disponibles en
                  temps réel.
                </p>
              </div>
              <span className="text-[11px] tabular-nums text-slate-500">
                {stockRows.length} affichée{stockRows.length > 1 ? "s" : ""} sur{" "}
                {overview.items} références
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  aria-label="Filtrer le stock par nom, DCI ou catégorie"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Rechercher par nom, DCI ou catégorie…"
                  className="input py-2 pl-8 text-xs"
                />
              </div>

              <div
                role="group"
                aria-label="Filtrer par état du stock"
                className="flex flex-wrap items-center gap-1.5"
              >
                {(
                  [
                    { key: "toutes", label: "Tout" },
                    { key: "alerte", label: "Stock faible / Rupture" },
                    { key: "en_stock", label: "En stock" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setStockFilter(option.key)}
                    aria-pressed={stockFilter === option.key}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-[11px] font-medium transition",
                      stockFilter === option.key
                        ? option.key === "alerte"
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-brand-500 bg-brand-50 text-brand-800"
                        : "border-slate-200 text-slate-600 hover:border-slate-300",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {stockRows.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center">
                <p className="text-xs text-slate-500">
                  Aucune référence ne correspond à votre recherche.
                </p>
                {(query.trim() || stockFilter !== "toutes") && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setStockFilter("toutes");
                    }}
                    className="btn-secondary mt-3 px-3 py-1.5 text-[11px]"
                  >
                    Afficher tout le stock
                  </button>
                )}
              </div>
            ) : (
              <div className="scroll-thin mt-3 max-h-[520px] flex-1 overflow-y-auto">
                <ul className="divide-y divide-slate-100">
                  {stockRows.map(({ item, medicine, level }) => {
                    const meta = LEVEL_META[level];
                    return (
                      <li key={item.medicineId} className="py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-ink-900">
                              {medicine.name}
                            </p>
                            <p className="truncate text-[11px] text-slate-500">
                              {medicine.dci} · {medicine.form} ·{" "}
                              {medicine.category} · maj{" "}
                              {timeAgo(item.updatedAt)}
                            </p>
                          </div>
                          <Badge tone={meta.tone} className="shrink-0">
                            {meta.label}
                          </Badge>
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                          <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                            Prix
                            <input
                              type="number"
                              aria-label={`Prix de ${medicine.name}`}
                              min={0}
                              step={100}
                              value={item.price}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                if (!Number.isFinite(value)) return;
                                updateStock(pharmacy.id, item.medicineId, {
                                  price: Math.max(0, value),
                                });
                              }}
                              className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-right text-[11px] font-medium tabular-nums text-ink-900 focus:border-brand-400 focus:outline-none"
                            />
                            F
                          </label>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateStock(
                                  pharmacy.id,
                                  item.medicineId,
                                  { quantity: Math.max(0, item.quantity - 1) },
                                  true,
                                )
                              }
                              disabled={item.quantity <= 0}
                              className="rounded-md border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={`Retirer une unité de ${medicine.name}`}
                            >
                              <IconMinus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="number"
                              aria-label={`Quantité en stock de ${medicine.name}`}
                              min={0}
                              value={item.quantity}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                if (!Number.isFinite(value)) return;
                                updateStock(pharmacy.id, item.medicineId, {
                                  quantity: Math.max(0, value),
                                });
                              }}
                              className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-[11px] font-medium tabular-nums text-ink-900 focus:border-brand-400 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateStock(
                                  pharmacy.id,
                                  item.medicineId,
                                  { quantity: item.quantity + 1 },
                                  true,
                                )
                              }
                              className="rounded-md border border-slate-200 p-1.5 text-slate-600 transition hover:bg-slate-50"
                              aria-label={`Ajouter une unité de ${medicine.name}`}
                            >
                              <IconPlus className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-3 sm:ml-auto">
                            <button
                              type="button"
                              onClick={() =>
                                updateStock(
                                  pharmacy.id,
                                  item.medicineId,
                                  { quantity: 0 },
                                  true,
                                )
                              }
                              disabled={item.quantity <= 0}
                              className="text-[11px] font-medium text-slate-600 underline-offset-2 hover:text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Rupture
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                removeStockItem(pharmacy.id, item.medicineId);
                                notify(
                                  `${medicine.name} retiré de votre stock.`,
                                );
                              }}
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-700"
                            >
                              <IconTrash className="h-3.5 w-3.5" />
                              Retirer
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <p className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
              <IconPhone className="h-3.5 w-3.5 shrink-0" />
              Les patients consultent vos disponibilités et vous contactent
              directement par téléphone ou WhatsApp.
            </p>
          </Card>

          <Card className="rounded-3xl p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-ink-900">
                  Ajouter un médicament à mon stock
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Sélectionnez une référence existante du catalogue ou créez un
                  nouveau médicament.
                </p>
              </div>
              <div className="flex rounded-2xl bg-slate-100 p-1 text-xs font-semibold">
                {(
                  [
                    { key: "catalog", label: "Depuis le catalogue" },
                    { key: "custom", label: "Nouvelle référence" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setAddMode(tab.key);
                      setAddError(null);
                      if (tab.key === "catalog" && effectiveMedicine) {
                        setAddPrice(String(effectiveMedicine.basePrice));
                      }
                    }}
                    aria-pressed={addMode === tab.key}
                    className={cn(
                      "flex-1 rounded-lg px-3 py-1.5 transition sm:flex-initial",
                      addMode === tab.key
                        ? "bg-white text-ink-900 shadow-sm"
                        : "text-slate-600 hover:text-ink-900",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddMedicine} className="mt-4 space-y-3">
              {addMode === "catalog" ? (
                availableCatalog.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_0.7fr_0.7fr_auto] sm:items-end">
                    <div className="min-w-0">
                      <label className="label" htmlFor="catalog-medicine">
                        Médicament du catalogue
                      </label>
                      <select
                        id="catalog-medicine"
                        className="input"
                        value={effectiveMedicine?.id ?? ""}
                        onChange={(event) => {
                          const nextId = event.target.value;
                          setSelectedMedicineId(nextId);
                          setAddError(null);
                          const chosen = availableCatalog.find(
                            (item) => item.id === nextId,
                          );
                          if (chosen) setAddPrice(String(chosen.basePrice));
                        }}
                      >
                        {availableCatalog.map((medicine) => (
                          <option key={medicine.id} value={medicine.id}>
                            {medicine.name} — {medicine.form} (
                            {medicine.category})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor="catalog-price">
                        Prix (FCFA)
                      </label>
                      <input
                        id="catalog-price"
                        type="number"
                        min={0}
                        max={1000000}
                        step={50}
                        className="input"
                        value={addPrice}
                        onChange={(event) => {
                          setAddPrice(event.target.value);
                          setAddError(null);
                        }}
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="catalog-qty">
                        Quantité
                      </label>
                      <input
                        id="catalog-qty"
                        type="number"
                        min={0}
                        max={99999}
                        className="input"
                        value={addQuantity}
                        onChange={(event) => {
                          setAddQuantity(event.target.value);
                          setAddError(null);
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={addBusy}
                      className="btn-primary w-full text-xs sm:w-auto"
                    >
                      <IconPlus className="h-4 w-4" />
                      {addBusy ? "Ajout…" : "Ajouter"}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-dashed border-slate-200 px-4 py-4 sm:flex-row sm:items-center">
                    <p className="text-xs text-slate-500">
                      Toutes les références du catalogue sont déjà présentes
                      dans votre stock.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setAddMode("custom");
                        setAddError(null);
                      }}
                      className="btn-secondary text-xs"
                    >
                      Créer une nouvelle référence
                    </button>
                  </div>
                )
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="label" htmlFor="custom-med-name">
                      Nom du médicament
                    </label>
                    <input
                      id="custom-med-name"
                      className="input"
                      placeholder="Ex. Doliprane 1000 mg"
                      value={customName}
                      onChange={(event) => {
                        setCustomName(event.target.value);
                        setAddError(null);
                      }}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="custom-med-dci">
                      Molécule (DCI)
                    </label>
                    <input
                      id="custom-med-dci"
                      className="input"
                      placeholder="Ex. Paracétamol"
                      value={customDci}
                      onChange={(event) => {
                        setCustomDci(event.target.value);
                        setAddError(null);
                      }}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="custom-med-form">
                      Forme / conditionnement
                    </label>
                    <input
                      id="custom-med-form"
                      className="input"
                      placeholder="Ex. Boîte de 8 comprimés"
                      value={customForm}
                      onChange={(event) => {
                        setCustomForm(event.target.value);
                        setAddError(null);
                      }}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="custom-med-category">
                      Catégorie
                    </label>
                    <select
                      id="custom-med-category"
                      className="input"
                      value={customCategory}
                      onChange={(event) => {
                        setCustomCategory(event.target.value);
                        setAddError(null);
                      }}
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="custom-med-price">
                      Prix (FCFA)
                    </label>
                    <input
                      id="custom-med-price"
                      type="number"
                      min={0}
                      max={1000000}
                      step={50}
                      className="input"
                      value={addPrice}
                      onChange={(event) => {
                        setAddPrice(event.target.value);
                        setAddError(null);
                      }}
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="custom-med-qty">
                      Quantité
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        id="custom-med-qty"
                        type="number"
                        min={0}
                        max={99999}
                        className="input"
                        value={addQuantity}
                        onChange={(event) => {
                          setAddQuantity(event.target.value);
                          setAddError(null);
                        }}
                      />
                      <button
                        type="submit"
                        disabled={addBusy}
                        className="btn-primary shrink-0 text-xs"
                      >
                        <IconPlus className="h-4 w-4" />
                        {addBusy ? "Ajout…" : "Créer"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {addError ? (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700"
                >
                  {addError}
                </p>
              ) : null}
            </form>
          </Card>
        </div>
      ) : activeTab === "csv" ? (
        <div role="tabpanel">
          <Card className="rounded-3xl p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-ink-900">
                  Import rapide CSV / Excel en masse
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Importez ou mettez à jour jusqu&apos;à 200 lignes depuis un
                  fichier CSV ou un copier-coller Excel / Calc.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="btn-secondary px-3 py-2 text-xs"
                >
                  <IconDownload className="h-4 w-4" />
                  Télécharger le modèle CSV
                </button>
                <label className="btn-secondary cursor-pointer px-3 py-2 text-xs">
                  <IconUpload className="h-4 w-4" />
                  Charger un fichier
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="sr-only"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      const content = await file.text();
                      setCsvText(content);
                      setImportError(null);
                      setImportSummary(null);
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="mt-4">
              <label className="label" htmlFor="bulk-csv-input">
                Contenu CSV (séparateur ; , ou tabulation)
              </label>
              <textarea
                id="bulk-csv-input"
                rows={6}
                className="input scroll-thin font-mono text-xs"
                placeholder={STOCK_CSV_TEMPLATE}
                value={csvText}
                onChange={(event) => {
                  setCsvText(event.target.value);
                  setImportError(null);
                  setImportSummary(null);
                }}
              />
            </div>

            {csvPreview ? (
              <div className="mt-4 space-y-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink-900">
                    {csvPreview.rows.length} ligne
                    {csvPreview.rows.length > 1 ? "s" : ""} valide
                    {csvPreview.rows.length > 1 ? "s" : ""} prête
                    {csvPreview.rows.length > 1 ? "s" : ""} à importer
                  </span>
                  {csvPreview.errors.length > 0 ? (
                    <Badge tone="amber">
                      {csvPreview.errors.length} erreur
                      {csvPreview.errors.length > 1 ? "s" : ""} détectée
                      {csvPreview.errors.length > 1 ? "s" : ""}
                    </Badge>
                  ) : (
                    <Badge tone="green">Format valide</Badge>
                  )}
                </div>

                {csvPreview.errors.length > 0 ? (
                  <ul className="max-h-32 space-y-1 overflow-y-auto text-[11px] text-amber-800">
                    {csvPreview.errors.map((err) => (
                      <li key={err}>• {err}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={
                  importBusy || !csvPreview || csvPreview.rows.length === 0
                }
                onClick={handleBulkImport}
                className="btn-primary w-full text-xs sm:w-auto"
              >
                <IconUpload className="h-4 w-4" />
                {importBusy
                  ? "Import en cours…"
                  : `Importer ${csvPreview?.rows.length ?? 0} référence${
                      (csvPreview?.rows.length ?? 0) > 1 ? "s" : ""
                    }`}
              </button>
              {csvText ? (
                <button
                  type="button"
                  disabled={importBusy}
                  onClick={() => {
                    setCsvText("");
                    setImportError(null);
                  }}
                  className="btn-ghost text-xs"
                >
                  Vider
                </button>
              ) : null}
            </div>

            {importError ? (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700"
              >
                {importError}
              </p>
            ) : null}

            {importSummary ? (
              <div
                role="status"
                className="mt-3 space-y-2 rounded-2xl border border-brand-200/80 bg-brand-50/80 p-4 text-xs text-brand-900"
              >
                <p className="font-semibold">Bilan de l&apos;import</p>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <Badge tone="green">{importSummary.imported} ajoutée(s)</Badge>
                  <Badge tone="blue">
                    {importSummary.updated} mise(s) à jour
                  </Badge>
                  <Badge tone="neutral">
                    {importSummary.createdMedicines} nouvelle(s) référence(s)
                    catalogue
                  </Badge>
                  {importSummary.skipped > 0 ? (
                    <Badge tone="amber">
                      {importSummary.skipped} ignorée(s)
                    </Badge>
                  ) : null}
                </div>
                {importSummary.errors.length > 0 ? (
                  <ul className="max-h-32 space-y-1 overflow-y-auto text-[11px] text-amber-800">
                    {importSummary.errors.map((err, idx) => (
                      <li key={`${idx}-${err}`}>• {err}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </Card>
        </div>
      ) : (
        <div role="tabpanel">
          <Card className="rounded-3xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-ink-900">
                  Fiche officine &amp; géolocalisation GPS
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Les modifications sont enregistrées automatiquement. Publiez
                  votre stock une fois vos informations vérifiées.
                </p>
              </div>
              <Badge tone="neutral">
                <IconList className="h-3 w-3" />
                {openingLabel(pharmacy)}
              </Badge>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="pharmacy-name">
                  Nom de l&apos;officine
                </label>
                <input
                  id="pharmacy-name"
                  className="input"
                  value={nameInput}
                  onChange={(event) => {
                    const value = event.target.value;
                    setNameInput(value);
                    if (!value.trim()) {
                      setNameError("Le nom de l'officine est obligatoire.");
                      return;
                    }
                    setNameError(null);
                    updatePharmacy(pharmacy.id, { name: value });
                  }}
                />
              </div>
              <div>
                <label className="label" htmlFor="pharmacy-quartier">
                  Quartier / commune
                </label>
                <input
                  id="pharmacy-quartier"
                  className="input"
                  value={pharmacy.quartier}
                  onChange={(event) =>
                    updatePharmacy(pharmacy.id, {
                      quartier: event.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="pharmacy-phone">
                  Téléphone
                </label>
                <input
                  id="pharmacy-phone"
                  className="input"
                  value={pharmacy.phone}
                  onChange={(event) =>
                    updatePharmacy(pharmacy.id, { phone: event.target.value })
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="pharmacy-whatsapp">
                  WhatsApp
                </label>
                <input
                  id="pharmacy-whatsapp"
                  className="input"
                  value={pharmacy.whatsapp}
                  onChange={(event) =>
                    updatePharmacy(pharmacy.id, {
                      whatsapp: event.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="pharmacy-address">
                  Adresse
                </label>
                <input
                  id="pharmacy-address"
                  className="input"
                  value={pharmacy.address}
                  onChange={(event) =>
                    updatePharmacy(pharmacy.id, { address: event.target.value })
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="pharmacy-open-from">
                  Ouverture (0–23 h)
                </label>
                <input
                  id="pharmacy-open-from"
                  type="number"
                  min={0}
                  max={23}
                  step={1}
                  className="input"
                  value={openFromInput}
                  onChange={(event) =>
                    handleHoursChange(event.target.value, openToInput)
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="pharmacy-open-to">
                  Fermeture (1–24 h)
                </label>
                <input
                  id="pharmacy-open-to"
                  type="number"
                  min={1}
                  max={24}
                  step={1}
                  className="input"
                  value={openToInput}
                  onChange={(event) =>
                    handleHoursChange(openFromInput, event.target.value)
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="pharmacy-license">
                  N° d&apos;agrément ONP / DPML
                </label>
                <input
                  id="pharmacy-license"
                  className="input font-mono text-xs"
                  placeholder="CI-ONP-2026-0001"
                  maxLength={60}
                  value={pharmacy.licenseNumber}
                  onChange={(event) =>
                    updatePharmacy(pharmacy.id, {
                      licenseNumber: event.target.value,
                    })
                  }
                />
              </div>
              <div className="sm:col-span-2 xl:col-span-3">
                <label className="label" htmlFor="pharmacy-duty-note">
                  Note de garde (optionnel)
                </label>
                <input
                  id="pharmacy-duty-note"
                  className="input"
                  placeholder="Ex. Garde permanente de nuit · sonnette côté avenue"
                  maxLength={160}
                  value={pharmacy.dutyNote}
                  onChange={(event) =>
                    updatePharmacy(pharmacy.id, {
                      dutyNote: event.target.value,
                    })
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="pharmacy-lat">
                  Latitude GPS
                </label>
                <input
                  id="pharmacy-lat"
                  type="number"
                  step="any"
                  min={-90}
                  max={90}
                  className="input font-mono text-xs"
                  value={latInput}
                  onChange={(event) =>
                    handleCoordsChange(event.target.value, lngInput)
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="pharmacy-lng">
                  Longitude GPS
                </label>
                <input
                  id="pharmacy-lng"
                  type="number"
                  step="any"
                  min={-180}
                  max={180}
                  className="input font-mono text-xs"
                  value={lngInput}
                  onChange={(event) =>
                    handleCoordsChange(latInput, event.target.value)
                  }
                />
              </div>
              <div className="flex items-end sm:col-span-2">
                <button
                  type="button"
                  disabled={gpsBusy}
                  onClick={captureGpsPosition}
                  className="btn-secondary w-full text-xs sm:w-auto"
                  title="Renseigner les coordonnées GPS actuelles"
                >
                  <IconCrosshair className="h-4 w-4" />
                  {gpsBusy ? "Localisation GPS…" : "Ma position actuelle"}
                </button>
              </div>
            </div>

            {nameError || hoursError || coordsError ? (
              <p
                role="alert"
                className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700"
              >
                {nameError ?? hoursError ?? coordsError}
              </p>
            ) : null}
          </Card>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
        <IconShield className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
        <p>
          Le stock et les prix affichés sont purement déclaratifs. Kéné
          n&apos;appartient pas au corps médical, ne vend pas de médicaments et
          ne prend aucune réservation : l&apos;outil informe et oriente
          directement les patients vers votre officine.
        </p>
      </div>
    </div>
  );
}
