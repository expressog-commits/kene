"use client";

import { useEffect, useState } from "react";
import { useStore } from "../store";
import { Card, cn } from "../ui";
import {
  IconArrowRight,
  IconCheck,
  IconHospital,
  IconKey,
  IconLock,
  IconLogout,
  IconPharmacy,
} from "../icons";
import { BedGrid3D, Capsule3D, GlowOrb } from "../visuals";
import { FEATURES } from "@/lib/features";
import type { ProfessionalType } from "@/lib/types";

type Mode = "login" | "signup" | "recover";
type EstablishmentType = "pharmacy" | "hospital";

function normalizeType(value: ProfessionalType): EstablishmentType {
  if (value === "admin") return "pharmacy";
  if (!FEATURES.hospitals && value === "hospital") return "pharmacy";
  return value;
}

export default function ProfessionalAuth({
  defaultType,
  onOpenOther,
}: {
  defaultType: ProfessionalType;
  onOpenOther: (type: EstablishmentType) => void;
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
  const [type, setType] = useState<EstablishmentType>(() =>
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
  }, [defaultType]);

  const allowedTypes: EstablishmentType[] = FEATURES.hospitals
    ? ["pharmacy", "hospital"]
    : ["pharmacy"];

  const visibleDemoAccounts = demoAccounts.filter(
    (account) =>
      account.type !== "admin" &&
      (FEATURES.hospitals || account.type !== "hospital"),
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
      : state.hospitals
          .filter((item) => !claimed.has(item.id))
          .map((item) => ({
            id: item.id,
            label: `${item.name} — ${item.quartier}`,
          }));

  const switchType = (next: EstablishmentType) => {
    const resolved = normalizeType(next);
    setType(resolved);
    setExistingId("");
    setError(null);
  };

  if (session) {
    const establishment =
      session.type === "pharmacy"
        ? state.pharmacies.find((item) => item.id === session.establishmentId)
        : session.type === "hospital"
          ? state.hospitals.find((item) => item.id === session.establishmentId)
          : null;

    const targetType = normalizeType(
      session.type === "hospital" ? "hospital" : "pharmacy",
    );

    return (
      <Card className="mx-auto max-w-xl p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <IconLock className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-ink-900">
          Vous êtes connecté
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
          {establishment?.name ?? session.establishmentName} — ouvrez votre
          espace pour gérer vos stocks ou changez de compte.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => onOpenOther(targetType)}
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
    if (type !== normalizeType(defaultType)) {
      onOpenOther(type);
    }
  };

  const submitSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
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
    notify("Compte pharmacie créé — votre officine est en ligne.");
    if (type !== normalizeType(defaultType)) {
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
    notify("Code réinitialisé — connectez-vous avec votre nouveau code.");
  };

  const benefitLines = [
    "Stocks, prix FCFA et horaires de garde en temps réel",
    "Import rapide de votre stock depuis Excel ou CSV",
    "Géolocalisation GPS et contact direct téléphone / WhatsApp",
    "Inscription gratuite pour votre officine",
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
      <div className="relative overflow-hidden rounded-2xl bg-ink-900 px-6 py-8 text-white shadow-lift">
        <div className="hero-grid absolute inset-0 opacity-50" />
        <GlowOrb className="-right-16 -top-20 h-56 w-56" tone="brand" />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-brand-200">
            <IconPharmacy className="h-3.5 w-3.5" />
            Espace Pharmacie Kéné
          </span>
          <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight">
            Publiez vos stocks et vos gardes
            <span className="block text-brand-300">en quelques clics.</span>
          </h2>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-slate-300">
            Connectez votre officine pour informer directement les patients de
            la disponibilité de leurs médicaments, de vos horaires et de votre
            position GPS.
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

          {FEATURES.hospitals ? (
            <BedGrid3D className="mt-6 h-40" />
          ) : (
            <div className="mt-6 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-sm">
              <Capsule3D className="h-12 w-24 shrink-0 -rotate-12" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">
                  Stocks visibles en temps réel
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">
                  Mettez à jour vos prix, vos gardes 24h/24 et votre position
                  GPS à tout moment.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            {type === "pharmacy" ? (
              <IconPharmacy className="h-4 w-4" />
            ) : (
              <IconHospital className="h-4 w-4" />
            )}
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink-900">
              {mode === "login"
                ? "Connexion pharmacie"
                : mode === "signup"
                  ? "Inscrire ma pharmacie"
                  : "Mot de passe / code d'accès oublié"}
            </h2>
            <p className="text-[11px] text-slate-500">
              Espace Pharmacie · Kéné
            </p>
          </div>
        </div>

        {allowedTypes.length > 1 ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
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
                ) : (
                  <IconHospital className="h-4 w-4" />
                )}
                {item === "pharmacy" ? "Pharmacie" : "Hôpital"}
              </button>
            ))}
          </div>
        ) : null}

        {mode !== "recover" ? (
          <div className="mt-4 flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
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
                    : "text-slate-600 hover:text-ink-900",
                )}
              >
                {item === "login" ? "Connexion" : "Inscrire ma pharmacie"}
              </button>
            ))}
          </div>
        ) : null}

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
                placeholder="officine.rondpoint@kene.ci"
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
                Mot de passe / code d&apos;accès
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
                className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
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
                Mot de passe oublié ?
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
                    account.type === "pharmacy"
                      ? pharmacyEst?.name ?? "Pharmacie"
                      : hospitalEst?.name ?? "Établissement";

                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => {
                        setType(normalizeType(account.type));
                        setMode("login");
                        setEmail(account.email);
                        setCode(account.accessCode);
                        setError(null);
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg bg-white px-2.5 py-2 text-left transition hover:shadow-card"
                    >
                      <span className="min-w-0 flex-1">
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
        ) : mode === "signup" ? (
          <form onSubmit={submitSignup} className="mt-4 space-y-3.5">
            <div>
              <label className="label" htmlFor="signup-establishment">
                Votre officine
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
                <option value="">Inscrire une nouvelle pharmacie</option>
                {availableEstablishments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-500">
                {availableEstablishments.length > 0
                  ? "Ou rattachez votre compte à une officine déjà référencée sur Kéné."
                  : "Renseignez les coordonnées de votre pharmacie ci-dessous."}
              </p>
            </div>

            {!existingId ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="signup-name">
                    Nom de la pharmacie
                  </label>
                  <input
                    id="signup-name"
                    className="input"
                    placeholder="Pharmacie de la Paix"
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
                  placeholder="Pharmacien titulaire"
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
                  Mot de passe / code (6 à 72 car.)
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

            {error ? (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full text-xs disabled:opacity-60"
            >
              <IconPharmacy className="h-4 w-4" />
              {busy ? "Création…" : "Créer mon compte pharmacie"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitRecover} className="mt-4 space-y-3.5">
            <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
              Vous avez oublié votre mot de passe ? Saisissez votre email
              professionnel et le code de secours reçu à l&apos;inscription pour
              définir un nouveau code d&apos;accès.
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
                placeholder="officine.rondpoint@kene.ci"
                value={recoverEmail}
                onChange={(event) => {
                  setRecoverEmail(event.target.value);
                  setError(null);
                }}
              />
            </div>
            <div>
              <label className="label" htmlFor="recover-secret">
                Code de secours reçu à l&apos;inscription
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
                Nouveau mot de passe / code d&apos;accès (6 à 72 caractères)
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
                className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
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
              className="text-xs font-medium text-slate-600 hover:text-ink-900"
            >
              ← Retour à la connexion
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
