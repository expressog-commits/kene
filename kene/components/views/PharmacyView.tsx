"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useStore } from "../store";
import { Badge, Toggle, cn } from "../ui";
import {
  IconAlert,
  IconCheck,
  IconClock,
  IconCrosshair,
  IconDownload,
  IconLogout,
  IconMinus,
  IconPlus,
  IconSearch,
  IconShield,
  IconTrash,
  IconUpload,
} from "../icons";
import { parseStockCsv, STOCK_CSV_TEMPLATE } from "@/lib/csv";
import { CATEGORIES, LEVEL_META, openingLabel, pharmacyOverview, stockLevel } from "@/lib/engine";
import { timeAgo } from "@/lib/format";
import { mapsDirectionsLink } from "@/lib/geo";
import type { BulkImportSummary } from "@/lib/types";

type PharmacyTab = "stock" | "add" | "profile";

const OPEN_FROM_HOURS = Array.from({ length: 24 }, (_, i) => i);
const OPEN_TO_HOURS = Array.from({ length: 24 }, (_, i) => i + 1);
const CARD = "rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-slate-200/75";
const STEP_BTN = "inline-flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40";
const NUM_INPUT = "h-11 min-h-[44px] rounded-xl border border-slate-200 bg-white text-[15px] font-bold tabular-nums text-slate-900 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100";
const ERR_BOX = "rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-800";

const normalizeText = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export default function PharmacyView() {
  const {
    state, session, updatePharmacy, updateStock, addStockMedicine,
    bulkImportStock, removeStockItem, publishStock, toggleDuty, signOut, notify,
  } = useStore();

  const pharmacyId = session?.type === "pharmacy" ? session.establishmentId : "";
  const pharmacy = state.pharmacies.find((item) => item.id === pharmacyId);

  const [activeTab, setActiveTab] = useState<PharmacyTab>("stock");
  const [stockFilter, setStockFilter] = useState<"tous" | "alerte">("tous");
  const [query, setQuery] = useState("");
  const [dutyNoteInput, setDutyNoteInput] = useState(() => pharmacy?.dutyNote ?? "");
  const [nameInput, setNameInput] = useState(() => pharmacy?.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [openFromInput, setOpenFromInput] = useState(() => String(pharmacy?.openFrom ?? 8));
  const [openToInput, setOpenToInput] = useState(() => String(pharmacy?.openTo ?? 20));
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [latInput, setLatInput] = useState(() => String(pharmacy?.latitude ?? 5.3484));
  const [lngInput, setLngInput] = useState(() => String(pharmacy?.longitude ?? -4.0124));
  const [coordsError, setCoordsError] = useState<string | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [manualGpsOpen, setManualGpsOpen] = useState(false);

  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<BulkImportSummary | null>(null);

  const [addMode, setAddMode] = useState<"catalog" | "custom">("catalog");
  const [selectedMedicineId, setSelectedMedicineId] = useState("");
  const [customMed, setCustomMed] = useState({ name: "", dci: "", form: "", category: String(CATEGORIES[0]) });
  const [addPrice, setAddPrice] = useState("1500");
  const [addQuantity, setAddQuantity] = useState("10");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => { if (pharmacy) setDutyNoteInput(pharmacy.dutyNote); }, [pharmacy?.id, pharmacy?.dutyNote]);
  useEffect(() => { if (pharmacy) { setNameInput(pharmacy.name); setNameError(null); } }, [pharmacy?.id, pharmacy?.name]);
  useEffect(() => {
    if (pharmacy) { setOpenFromInput(String(pharmacy.openFrom)); setOpenToInput(String(pharmacy.openTo)); setHoursError(null); }
  }, [pharmacy?.id, pharmacy?.openFrom, pharmacy?.openTo]);
  useEffect(() => {
    if (pharmacy) { setLatInput(String(pharmacy.latitude)); setLngInput(String(pharmacy.longitude)); setCoordsError(null); }
  }, [pharmacy?.id, pharmacy?.latitude, pharmacy?.longitude]);

  const csvPreview = useMemo(() => (csvText.trim() ? parseStockCsv(csvText) : null), [csvText]);
  const overview = useMemo(() => pharmacyOverview(state, pharmacyId), [state, pharmacyId]);
  const pharmacyStockIds = useMemo(
    () => new Set(state.stock.filter((i) => i.pharmacyId === pharmacyId).map((i) => i.medicineId)),
    [state.stock, pharmacyId],
  );
  const availableCatalog = useMemo(
    () => state.medicines.filter((m) => !pharmacyStockIds.has(m.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [state.medicines, pharmacyStockIds],
  );
  const effectiveMedicine = availableCatalog.find((m) => m.id === selectedMedicineId) ?? availableCatalog[0] ?? null;

  useEffect(() => {
    if (addMode === "catalog" && effectiveMedicine) setAddPrice(String(effectiveMedicine.basePrice));
  }, [addMode, effectiveMedicine]);

  const stockRows = useMemo(() => {
    const term = normalizeText(query.trim());
    const weight = { out: 0, low: 1, available: 2 };
    return state.stock
      .filter((item) => item.pharmacyId === pharmacyId)
      .map((item) => ({ item, medicine: state.medicines.find((m) => m.id === item.medicineId), level: stockLevel(item) }))
      .filter((e): e is { item: (typeof state.stock)[number]; medicine: (typeof state.medicines)[number]; level: ReturnType<typeof stockLevel> } => Boolean(e.medicine))
      .filter(({ medicine, level }) => {
        if (stockFilter === "alerte" && level === "available") return false;
        return !term || normalizeText(`${medicine.name} ${medicine.dci} ${medicine.category}`).includes(term);
      })
      .sort((a, b) => weight[a.level] - weight[b.level] || a.medicine.name.localeCompare(b.medicine.name));
  }, [state.stock, state.medicines, pharmacyId, query, stockFilter]);

  if (!session || session.type !== "pharmacy" || !pharmacy) return null;

  const alertCount = overview.ruptures.length + overview.lowStock.length;
  const hasProfileErrors = Boolean(nameError || hoursError || coordsError);

  const saveDutyNote = (showToast = false) => {
    const clean = dutyNoteInput.trim();
    if (clean !== pharmacy.dutyNote) updatePharmacy(pharmacy.id, { dutyNote: clean });
    if (showToast) notify("Note de garde enregistrée.");
  };

  const handleHoursChange = (nextFromRaw: string, nextToRaw: string) => {
    setOpenFromInput(nextFromRaw);
    setOpenToInput(nextToRaw);
    const from = Number(nextFromRaw);
    const to = Number(nextToRaw);
    if (!Number.isInteger(from) || from < 0 || from > 23) return setHoursError("L'heure d'ouverture doit être entre 0 h et 23 h.");
    if (!Number.isInteger(to) || to < 1 || to > 24) return setHoursError("L'heure de fermeture doit être entre 1 h et 24 h.");
    if (to <= from) return setHoursError("L'heure de fermeture doit être supérieure à l'heure d'ouverture.");
    setHoursError(null);
    updatePharmacy(pharmacy.id, { openFrom: from, openTo: to });
  };

  const handleCoordsChange = (nextLatRaw: string, nextLngRaw: string) => {
    setLatInput(nextLatRaw);
    setLngInput(nextLngRaw);
    if (!nextLatRaw.trim() || !nextLngRaw.trim()) return setCoordsError("Indiquez la latitude et la longitude GPS.");
    const lat = Number(nextLatRaw);
    const lng = Number(nextLngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return setCoordsError("Coordonnées GPS invalides (latitude -90 à 90, longitude -180 à 180).");
    }
    setCoordsError(null);
    updatePharmacy(pharmacy.id, { latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) });
  };

  const captureGpsPosition = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      const msg = "La géolocalisation n'est pas supportée par ce navigateur.";
      setCoordsError(msg);
      return notify(msg);
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
        setCoordsError("Impossible de récupérer votre position GPS. Vérifiez l'autorisation du navigateur.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const downloadCsvTemplate = () => {
    const url = URL.createObjectURL(new Blob([STOCK_CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "modele-stock-kene.csv" });
    document.body.appendChild(a);
    a.click();
    a.remove();
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
      return notify(message);
    }
    const summary = result.summary ?? null;
    setImportSummary(summary);
    if (summary) {
      notify(`Import terminé : ${summary.imported} ajoutée(s), ${summary.updated} mise(s) à jour.`);
      if (summary.skipped === 0 && summary.errors.length === 0) setCsvText("");
    } else notify("Stock importé.");
  };

  const handleAddMedicine = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (addBusy) return;
    setAddError(null);
    const parsedPrice = Number(addPrice);
    const parsedQuantity = Number(addQuantity);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || parsedPrice > 1_000_000) return setAddError("Indiquez un prix valide en FCFA (0 à 1 000 000).");
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0 || parsedQuantity > 99_999) return setAddError("Indiquez une quantité valide (0 à 99 999).");
    const price = Math.round(parsedPrice);
    const quantity = Math.round(parsedQuantity);

    if (addMode === "catalog") {
      if (!effectiveMedicine) return setAddError("Toutes les références du catalogue sont déjà dans votre stock.");
      setAddBusy(true);
      const res = await addStockMedicine(pharmacy.id, { medicineId: effectiveMedicine.id, price, quantity });
      setAddBusy(false);
      if (!res.ok) return setAddError(res.error ?? "Impossible d'ajouter ce médicament.");
      notify(`${effectiveMedicine.name} ajouté à votre stock.`);
      setSelectedMedicineId("");
      setAddPrice("1500");
      return setAddQuantity("10");
    }

    const name = customMed.name.trim();
    const dci = customMed.dci.trim();
    const form = customMed.form.trim();
    if (!name || !dci || !form) return setAddError("Renseignez le nom, la DCI et la forme du médicament.");
    setAddBusy(true);
    const res = await addStockMedicine(pharmacy.id, { name, dci, form, category: customMed.category, price, quantity });
    setAddBusy(false);
    if (!res.ok) return setAddError(res.error ?? "Impossible de créer cette référence.");
    notify(`${name} ajouté au catalogue et à votre stock.`);
    setCustomMed({ name: "", dci: "", form: "", category: String(CATEGORIES[0]) });
    setAddPrice("1500");
    setAddQuantity("10");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-8">
      <section className={cn(CARD, "p-4 sm:p-5")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-bold text-slate-900 sm:text-xl">{pharmacy.name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-slate-600">
              <span>{pharmacy.quartier} · {openingLabel(pharmacy)}</span>
              <a
                href={mapsDirectionsLink(pharmacy, null)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center font-semibold text-brand-700 transition hover:text-brand-800 hover:underline"
              >
                Voir sur Google Maps ↗
              </a>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            <IconClock className="h-3.5 w-3.5 text-slate-500" />
            {overview.lastUpdatedAt ? timeAgo(overview.lastUpdatedAt) : "Non publié"}
          </span>
        </div>

        <div className={cn("mt-4 rounded-2xl border p-3.5 transition", pharmacy.onDuty ? "border-brand-300 bg-brand-50/75" : "border-slate-200 bg-slate-50/80")}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-slate-900">Pharmacie de garde 24h/24</p>
              <p className="text-xs text-slate-600">
                {pharmacy.onDuty ? "Visible en priorité jour et nuit par les patients" : "Activez lorsque votre officine assure la garde"}
              </p>
            </div>
            <Toggle
              checked={pharmacy.onDuty}
              label="Pharmacie de garde 24h/24"
              onChange={() => {
                toggleDuty(pharmacy.id);
                notify(pharmacy.onDuty ? "Vous n'êtes plus signalée de garde." : "Vous apparaissez maintenant de garde, 24 h/24.");
              }}
            />
          </div>
          {pharmacy.onDuty ? (
            <div className="mt-3 border-t border-brand-200/70 pt-3">
              <label htmlFor="inline-duty-note" className="mb-1 block text-xs font-semibold text-brand-900">Note de garde (optionnel)</label>
              <div className="flex gap-2">
                <input
                  id="inline-duty-note"
                  type="text"
                  maxLength={160}
                  value={dutyNoteInput}
                  onChange={(e) => setDutyNoteInput(e.target.value)}
                  onBlur={() => saveDutyNote(false)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveDutyNote(true); } }}
                  placeholder="Ex. Sonnette côté avenue, nuit complète…"
                  className="h-11 min-w-0 flex-1 rounded-xl border border-brand-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                <button type="button" onClick={() => saveDutyNote(true)} className="h-11 shrink-0 rounded-xl bg-white px-3.5 text-sm font-semibold text-brand-800 ring-1 ring-inset ring-brand-300 transition hover:bg-brand-50">Enregistrer</button>
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => {
            if (pharmacy.onDuty) saveDutyNote(false);
            publishStock(pharmacy.id);
            notify("Stock publié — vos disponibilités sont actualisées pour les patients.");
          }}
          className="btn-primary mt-3 h-12 w-full rounded-xl text-[15px]"
        >
          <IconCheck className="h-4 w-4" />
          Publier mon stock
        </button>

        {alertCount > 0 ? (
          <button
            type="button"
            onClick={() => { setActiveTab("stock"); setStockFilter("alerte"); }}
            className="mt-3 flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-left text-sm text-amber-950 transition hover:bg-amber-100/75"
          >
            <span className="flex items-center gap-2.5 font-medium">
              <IconAlert className="h-4 w-4 shrink-0 text-amber-700" />
              <span><strong className="font-bold tabular-nums">{alertCount}</strong> référence{alertCount > 1 ? "s" : ""} à vérifier (rupture ou faible)</span>
            </span>
            <span className="shrink-0 font-bold text-amber-900">À vérifier</span>
          </button>
        ) : null}
      </section>

      <div role="tablist" aria-label="Sections de l'espace pharmacie" className={cn(CARD, "grid grid-cols-3 gap-1.5 p-1.5")}>
        {([
          { key: "stock", label: `Mon stock (${overview.items})` },
          { key: "add", label: "+ Ajouter" },
          { key: "profile", label: "Ma fiche", hasAlert: hasProfileErrors },
        ] as Array<{ key: PharmacyTab; label: string; hasAlert?: boolean }>).map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-center text-[13px] font-semibold transition sm:px-3 sm:text-[15px]",
              activeTab === tab.key ? "bg-brand-700 text-white shadow-sm" : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            <span className="truncate">{tab.label}</span>
            {tab.hasAlert ? <span aria-label="Erreur de saisie" className="h-2 w-2 shrink-0 rounded-full bg-rose-500" /> : null}
          </button>
        ))}
      </div>

      {activeTab === "stock" ? (
        <div role="tabpanel" className="space-y-3">
          <div className="space-y-2.5">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input aria-label="Rechercher un médicament dans le stock" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un médicament, DCI…" className="input h-12 rounded-2xl border-slate-200 bg-white pl-10 text-[15px] shadow-[0_1px_2px_rgba(15,23,42,0.03)]" />
            </div>
            <div role="group" aria-label="Filtrer par état du stock" className="flex items-center gap-2">
              {([
                ["tous", "Tous", "bg-slate-900 text-white"],
                ["alerte", `À vérifier (${alertCount})`, "bg-amber-600 text-white"],
              ] as const).map(([key, label, activeCls]) => (
                <button key={key} type="button" aria-pressed={stockFilter === key} onClick={() => setStockFilter(key)} className={cn("min-h-[40px] rounded-full px-4 text-sm font-semibold transition", stockFilter === key ? activeCls : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50")}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {stockRows.length === 0 ? (
            <div className={cn(CARD, "px-5 py-10 text-center")}>
              <p className="text-[15px] text-slate-600">{overview.items === 0 ? "Votre stock est vide pour le moment." : "Aucun médicament ne correspond à votre filtre."}</p>
              {query.trim() || stockFilter !== "tous" ? (
                <button type="button" onClick={() => { setQuery(""); setStockFilter("tous"); }} className="btn-secondary mt-4 h-11 rounded-xl px-4 text-sm">Afficher tout le stock</button>
              ) : (
                <button type="button" onClick={() => setActiveTab("add")} className="btn-primary mt-4 h-11 rounded-xl px-4 text-sm"><IconPlus className="h-4 w-4" />Ajouter un médicament</button>
              )}
            </div>
          ) : (
            <ul className={cn(CARD, "divide-y divide-slate-100 overflow-hidden")}>
              {stockRows.map(({ item, medicine, level }) => {
                const meta = LEVEL_META[level];
                const isOut = item.quantity === 0;
                return (
                  <li key={item.medicineId} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-bold text-slate-900">{medicine.name}</p>
                        <p className="mt-0.5 truncate text-sm text-slate-500">{medicine.form}</p>
                      </div>
                      <Badge tone={meta.tone} className="shrink-0">{meta.label}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-1.5">
                        <button type="button" disabled={item.quantity <= 0} onClick={() => updateStock(pharmacy.id, item.medicineId, { quantity: Math.max(0, item.quantity - 1) }, true)} aria-label={`Retirer une unité de ${medicine.name}`} className={STEP_BTN}><IconMinus className="h-4 w-4" /></button>
                        <input type="number" aria-label={`Quantité de ${medicine.name}`} min={0} value={item.quantity} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) updateStock(pharmacy.id, item.medicineId, { quantity: Math.max(0, v) }); }} className={cn(NUM_INPUT, "w-16 px-2 text-center")} />
                        <button type="button" onClick={() => updateStock(pharmacy.id, item.medicineId, { quantity: item.quantity + 1 }, true)} aria-label={`Ajouter une unité de ${medicine.name}`} className={STEP_BTN}><IconPlus className="h-4 w-4" /></button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input type="number" aria-label={`Prix en FCFA de ${medicine.name}`} min={0} step={100} value={item.price} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) updateStock(pharmacy.id, item.medicineId, { price: Math.max(0, v) }); }} className={cn(NUM_INPUT, "w-24 px-2.5 text-right")} />
                        <span className="text-xs font-semibold text-slate-500">FCFA</span>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { updateStock(pharmacy.id, item.medicineId, { quantity: isOut ? 10 : 0 }, true); notify(isOut ? `${medicine.name} remis en stock.` : `${medicine.name} mis en rupture.`); }}
                        className={cn("min-h-[44px] flex-1 rounded-xl border px-3.5 text-sm font-semibold transition", isOut ? "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100" : "border-rose-200 bg-rose-50/70 text-rose-800 hover:bg-rose-100")}
                      >
                        {isOut ? "Remettre en stock" : "Mettre en rupture"}
                      </button>
                      <button type="button" aria-label={`Retirer ${medicine.name}`} onClick={() => { removeStockItem(pharmacy.id, item.medicineId); notify(`${medicine.name} retiré de votre stock.`); }} className="inline-flex h-11 min-h-[44px] w-11 min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700">
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : activeTab === "add" ? (
        <div role="tabpanel" className="space-y-4">
          <section className={cn(CARD, "p-4 sm:p-5")}>
            <h2 className="font-display text-lg font-bold text-slate-900">Ajouter au stock</h2>
            <p className="mt-0.5 text-sm text-slate-600">Choisissez dans le catalogue ou créez une nouvelle fiche.</p>

            <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-100 p-1">
              {([["catalog", "Catalogue"], ["custom", "Créer un nouveau médicament"]] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={addMode === mode}
                  onClick={() => { setAddMode(mode); setAddError(null); if (mode === "catalog" && effectiveMedicine) setAddPrice(String(effectiveMedicine.basePrice)); }}
                  className={cn("min-h-[42px] rounded-lg px-2.5 text-xs font-semibold transition sm:text-sm", addMode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={handleAddMedicine} className="mt-4 space-y-3.5">
              {addMode === "catalog" ? (
                availableCatalog.length > 0 ? (
                  <Field id="catalog-medicine" label="Médicament">
                    <select
                      id="catalog-medicine"
                      className="input h-12 text-[15px]"
                      value={effectiveMedicine?.id ?? ""}
                      onChange={(e) => {
                        setSelectedMedicineId(e.target.value);
                        setAddError(null);
                        const chosen = availableCatalog.find((item) => item.id === e.target.value);
                        if (chosen) setAddPrice(String(chosen.basePrice));
                      }}
                    >
                      {availableCatalog.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.form}</option>)}
                    </select>
                  </Field>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
                    <p className="text-sm text-slate-600">Toutes les références du catalogue sont déjà dans votre stock.</p>
                    <button type="button" onClick={() => { setAddMode("custom"); setAddError(null); }} className="btn-secondary mt-3 h-11 px-4 text-sm">Créer un nouveau médicament</button>
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  {([
                    ["custom-med-name", "Nom du médicament", "name", "Ex. Doliprane 1000 mg"],
                    ["custom-med-dci", "DCI (molécule)", "dci", "Ex. Paracétamol"],
                    ["custom-med-form", "Forme", "form", "Ex. Boîte de 8 comprimés"],
                  ] as const).map(([id, label, key, placeholder]) => (
                    <Field key={key} id={id} label={label}>
                      <input id={id} className="input h-12 text-[15px]" placeholder={placeholder} value={customMed[key]} onChange={(e) => { setCustomMed((p) => ({ ...p, [key]: e.target.value })); setAddError(null); }} />
                    </Field>
                  ))}
                  <Field id="custom-med-category" label="Catégorie">
                    <select id="custom-med-category" className="input h-12 text-[15px]" value={customMed.category} onChange={(e) => { setCustomMed((p) => ({ ...p, category: e.target.value })); setAddError(null); }}>
                      {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </Field>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field id="add-med-price" label="Prix (FCFA)">
                  <input id="add-med-price" type="number" min={0} max={1000000} step={50} className="input h-12 text-[15px] tabular-nums" value={addPrice} onChange={(e) => { setAddPrice(e.target.value); setAddError(null); }} />
                </Field>
                <Field id="add-med-qty" label="Quantité">
                  <input id="add-med-qty" type="number" min={0} max={99999} className="input h-12 text-[15px] tabular-nums" value={addQuantity} onChange={(e) => { setAddQuantity(e.target.value); setAddError(null); }} />
                </Field>
              </div>

              {addError ? <p role="alert" className={ERR_BOX}>{addError}</p> : null}

              <button type="submit" disabled={addBusy} className="btn-primary h-12 w-full rounded-xl text-[15px]">
                <IconPlus className="h-4 w-4" />
                {addBusy ? "Ajout en cours…" : "Ajouter au stock"}
              </button>
            </form>
          </section>

          <section className={cn(CARD, "overflow-hidden")}>
            <button type="button" aria-expanded={csvOpen} onClick={() => setCsvOpen((prev) => !prev)} className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 sm:px-5">
              <span className="flex items-center gap-3">
                <IconUpload className="h-5 w-5 shrink-0 text-brand-700" />
                <span>
                  <span className="block text-[15px] font-bold text-slate-900">Importer un fichier Excel / CSV</span>
                  <span className="block text-xs text-slate-500">Mise à jour en masse jusqu&apos;à 200 lignes</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-slate-500">
                {csvPreview?.rows.length ? <Badge tone="green">{csvPreview.rows.length}</Badge> : null}
                {csvOpen ? <IconMinus className="h-4 w-4" /> : <IconPlus className="h-4 w-4" />}
              </span>
            </button>

            {csvOpen ? (
              <div className="space-y-4 border-t border-slate-100 p-4 sm:p-5">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={downloadCsvTemplate} className="btn-secondary h-11 flex-1 px-3.5 text-sm"><IconDownload className="h-4 w-4" />Modèle CSV</button>
                  <label className="btn-secondary h-11 flex-1 cursor-pointer px-3.5 text-sm">
                    <IconUpload className="h-4 w-4" />Charger un fichier
                    <input type="file" accept=".csv,.txt" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { setCsvText(await f.text()); setImportError(null); setImportSummary(null); } }} />
                  </label>
                </div>

                <Field id="bulk-csv-input" label="Contenu CSV (; , ou tabulation)">
                  <textarea id="bulk-csv-input" rows={5} className="input scroll-thin min-h-[140px] font-mono text-xs leading-relaxed sm:text-sm" placeholder={STOCK_CSV_TEMPLATE} value={csvText} onChange={(e) => { setCsvText(e.target.value); setImportError(null); setImportSummary(null); }} />
                </Field>

                {csvPreview ? (
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{csvPreview.rows.length} ligne{csvPreview.rows.length > 1 ? "s" : ""} prête{csvPreview.rows.length > 1 ? "s" : ""}</span>
                      <Badge tone={csvPreview.errors.length > 0 ? "amber" : "green"}>{csvPreview.errors.length > 0 ? `${csvPreview.errors.length} erreur(s)` : "Format valide"}</Badge>
                    </div>
                    {csvPreview.errors.length > 0 ? (
                      <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-amber-900">{csvPreview.errors.map((err) => <li key={err}>• {err}</li>)}</ul>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={importBusy || !csvPreview || csvPreview.rows.length === 0} onClick={handleBulkImport} className="btn-primary h-12 flex-1 rounded-xl text-[15px]">
                    <IconUpload className="h-4 w-4" />
                    {importBusy ? "Import en cours…" : `Importer ${csvPreview?.rows.length ?? 0} référence${(csvPreview?.rows.length ?? 0) > 1 ? "s" : ""}`}
                  </button>
                  {csvText ? <button type="button" disabled={importBusy} onClick={() => { setCsvText(""); setImportError(null); }} className="btn-ghost h-12 px-4 text-sm">Vider</button> : null}
                </div>

                {importError ? <p role="alert" className={ERR_BOX}>{importError}</p> : null}

                {importSummary ? (
                  <div role="status" className="space-y-2 rounded-xl border border-brand-200 bg-brand-50/80 p-3.5 text-sm text-brand-950">
                    <p className="font-bold">Bilan de l&apos;import</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone="green">{importSummary.imported} ajoutée(s)</Badge>
                      <Badge tone="blue">{importSummary.updated} mise(s) à jour</Badge>
                      <Badge tone="neutral">{importSummary.createdMedicines} créée(s)</Badge>
                      {importSummary.skipped > 0 ? <Badge tone="amber">{importSummary.skipped} ignorée(s)</Badge> : null}
                    </div>
                    {importSummary.errors.length > 0 ? (
                      <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-amber-900">{importSummary.errors.map((err, idx) => <li key={`${idx}-${err}`}>• {err}</li>)}</ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      ) : (
        <div role="tabpanel" className="space-y-4">
          <div className={cn(CARD, "divide-y divide-slate-100 overflow-hidden")}>
            <div className="space-y-3.5 p-4 sm:p-5">
              <h2 className="font-display text-base font-bold text-slate-900">Informations de l&apos;officine</h2>
              <Field id="pharmacy-name" label="Nom de l'officine">
                <input
                  id="pharmacy-name"
                  className="input h-12 text-[15px]"
                  value={nameInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNameInput(value);
                    if (!value.trim()) return setNameError("Le nom de l'officine est obligatoire.");
                    setNameError(null);
                    updatePharmacy(pharmacy.id, { name: value });
                  }}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                {([
                  ["pharmacy-phone", "Téléphone", "phone"],
                  ["pharmacy-whatsapp", "WhatsApp", "whatsapp"],
                  ["pharmacy-quartier", "Quartier / commune", "quartier"],
                  ["pharmacy-address", "Adresse", "address"],
                ] as const).map(([id, label, key]) => (
                  <Field key={key} id={id} label={label}>
                    <input id={id} className="input h-12 text-[15px]" value={pharmacy[key]} onChange={(e) => updatePharmacy(pharmacy.id, { [key]: e.target.value })} />
                  </Field>
                ))}
              </div>
            </div>

            <div className="space-y-3.5 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-slate-900">Horaires d&apos;ouverture</h2>
                <button
                  type="button"
                  onClick={() => { handleHoursChange("0", "24"); notify("Horaires définis sur Ouvert 24h/24."); }}
                  className={cn("min-h-[38px] rounded-full px-3.5 text-xs font-semibold transition", pharmacy.openFrom === 0 && pharmacy.openTo === 24 ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200 hover:bg-brand-100")}
                >
                  Ouvert 24h/24
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field id="pharmacy-open-from" label="Ouverture">
                  <select id="pharmacy-open-from" className="input h-12 py-2.5 text-[15px] leading-snug" value={openFromInput} onChange={(e) => handleHoursChange(e.target.value, openToInput)}>
                    {OPEN_FROM_HOURS.map((h) => <option key={h} value={String(h)}>{h}h</option>)}
                  </select>
                </Field>
                <Field id="pharmacy-open-to" label="Fermeture">
                  <select id="pharmacy-open-to" className="input h-12 py-2.5 text-[15px] leading-snug" value={openToInput} onChange={(e) => handleHoursChange(openFromInput, e.target.value)}>
                    {OPEN_TO_HOURS.map((h) => <option key={h} value={String(h)}>{h}h</option>)}
                  </select>
                </Field>
              </div>
            </div>

            <div className="space-y-3 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold text-slate-900">Localisation GPS</h2>
                <span className="font-mono text-xs text-slate-500">{pharmacy.latitude.toFixed(4)}, {pharmacy.longitude.toFixed(4)}</span>
              </div>
              <button type="button" disabled={gpsBusy} onClick={captureGpsPosition} className="btn-secondary h-12 w-full rounded-xl text-[15px]">
                <IconCrosshair className="h-4 w-4 text-brand-700" />
                {gpsBusy ? "Localisation en cours…" : "Enregistrer ma position GPS actuelle"}
              </button>
              <div>
                <button type="button" aria-expanded={manualGpsOpen} onClick={() => setManualGpsOpen((prev) => !prev)} className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900">
                  {manualGpsOpen ? <IconMinus className="h-3.5 w-3.5" /> : <IconPlus className="h-3.5 w-3.5" />}
                  Coordonnées GPS manuelles
                </button>
                {manualGpsOpen ? (
                  <div className="mt-2.5 grid grid-cols-2 gap-3">
                    <Field id="pharmacy-lat" label="Latitude">
                      <input id="pharmacy-lat" type="number" step="any" min={-90} max={90} className="input h-12 font-mono text-sm" value={latInput} onChange={(e) => handleCoordsChange(e.target.value, lngInput)} />
                    </Field>
                    <Field id="pharmacy-lng" label="Longitude">
                      <input id="pharmacy-lng" type="number" step="any" min={-180} max={180} className="input h-12 font-mono text-sm" value={lngInput} onChange={(e) => handleCoordsChange(latInput, e.target.value)} />
                    </Field>
                  </div>
                ) : null}
              </div>
            </div>

            {nameError || hoursError || coordsError ? (
              <div className="p-4 sm:p-5"><p role="alert" className={ERR_BOX}>{nameError ?? hoursError ?? coordsError}</p></div>
            ) : null}
          </div>

          <button type="button" onClick={() => { void signOut(); notify("Déconnecté de l'espace pharmacie."); }} className={cn(CARD, "flex h-12 w-full items-center justify-center gap-2 border border-rose-200 px-5 text-[15px] font-semibold text-rose-700 ring-0 transition hover:bg-rose-50")}>
            <IconLogout className="h-4 w-4" />
            Se déconnecter
          </button>
        </div>
      )}

      <p className="flex items-start gap-2.5 px-1 text-xs leading-relaxed text-slate-500">
        <IconShield className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
        <span>Stock et prix purement déclaratifs — Kéné oriente les patients vers votre officine sans vente ni réservation en ligne.</span>
      </p>
    </div>
  );
}
