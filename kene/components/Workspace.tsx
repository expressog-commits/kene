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

interface NavItem {
  key: ViewKey;
  label: string;
  short: string;
  group: "patient" | "pro";
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

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      {
        key: "search",
        label: "Trouver",
        short: "Trouver",
        group: "patient",
        icon: IconSearch,
      },
      {
        key: "duty",
        label: "De garde",
        short: "De garde",
        group: "patient",
        icon: IconClock,
      },
    ];
    if (FEATURES.hospitals) {
      items.push({
        key: "emergency",
        label: "Urgences",
        short: "Urgences",
        group: "patient",
        icon: IconBed,
      });
    }
    items.push({
      key: "pharmacy",
      label: "Pharmacie",
      short: "Pharmacie",
      group: "pro",
      icon: IconPharmacy,
    });
    if (FEATURES.hospitals) {
      items.push({
        key: "hospital",
        label: "Hôpital",
        short: "Hôpital",
        group: "pro",
        icon: IconHospital,
      });
    }
    items.push({
      key: "settings",
      label: "Réglages",
      short: "Réglages",
      group: "pro",
      icon: IconSettings,
    });
    return items;
  }, []);

  const dutyList = useMemo(() => dutyPharmacies(state), [state]);
  const beds = useMemo(() => emergencySummary(state), [state]);

  const activeView: ViewKey =
    !FEATURES.hospitals && (view === "emergency" || view === "hospital")
      ? "search"
      : view;

  const patientNavItems = navItems.filter((item) => item.group === "patient");
  const proNavItems = navItems.filter((item) => item.group === "pro");
  const isWideView = activeView === "search" || activeView === "duty";

  const renderDesktopNavButton = (item: NavItem) => {
    const active = activeView === item.key;
    const Icon = item.icon;
    const isConnectedPharmacy =
      item.key === "pharmacy" && session?.type === "pharmacy";
    const isConnectedHospital =
      item.key === "hospital" && session?.type === "hospital";

    return (
      <button
        key={item.key}
        type="button"
        onClick={() => selectView(item.key)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition",
          active
            ? "bg-white text-ink-900 shadow-sm ring-1 ring-slate-200/70"
            : "text-slate-600 hover:bg-white/60 hover:text-ink-900",
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            active ? "text-brand-600" : "text-slate-500",
          )}
        />
        {isConnectedPharmacy ? (
          <>
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
            />
            <span className="max-w-[160px] truncate">{session.establishmentName}</span>
          </>
        ) : isConnectedHospital ? (
          <>
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
            />
            <span className="max-w-[160px] truncate">{session.establishmentName}</span>
          </>
        ) : (
          <span>{item.label}</span>
        )}
        {item.key === "duty" && dutyList.length > 0 ? (
          <span
            className={cn(
              "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums",
              active
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/80"
                : "bg-emerald-100/90 text-emerald-700",
            )}
          >
            {dutyList.length}
          </span>
        ) : null}
        {item.key === "emergency" && FEATURES.hospitals && beds.available > 0 ? (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-100 px-1.5 text-[11px] font-bold tabular-nums text-sky-700">
            {beds.available}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <a href="#contenu" className="skip-link">
        Aller au contenu principal
      </a>

      <header className="sticky top-0 z-30 border-b border-slate-200/75 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <a
              href="/"
              className="group flex items-center gap-2.5 rounded-xl focus-visible:outline-offset-4"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200/60 transition group-hover:bg-brand-100/70">
                <IconLogo className="h-6 w-6" />
              </span>
              <span className="text-[17px] font-bold tracking-tight text-ink-900">
                Kéné
              </span>
            </a>
            <span className="hidden items-center gap-1.5 rounded-full bg-slate-100/90 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200/80 sm:inline-flex">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Abidjan
            </span>
          </div>

          <nav
            aria-label="Navigation principale"
            className="hidden items-center gap-1 rounded-full border border-slate-200/70 bg-slate-100/80 p-1 lg:flex"
          >
            {patientNavItems.map(renderDesktopNavButton)}
            <span aria-hidden="true" className="mx-1 h-4 w-px bg-slate-200/90" />
            {proNavItems.map(renderDesktopNavButton)}
          </nav>

          <div className="flex items-center gap-2">
            {isOffline ? (
              <span
                aria-live="polite"
                title={cachedAt ? `Données en cache du ${cachedAt}` : undefined}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200/80"
              >
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Hors-ligne
              </span>
            ) : null}

            {saving ? (
              <span
                aria-live="polite"
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200/80"
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
                />
                <span className="hidden sm:inline">Enregistrement…</span>
              </span>
            ) : null}

            {canInstallPwa ? (
              <button
                type="button"
                onClick={() => void installPwa()}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-900 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
              >
                <IconDownload className="h-3.5 w-3.5 text-brand-600" />
                <span>Installer</span>
              </button>
            ) : null}

            <a
              href="tel:185"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200/80 transition hover:bg-rose-100 active:scale-[0.98]"
            >
              <IconPhone className="h-3.5 w-3.5" />
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
          "mx-auto w-full flex-1 px-4 py-5 pb-28 focus:outline-none sm:px-6 lg:py-6 lg:pb-10",
          isWideView ? "max-w-[1440px]" : "max-w-5xl",
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

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-slate-200/70 pt-4 text-[11px] text-slate-500">
          <p className="inline-flex items-center gap-1.5">
            <IconShield className="h-3.5 w-3.5 shrink-0 text-brand-600" />
            <span>
              Outil d&apos;information uniquement — pas de vente ni de réservation
              médicale.
            </span>
          </p>
          <a
            href="tel:185"
            className="font-semibold text-rose-700 transition hover:text-rose-800"
          >
            Urgence vitale · SAMU 185
          </a>
        </footer>
      </main>

      <nav
        aria-label="Navigation mobile"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgba(11,31,29,0.12)] backdrop-blur-xl lg:hidden"
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
                  "relative flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-1.5 transition active:scale-[0.98]",
                  active
                    ? "bg-brand-50/90 text-brand-700"
                    : "text-slate-500 hover:text-ink-900",
                )}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-1 h-1 w-6 rounded-full bg-brand-500"
                  />
                ) : null}
                <span className="relative mt-0.5">
                  <Icon className="h-5 w-5" />
                  {item.key === "duty" && dutyList.length > 0 ? (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-bold tabular-nums text-white ring-2 ring-white">
                      {dutyList.length}
                    </span>
                  ) : null}
                  {item.key === "pharmacy" && session?.type === "pharmacy" ? (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white"
                    />
                  ) : null}
                </span>
                <span className="max-w-full truncate text-[11px] font-semibold">
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
                type="button"
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
                type="button"
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
          className="fixed bottom-24 left-1/2 z-[60] w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 animate-fade-up rounded-2xl bg-ink-900/95 px-4 py-3 text-center text-xs font-medium text-white shadow-float backdrop-blur lg:bottom-6"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
