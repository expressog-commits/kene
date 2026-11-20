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
  IconLock,
  IconLogout,
  IconMinus,
  IconPhone,
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
    changeAccessCode,
    notify,
  } = useStore();

  const pharmacyId =
    session?.type === "pharmacy" ? session.establishmentId : "";
  const pharmacy = state.pharmacies.find((item) => item.id === pharmacyId);

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

  const [currentCode, setCurrentCode] = useState("");
  const [nextCode, setNextCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSaved, setCodeSaved] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);

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

  return (
    <div className="space-y-5">
      {pharmacy.verificationStatus === "verified" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-xs text-brand-800">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone="green">
              Officine validée et visible des patients
            </Badge>
            {pharmacy.verifiedAt ? (
              <span className="text-[11px] text-brand-700">
                Validée {timeAgo(pharmacy.verifiedAt)}
              </span>
            ) : null}
          </div>
          {pharmacy.licenseNumber ? (
            <span className="font-mono text-[11px] font-medium text-brand-800">
              Agrément : {pharmacy.licenseNumber}
            </span>
          ) : null}
        </div>
      ) : pharmacy.verificationStatus === "pending" ? (
        <div className="flex items-start gap-3 rounded-2xl border border-sun-200 bg-sun-50 px-4 py-3.5 text-xs text-sun-800">
          <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-sun-600" />
          <div>
            <p className="font-semibold">
              En attente de validation par l&apos;équipe Kéné
            </p>
            <p className="mt-0.5 leading-relaxed">
              Vous pouvez déjà préparer votre stock ; l&apos;officine deviendra
              publique dès validation.
            </p>
          </div>
        </div>
      ) : (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-xs text-red-700"
        >
          <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold">Officine suspendue</p>
            <p className="mt-0.5 leading-relaxed">
              Votre officine est masquée pour les patients — contactez
              l&apos;administration Kéné.
            </p>
          </div>
        </div>
      )}

      <Card className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <IconShield className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">
                {pharmacy.name}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {pharmacy.address} · {pharmacy.quartier}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
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

          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-[11px] font-medium text-brand-800">
                <IconLock className="h-3.5 w-3.5" />
                {session.managerName}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  notify("Déconnecté du back-office pharmacie.");
                }}
                className="btn-secondary px-2.5 py-2 text-[11px]"
              >
                <IconLogout className="h-3.5 w-3.5" />
                Quitter
              </button>
              <button
                type="button"
                onClick={() => {
                  publishStock(pharmacy.id);
                  notify(
                    "Stock confirmé — vos disponibilités sont actualisées pour les patients.",
                  );
                }}
                className="btn-primary whitespace-nowrap text-xs"
              >
                <IconCheck className="h-4 w-4" />
                Confirmer mon stock maintenant
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-medium text-slate-500">
                {pharmacy.onDuty ? "De garde" : "Hors garde"}
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
                label="Pharmacie de garde"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-4">
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
              Quartier
            </label>
            <input
              id="pharmacy-quartier"
              className="input"
              value={pharmacy.quartier}
              onChange={(event) =>
                updatePharmacy(pharmacy.id, { quartier: event.target.value })
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
                updatePharmacy(pharmacy.id, { whatsapp: event.target.value })
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
          <div className="sm:col-span-2">
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
                updatePharmacy(pharmacy.id, { dutyNote: event.target.value })
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
            <div className="flex gap-2">
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
              <button
                type="button"
                disabled={gpsBusy}
                onClick={captureGpsPosition}
                className="btn-secondary shrink-0 px-3 text-xs"
                title="Renseigner les coordonnées actuelles"
              >
                <IconCrosshair className="h-4 w-4" />
                {gpsBusy ? "GPS…" : "Ma position GPS"}
              </button>
            </div>
          </div>
        </div>

        {nameError || hoursError || coordsError ? (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
          >
            {nameError ?? hoursError ?? coordsError}
          </p>
        ) : null}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Références en stock",
            value: String(overview.inStock.length),
            sub: `sur ${overview.items}`,
            tone: overview.inStock.length > 0 ? "green" : "amber",
          },
          {
            label: "Produits en rupture",
            value: String(overview.ruptures.length),
            sub: "indisponibles",
            tone: overview.ruptures.length > 0 ? "red" : "green",
          },
          {
            label: "Stock faible",
            value: String(overview.lowStock.length),
            sub: "5 unités ou moins",
            tone: overview.lowStock.length > 0 ? "amber" : "green",
          },
          {
            label: "Dernière mise à jour",
            value: overview.lastUpdatedAt
              ? timeAgo(overview.lastUpdatedAt)
              : "—",
            sub: "stock déclaré",
            tone: "neutral",
          },
        ].map((card) => (
          <Card key={card.label} className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {card.label}
            </p>
            <div className="mt-3 flex items-end justify-between gap-2">
              <p className="text-2xl font-semibold tracking-tight text-ink-900">
                {card.value}
              </p>
              <Badge
                tone={card.tone as "amber" | "green" | "red" | "neutral"}
              >
                {card.sub}
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      {alertCount > 0 ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-ink-900 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sun-400/20 text-sun-300">
              <IconAlert className="h-5 w-5" />
            </span>
            <p className="text-sm">
              <span className="font-semibold">{alertCount} références</span> à
              réapprovisionner ou vérifier — signalez vos retours en stock dès
              réception.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStockFilter("alerte")}
            className="btn bg-white px-4 py-2 text-xs text-ink-900 hover:bg-slate-100"
          >
            Voir les alertes
          </button>
        </div>
      ) : null}

      <Card className="flex flex-col p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Mon stock</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Modifiez les prix en FCFA et les quantités disponibles en temps
              réel.
            </p>
          </div>
          <span className="text-[11px] text-slate-500">
            {stockRows.length} affichée{stockRows.length > 1 ? "s" : ""} sur{" "}
            {overview.items} références
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
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
                { key: "toutes", label: "Toutes" },
                { key: "alerte", label: "Alertes" },
                { key: "en_stock", label: "En stock" },
              ] as const
            ).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setStockFilter(option.key)}
                aria-pressed={stockFilter === option.key}
                className={cn(
                  "rounded-lg border px-2.5 py-2 text-[11px] font-medium transition",
                  stockFilter === option.key
                    ? option.key === "alerte"
                      ? "border-sun-300 bg-sun-50 text-sun-700"
                      : "border-brand-500 bg-brand-50 text-brand-800"
                    : "border-slate-200 text-slate-500 hover:border-slate-300",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {stockRows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
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
          <div className="scroll-thin mt-3 max-h-[480px] flex-1 overflow-y-auto">
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
                          {medicine.dci} · {medicine.form} · {medicine.category}{" "}
                          · maj {timeAgo(item.updatedAt)}
                        </p>
                      </div>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
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
                          className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right text-[11px] font-medium text-ink-900 focus:border-brand-400 focus:outline-none"
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
                          className="rounded-md border border-slate-200 p-1 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Retirer une unité de ${medicine.name}`}
                        >
                          <IconMinus className="h-3 w-3" />
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
                          className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center text-[11px] font-medium text-ink-900 focus:border-brand-400 focus:outline-none"
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
                          className="rounded-md border border-slate-200 p-1 text-slate-500 transition hover:bg-slate-50"
                          aria-label={`Ajouter une unité de ${medicine.name}`}
                        >
                          <IconPlus className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="ml-auto flex items-center gap-3">
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
                          className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-red-500 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Rupture
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            removeStockItem(pharmacy.id, item.medicineId);
                            notify(`${medicine.name} retiré de votre stock.`);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600"
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
          <IconPhone className="h-3.5 w-3.5" />
          Les patients consultent vos disponibilités et vous contactent
          directement par téléphone ou WhatsApp.
        </p>
      </Card>

      <Card className="p-5">
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
          <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
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
                  "rounded-lg px-3 py-1.5 transition",
                  addMode === tab.key
                    ? "bg-white text-ink-900 shadow-sm"
                    : "text-slate-500 hover:text-ink-900",
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
              <div className="grid gap-3 sm:grid-cols-[1.6fr_0.7fr_0.7fr_auto] sm:items-end">
                <div>
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
                        {medicine.name} — {medicine.form} ({medicine.category})
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
                  className="btn-primary text-xs"
                >
                  <IconPlus className="h-4 w-4" />
                  {addBusy ? "Ajout…" : "Ajouter"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-dashed border-slate-200 px-4 py-4 sm:flex-row sm:items-center">
                <p className="text-xs text-slate-500">
                  Toutes les références du catalogue sont déjà présentes dans
                  votre stock.
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
                <div className="flex gap-2">
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
              className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
            >
              {addError}
            </p>
          ) : null}
        </form>
      </Card>

      <Card className="p-5">
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
            rows={5}
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
          <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
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
            disabled={importBusy || !csvPreview || csvPreview.rows.length === 0}
            onClick={handleBulkImport}
            className="btn-primary text-xs"
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
            className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
          >
            {importError}
          </p>
        ) : null}

        {importSummary ? (
          <div
            role="status"
            className="mt-3 space-y-2 rounded-xl border border-brand-200 bg-brand-50 p-3.5 text-xs text-brand-800"
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
                <Badge tone="amber">{importSummary.skipped} ignorée(s)</Badge>
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

      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <IconLock className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">
                Compte de l&apos;établissement
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {session.managerName} · {session.role}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {session.email} · connecté {timeAgo(session.signedInAt)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              notify("Déconnecté du back-office pharmacie.");
            }}
            className="btn-secondary whitespace-nowrap text-xs"
          >
            <IconLogout className="h-4 w-4" />
            Se déconnecter
          </button>
        </div>

        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="pharmacy-current-code">
              Code actuel
            </label>
            <input
              id="pharmacy-current-code"
              type="password"
              autoComplete="current-password"
              className="input"
              value={currentCode}
              onChange={(event) => {
                setCurrentCode(event.target.value);
                setCodeError(null);
                setCodeSaved(false);
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="pharmacy-next-code">
              Nouveau code (6 à 72 caractères)
            </label>
            <input
              id="pharmacy-next-code"
              type="password"
              autoComplete="new-password"
              className="input"
              value={nextCode}
              onChange={(event) => {
                setNextCode(event.target.value);
                setCodeError(null);
                setCodeSaved(false);
              }}
            />
          </div>
          <button
            type="button"
            disabled={codeBusy}
            onClick={async () => {
              if (codeBusy) return;
              const trimmedNext = nextCode.trim();
              if (trimmedNext.length < 6 || trimmedNext.length > 72) {
                setCodeError(
                  "Le nouveau code doit contenir entre 6 et 72 caractères.",
                );
                setCodeSaved(false);
                return;
              }
              setCodeBusy(true);
              const result = await changeAccessCode(currentCode, nextCode);
              setCodeBusy(false);
              if (!result.ok) {
                setCodeError(result.error ?? "Modification impossible.");
                setCodeSaved(false);
                return;
              }
              setCurrentCode("");
              setNextCode("");
              setCodeError(null);
              setCodeSaved(true);
              notify("Code d'accès mis à jour.");
            }}
            className="btn-primary text-xs"
          >
            <IconCheck className="h-4 w-4" />
            {codeBusy ? "Enregistrement…" : "Changer le code"}
          </button>
        </div>

        {codeError ? (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
          >
            {codeError}
          </p>
        ) : null}
        {codeSaved ? (
          <p
            role="status"
            className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800"
          >
            Code d&apos;accès enregistré. Utilisez-le à la prochaine connexion.
          </p>
        ) : null}

        <p className="mt-4 text-[10px] leading-relaxed text-slate-500">
          Un seul compte par pharmacie. La session est un cookie HttpOnly
          valable 8 heures, vérifié côté serveur à chaque modification.
        </p>
      </Card>

      <div className="flex items-start gap-2 rounded-xl bg-white/60 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
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
