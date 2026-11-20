"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "./store";
import { cn } from "./ui";
import {
  IconBed,
  IconClock,
  IconDownload,
  IconHospital,
  IconLogo,
  IconPharmacy,
  IconPhone,
  IconSearch,
  IconSettings,
  IconShield,
} from "./icons";
import Search from "./views/Search";
import DutyPharmacies from "./views/DutyPharmacies";
import Emergency from "./views/Emergency";
import PharmacyView from "./views/PharmacyView";
import SettingsView from "./views/SettingsView";
import HospitalView from "./views/HospitalView";
import ProfessionalAuth from "./views/ProfessionalAuth";
import {
  dutyPharmacies,
  emergencySummary,
  publicPharmacies,
} from "@/lib/engine";
import { FEATURES } from "@/lib/features";
import { phoneDisplay } from "@/lib/format";

type ViewKey =
  | "search"
  | "duty"
  | "emergency"
  | "pharmacy"
  | "hospital"
  | "settings";

const ALL_VIEWS: ViewKey[] = [
  "search",
  "duty",
  "emergency",
  "pharmacy",
  "hospital",
  "settings",
];

function parseView(raw: string | null): ViewKey {
  if (!raw || !ALL_VIEWS.includes(raw as ViewKey)) return "search";
  const candidate = raw as ViewKey;
  if (!FEATURES.hospitals && (candidate === "emergency" || candidate === "hospital")) {
    return "search";
  }
  return candidate;
}

const HEADERS: Record<ViewKey, { kicker: string; title: string }> = {
  search: { kicker: "Disponibilité", title: "Trouver un médicament" },
  duty: { kicker: "Permanence 24 h/24", title: "Pharmacies de garde" },
  emergency: { kicker: "Urgences", title: "Lits disponibles" },
  pharmacy: { kicker: "Back-office", title: "Espace pharmacie" },
  hospital: { kicker: "Back-office", title: "Espace hôpital" },
  settings: { kicker: "Préférences", title: "Réglages" },
};

export default function Workspace() {
  const {
    state,
    session,
    recoveryCode,
    dismissRecoveryCode,
    saving,
    isOffline,
    cachedAt,
    canInstallPwa,
    installPwa,
    toast,
    notify,
  } = useStore();
  const [view, setView] = useState<ViewKey>("search");
  const [initialQuery, setInitialQuery] = useState("");

  const consumeInitialQuery = useCallback(() => {
    setInitialQuery("");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("q")) {
        url.searchParams.delete("q");
        window.history.replaceState(null, "", url.toString());
      }
    }
  }, []);

  const selectView = useCallback((next: ViewKey) => {
    const target =
      !FEATURES.hospitals && (next === "emergency" || next === "hospital")
        ? "search"
        : next;
    setView(target);
    setInitialQuery("");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", target);
      url.searchParams.delete("q");
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  useEffect(() => {
    const syncFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setView(parseView(params.get("view")));
      setInitialQuery(params.get("q")?.trim() ?? "");
    };
    syncFromUrl();
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  const navItems = useMemo(() => {
    const items: {
      key: ViewKey;
      label: string;
      short: string;
      icon: (props: { className?: string }) => JSX.Element;
    }[] = [
      { key: "search", label: "Trouver un médicament", short: "Trouver", icon: IconSearch },
      { key: "duty", label: "Pharmacies de garde", short: "De garde", icon: IconClock },
    ];
    if (FEATURES.hospitals) {
      items.push({
        key: "emergency",
        label: "Urgences & lits",
        short: "Urgences",
        icon: IconBed,
      });
    }
    items.push({
      key: "pharmacy",
      label: "Espace pharmacie",
      short: "Pharmacie",
      icon: IconPharmacy,
    });
    if (FEATURES.hospitals) {
      items.push({
        key: "hospital",
        label: "Espace hôpital",
        short: "Hôpital",
        icon: IconHospital,
      });
    }
    items.push({
      key: "settings",
      label: "Réglages",
      short: "Réglages",
      icon: IconSettings,
    });
    return items;
  }, []);

  const verifiedPharmacies = useMemo(() => publicPharmacies(state), [state]);
  const dutyList = useMemo(() => dutyPharmacies(state), [state]);
  const beds = useMemo(() => emergencySummary(state), [state]);
  const duty = dutyList[0]?.pharmacy;

  const activeView: ViewKey =
    !FEATURES.hospitals && (view === "emergency" || view === "hospital")
      ? "search"
      : view;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[268px_1fr]">
      <a href="#contenu" className="skip-link">
        Aller au contenu principal
      </a>
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-white/5 bg-ink-900 px-4 py-6 lg:flex">
        <a href="/" className="flex items-center gap-2.5 px-2">
          <IconLogo className="h-9 w-9 text-brand-400" />
          <span className="text-lg font-semibold tracking-tight text-white">Kéné</span>
        </a>
        <p className="mt-1 px-2 text-[11px] text-slate-400">
          {FEATURES.hospitals
            ? `Abidjan · ${verifiedPharmacies.length} pharmacies · ${state.hospitals.length} hôpitaux`
            : `Abidjan · ${verifiedPharmacies.length} pharmacies`}
        </p>

        <nav aria-label="Navigation principale" className="mt-7 space-y-1">
          {navItems.map((item) => {
            const active = activeView === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => selectView(item.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.key === "duty" && dutyList.length > 0 ? (
                  <span className="rounded-md bg-brand-400/20 px-1.5 py-0.5 text-[11px] font-semibold text-brand-200">
                    {dutyList.length}
                  </span>
                ) : null}
                {(item.key === "pharmacy" || item.key === "hospital") &&
                session?.type !== (item.key as string) ? (
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
                    {session ? "Changer" : "Connexion"}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          {duty ? (
            <button
              type="button"
              onClick={() => selectView("duty")}
              className="w-full rounded-xl bg-white/5 p-3.5 text-left transition hover:bg-white/10"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                De garde maintenant ({dutyList.length})
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{duty.name}</p>
              <p className="text-[11px] text-slate-400">
                {duty.quartier} · {phoneDisplay(duty.phone)}
              </p>
            </button>
          ) : null}

          <div className="rounded-xl border border-white/10 p-3.5">
            <div className="flex items-start gap-2">
              <IconShield className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
              <p className="text-[11px] leading-relaxed text-slate-300">
                Outil d&apos;information uniquement : pas de vente ni de réservation
                médicale.
              </p>
            </div>
          </div>

          <a
            href="tel:185"
            className="flex items-center gap-2.5 rounded-xl bg-red-500/15 px-3.5 py-3 text-white transition hover:bg-red-500/25"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white">
              <IconPhone className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white">Urgence vitale · SAMU 185</p>
              <p className="text-[11px] text-slate-300">Appel direct 24 h/24</p>
            </div>
          </a>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-sand/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="flex items-center gap-3">
              <a href="/" aria-label="Kéné — Accueil" className="lg:hidden">
                <IconLogo className="h-8 w-8 text-brand-500" />
              </a>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {HEADERS[activeView].kicker}
                </p>
                <h1 className="text-lg font-semibold tracking-tight text-ink-900 sm:text-xl">
                  {HEADERS[activeView].title}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isOffline ? (
                <span
                  aria-live="polite"
                  title={cachedAt ? `Données en cache du ${cachedAt}` : undefined}
                  className="inline-flex items-center gap-1.5 rounded-full bg-sun-100 px-2.5 py-1 text-[11px] font-semibold text-sun-800"
                >
                  Hors-ligne
                </span>
              ) : null}

              {saving ? (
                <span
                  aria-live="polite"
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700"
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                  <span className="hidden sm:inline">Enregistrement…</span>
                </span>
              ) : null}

              {canInstallPwa ? (
                <button
                  type="button"
                  onClick={() => void installPwa()}
                  className="btn-secondary whitespace-nowrap px-3 py-1.5 text-xs"
                >
                  <IconDownload className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Installer l&apos;app</span>
                  <span className="md:hidden">App</span>
                </button>
              ) : null}

              {FEATURES.hospitals ? (
                <button
                  onClick={() => selectView("emergency")}
                  className="hidden items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-card transition hover:shadow-lift sm:flex"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[9px] font-bold text-white">
                    {beds.available}
                  </span>
                  lits libres aux urgences
                </button>
              ) : (
                <button
                  onClick={() => selectView("duty")}
                  className="hidden items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-card transition hover:shadow-lift sm:flex"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[9px] font-bold text-white">
                    {dutyList.length}
                  </span>
                  pharmacie{dutyList.length > 1 ? "s" : ""} de garde
                </button>
              )}

              <button
                onClick={() => selectView("pharmacy")}
                className="btn-secondary hidden max-w-[200px] whitespace-nowrap text-xs lg:inline-flex"
              >
                <IconPharmacy className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {session?.type === "pharmacy"
                    ? session.establishmentName
                    : "Espace pharmacie"}
                </span>
              </button>
            </div>
          </div>
        </header>

        <main
          id="contenu"
          tabIndex={-1}
          aria-busy={saving}
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-24 focus:outline-none sm:px-5 lg:py-6 lg:pb-8"
        >
          {activeView === "search" ? (
            <Search
              initialQuery={initialQuery}
              onConsumeInitialQuery={consumeInitialQuery}
            />
          ) : null}
          {activeView === "duty" ? <DutyPharmacies /> : null}
          {activeView === "emergency" && FEATURES.hospitals ? (
            <Emergency onManage={() => selectView("hospital")} />
          ) : null}
          {activeView === "pharmacy" ? (
            session?.type === "pharmacy" ? (
              <PharmacyView />
            ) : (
              <ProfessionalAuth
                defaultType="pharmacy"
                onOpenOther={(type) =>
                  selectView(
                    type === "hospital" && FEATURES.hospitals ? "hospital" : "pharmacy",
                  )
                }
              />
            )
          ) : null}
          {activeView === "hospital" && FEATURES.hospitals ? (
            session?.type === "hospital" ? (
              <HospitalView />
            ) : (
              <ProfessionalAuth
                defaultType="hospital"
                onOpenOther={(type) =>
                  selectView(
                    type === "hospital" && FEATURES.hospitals ? "hospital" : "pharmacy",
                  )
                }
              />
            )
          ) : null}
          {activeView === "settings" ? (
            <SettingsView
              onOpenProfessional={(type) =>
                selectView(
                  type === "hospital" && FEATURES.hospitals ? "hospital" : "pharmacy",
                )
              }
            />
          ) : null}
        </main>
      </div>

      <nav
        aria-label="Navigation mobile"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/90 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around gap-1 px-2 py-1.5">
          {navItems.map((item) => {
            const active = activeView === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => selectView(item.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-1.5 transition",
                  active
                    ? "bg-brand-50/80 text-brand-700"
                    : "text-slate-500 hover:text-ink-900",
                )}
              >
                <span className="relative">
                  <Icon className="h-[18px] w-[18px]" />
                  {item.key === "duty" && dutyList.length > 0 ? (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-500 px-1 text-[9px] font-bold text-white">
                      {dutyList.length}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate text-[10px] font-semibold">
                  {item.short}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {recoveryCode ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex justify-center px-5 lg:bottom-24">
          <div className="pointer-events-auto w-full max-w-md animate-fade-up rounded-2xl bg-white p-4 shadow-lift ring-1 ring-brand-200">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
              Code de secours — à conserver
            </p>
            <p
              aria-live="polite"
              className="mt-1 font-mono text-base font-semibold tracking-wide text-ink-900"
            >
              {recoveryCode}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Il réinitialise votre code d&apos;accès. Il n&apos;est affiché qu&apos;une
              fois et chaque utilisation le remplace.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(recoveryCode)
                    .then(() => notify("Code de secours copié."))
                    .catch(() => notify("Copie impossible — notez le code."));
                }}
                className="btn-secondary text-[11px]"
              >
                Copier
              </button>
              <button
                onClick={dismissRecoveryCode}
                className="btn-primary text-[11px]"
              >
                J&apos;ai sauvegardé le code
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 z-[60] w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 animate-fade-up rounded-xl bg-ink-900 px-4 py-3 text-center text-xs font-medium text-white shadow-lift lg:bottom-6"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
