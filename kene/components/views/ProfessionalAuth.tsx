"use client";

import { useEffect, useState } from "react";
import { useStore } from "../store";
import { cn } from "../ui";
import {
  IconArrowLeft,
  IconArrowRight,
  IconHospital,
  IconKey,
  IconLock,
  IconLogo,
  IconLogout,
  IconPharmacy,
} from "../icons";
import { FEATURES } from "@/lib/features";
import { COMMUNE_COORDS } from "@/lib/geo";
import type { ProfessionalType } from "@/lib/types";

const ABIDJAN_COMMUNES = Object.keys(COMMUNE_COORDS);

type Mode = "login" | "signup" | "recover";
type EstablishmentType = "pharmacy" | "hospital";

function normalizeType(value: ProfessionalType): EstablishmentType {
  if (value === "admin") return "pharmacy";
  if (!FEATURES.hospitals && value === "hospital") return "pharmacy";
  return value;
}

const DARK_INPUT =
  "h-12 w-full rounded-lg border border-white/15 bg-[#111111] px-3.5 text-[15px] text-white placeholder:text-neutral-500 transition focus:border-white/40 focus:outline-none";

const DARK_LABEL = "mb-1.5 block text-xs font-medium text-neutral-400";

export default function ProfessionalAuth({
  defaultType,
  onOpenOther,
  onBack,
}: {
  defaultType: ProfessionalType;
  onOpenOther: (type: EstablishmentType) => void;
  onBack: () => void;
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
  const [quartier, setQuartier] = useState("Cocody");
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

  const visibleDemoAccounts = FEATURES.showDemoAccounts
    ? demoAccounts.filter(
        (account) =>
          account.type !== "admin" &&
          (FEATURES.hospitals || account.type !== "hospital"),
      )
    : [];

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
      <div className="flex min-h-screen flex-col bg-[#0A0A0A] text-white">
        <header className="flex items-center justify-between px-5 py-4 sm:px-8">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-2 text-sm font-medium text-neutral-300 transition hover:text-white"
          >
            <IconArrowLeft className="h-4 w-4" />
            <span>Retour</span>
          </button>
        </header>
        <div className="flex flex-1 items-center justify-center px-5 py-8">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111111] p-7 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white">
              <IconLock className="h-5 w-5" />
            </span>
            <h1 className="mt-4 font-display text-xl font-bold text-white">
              Vous êtes connecté
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              {establishment?.name ?? session.establishmentName}
            </p>
            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                onClick={() => onOpenOther(targetType)}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-white text-[15px] font-semibold text-black transition hover:bg-neutral-200"
              >
                <span>Ouvrir mon espace</span>
                <IconArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  notify("Déconnecté.");
                }}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-transparent text-sm font-medium text-white transition hover:bg-white/[0.06]"
              >
                <IconLogout className="h-4 w-4" />
                <span>Changer de compte</span>
              </button>
            </div>
          </div>
        </div>
      </div>
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

  return (
    <div className="flex min-h-screen flex-col bg-[#0A0A0A] text-white">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[44px] items-center gap-2.5 rounded-lg px-2 text-sm font-medium text-neutral-300 transition hover:text-white"
        >
          <IconLogo className="h-7 w-7 text-brand-500" />
          <IconArrowLeft className="h-4 w-4 text-neutral-400" />
          <span>Pharmacies</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setError(null);
          }}
          className="inline-flex h-9 items-center rounded-lg border border-white/15 bg-[#111111] px-4 text-sm font-medium text-white transition hover:bg-white/10"
        >
          {mode === "signup" ? "Se connecter" : "S'inscrire"}
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-8">
        <div
          className={cn(
            "w-full",
            mode === "signup" ? "max-w-[440px]" : "max-w-[360px]",
          )}
        >
          <h1 className="text-center font-display text-[28px] font-bold tracking-tight text-white">
            {mode === "login"
              ? "Connectez-vous à Kéné"
              : mode === "signup"
                ? "Inscrivez votre pharmacie"
                : "Réinitialiser votre code"}
          </h1>
          <p className="mt-2 text-center text-sm text-neutral-400">
            {mode === "login"
              ? "Espace pharmacie vérifiée"
              : mode === "signup"
                ? "Publiez vos stocks et vos gardes en temps réel"
                : "Utilisez votre code de secours reçu à l'inscription"}
          </p>

          {allowedTypes.length > 1 && mode !== "recover" ? (
            <div className="mt-6 grid grid-cols-2 gap-2">
              {allowedTypes.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => switchType(item)}
                  aria-pressed={type === item}
                  className={cn(
                    "flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition",
                    type === item
                      ? "border-white bg-white text-black"
                      : "border-white/15 bg-[#111111] text-neutral-300 hover:bg-white/[0.06]",
                  )}
                >
                  {item === "pharmacy" ? (
                    <IconPharmacy className="h-4 w-4" />
                  ) : (
                    <IconHospital className="h-4 w-4" />
                  )}
                  <span>{item === "pharmacy" ? "Pharmacie" : "Hôpital"}</span>
                </button>
              ))}
            </div>
          ) : null}

          {mode === "login" ? (
            <div className="mt-7">
              <form onSubmit={submitLogin} className="space-y-3">
                <div>
                  <label className="sr-only" htmlFor="pro-email">
                    Adresse e-mail
                  </label>
                  <input
                    id="pro-email"
                    type="email"
                    autoComplete="username"
                    placeholder="Adresse e-mail"
                    className={DARK_INPUT}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError(null);
                    }}
                  />
                </div>
                <div>
                  <label className="sr-only" htmlFor="pro-code">
                    Mot de passe / code d&apos;accès
                  </label>
                  <input
                    id="pro-code"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Mot de passe / code d'accès"
                    className={DARK_INPUT}
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
                    className="rounded-lg border border-rose-500/40 bg-rose-950/60 px-3.5 py-2.5 text-sm font-medium text-rose-200"
                  >
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-white text-[15px] font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-50"
                >
                  {busy ? "Connexion…" : "Continuer par e-mail"}
                </button>
              </form>

              <div className="mt-4 space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setMode("recover");
                    setRecoverEmail(email);
                    setError(null);
                  }}
                  className="flex h-12 w-full items-center justify-center gap-2.5 rounded-lg border border-white/15 bg-[#0F0F0F] px-4 text-sm font-medium text-white transition hover:bg-white/[0.06]"
                >
                  <IconKey className="h-4 w-4 text-neutral-400" />
                  <span>Continuer avec le code de secours</span>
                </button>

                {FEATURES.showDemoAccounts && visibleDemoAccounts.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowAccounts((value) => !value)}
                    aria-expanded={showAccounts}
                    aria-controls="demo-accounts"
                    className="block w-full py-2 text-center text-sm font-medium text-neutral-300 transition hover:text-white"
                  >
                    {showAccounts
                      ? "Masquer les autres options"
                      : "Afficher d'autres options"}
                  </button>
                ) : null}
              </div>

              {FEATURES.showDemoAccounts && showAccounts ? (
                <div
                  id="demo-accounts"
                  className="scroll-thin mt-3 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-[#111111] p-2.5"
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
                        className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#161616] px-3 py-2 text-left transition hover:border-white/30"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white">
                            {displayTitle}
                          </span>
                          <span className="block truncate text-xs text-neutral-400">
                            {account.email}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-md bg-white/10 px-2.5 py-1 font-mono text-xs font-semibold text-white">
                          {account.accessCode}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <p className="mt-7 text-center text-sm text-neutral-400">
                Vous n&apos;avez pas de compte ?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                  className="font-medium text-sky-400 hover:underline"
                >
                  Inscrivez-vous
                </button>
              </p>
            </div>
          ) : mode === "signup" ? (
            <div className="mt-7">
              <form onSubmit={submitSignup} className="space-y-4">
                <div>
                  <label className={DARK_LABEL} htmlFor="signup-establishment">
                    Votre officine
                  </label>
                  <select
                    id="signup-establishment"
                    className={DARK_INPUT}
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
                </div>

                {!existingId ? (
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className={DARK_LABEL} htmlFor="signup-name">
                        Nom de la pharmacie
                      </label>
                      <input
                        id="signup-name"
                        className={DARK_INPUT}
                        placeholder="Pharmacie de la Paix"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </div>
                    <div>
                      <label className={DARK_LABEL} htmlFor="signup-quartier">
                        Quartier / commune
                      </label>
                      <select
                        id="signup-quartier"
                        className={DARK_INPUT}
                        value={quartier}
                        onChange={(event) => setQuartier(event.target.value)}
                      >
                        {ABIDJAN_COMMUNES.map((commune) => (
                          <option key={commune} value={commune}>
                            {commune}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={DARK_LABEL} htmlFor="signup-phone">
                        Téléphone
                      </label>
                      <input
                        id="signup-phone"
                        className={DARK_INPUT}
                        placeholder="+225 07 00 00 00 00"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={DARK_LABEL} htmlFor="signup-address">
                        Adresse
                      </label>
                      <input
                        id="signup-address"
                        className={DARK_INPUT}
                        placeholder="Rue des Jardins, près du carrefour"
                        value={address}
                        onChange={(event) => setAddress(event.target.value)}
                      />
                    </div>
                    {type === "pharmacy" ? (
                      <div className="sm:col-span-2">
                        <label className={DARK_LABEL} htmlFor="signup-license">
                          N° d&apos;agrément / licence (optionnel)
                        </label>
                        <input
                          id="signup-license"
                          className={cn(DARK_INPUT, "font-mono")}
                          placeholder="CI-ONP-2026-0842"
                          maxLength={60}
                          value={licenseNumber}
                          onChange={(event) => setLicenseNumber(event.target.value)}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-3.5 sm:grid-cols-2">
                  <div>
                    <label className={DARK_LABEL} htmlFor="signup-manager">
                      Responsable
                    </label>
                    <input
                      id="signup-manager"
                      className={DARK_INPUT}
                      placeholder="Dr Aya Konan"
                      value={managerName}
                      onChange={(event) => setManagerName(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className={DARK_LABEL} htmlFor="signup-role">
                      Fonction (optionnel)
                    </label>
                    <input
                      id="signup-role"
                      className={DARK_INPUT}
                      placeholder="Pharmacien titulaire"
                      value={role}
                      onChange={(event) => setRole(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className={DARK_LABEL} htmlFor="signup-email">
                      Email professionnel
                    </label>
                    <input
                      id="signup-email"
                      type="email"
                      autoComplete="username"
                      className={DARK_INPUT}
                      placeholder="contact@monofficine.ci"
                      value={signupEmail}
                      onChange={(event) => setSignupEmail(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className={DARK_LABEL} htmlFor="signup-code">
                      Mot de passe (6 à 72 car.)
                    </label>
                    <input
                      id="signup-code"
                      type="password"
                      autoComplete="new-password"
                      className={DARK_INPUT}
                      placeholder="••••••••"
                      value={signupCode}
                      onChange={(event) => setSignupCode(event.target.value)}
                    />
                  </div>
                </div>

                {error ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-rose-500/40 bg-rose-950/60 px-3.5 py-2.5 text-sm font-medium text-rose-200"
                  >
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-white text-[15px] font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-50"
                >
                  {busy ? "Création…" : "Créer mon compte"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-neutral-400">
                Vous avez déjà un compte ?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="font-medium text-sky-400 hover:underline"
                >
                  Se connecter
                </button>
              </p>
            </div>
          ) : (
            <div className="mt-7">
              <form onSubmit={submitRecover} className="space-y-3.5">
                <div>
                  <label className={DARK_LABEL} htmlFor="recover-email">
                    Email professionnel
                  </label>
                  <input
                    id="recover-email"
                    type="email"
                    autoComplete="username"
                    className={DARK_INPUT}
                    placeholder="contact@monofficine.ci"
                    value={recoverEmail}
                    onChange={(event) => {
                      setRecoverEmail(event.target.value);
                      setError(null);
                    }}
                  />
                </div>
                <div>
                  <label className={DARK_LABEL} htmlFor="recover-secret">
                    Code de secours
                  </label>
                  <input
                    id="recover-secret"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    className={cn(DARK_INPUT, "font-mono tracking-wide")}
                    placeholder="KNR-XXXX-XXXX"
                    value={recoverSecret}
                    onChange={(event) => {
                      setRecoverSecret(event.target.value.toUpperCase());
                      setError(null);
                    }}
                  />
                </div>
                <div>
                  <label className={DARK_LABEL} htmlFor="recover-new">
                    Nouveau mot de passe (6 à 72 caractères)
                  </label>
                  <input
                    id="recover-new"
                    type="password"
                    autoComplete="new-password"
                    className={DARK_INPUT}
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
                    className="rounded-lg border border-rose-500/40 bg-rose-950/60 px-3.5 py-2.5 text-sm font-medium text-rose-200"
                  >
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-white text-[15px] font-semibold text-black transition hover:bg-neutral-200 disabled:opacity-50"
                >
                  {busy ? "Vérification…" : "Réinitialiser le code"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center text-sm font-medium text-neutral-300 transition hover:text-white"
              >
                ← Retour à la connexion
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-neutral-500">
        Outil d&apos;information uniquement · Politique de confidentialité
      </footer>
    </div>
  );
}
