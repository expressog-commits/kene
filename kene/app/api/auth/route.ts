import { randomUUID } from "node:crypto";
import { z } from "zod";
import { serviceId } from "@/lib/engine";
import { FEATURES } from "@/lib/features";
import { ABIDJAN_CENTER, coordsForQuartier, haversineKm } from "@/lib/geo";
import { logActivity } from "@/lib/server/activity";
import {
  clearSessionCookie,
  createSession,
  establishmentName,
  getAuth,
  publicSession,
  revokeAllSessions,
  revokeOtherSessions,
  revokeSession,
  setSessionCookie,
} from "@/lib/server/auth";
import {
  createRecoveryCode,
  createSalt,
  hashAccessCode,
  verifyAccessCode,
} from "@/lib/server/crypto";
import {
  ensureSeeded,
  getClaimedEstablishmentIds,
  getVisibleDemoAccounts,
  loadPublicState,
  mapAccountRecord,
  type AccountRecord,
} from "@/lib/server/db";
import {
  clientKey,
  isSameOrigin,
  isValidEmail,
  jsonError,
  jsonOk,
  parseZod,
  rawTrimmed,
  readJson,
  text,
} from "@/lib/server/http";
import { isMailConfigured } from "@/lib/server/mailer";
import { enqueueRecoveryEmail, processOutbox } from "@/lib/server/outbox";
import { prisma } from "@/lib/server/prisma";
import { rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  action: z.literal("login"),
  email: z.string().max(160),
  code: z.string(),
});

const registerSchema = z.object({
  action: z.literal("register"),
  type: z.enum(["pharmacy", "hospital"]),
  email: z.string().max(160),
  accessCode: z.string().optional(),
  code: z.string().optional(),
  managerName: z.string().max(80),
  role: z.string().max(80).optional(),
  existingEstablishmentId: z.string().max(60).optional(),
  name: z.string().max(120).optional(),
  quartier: z.string().max(80).optional(),
  address: z.string().max(180).optional(),
  phone: z.string().max(40).optional(),
  licenseNumber: z.string().max(60).optional(),
});

const recoverSchema = z.object({
  action: z.literal("recover"),
  email: z.string().max(160),
  recoveryCode: z.string().max(40),
  newCode: z.string(),
});

const changeCodeSchema = z.object({
  action: z.literal("change-code"),
  current: z.string(),
  next: z.string(),
});

async function sessionPayload(account: AccountRecord, signedInAt: string) {
  const [state, session, claimedEstablishmentIds] = await Promise.all([
    loadPublicState({ account }),
    publicSession(account, signedInAt),
    getClaimedEstablishmentIds(),
  ]);
  return {
    state,
    session,
    claimedEstablishmentIds,
    demoAccounts: getVisibleDemoAccounts(),
  };
}

export async function GET() {
  try {
    await ensureSeeded();
    const auth = await getAuth();
    const [state, session, claimedEstablishmentIds] = await Promise.all([
      loadPublicState(auth),
      auth
        ? publicSession(auth.account, auth.session.createdAt)
        : Promise.resolve(null),
      getClaimedEstablishmentIds(),
    ]);
    return jsonOk({
      state,
      session,
      claimedEstablishmentIds,
      demoAccounts: getVisibleDemoAccounts(),
    });
  } catch {
    return jsonError("Données indisponibles.", 500);
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError("Origine non autorisée.", 403);
  }

  const body = await readJson(request);
  if (!body) return jsonError("Requête invalide.");

  const action = text(body.action, 40);

  try {
    await ensureSeeded();
    if (action === "login") return await login(request, body);
    if (action === "register") return await register(request, body);
    if (action === "logout") return await logout();
    if (action === "change-code") return await changeCode(request, body);
    if (action === "recover") return await recover(request, body);
    return jsonError("Action inconnue.");
  } catch {
    return jsonError("Une erreur serveur est survenue.", 500);
  }
}

async function login(request: Request, body: Record<string, unknown>) {
  const parsed = parseZod(loginSchema, body);
  if (!parsed.success) {
    return jsonError("Email ou code d'accès incorrect.", 401);
  }

  const email = text(parsed.data.email, 160).toLowerCase();
  const code = rawTrimmed(parsed.data.code);

  const limit = rateLimit(clientKey(request, `login:${email}`), 8, 15 * 60_000);
  if (!limit.allowed) {
    return jsonError(
      `Trop de tentatives. Réessayez dans ${limit.retryAfter} secondes.`,
      429,
    );
  }

  if (!isValidEmail(email) || !code || code.length > 72) {
    return jsonError("Email ou code d'accès incorrect.", 401);
  }

  const row = await prisma.account.findUnique({ where: { email } });
  if (!row || !verifyAccessCode(code, row.codeSalt, row.codeHash)) {
    return jsonError("Email ou code d'accès incorrect.", 401);
  }

  if (row.type === "hospital" && !FEATURES.hospitals) {
    return jsonError("L'espace hôpital est actuellement désactivé.", 403);
  }

  const now = new Date();
  const updated = await prisma.account.update({
    where: { id: row.id },
    data: { lastLoginAt: now },
  });
  const account = mapAccountRecord(updated);
  const token = await createSession(account.id);
  setSessionCookie(token);

  const labelName = await establishmentName(account);
  const spaceLabel =
    account.type === "admin"
      ? "administration"
      : account.type === "pharmacy"
        ? "pharmacie"
        : "hôpital";
  await logActivity(
    account.type === "admin" ? "admin" : "system",
    `Connexion au back-office ${spaceLabel} — ${labelName}.`,
  );

  return jsonOk(await sessionPayload(account, now.toISOString()));
}

async function register(request: Request, body: Record<string, unknown>) {
  const limit = rateLimit(clientKey(request, "register"), 5, 60 * 60_000);
  if (!limit.allowed) {
    return jsonError(
      `Trop de créations de compte. Réessayez dans ${limit.retryAfter} secondes.`,
      429,
    );
  }

  const parsed = parseZod(registerSchema, body);
  if (!parsed.success) {
    return jsonError(parsed.error);
  }

  const { type } = parsed.data;
  if (type === "hospital" && !FEATURES.hospitals) {
    return jsonError("L'inscription hôpital est actuellement désactivée.", 403);
  }

  const email = text(parsed.data.email, 160).toLowerCase();
  const code = rawTrimmed(parsed.data.accessCode ?? parsed.data.code);
  const managerName = text(parsed.data.managerName, 80);
  const role = text(parsed.data.role, 80);
  const existingEstablishmentId = text(parsed.data.existingEstablishmentId, 60);
  const name = text(parsed.data.name, 120);
  const quartier = text(parsed.data.quartier, 80);
  const address = text(parsed.data.address, 180);
  const phone = text(parsed.data.phone, 40);
  const licenseNumber = text(parsed.data.licenseNumber, 60);

  if (!isValidEmail(email)) return jsonError("Adresse email invalide.");
  if (code.length < 6 || code.length > 72) {
    return jsonError("Le code d'accès doit contenir entre 6 et 72 caractères.");
  }
  if (!managerName) return jsonError("Indiquez le nom du responsable.");

  const emailTaken = await prisma.account.findUnique({ where: { email } });
  if (emailTaken) {
    return jsonError("Un compte existe déjà avec cet email.", 409);
  }

  let establishmentId = existingEstablishmentId;
  let estName = name;

  if (establishmentId) {
    if (type === "pharmacy") {
      const pharmacy = await prisma.pharmacy.findUnique({
        where: { id: establishmentId },
      });
      if (!pharmacy) return jsonError("Établissement introuvable.", 404);
      estName = pharmacy.name;
    } else {
      const hospital = await prisma.hospital.findUnique({
        where: { id: establishmentId },
      });
      if (!hospital) return jsonError("Établissement introuvable.", 404);
      estName = hospital.name;
    }

    const claimed = await prisma.account.findFirst({
      where: { establishmentId },
    });
    if (claimed) {
      return jsonError(
        "Cet établissement dispose déjà d'un compte professionnel.",
        409,
      );
    }
  } else {
    if (!name || !quartier || !address || !phone) {
      return jsonError(
        "Complétez le nom, le quartier, l'adresse et le téléphone.",
      );
    }
    establishmentId = randomUUID();
  }

  const now = new Date();
  const codeSalt = createSalt();
  const recoveryCode = createRecoveryCode();
  const recoverySalt = createSalt();
  const accountId = randomUUID();
  const finalRole =
    role ||
    (type === "pharmacy"
      ? "Pharmacien responsable"
      : "Responsable des urgences");

  const createdRow = await prisma.$transaction(async (tx) => {
    if (!existingEstablishmentId) {
      const coords = coordsForQuartier(quartier);
      const distanceKm = haversineKm(ABIDJAN_CENTER, coords);

      if (type === "pharmacy") {
        const medicines = await tx.medicine.findMany();
        await tx.pharmacy.create({
          data: {
            id: establishmentId,
            name,
            quartier,
            address,
            phone,
            whatsapp: phone,
            distanceKm,
            latitude: coords.lat,
            longitude: coords.lng,
            openFrom: 8,
            openTo: 20,
            onDuty: false,
            dutyNote: "",
            verificationStatus: "pending",
            licenseNumber:
              licenseNumber ||
              `CI-ONP-${now.getFullYear()}-${establishmentId.slice(0, 4).toUpperCase()}`,
            verifiedAt: null,
            updatedAt: now,
          },
        });
        if (medicines.length > 0) {
          await tx.stockItem.createMany({
            data: medicines.map((medicine) => ({
              pharmacyId: establishmentId,
              medicineId: medicine.id,
              price: medicine.basePrice,
              quantity: 0,
              updatedAt: now,
            })),
          });
        }
      } else {
        await tx.hospital.create({
          data: {
            id: establishmentId,
            name,
            quartier,
            address,
            phone,
            whatsapp: phone,
            distanceKm,
            latitude: coords.lat,
            longitude: coords.lng,
            updatedAt: now,
            units: {
              create: {
                id: serviceId("Urgences adultes", []),
                label: "Urgences adultes",
                totalBeds: 10,
                occupiedBeds: 0,
                waitingMinutes: 15,
              },
            },
          },
        });
      }
    }

    return tx.account.create({
      data: {
        id: accountId,
        type,
        establishmentId,
        email,
        managerName,
        role: finalRole,
        createdAt: now,
        lastLoginAt: now,
        codeSalt,
        codeHash: hashAccessCode(code, codeSalt),
        recoverySalt,
        recoveryHash: hashAccessCode(recoveryCode, recoverySalt),
      },
    });
  });

  const account = mapAccountRecord(createdRow);
  const token = await createSession(account.id);
  setSessionCookie(token);

  await logActivity(
    type === "pharmacy" ? "pharmacy" : "system",
    `Création du compte ${type === "pharmacy" ? "pharmacie" : "hôpital"} — ${estName}.`,
  );

  if (isMailConfigured()) {
    await enqueueRecoveryEmail({
      accountId: account.id,
      to: account.email,
      managerName: account.managerName,
      establishmentName: estName,
      recoveryCode,
      kind: "created",
    });
    void processOutbox();
  }

  return jsonOk({
    ...(await sessionPayload(account, now.toISOString())),
    recoveryCode,
  });
}

async function recover(request: Request, body: Record<string, unknown>) {
  const rawEmail = text(body.email, 160).toLowerCase();
  const limit = rateLimit(
    clientKey(request, `recover:${rawEmail}`),
    5,
    15 * 60_000,
  );
  if (!limit.allowed) {
    return jsonError(
      `Trop de tentatives. Réessayez dans ${limit.retryAfter} secondes.`,
      429,
    );
  }

  const parsed = parseZod(recoverSchema, body);
  if (!parsed.success) {
    return jsonError("Email ou code de secours incorrect.", 401);
  }

  const email = text(parsed.data.email, 160).toLowerCase();
  const recoveryCode = text(parsed.data.recoveryCode, 40).toUpperCase();
  const newCode = rawTrimmed(parsed.data.newCode);

  if (!isValidEmail(email) || !recoveryCode) {
    return jsonError("Email ou code de secours incorrect.", 401);
  }
  if (newCode.length < 6 || newCode.length > 72) {
    return jsonError(
      "Le nouveau code d'accès doit contenir entre 6 et 72 caractères.",
    );
  }

  const row = await prisma.account.findUnique({ where: { email } });
  if (
    !row ||
    !row.recoveryHash ||
    !row.recoverySalt ||
    !verifyAccessCode(recoveryCode, row.recoverySalt, row.recoveryHash)
  ) {
    return jsonError("Email ou code de secours incorrect.", 401);
  }

  const codeSalt = createSalt();
  const nextRecoveryCode = createRecoveryCode();
  const recoverySalt = createSalt();

  await prisma.account.update({
    where: { id: row.id },
    data: {
      codeSalt,
      codeHash: hashAccessCode(newCode, codeSalt),
      recoverySalt,
      recoveryHash: hashAccessCode(nextRecoveryCode, recoverySalt),
    },
  });

  await revokeAllSessions(row.id);
  clearSessionCookie();

  const account = mapAccountRecord(row);
  const labelName = await establishmentName(account);
  await logActivity(
    "system",
    `Code d'accès réinitialisé par code de secours — ${labelName}.`,
  );

  if (isMailConfigured()) {
    await enqueueRecoveryEmail({
      accountId: account.id,
      to: account.email,
      managerName: account.managerName,
      establishmentName: labelName,
      recoveryCode: nextRecoveryCode,
      kind: "reset",
    });
    void processOutbox();
  }

  return jsonOk({
    recovered: true,
    newRecoveryCode: nextRecoveryCode,
  });
}

async function logout() {
  const auth = await getAuth();
  if (auth) {
    const labelName = await establishmentName(auth.account);
    await logActivity("system", `Déconnexion du back-office — ${labelName}.`);
    await revokeSession();
  }
  clearSessionCookie();

  const [state, claimedEstablishmentIds] = await Promise.all([
    loadPublicState(null),
    getClaimedEstablishmentIds(),
  ]);

  return jsonOk({
    state,
    session: null,
    claimedEstablishmentIds,
    demoAccounts: getVisibleDemoAccounts(),
  });
}

async function changeCode(
  request: Request,
  body: Record<string, unknown>,
) {
  const limit = rateLimit(clientKey(request, "code-change"), 10, 15 * 60_000);
  if (!limit.allowed) {
    return jsonError(
      `Trop de tentatives. Réessayez dans ${limit.retryAfter} secondes.`,
      429,
    );
  }

  const parsed = parseZod(changeCodeSchema, body);
  if (!parsed.success) {
    return jsonError(parsed.error);
  }

  const current = rawTrimmed(parsed.data.current);
  const next = rawTrimmed(parsed.data.next);
  if (next.length < 6 || next.length > 72) {
    return jsonError("Le nouveau code doit contenir entre 6 et 72 caractères.");
  }

  const auth = await getAuth();
  if (!auth) return jsonError("Connectez-vous pour modifier le code.", 401);

  if (
    !current ||
    current.length > 72 ||
    !verifyAccessCode(current, auth.account.codeSalt, auth.account.codeHash)
  ) {
    return jsonError("Code d'accès actuel incorrect.", 401);
  }
  if (current === next) {
    return jsonError("Le nouveau code est identique à l'actuel.");
  }

  const salt = createSalt();
  await prisma.account.update({
    where: { id: auth.account.id },
    data: {
      codeSalt: salt,
      codeHash: hashAccessCode(next, salt),
    },
  });

  await revokeOtherSessions(auth.account.id);
  await logActivity(
    "system",
    `Code d'accès modifié pour ${auth.account.email}.`,
  );

  return jsonOk(
    await sessionPayload(auth.account, new Date().toISOString()),
  );
}
