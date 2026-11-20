"use client";

import { useMemo, useState } from "react";
import { useStore } from "../store";
import { Badge, Card, cn } from "../ui";
import {
  IconAlert,
  IconBed,
  IconCheck,
  IconClock,
  IconHospital,
  IconLock,
  IconLogout,
  IconMinus,
  IconPlus,
  IconShield,
  IconTrash,
} from "../icons";
import {
  BED_META,
  BED_SERVICE_PRESETS,
  bedLevel,
  hospitalStats,
  unitAvailable,
} from "@/lib/engine";
import { timeAgo } from "@/lib/format";

export default function HospitalView() {
  const {
    state,
    session,
    updateHospital,
    updateUnit,
    addUnit,
    removeUnit,
    publishBeds,
    signOut,
    changeAccessCode,
    notify,
  } = useStore();

  const hospital = state.hospitals.find(
    (item) => item.id === session?.establishmentId,
  );

  const [newLabel, setNewLabel] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [newTotal, setNewTotal] = useState(8);
  const [newWait, setNewWait] = useState(15);
  const [unitError, setUnitError] = useState<string | null>(null);
  const [unitBusy, setUnitBusy] = useState(false);
  const [currentCode, setCurrentCode] = useState("");
  const [nextCode, setNextCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSaved, setCodeSaved] = useState(false);

  const stats = useMemo(
    () => (hospital ? hospitalStats(hospital) : null),
    [hospital],
  );

  if (!session || session.type !== "hospital" || !hospital || !stats) return null;

  const unusedPresets = BED_SERVICE_PRESETS.filter(
    (preset) =>
      !hospital.units.some(
        (unit) => unit.label.toLowerCase() === preset.toLowerCase(),
      ),
  );
  const effectiveLabel = unusedPresets.some((preset) => preset === newLabel)
    ? newLabel
    : (unusedPresets[0] ?? "");

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <IconHospital className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">{hospital.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {hospital.address} · {hospital.quartier}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <IconClock className="h-3.5 w-3.5" />
                  déclaré {timeAgo(hospital.updatedAt)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <IconBed className="h-3.5 w-3.5" />
                  {stats.available} lits libres sur {stats.total}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
            <span className="inline-flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-[11px] font-medium text-brand-800">
              <IconLock className="h-3.5 w-3.5" />
              {session.managerName} · accès {hospital.quartier}
            </span>
            <button
              onClick={() => {
                publishBeds(hospital.id);
                notify("Disponibilités publiées — visibles immédiatement par les patients.");
              }}
              className="btn-primary whitespace-nowrap text-xs"
            >
              <IconCheck className="h-4 w-4" />
              Publier la mise à jour
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="label" htmlFor="hospital-name">
              Nom de l&apos;hôpital
            </label>
            <input
              id="hospital-name"
              className="input"
              value={hospital.name}
              onChange={(event) =>
                updateHospital(hospital.id, { name: event.target.value })
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="hospital-quartier">
              Quartier
            </label>
            <input
              id="hospital-quartier"
              className="input"
              value={hospital.quartier}
              onChange={(event) =>
                updateHospital(hospital.id, { quartier: event.target.value })
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="hospital-phone">
              Téléphone des urgences
            </label>
            <input
              id="hospital-phone"
              className="input"
              value={hospital.phone}
              onChange={(event) =>
                updateHospital(hospital.id, { phone: event.target.value })
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="hospital-address">
              Adresse
            </label>
            <input
              id="hospital-address"
              className="input"
              value={hospital.address}
              onChange={(event) =>
                updateHospital(hospital.id, { address: event.target.value })
              }
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Lits libres",
            value: `${stats.available}`,
            sub: `sur ${stats.total} lits`,
            tone: stats.available > 0 ? "green" : "red",
          },
          {
            label: "Taux d'occupation",
            value: `${stats.rate} %`,
            sub: stats.rate >= 90 ? "très tendu" : "sous contrôle",
            tone: stats.rate >= 90 ? "amber" : "green",
          },
          {
            label: "Services complets",
            value: `${stats.full.length}`,
            sub: `sur ${hospital.units.length} services`,
            tone: stats.full.length > 0 ? "red" : "green",
          },
          {
            label: "Attente la plus longue",
            value: stats.maxWait !== null ? `${stats.maxWait} min` : "—",
            sub: "déclarée par service",
            tone: "amber",
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
              <Badge tone={card.tone as "green" | "amber" | "red"}>{card.sub}</Badge>
            </div>
          </Card>
        ))}
      </div>

      {stats.full.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-ink-900 px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-400/20 text-red-300">
              <IconAlert className="h-5 w-5" />
            </span>
            <p className="text-sm">
              <span className="font-semibold">{stats.full.length} service(s) complet(s)</span>{" "}
              — les patients les voient saturés et sont redirigés ailleurs.
            </p>
          </div>
          <p className="text-[11px] text-slate-300">
            Libérez un lit dès qu&apos;une place se présente.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-ink-900">Lits par service d&apos;urgence</h2>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Ajustez le nombre de lits et les places occupées. Chaque modification est
          immédiatement visible dans l&apos;onglet « Urgences &amp; lits ».
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {hospital.units.map((unit) => {
          const free = unitAvailable(unit);
          const meta = BED_META[bedLevel(free, unit.totalBeds)];
          const freeRatio = unit.totalBeds === 0 ? 0 : free / unit.totalBeds;
          const barClass =
            free === 0
              ? "bg-red-400"
              : free <= 2
                ? "bg-sun-400"
                : "bg-brand-500";

          return (
            <Card key={unit.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <label className="label" htmlFor={`unit-${unit.id}`}>
                    Service
                  </label>
                  <input
                    id={`unit-${unit.id}`}
                    className="input"
                    value={unit.label}
                    onChange={(event) =>
                      updateUnit(hospital.id, unit.id, {
                        label: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col items-end gap-1 pt-5">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <span className="text-[11px] text-slate-500">
                    {free} lit{free > 1 ? "s" : ""} libre{free > 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <span className="label mb-0">Lits totaux</span>
                  <div className="mt-1.5 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        updateUnit(
                          hospital.id,
                          unit.id,
                          { totalBeds: Math.max(0, unit.totalBeds - 1) },
                          true,
                        )
                      }
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50"
                      aria-label="Retirer un lit"
                    >
                      <IconMinus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="number"
                      aria-label={`Lits totaux — ${unit.label}`}
                      min={0}
                      value={unit.totalBeds}
                      onChange={(event) =>
                        updateUnit(hospital.id, unit.id, {
                          totalBeds: Number(event.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-center text-xs font-semibold text-ink-900 focus:border-brand-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateUnit(
                          hospital.id,
                          unit.id,
                          { totalBeds: unit.totalBeds + 1 },
                          true,
                        )
                      }
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50"
                      aria-label="Ajouter un lit"
                    >
                      <IconPlus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="label mb-0">Lits occupés</span>
                  <div className="mt-1.5 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        updateUnit(
                          hospital.id,
                          unit.id,
                          { occupiedBeds: Math.max(0, unit.occupiedBeds - 1) },
                          true,
                        )
                      }
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50"
                      aria-label="Libérer un lit"
                    >
                      <IconMinus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="number"
                      aria-label={`Lits occupés — ${unit.label}`}
                      min={0}
                      max={unit.totalBeds}
                      value={unit.occupiedBeds}
                      onChange={(event) =>
                        updateUnit(hospital.id, unit.id, {
                          occupiedBeds: Number(event.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-center text-xs font-semibold text-ink-900 focus:border-brand-400 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateUnit(
                          hospital.id,
                          unit.id,
                          {
                            occupiedBeds: Math.min(
                              unit.totalBeds,
                              unit.occupiedBeds + 1,
                            ),
                          },
                          true,
                        )
                      }
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50"
                      aria-label="Occuper un lit"
                    >
                      <IconPlus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="label mb-0">Attente (min)</span>
                  <input
                    type="number"
                    aria-label={`Attente en minutes — ${unit.label}`}
                    min={0}
                    value={unit.waitingMinutes}
                    onChange={(event) =>
                      updateUnit(hospital.id, unit.id, {
                        waitingMinutes: Number(event.target.value),
                      })
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-center text-xs font-semibold text-ink-900 focus:border-brand-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={cn("h-full rounded-full transition-all", barClass)}
                  style={{
                    width: `${Math.max(free > 0 ? 6 : 0, Math.round(freeRatio * 100))}%`,
                  }}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3.5">
                <button
                  type="button"
                  onClick={() => {
                    updateUnit(
                      hospital.id,
                      unit.id,
                      { occupiedBeds: Math.max(0, unit.occupiedBeds - 1) },
                      true,
                    );
                    notify(`${unit.label} : un lit libéré.`);
                  }}
                  className="btn-primary px-3 py-1.5 text-[11px]"
                >
                  Libérer un lit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    updateUnit(
                      hospital.id,
                      unit.id,
                      {
                        occupiedBeds: Math.min(
                          unit.totalBeds,
                          unit.occupiedBeds + 1,
                        ),
                      },
                      true,
                    );
                    notify(`${unit.label} : un lit occupé.`);
                  }}
                  className="btn-secondary px-3 py-1.5 text-[11px]"
                >
                  Occuper un lit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeUnit(hospital.id, unit.id);
                    notify(`Service « ${unit.label} » retiré.`);
                  }}
                  disabled={hospital.units.length <= 1}
                  className="btn-ghost ml-auto px-2.5 py-1.5 text-[11px] text-slate-500 hover:text-red-500"
                  title={
                    hospital.units.length <= 1
                      ? "Un hôpital doit conserver au moins un service"
                      : "Retirer ce service"
                  }
                >
                  <IconTrash className="h-3.5 w-3.5" />
                  Retirer
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-ink-900">
          Ajouter un service d&apos;urgence
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Les nouveaux services apparaissent aussitôt dans la recherche de lits.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_0.7fr_0.7fr_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="new-unit-label">
              {unusedPresets.length > 0 ? "Service" : "Service personnalisé"}
            </label>
            {unusedPresets.length > 0 ? (
              <select
                id="new-unit-label"
                className="input"
                value={effectiveLabel}
                onChange={(event) => {
                  setNewLabel(event.target.value);
                  setUnitError(null);
                }}
              >
                {unusedPresets.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="new-unit-label"
                type="text"
                className="input"
                placeholder="Ex. Cardiologie d'urgence"
                value={customLabel}
                onChange={(event) => {
                  setCustomLabel(event.target.value);
                  setUnitError(null);
                }}
              />
            )}
          </div>
          <div>
            <label className="label" htmlFor="new-unit-total">
              Lits totaux
            </label>
            <input
              id="new-unit-total"
              type="number"
              min={1}
              className="input"
              value={newTotal}
              onChange={(event) => {
                setNewTotal(Number(event.target.value));
                setUnitError(null);
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="new-unit-wait">
              Attente (min)
            </label>
            <input
              id="new-unit-wait"
              type="number"
              min={0}
              className="input"
              value={newWait}
              onChange={(event) => {
                setNewWait(Number(event.target.value));
                setUnitError(null);
              }}
            />
          </div>
          <button
            type="button"
            disabled={unitBusy}
            onClick={async () => {
              if (unitBusy) return;
              const label = (
                unusedPresets.length > 0 ? effectiveLabel : customLabel
              ).trim();
              if (!label) {
                const msg = "Indiquez le nom du service.";
                setUnitError(msg);
                notify(msg);
                return;
              }
              const exists = hospital.units.some(
                (unit) => unit.label.toLowerCase() === label.toLowerCase(),
              );
              if (exists) {
                const msg = "Ce service est déjà déclaré pour cet hôpital.";
                setUnitError(msg);
                notify(msg);
                return;
              }
              setUnitBusy(true);
              const result = await addUnit(hospital.id, {
                label,
                totalBeds: newTotal,
                occupiedBeds: 0,
                waitingMinutes: newWait,
              });
              setUnitBusy(false);
              if (!result.ok) {
                const msg = result.error ?? "Impossible d'ajouter ce service.";
                setUnitError(msg);
                notify(msg);
                return;
              }
              setUnitError(null);
              setNewLabel("");
              setCustomLabel("");
              setNewTotal(8);
              setNewWait(15);
              notify(`Service « ${label} » ajouté.`);
            }}
            className="btn-primary text-xs"
          >
            <IconPlus className="h-4 w-4" />
            {unitBusy ? "Ajout…" : "Ajouter"}
          </button>
        </div>

        {unitError ? (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
          >
            {unitError}
          </p>
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
            onClick={async () => {
              await signOut();
              notify("Déconnecté du back-office hôpital.");
            }}
            className="btn-secondary whitespace-nowrap text-xs"
          >
            <IconLogout className="h-4 w-4" />
            Se déconnecter
          </button>
        </div>

        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="current-code">
              Code actuel
            </label>
            <input
              id="current-code"
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
            <label className="label" htmlFor="next-code">
              Nouveau code (6 caractères min.)
            </label>
            <input
              id="next-code"
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
            onClick={async () => {
              const result = await changeAccessCode(currentCode, nextCode);
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
            Changer le code
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
          Un seul compte par hôpital. La session est un cookie HttpOnly valable 8 heures,
          vérifié côté serveur à chaque modification.
        </p>
      </Card>

      <div className="flex items-start gap-2 rounded-xl bg-white/60 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
        <IconShield className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
        <p>
          Ces chiffres sont publiés sous votre responsabilité et ne constituent pas une
          garantie d&apos;admission. Un lit libre doit correspondre à une place réellement
          disponible dans le service.
        </p>
      </div>
    </div>
  );
}
