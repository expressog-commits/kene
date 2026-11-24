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
import { dutyPharmacies, emergencySummary } from "@/lib/engine";
import { FEATURES } from "@/lib/features";

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

interface MobileNavItem {
  key: ViewKey;
  label: string;
  icon: (props: { className?: string }) => JSX.Element;
}

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

  const dutyList = useMemo(() => dutyPharmacies(state), [state]);
  const beds = useMemo(() => emergencySummary(state), [state]);

  const activeView: ViewKey =
    !FEATURES.hospitals && (view === "emergency" || view === "hospital")
      ? "search"
      : view;

  const mobileNavItems = useMemo<MobileNavItem[]>(() => {
    const items: MobileNavItem[] = [
      { key: "search", label: "Rechercher", icon: IconSearch },
      { key: "duty", label: "De garde", icon: IconClock },
    ];
    if (FEATURES.hospitals) {
      items.push({ key: "emergency", label: "Urgences", icon: IconBed });
    }
    items.push({ key: "pharmacy", label: "Pharmacie", icon: IconPharmacy });
    if (FEATURES.hospitals) {
      items.push({ key: "hospital", label: "Hôpital", icon: IconHospital });
    }
    return items;
  }, []);

  const isWideView = activeView === "search" || activeView === "duty";

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <a href="#contenu" className="skip-link">
        Aller au contenu principal
      </a>

      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <a
            href="/"
            className="group flex shrink-0 items-center gap-2.5 rounded-xl py-1 pr-1 focus-visible:outline-offset-4"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200/70 transition group-hover:bg-brand-100">
              <IconLogo className="h-7 w-7" />
            </span>
            <span className="font-display text-xl font-bold tracking-tight text-slate-900">
              Kéné
            </span>
          </a>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <nav
              aria-label="Navigation principale"
              className="hidden items-center gap-1.5 lg:flex"
            >
              <button
                type="button"
                onClick={() => selectView("search")}
                aria-current={activeView === "search" ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3.5 text-[15px] font-semibold transition",
                  activeView === "search"
                    ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <IconSearch className="h-4 w-4 shrink-0" />
                <span>Rechercher</span>
              </button>

              <button
                type="button"
                onClick={() => selectView("duty")}
                aria-current={activeView === "duty" ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3.5 text-[15px] font-semibold transition",
                  activeView === "duty"
                    ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <IconClock className="h-4 w-4 shrink-0" />
                <span>Pharmacies de garde</span>
                {dutyList.length > 0 ? (
                  <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-emerald-100 px-2 text-xs font-bold tabular-nums text-emerald-900">
                    {dutyList.length}
                  </span>
                ) : null}
              </button>

              {FEATURES.hospitals ? (
                <button
                  type="button"
                  onClick={() => selectView("emergency")}
                  aria-current={activeView === "emergency" ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3.5 text-[15px] font-semibold transition",
                    activeView === "emergency"
                      ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <IconBed className="h-4 w-4 shrink-0" />
                  <span>Urgences</span>
                  {beds.available > 0 ? (
                    <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-sky-100 px-2 text-xs font-bold tabular-nums text-sky-900">
                      {beds.available}
                    </span>
                  ) : null}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => selectView("pharmacy")}
                aria-current={activeView === "pharmacy" ? "page" : undefined}
                className={cn(
                  "ml-1 inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-[15px] font-semibold transition",
                  activeView === "pharmacy"
                    ? "border-brand-700 bg-brand-50 text-brand-800 ring-1 ring-brand-700/20"
                    : "border-slate-300 bg-white text-slate-800 hover:border-brand-600 hover:bg-brand-50/40 hover:text-brand-800",
                )}
              >
                {session?.type === "pharmacy" ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500"
                    />
                    <span className="max-w-[170px] truncate">
                      {session.establishmentName}
                    </span>
                  </>
                ) : (
                  <>
                    <IconPharmacy className="h-4 w-4 shrink-0 text-brand-700" />
                    <span>Vous êtes pharmacien ?</span>
                  </>
                )}
              </button>

              {FEATURES.hospitals ? (
                <button
                  type="button"
                  onClick={() => selectView("hospital")}
                  aria-current={activeView === "hospital" ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3.5 text-[15px] font-semibold transition",
                    activeView === "hospital"
                      ? "border-brand-700 bg-brand-50 text-brand-800 ring-1 ring-brand-700/20"
                      : "border-slate-300 bg-white text-slate-800 hover:border-brand-600 hover:bg-brand-50/40 hover:text-brand-800",
                  )}
                >
                  {session?.type === "hospital" ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500"
                      />
                      <span className="max-w-[150px] truncate">
                        {session.establishmentName}
                      </span>
                    </>
                  ) : (
                    <>
                      <IconHospital className="h-4 w-4 shrink-0 text-brand-700" />
                      <span>Hôpital</span>
                    </>
                  )}
                </button>
              ) : null}
            </nav>

            {isOffline ? (
              <span
                aria-live="polite"
                title={cachedAt ? `Données en cache du ${cachedAt}` : undefined}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-300"
              >
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-600" />
                Hors-ligne
              </span>
            ) : null}

            {saving ? (
              <span
                aria-live="polite"
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-200"
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 animate-pulse rounded-full bg-emerald-600"
                />
                <span className="hidden sm:inline">Enregistrement…</span>
              </span>
            ) : null}

            {canInstallPwa ? (
              <button
                type="button"
                onClick={() => void installPwa()}
                className="inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
              >
                <IconDownload className="h-4 w-4 text-brand-700" />
                <span>Installer</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => selectView("settings")}
              aria-label="Réglages"
              title="Réglages"
              aria-current={activeView === "settings" ? "page" : undefined}
              className={cn(
                "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition",
                activeView === "settings"
                  ? "border-brand-700 bg-brand-50 text-brand-800"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <IconSettings className="h-5 w-5" />
            </button>

            <a
              href="tel:185"
              className="inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-rose-50 px-3.5 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200 transition hover:bg-rose-100 active:scale-[0.98]"
            >
              <IconPhone className="h-4 w-4 shrink-0" />
              <span>SAMU 185</span>
            </a>
          </div>
        </div>
      </header>

      <main
        id="contenu"
        tabIndex={-1}
        aria-busy={saving}
        className={cn(
          "mx-auto w-full flex-1 px-4 py-6 pb-28 focus:outline-none sm:px-6 sm:py-8 lg:pb-12",
          isWideView ? "max-w-7xl" : "max-w-4xl",
        )}
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

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-slate-200/80 pt-6 text-sm text-slate-600">
          <p className="inline-flex items-center gap-2">
            <IconShield className="h-4 w-4 shrink-0 text-brand-700" />
            <span>
              Outil d&apos;information uniquement — pas de vente ni de réservation
              médicale.
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => selectView("settings")}
              className="inline-flex min-h-[36px] items-center font-semibold text-slate-700 underline-offset-4 transition hover:text-brand-700 hover:underline"
            >
              Réglages
            </button>
            <a
              href="tel:185"
              className="inline-flex min-h-[36px] items-center font-semibold text-rose-700 transition hover:text-rose-800"
            >
              Urgence vitale · SAMU 185
            </a>
          </div>
        </footer>
      </main>

      <nav
        aria-label="Navigation mobile"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/90 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.10)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto flex h-[68px] max-w-lg items-stretch justify-around gap-1.5 px-3 py-1.5">
          {mobileNavItems.map((item) => {
            const active = activeView === item.key;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => selectView(item.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 transition active:scale-[0.98]",
                  active
                    ? "bg-brand-50 text-brand-800"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-1 h-1 w-8 rounded-full bg-brand-700"
                  />
                ) : null}
                <span className="relative mt-0.5">
                  <Icon className="h-6 w-6" />
                  {item.key === "duty" && dutyList.length > 0 ? (
                    <span className="absolute -right-3 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-700 px-1 text-[11px] font-bold tabular-nums text-white ring-2 ring-white">
                      {dutyList.length}
                    </span>
                  ) : null}
                  {item.key === "emergency" && FEATURES.hospitals && beds.available > 0 ? (
                    <span className="absolute -right-3 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-700 px-1 text-[11px] font-bold tabular-nums text-white ring-2 ring-white">
                      {beds.available}
                    </span>
                  ) : null}
                  {item.key === "pharmacy" && session?.type === "pharmacy" ? (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                    />
                  ) : null}
                  {item.key === "hospital" &&
                  FEATURES.hospitals &&
                  session?.type === "hospital" ? (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                    />
                  ) : null}
                </span>
                <span className="max-w-full truncate text-xs font-bold">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {recoveryCode ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex justify-center px-5 lg:bottom-24">
          <div className="pointer-events-auto w-full max-w-md animate-fade-up rounded-2xl border border-brand-200 bg-white p-5 shadow-lift">
            <p className="text-sm font-bold text-brand-800">
              Code de secours — à conserver
            </p>
            <p
              aria-live="polite"
              className="mt-1.5 font-mono text-lg font-bold tracking-wide text-slate-900"
            >
              {recoveryCode}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              Il réinitialise votre code d&apos;accès. Il n&apos;est affiché qu&apos;une
              fois et chaque utilisation le remplace.
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(recoveryCode)
                    .then(() => notify("Code de secours copié."))
                    .catch(() => notify("Copie impossible — notez le code."));
                }}
                className="btn-secondary"
              >
                Copier
              </button>
              <button
                type="button"
                onClick={dismissRecoveryCode}
                className="btn-primary"
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
          className="fixed bottom-24 left-1/2 z-[60] w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 animate-fade-up rounded-2xl bg-slate-900/95 px-4 py-3 text-center text-sm font-medium text-white shadow-float backdrop-blur lg:bottom-6"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
