"use client";

import { useMemo, useState } from "react";
import { useStore } from "../store";
import { Badge, Card, cn } from "../ui";
import {
  IconAlert,
  IconCheck,
  IconClock,
  IconLock,
  IconLogout,
  IconMapPin,
  IconPhone,
  IconSearch,
  IconShield,
  IconUserCheck,
} from "../icons";
import { FEATURES } from "@/lib/features";
import { timeAgo } from "@/lib/format";
import type { ActivityItem, VerificationStatus } from "@/lib/types";

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const STATUS_META: Record<
  VerificationStatus,
  { label: string; tone: "green" | "amber" | "red" }
> = {
  verified: { label: "Validée", tone: "green" },
  pending: { label: "En attente", tone: "amber" },
  suspended: { label: "Suspendue", tone: "red" },
};

const ACTIVITY_KIND_META: Record<
  ActivityItem["kind"],
  { label: string; tone: "green" | "amber" | "blue" | "violet" | "neutral" }
> = {
  admin: { label: "Admin", tone: "violet" },
  pharmacy: { label: "Officine", tone: "green" },
  stock: { label: "Stock", tone: "blue" },
  beds: { label: FEATURES.hospitals ? "Urgences" : "Activité", tone: "amber" },
  system: { label: "Système", tone: "neutral" },
};

export default function AdminView() {
  const {
    state,
    session,
    setPharmacyVerification,
    signOut,
    changeAccessCode,
    notify,
  } = useStore();

  const [statusFilter, setStatusFilter] = useState<
    "all" | VerificationStatus
  >(() =>
    state.pharmacies.some(
      (pharmacy) => pharmacy.verificationStatus === "pending",
    )
      ? "pending"
      : "all",
  );
  const [query, setQuery] = useState("");
  const [busyPharmacyId, setBusyPharmacyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [currentCode, setCurrentCode] = useState("");
  const [nextCode, setNextCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSaved, setCodeSaved] = useState(false);
  const [codeBusy, setCodeBusy] = useState(false);

  const counts = useMemo(() => {
    let verified = 0;
    let pending = 0;
    let suspended = 0;
    for (const pharmacy of state.pharmacies) {
      if (pharmacy.verificationStatus === "verified") verified += 1;
      else if (pharmacy.verificationStatus === "pending") pending += 1;
      else suspended += 1;
    }
    return {
      total: state.pharmacies.length,
      verified,
      pending,
      suspended,
    };
  }, [state.pharmacies]);

  const stockStatsByPharmacy = useMemo(() => {
    const map = new Map<string, { total: number; inStock: number }>();
    for (const item of state.stock) {
      const current = map.get(item.pharmacyId) ?? { total: 0, inStock: 0 };
      current.total += 1;
      if (item.quantity > 0) current.inStock += 1;
      map.set(item.pharmacyId, current);
    }
    return map;
  }, [state.stock]);

  const filteredPharmacies = useMemo(() => {
    const term = normalizeText(query.trim());
    const weight: Record<VerificationStatus, number> = {
      pending: 0,
      verified: 1,
      suspended: 2,
    };
    return [...state.pharmacies]
      .filter((pharmacy) => {
        if (
          statusFilter !== "all" &&
          pharmacy.verificationStatus !== statusFilter
        ) {
          return false;
        }
        if (!term) return true;
        return (
          normalizeText(pharmacy.name).includes(term) ||
          normalizeText(pharmacy.quartier).includes(term) ||
          normalizeText(pharmacy.licenseNumber).includes(term)
        );
      })
      .sort((a, b) => {
        const diff =
          weight[a.verificationStatus] - weight[b.verificationStatus];
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      });
  }, [state.pharmacies, statusFilter, query]);

  if (!session || session.type !== "admin") return null;

  const handleVerification = async (
    pharmacyId: string,
    pharmacyName: string,
    nextStatus: VerificationStatus,
  ) => {
    if (busyPharmacyId) return;
    setActionError(null);
    setBusyPharmacyId(pharmacyId);
    const result = await setPharmacyVerification(pharmacyId, nextStatus);
    setBusyPharmacyId(null);
    if (!result.ok) {
      const message =
        result.error ?? "Impossible de modifier le statut de cette officine.";
      setActionError(message);
      notify(message);
      return;
    }
    const label =
      nextStatus === "verified"
        ? "validée et rendue visible aux patients"
        : nextStatus === "pending"
          ? "remise en attente de validation"
          : "suspendue";
    notify(`${pharmacyName} ${label}.`);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <IconUserCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-900">
                Administration et modération Kéné
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Vérifiez les numéros d&apos;agrément ONP / DPML avant
                d&apos;autoriser la publication publique d&apos;une officine.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-[11px] font-medium text-brand-800">
              <IconLock className="h-3.5 w-3.5" />
              {session.managerName}
            </span>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                notify("Déconnecté de l'espace administration.");
              }}
              className="btn-secondary px-3 py-2 text-[11px]"
            >
              <IconLogout className="h-3.5 w-3.5" />
              Quitter
            </button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: "Officines validées",
            value: String(counts.verified),
            sub: "visibles patients",
            tone: "green" as const,
          },
          {
            label: "En attente",
            value: String(counts.pending),
            sub: counts.pending > 0 ? "à vérifier" : "aucune en attente",
            tone: counts.pending > 0 ? ("amber" as const) : ("green" as const),
          },
          {
            label: "Suspendues",
            value: String(counts.suspended),
            sub: "masquées du public",
            tone:
              counts.suspended > 0 ? ("red" as const) : ("neutral" as const),
          },
          {
            label: "Médicaments au catalogue",
            value: String(state.medicines.length),
            sub: "références suivies",
            tone: "neutral" as const,
          },
        ].map((card) => (
          <Card key={card.label} className="p-4 sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {card.label}
            </p>
            <div className="mt-2.5 flex flex-wrap items-end justify-between gap-2">
              <p className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
                {card.value}
              </p>
              <Badge tone={card.tone}>{card.sub}</Badge>
            </div>
          </Card>
        ))}
      </div>

      {counts.pending > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-ink-900 px-4 py-3.5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sun-400/20 text-sun-300">
              <IconAlert className="h-5 w-5" />
            </span>
            <p className="text-xs sm:text-sm">
              <span className="font-semibold">
                {counts.pending} officine{counts.pending > 1 ? "s" : ""} en
                attente
              </span>{" "}
              — invisible{counts.pending > 1 ? "s" : ""} dans la recherche
              patient tant que la vérification n&apos;est pas validée.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className="btn w-full shrink-0 bg-white px-4 py-2 text-xs text-ink-900 hover:bg-slate-100 sm:w-auto"
          >
            Filtrer en attente
          </button>
        </div>
      ) : null}

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">
              Officines inscrites
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Contrôlez le statut de chaque pharmacie sur la plateforme.
            </p>
          </div>
          <span className="text-[11px] text-slate-500">
            {filteredPharmacies.length} affichée
            {filteredPharmacies.length > 1 ? "s" : ""} sur {counts.total}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          <div
            role="group"
            aria-label="Filtrer par statut de validation"
            className="flex flex-wrap items-center gap-1.5"
          >
            {(
              [
                { key: "pending", label: `En attente (${counts.pending})` },
                { key: "all", label: `Toutes (${counts.total})` },
                { key: "verified", label: `Validées (${counts.verified})` },
                { key: "suspended", label: `Suspendues (${counts.suspended})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                aria-pressed={statusFilter === tab.key}
                className={cn(
                  "rounded-lg border px-2.5 py-2 text-[11px] font-medium transition",
                  statusFilter === tab.key
                    ? tab.key === "pending"
                      ? "border-sun-300 bg-sun-50 text-sun-800"
                      : tab.key === "suspended"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-brand-500 bg-brand-50 text-brand-800"
                    : "border-slate-200 text-slate-600 hover:border-slate-300",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:min-w-[220px] sm:flex-1">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              aria-label="Rechercher une officine par nom, commune ou numéro d'agrément"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom, commune ou n° d'agrément…"
              className="input py-2 pl-8 text-xs"
            />
          </div>
        </div>

        {actionError ? (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
          >
            {actionError}
          </p>
        ) : null}

        {filteredPharmacies.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
            <p className="text-xs text-slate-500">
              Aucune officine ne correspond à ce filtre.
            </p>
            {(query.trim() || statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("all");
                }}
                className="btn-secondary mt-3 px-3 py-1.5 text-[11px]"
              >
                Afficher toutes les officines
              </button>
            )}
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {filteredPharmacies.map((pharmacy) => {
              const meta = STATUS_META[pharmacy.verificationStatus];
              const stockCounts = stockStatsByPharmacy.get(pharmacy.id) ?? {
                total: 0,
                inStock: 0,
              };
              const isBusy = busyPharmacyId === pharmacy.id;

              return (
                <li
                  key={pharmacy.id}
                  className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink-900">
                        {pharmacy.name}
                      </p>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {pharmacy.onDuty ? (
                        <Badge tone="blue">De garde 24 h/24</Badge>
                      ) : null}
                    </div>

                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 break-words text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <IconMapPin className="h-3.5 w-3.5 shrink-0" />
                        {pharmacy.quartier} · {pharmacy.address}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <IconPhone className="h-3.5 w-3.5 shrink-0" />
                        {pharmacy.phone}
                      </span>
                    </p>

                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="font-mono font-medium text-ink-900">
                        Agrément : {pharmacy.licenseNumber || "Non renseigné"}
                      </span>
                      <span>
                        {stockCounts.total} référence
                        {stockCounts.total > 1 ? "s" : ""} ({stockCounts.inStock}{" "}
                        en stock)
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <IconClock className="h-3.5 w-3.5" />
                        {pharmacy.updatedAt
                          ? `maj ${timeAgo(pharmacy.updatedAt)}`
                          : "—"}
                      </span>
                    </p>

                    {pharmacy.onDuty && pharmacy.dutyNote ? (
                      <p className="text-[11px] text-brand-700">
                        Garde : {pharmacy.dutyNote}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                    <button
                      type="button"
                      disabled={
                        isBusy || pharmacy.verificationStatus === "verified"
                      }
                      onClick={() =>
                        handleVerification(
                          pharmacy.id,
                          pharmacy.name,
                          "verified",
                        )
                      }
                      className="btn-primary px-3 py-2 text-[11px]"
                    >
                      <IconCheck className="h-3.5 w-3.5" />
                      Valider
                    </button>
                    <button
                      type="button"
                      disabled={
                        isBusy || pharmacy.verificationStatus === "pending"
                      }
                      onClick={() =>
                        handleVerification(
                          pharmacy.id,
                          pharmacy.name,
                          "pending",
                        )
                      }
                      className="btn-secondary px-3 py-2 text-[11px]"
                    >
                      Mettre en attente
                    </button>
                    <button
                      type="button"
                      disabled={
                        isBusy || pharmacy.verificationStatus === "suspended"
                      }
                      onClick={() =>
                        handleVerification(
                          pharmacy.id,
                          pharmacy.name,
                          "suspended",
                        )
                      }
                      className="btn border border-red-200 bg-white px-3 py-2 text-[11px] text-red-600 hover:bg-red-50"
                    >
                      Suspendre
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">
              Journal d&apos;activité récent
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Dernières actions enregistrées en base SQLite / Prisma.
            </p>
          </div>
          <span className="text-[11px] text-slate-500">
            {state.activity.length} entrée{state.activity.length > 1 ? "s" : ""}
          </span>
        </div>

        {state.activity.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500">
            Aucune activité enregistrée pour le moment.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {state.activity.slice(0, 15).map((entry) => {
              const kindMeta = ACTIVITY_KIND_META[entry.kind];
              return (
                <li
                  key={entry.id}
                  className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Badge tone={kindMeta.tone} className="shrink-0">
                      {kindMeta.label}
                    </Badge>
                    <p className="min-w-0 break-words text-xs text-ink-900">
                      {entry.label}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-500">
                    {timeAgo(entry.at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <IconLock className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-900">
                Compte administrateur
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {session.managerName} · {session.role}
              </p>
              <p className="mt-0.5 break-all text-[11px] text-slate-500">
                {session.email} · connecté {timeAgo(session.signedInAt)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              notify("Déconnecté de l'espace administration.");
            }}
            className="btn-secondary w-full whitespace-nowrap text-xs sm:w-auto"
          >
            <IconLogout className="h-4 w-4" />
            Se déconnecter
          </button>
        </div>

        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="admin-current-code">
              Code actuel
            </label>
            <input
              id="admin-current-code"
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
            <label className="label" htmlFor="admin-next-code">
              Nouveau code (6 à 72 caractères)
            </label>
            <input
              id="admin-next-code"
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
              notify("Code d'accès administrateur mis à jour.");
            }}
            className="btn-primary w-full text-xs sm:w-auto"
          >
            <IconCheck className="h-4 w-4" />
            {codeBusy ? "Enregistrement…" : "Changer le code"}
          </button>
        </div>

        {codeError ? (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
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

        <p className="mt-4 flex items-center gap-1.5 text-[10px] leading-relaxed text-slate-500">
          <IconShield className="h-3.5 w-3.5 shrink-0 text-brand-500" />
          Les changements de statut de validation s&apos;appliquent
          immédiatement sur la recherche publique des patients.
        </p>
      </Card>
    </div>
  );
}
