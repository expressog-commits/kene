"use client";

import { useEffect, useState } from "react";
import { useStore } from "../store";
import { Card, cn } from "../ui";
import {
  IconAlert,
  IconArrowRight,
  IconCheck,
  IconHospital,
  IconKey,
  IconLock,
  IconLogout,
  IconPharmacy,
  IconShield,
  IconUserCheck,
} from "../icons";
import { BedGrid3D, GlowOrb } from "../visuals";
import { FEATURES } from "@/lib/features";
import type { ProfessionalType } from "@/lib/types";

type Mode = "login" | "signup" | "recover";

function normalizeType(value: ProfessionalType): ProfessionalType {
  if (!FEATURES.hospitals && value === "hospital") return "pharmacy";
  return value;
}

export default function ProfessionalAuth({
  defaultType,
  onOpenOther,
}: {
  defaultType: ProfessionalType;
  onOpenOther: (type: ProfessionalType) => void;
}) {
  const {
    state,
    session,
    claimedEstablishmentIds,
    demoAccounts,
    signIn,
    signUp,
    signOut,
    recoverAccessCode,
    notify,
  } = useStore();

  const [mode, setMode] = useState<Mode>("login");
  const [type, setType] = useState<ProfessionalType>(() =>
    normalizeType(defaultType),
  );
  const [error, setError] = useState<string | null>(null);
  const [showAccounts, setShowAccounts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverSecret, setRecoverSecret] = useState("");
  const [recoverNew, setRecoverNew] = useState("");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const [signupEmail, setSignupEmail] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [managerName, setManagerName] = useState("");
  const [role, setRole] = useState("");
  const [existingId, setExistingId] = useState("");
  const [name, setName] = useState("");
  const [quartier, setQuartier] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");

  useEffect(() => {
    const next = normalizeType(defaultType);
    setType(next);
    setExistingId("");
    setError(null);
    if (next === "admin") {
      setMode((current) => (current === "signup" ? "login" : current));
    }
  }, [defaultType]);

  const allowedTypes: ProfessionalType[] = FEATURES.hospitals
    ? ["pharmacy", "hospital", "admin"]
    : ["pharmacy", "admin"];

  const visibleDemoAccounts = demoAccounts.filter(
    (account) => FEATURES.hospitals || account.type !== "hospital",
  );

  const claimed = new Set(claimedEstablishmentIds);
  const availableEstablishments =
    type === "pharmacy"
      ? state.pharmacies
          .filter((item) => !claimed.has(item.id))
          .map((item) => ({
            id: item.id,
            label: `${item.name} — ${item.quartier}`,
          }))
      : type === "hospital"
        ? state.hospitals
            .filter((item) => !claimed.has(item.id))
            .map((item) => ({
              id: item.id,
              label: `${item.name} — ${item.quartier}`,
            }))
        : [];

  const switchType = (next: ProfessionalType) => {
    const resolved = normalizeType(next);
    setType(resolved);
    setExistingId("");
    setError(null);
    if (resolved === "admin" && mode === "signup") {
      setMode("login");
    }
  };

  if (session) {
    const establishment =
      session.type === "pharmacy"
        ? state.pharmacies.find((item) => item.id === session.establishmentId)
        : session.type === "hospital"
          ? state.hospitals.find((item) => item.id === session.establishmentId)
          : null;

    const sessionKindLabel =
      session.type === "pharmacy"
        ? "pharmacie"
        : session.type === "hospital"
          ? "hôpital"
          : "administrateur";
    const targetAudienceLabel =
      defaultType === "pharmacy"
        ? "officines"
        : defaultType === "hospital"
          ? "hôpitaux"
          : "administrateurs Kéné";

    return (
      <Card className="mx-auto max-w-xl p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <IconLock className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-ink-900">
          Connecté avec un compte {sessionKindLabel}
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
          {establishment?.name ??
            (session.type === "admin"
              ? "Administration Kéné"
              : "Votre établissement")}{" "}
          — cet espace est réservé aux {targetAudienceLabel}. Chaque compte ne
          donne accès qu&apos;à son propre périmètre.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => onOpenOther(session.type)}
            className="btn-primary text-xs"
          >
            <IconArrowRight className="h-4 w-4" />
            Ouvrir mon espace
          </button>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              notify("Déconnecté.");
            }}
            className="btn-secondary text-xs"
          >
            <IconLogout className="h-4 w-4" />
            Changer de compte
          </button>
        </div>
      </Card>
    );
  }

  const submitLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const result = await signIn(email, code);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Connexion impossible.");
      return;
    }
    setError(null);
    notify("Connexion réussie.");
    if (type !== defaultType) {
      onOpenOther(type);
    }
  };

  const submitSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || type === "admin") return;
    setBusy(true);
    const result = await signUp({
      type,
      email: signupEmail,
      accessCode: signupCode,
      managerName,
      role,
      existingEstablishmentId: existingId || undefined,
      name,
      quartier,
      address,
      phone,
      licenseNumber:
        type === "pharmacy" && !existingId && licenseNumber.trim()
          ? licenseNumber.trim()
          : undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Création impossible.");
      return;
    }
    setError(null);
    notify(
      type === "pharmacy"
        ? "Compte pharmacie créé — en attente de validation administrateur pour la mise en ligne."
        : "Compte professionnel créé — vous êtes connecté.",
    );
    if (type !== defaultType) {
      onOpenOther(type);
    }
  };

  const submitRecover = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const result = await recoverAccessCode(
      recoverEmail,
      recoverSecret,
      recoverNew,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Récupération impossible.");
      return;
    }
    setError(null);
    setEmail(recoverEmail);
    setCode("");
    setRecoverSecret("");
    setRecoverNew("");
    setMode("login");
    notify("Code réinitialisé — connectez-vous avec le nouveau code.");
  };

  const benefitLines = FEATURES.hospitals
    ? [
        "Pharmacies : stock, prix, garde, import CSV et GPS",
        "Hôpitaux : lits disponibles par service",
        "Validation administrateur avant publication publique",
        "Un compte par établissement, données isolées",
      ]
    : [
        "Pharmacies : stock, prix, garde, import CSV et GPS",
        "Validation administrateur de l'agrément avant mise en ligne",
        "Un compte par officine, données isolées",
        "Code de secours à usage unique pour récupérer l'accès",
      ];

  return (
    <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
      <div className="relative overflow-hidden rounded-2xl bg-ink-900 px-6 py-8 text-white shadow-lift">
        <div className="hero-grid absolute inset-0 opacity-50" />
        <GlowOrb className="-right-16 -top-20 h-56 w-56" tone="brand" />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-brand-200">
            <IconLock className="h-3.5 w-3.5" />
            Espace professionnel Kéné
          </span>
          <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight">
            Un compte pour votre officine
            <span className="block text-brand-300">
              {FEATURES.hospitals
                ? "ou votre hôpital."
                : "vérifiée à Abidjan."}
            </span>
          </h2>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-slate-300">
            Créez votre compte en quelques champs : votre établissement, votre
            numéro d&apos;agrément et un code d&apos;accès. Chaque compte ne
            donne accès qu&apos;à son propre espace.
          </p>

          <ul className="mt-5 space-y-2.5">
            {benefitLines.map((line) => (
              <li
                key={line}
                className="flex items-start gap-2 text-[11px] text-slate-300"
              >
                <IconCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-300" />
                {line}
              </li>
            ))}
          </ul>

          <BedGrid3D className="mt-6 h-40" />
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            {type === "pharmacy" ? (
              <IconPharmacy className="h-4 w-4" />
            ) : type === "hospital" ? (
              <IconHospital className="h-4 w-4" />
            ) : (
              <IconUserCheck className="h-4 w-4" />
            )}
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink-900">
              {mode === "login"
                ? "Connexion professionnelle"
                : mode === "signup"
                  ? "Créer un compte"
                  : "Récupérer votre accès"}
            </h2>
            <p className="text-[11px] text-slate-500">
              {type === "pharmacy"
                ? "Espace pharmacie"
                : type === "hospital"
                  ? "Espace hôpital"
                  : "Espace administration"}{" "}
              · Kéné
            </p>
          </div>
        </div>

        <div
          className={cn(
            "mt-4 grid gap-2",
            allowedTypes.length === 3 ? "grid-cols-3" : "grid-cols-2",
          )}
        >
          {allowedTypes.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => switchType(item)}
              aria-pressed={type === item}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition",
                type === item
                  ? "border-brand-500 bg-brand-50 text-brand-800"
                  : "border-slate-200 text-slate-500 hover:border-slate-300",
              )}
            >
              {item === "pharmacy" ? (
                <IconPharmacy className="h-4 w-4" />
              ) : item === "hospital" ? (
                <IconHospital className="h-4 w-4" />
              ) : (
                <IconUserCheck className="h-4 w-4" />
              )}
              {item === "pharmacy"
                ? "Pharmacie"
                : item === "hospital"
                  ? "Hôpital"
                  : "Administration"}
            </button>
          ))}
        </div>

        {type === "admin" ? (
          <div className="mt-3 flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
            {(
              [
                { key: "login", label: "Connexion" },
                { key: "recover", label: "Récupération" },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setMode(item.key);
                  setError(null);
                }}
                aria-pressed={mode === item.key}
                className={cn(
                  "flex-1 rounded-lg px-3 py-2 transition",
                  mode === item.key
                    ? "bg-white text-ink-900 shadow-sm"
                    : "text-slate-500 hover:text-ink-900",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
            {(["login", "signup"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setMode(item);
                  setError(null);
                }}
                aria-pressed={mode === item}
                className={cn(
                  "flex-1 rounded-lg px-3 py-2 transition",
                  mode === item
                    ? "bg-white text-ink-900 shadow-sm"
                    : "text-slate-500 hover:text-ink-900",
                )}
              >
                {item === "login" ? "Connexion" : "Créer un compte"}
              </button>
            ))}
          </div>
        )}

        {mode === "login" ? (
          <form onSubmit={submitLogin} className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="pro-email">
                Email professionnel
              </label>
              <input
                id="pro-email"
                type="email"
                autoComplete="username"
                placeholder={
                  type === "pharmacy"
                    ? "officine.rondpoint@kene.ci"
                    : type === "hospital"
                      ? "urgences.cocody@kene.ci"
                      : "admin@kene.ci"
                }
                className="input"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                }}
              />
            </div>
            <div>
              <label className="label" htmlFor="pro-code">
                Code d&apos;accès
              </label>
              <input
                id="pro-code"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="input"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setError(null);
                }}
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full text-xs disabled:opacity-60"
            >
              <IconKey className="h-4 w-4" />
              {busy ? "Connexion…" : "Se connecter"}
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("recover");
                  setRecoverEmail(email);
                  setError(null);
                }}
                className="text-[11px] font-medium text-brand-700 underline-offset-2 hover:underline"
              >
                Code d&apos;accès oublié ?
              </button>

              {FEATURES.showDemoAccounts && visibleDemoAccounts.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowAccounts((value) => !value)}
                  aria-expanded={showAccounts}
                  aria-controls="demo-accounts"
                  className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-ink-900 hover:underline"
                >
                  {showAccounts
                    ? "Masquer les comptes de démonstration"
                    : "Voir les comptes de démonstration"}
                </button>
              ) : null}
            </div>

            {FEATURES.showDemoAccounts && showAccounts ? (
              <div
                id="demo-accounts"
                className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-3"
              >
                {visibleDemoAccounts.map((account) => {
                  const pharmacyEst =
                    account.type === "pharmacy"
                      ? state.pharmacies.find(
                          (item) => item.id === account.establishmentId,
                        )
                      : null;
                  const hospitalEst =
                    account.type === "hospital"
                      ? state.hospitals.find(
                          (item) => item.id === account.establishmentId,
                        )
                      : null;
                  const displayTitle =
                    account.type === "admin"
                      ? "Administration Kéné · Modération"
                      : account.type === "pharmacy"
                        ? `${pharmacyEst?.name ?? "Pharmacie"}${
                            pharmacyEst?.verificationStatus === "pending"
                              ? " (en attente)"
                              : ""
                          }`
                        : hospitalEst?.name ?? "Hôpital";

                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => {
                        setType(account.type);
                        setMode("login");
                        setEmail(account.email);
                        setCode(account.accessCode);
                        setError(null);
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg bg-white px-2.5 py-2 text-left transition hover:shadow-card"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] font-semibold text-ink-900">
                          {displayTitle}
                        </span>
                        <span className="block truncate text-[10px] text-slate-500">
                          {account.email}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-md bg-sand px-2 py-1 font-mono text-[10px] font-semibold text-brand-800">
                        {account.accessCode}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </form>
        ) : mode === "signup" && type !== "admin" ? (
          <form onSubmit={submitSignup} className="mt-4 space-y-3.5">
            <div>
              <label className="label" htmlFor="signup-establishment">
                Votre établissement
              </label>
              <select
                id="signup-establishment"
                className="input"
                value={existingId}
                onChange={(event) => {
                  setExistingId(event.target.value);
                  setError(null);
                }}
              >
                <option value="">Créer un nouvel établissement</option>
                {availableEstablishments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-500">
                {availableEstablishments.length > 0
                  ? "Ou rattachez le compte à un établissement déjà présent sur Kéné."
                  : "Aucun établissement de ce type n'est disponible : créez le vôtre."}
              </p>
            </div>

            {!existingId ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="signup-name">
                    Nom de l&apos;établissement
                  </label>
                  <input
                    id="signup-name"
                    className="input"
                    placeholder={
                      type === "pharmacy"
                        ? "Pharmacie de la Paix"
                        : "Hôpital Général de Bingerville"
                    }
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="signup-quartier">
                    Quartier / commune
                  </label>
                  <input
                    id="signup-quartier"
                    className="input"
                    placeholder="Cocody"
                    value={quartier}
                    onChange={(event) => setQuartier(event.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="signup-phone">
                    Téléphone
                  </label>
                  <input
                    id="signup-phone"
                    className="input"
                    placeholder="+225 07 00 00 00 00"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="signup-address">
                    Adresse
                  </label>
                  <input
                    id="signup-address"
                    className="input"
                    placeholder="Rue des Jardins, près du carrefour"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                  />
                </div>
                {type === "pharmacy" ? (
                  <div className="sm:col-span-2">
                    <label className="label" htmlFor="signup-license">
                      N° d&apos;agrément / licence (optionnel)
                    </label>
                    <input
                      id="signup-license"
                      className="input font-mono text-xs"
                      placeholder="CI-ONP-2026-0842"
                      maxLength={60}
                      value={licenseNumber}
                      onChange={(event) => setLicenseNumber(event.target.value)}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="signup-manager">
                  Responsable
                </label>
                <input
                  id="signup-manager"
                  className="input"
                  placeholder="Dr Aya Konan"
                  value={managerName}
                  onChange={(event) => setManagerName(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="signup-role">
                  Fonction (optionnel)
                </label>
                <input
                  id="signup-role"
                  className="input"
                  placeholder={
                    type === "pharmacy"
                      ? "Pharmacien titulaire"
                      : "Chef de service"
                  }
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="signup-email">
                  Email professionnel
                </label>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="username"
                  className="input"
                  placeholder="contact@monofficine.ci"
                  value={signupEmail}
                  onChange={(event) => setSignupEmail(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="signup-code">
                  Code d&apos;accès (6 à 72 car.)
                </label>
                <input
                  id="signup-code"
                  type="password"
                  autoComplete="new-password"
                  className="input"
                  placeholder="••••••••"
                  value={signupCode}
                  onChange={(event) => setSignupCode(event.target.value)}
                />
              </div>
            </div>

            {type === "pharmacy" ? (
              <div className="flex items-start gap-2 rounded-xl border border-sun-200 bg-sun-50 px-3 py-2 text-[11px] leading-relaxed text-sun-800">
                <IconAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sun-600" />
                <p>
                  Votre nouvelle officine est créée en statut{" "}
                  <strong>en attente</strong> : vous pourrez préparer votre
                  stock dès maintenant, et elle deviendra visible aux patients
                  après validation de l&apos;administrateur Kéné.
                </p>
              </div>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full text-xs disabled:opacity-60"
            >
              {type === "pharmacy" ? (
                <IconPharmacy className="h-4 w-4" />
              ) : (
                <IconHospital className="h-4 w-4" />
              )}
              {busy
                ? "Création…"
                : `Créer mon compte ${type === "pharmacy" ? "pharmacie" : "hôpital"}`}
            </button>
          </form>
        ) : (
          <form onSubmit={submitRecover} className="mt-4 space-y-3.5">
            <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
              Saisissez le code de secours reçu à la création du compte. Il est
              à usage unique : un nouveau code vous sera affiché, puis remplacé
              à chaque utilisation.
            </p>

            <div>
              <label className="label" htmlFor="recover-email">
                Email professionnel
              </label>
              <input
                id="recover-email"
                type="email"
                autoComplete="username"
                className="input"
                placeholder={
                  type === "admin"
                    ? "admin@kene.ci"
                    : "officine.rondpoint@kene.ci"
                }
                value={recoverEmail}
                onChange={(event) => {
                  setRecoverEmail(event.target.value);
                  setError(null);
                }}
              />
            </div>
            <div>
              <label className="label" htmlFor="recover-secret">
                Code de secours
              </label>
              <input
                id="recover-secret"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="input font-mono tracking-wide"
                placeholder="KNR-XXXX-XXXX"
                value={recoverSecret}
                onChange={(event) => {
                  setRecoverSecret(event.target.value.toUpperCase());
                  setError(null);
                }}
              />
            </div>
            <div>
              <label className="label" htmlFor="recover-new">
                Nouveau code d&apos;accès (6 à 72 caractères)
              </label>
              <input
                id="recover-new"
                type="password"
                autoComplete="new-password"
                className="input"
                placeholder="••••••••"
                value={recoverNew}
                onChange={(event) => {
                  setRecoverNew(event.target.value);
                  setError(null);
                }}
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full text-xs disabled:opacity-60"
            >
              <IconKey className="h-4 w-4" />
              {busy ? "Vérification…" : "Réinitialiser mon code"}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className="text-[11px] font-medium text-slate-500 hover:text-ink-900"
            >
              Revenir à la connexion
            </button>
          </form>
        )}

        <div className="mt-5 flex items-start gap-2 rounded-xl bg-sun-50 px-3 py-2.5 text-[10px] leading-relaxed text-sun-800">
          <IconShield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Les comptes sont stockés en base SQL (Prisma), les codes hachés
            (scrypt) et la session dans un cookie HttpOnly. Toute nouvelle
            pharmacie reste en attente jusqu&apos;à validation administrateur.
          </p>
        </div>
      </Card>
    </div>
  );
}
