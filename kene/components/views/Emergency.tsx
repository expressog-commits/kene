"use client";

import { useMemo, useState } from "react";
import { useStore } from "../store";
import { Badge, Card, cn } from "../ui";
import {
  IconAlert,
  IconAmbulance,
  IconBed,
  IconClock,
  IconMapPin,
  IconNavigation,
  IconPhone,
} from "../icons";
import {
  BED_META,
  EMERGENCY_SERVICES,
  emergencySummary,
  filterHospitals,
  unitAvailable,
} from "@/lib/engine";
import { distanceLabel, timeAgo } from "@/lib/format";
import { effectiveDistanceKm, mapsDirectionsLink } from "@/lib/geo";
import { BedGrid3D, GlowOrb } from "../visuals";

export default function Emergency({ onManage }: { onManage?: () => void }) {
  const { state, userLocation } = useStore();
  const [quartier, setQuartier] = useState("Tous");
  const [service, setService] = useState<string>(EMERGENCY_SERVICES[0]);
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const summary = useMemo(() => emergencySummary(state), [state]);
  const quartiers = useMemo(
    () => ["Tous", ...Array.from(new Set(state.hospitals.map((h) => h.quartier)))],
    [state.hospitals],
  );
  const rows = useMemo(
    () => filterHospitals(state, { quartier, service, onlyAvailable }),
    [state, quartier, service, onlyAvailable],
  );

  const shownBeds = rows.reduce((sum, row) => sum + row.available, 0);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl bg-ink-900 px-6 py-7 text-white shadow-lift">
        <div className="hero-grid absolute inset-0 opacity-40" />
        <GlowOrb className="-right-16 -top-20 h-56 w-56" tone="brand" />
        <GlowOrb className="-bottom-24 left-1/3 h-52 w-52" tone="sun" />

        <div className="relative grid items-center gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-brand-200">
              <IconAmbulance className="h-3.5 w-3.5" />
              Urgences hospitalières · Abidjan
            </span>
            <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight">
              {summary.available} lits libres
              <span className="block text-brand-300">avant de prendre la route.</span>
            </h2>
            <p className="mt-2.5 max-w-md text-xs leading-relaxed text-slate-300">
              Lits d&apos;urgence déclarés par les hôpitaux, avec le temps d&apos;attente
              estimé par service. Appelez le service avant de vous déplacer : un lit libre
              n&apos;est pas une admission garantie.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {[
                { tone: "bg-brand-400", label: `${summary.centers} hôpitaux avec des lits` },
                { tone: "bg-sun-400", label: "Tension signalée" },
                { tone: "bg-slate-500", label: "Services saturés" },
              ].map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] text-slate-300"
                >
                  <span className={cn("h-2 w-2 rounded-full", item.tone)} />
                  {item.label}
                </span>
              ))}
            </div>

            <a
              href="tel:185"
              className="btn mt-5 bg-white px-4 py-2.5 text-xs text-ink-900 hover:bg-slate-100"
            >
              <IconPhone className="h-4 w-4" />
              Détresse vitale : SAMU 185
            </a>
          </div>

          <div className="relative">
            <BedGrid3D className="h-52" />
            <div className="pointer-events-none absolute -left-2 top-3 rounded-lg border border-white/15 bg-ink-800/80 px-2.5 py-1.5 text-[10px] font-medium text-brand-200 backdrop-blur">
              {summary.total} lits d&apos;urgence suivis
            </div>
            <div className="pointer-events-none absolute -right-1 bottom-3 rounded-lg border border-white/15 bg-ink-800/80 px-2.5 py-1.5 text-[10px] font-medium text-slate-300 backdrop-blur">
              Mis à jour en continu
            </div>
          </div>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filtrer les hôpitaux par quartier"
            value={quartier}
            onChange={(event) => setQuartier(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 focus:border-brand-400 focus:outline-none"
          >
            {quartiers.map((item) => (
              <option key={item} value={item}>
                {item === "Tous" ? "Tous les quartiers" : item}
              </option>
            ))}
          </select>

          <button
            onClick={() => setOnlyAvailable((value) => !value)}
            aria-pressed={onlyAvailable}
            className={cn(
              "rounded-xl border px-3 py-2 text-xs font-medium transition",
              onlyAvailable
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            Lits disponibles seulement
          </button>

          <span aria-live="polite" className="ml-auto text-[11px] text-slate-500">
            <span className="font-semibold text-ink-900">{shownBeds}</span> lits libres dans
            cette sélection
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {EMERGENCY_SERVICES.map((item) => (
            <button
              key={item}
              onClick={() => setService(item)}
              aria-pressed={service === item}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
                service === item
                  ? "bg-ink-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <IconBed className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-ink-900">
              Aucun lit libre pour ce filtre
            </p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
              Élargissez le quartier ou le service. En cas d&apos;urgence vitale, appelez
              directement le SAMU au 185 plutôt que de chercher un lit.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setService(EMERGENCY_SERVICES[0]);
                setQuartier("Tous");
                setOnlyAvailable(false);
              }}
              className="btn-secondary text-xs"
            >
              Réinitialiser les filtres
            </button>
            <a href="tel:185" className="btn-primary text-xs">
              Appeler le 185
            </a>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map(({ hospital, units, available, total, wait, level }) => {
            const meta = BED_META[level];
            return (
              <Card key={hospital.id} className="card-lift overflow-hidden p-0">
                <div className="flex items-start justify-between gap-4 px-5 pt-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink-900">{hospital.name}</p>
                      <Badge tone={meta.tone}>
                        {level === "full" ? "Saturé" : `${available} lits libres`}
                      </Badge>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <IconMapPin className="h-3.5 w-3.5" />
                        {hospital.quartier} ·{" "}
                        {distanceLabel(effectiveDistanceKm(hospital, userLocation))}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <IconClock className="h-3.5 w-3.5" />
                        {wait === null
                          ? "aucun lit libre"
                          : `attente ≈ ${wait} min`}
                      </span>
                    </p>
                    <p className="mt-1 truncate text-[11px] text-slate-500">
                      {hospital.address} · maj {timeAgo(hospital.updatedAt)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-semibold leading-none text-ink-900">
                      {available}
                    </p>
                    <p className="text-[10px] text-slate-500">sur {total} lits</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 px-5">
                  {units.map((unit) => {
                    const free = unitAvailable(unit);
                    const freeRatio =
                      unit.totalBeds === 0 ? 0 : free / unit.totalBeds;
                    const bar =
                      free === 0
                        ? "bg-red-400"
                        : free <= 2
                          ? "bg-sun-400"
                          : "bg-brand-500";
                    return (
                      <div
                        key={unit.id}
                        className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-ink-900">{unit.label}</span>
                          <span className="text-slate-500">
                            {free > 0 ? (
                              <>
                                <strong className="text-ink-900">{free}</strong> lit
                                {free > 1 ? "s" : ""} libre{free > 1 ? "s" : ""}
                              </>
                            ) : (
                              <span className="font-semibold text-red-500">complet</span>
                            )}
                            {unit.waitingMinutes > 0 ? ` · ${unit.waitingMinutes} min` : ""}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div
                            role="progressbar"
                            aria-label={`Lits libres — ${unit.label}`}
                            aria-valuemin={0}
                            aria-valuemax={unit.totalBeds}
                            aria-valuenow={free}
                            className={cn("h-full rounded-full transition-all", bar)}
                            style={{ width: `${Math.max(free > 0 ? 6 : 0, Math.round(freeRatio * 100))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3.5">
                  <a
                    href={`tel:${hospital.phone.replace(/\s/g, "")}`}
                    className="btn-primary px-3 py-2 text-xs"
                  >
                    <IconPhone className="h-3.5 w-3.5" />
                    Appeler les urgences
                  </a>
                  <a
                    href={mapsDirectionsLink(hospital, userLocation)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary px-3 py-2 text-xs"
                  >
                    <IconNavigation className="h-3.5 w-3.5" />
                    Itinéraire
                  </a>
                  <span className="ml-auto text-[10px] text-slate-500">
                    {hospital.units.length} services d&apos;urgence
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="ml-0.5 flex items-start gap-2 rounded-xl border border-sun-200 bg-sun-50 px-4 py-3">
        <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-sun-600" />
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-relaxed text-sun-800">
            Les lits sont déclarés par les hôpitaux et peuvent changer à tout moment. Un lit
            libre ne garantit pas une prise en charge : appelez le service des urgences.
            Détresse vitale : <strong>SAMU 185</strong> · <strong>Pompiers 180</strong>.
          </p>
          {onManage ? (
            <button
              onClick={onManage}
              className="shrink-0 whitespace-nowrap rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-ink-900 shadow-sm transition hover:bg-slate-50"
            >
              Vous êtes un hôpital ? Mettre à jour les lits
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
