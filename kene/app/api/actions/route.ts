import { randomUUID } from "node:crypto";
import { z } from "zod";
import { parseStockCsv, type CsvStockRow } from "@/lib/csv";
import { CATEGORIES, normalize, serviceId, unitAvailable } from "@/lib/engine";
import { FEATURES } from "@/lib/features";
import { ABIDJAN_CENTER, coordsForQuartier, haversineKm } from "@/lib/geo";
import { logActivity } from "@/lib/server/activity";
import { clearSessionCookie, getAuth } from "@/lib/server/auth";
import {
  ensureSeeded,
  getClaimedEstablishmentIds,
  getVisibleDemoAccounts,
  loadPublicState,
  resetDatabase,
} from "@/lib/server/db";
import {
  clientKey,
  integer,
  isSameOrigin,
  jsonError,
  jsonOk,
  parseZod,
  readJson,
  text,
} from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";
import { rateLimit } from "@/lib/server/rate-limit";
import type { BulkImportSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

type AuthContext = Awaited<ReturnType<typeof getAuth>>;

const updatePharmacySchema = z.object({
  pharmacyId: z.string().min(1).max(60),
  patch: z
    .object({
      name: z.string().max(120).optional(),
      quartier: z.string().max(80).optional(),
      address: z.string().max(180).optional(),
      phone: z.string().max(40).optional(),
      whatsapp: z.string().max(40).optional(),
      dutyNote: z.string().max(160).optional(),
      licenseNumber: z.string().max(60).optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      openFrom: z.coerce.number().int().min(0).max(23).optional(),
      openTo: z.coerce.number().int().min(1).max(24).optional(),
    })
    .strict(),
});

const updateStockSchema = z.object({
  pharmacyId: z.string().min(1).max(60),
  medicineId: z.string().min(1).max(60),
  price: z.coerce.number().finite().optional(),
  quantity: z.coerce.number().finite().optional(),
});

const bulkRowSchema = z.object({
  line: z.coerce.number().int().min(1).optional(),
  name: z.string().min(1).max(120),
  dci: z.string().max(120).optional().default(""),
  form: z.string().max(120).optional().default(""),
  category: z.string().max(80).optional().default(""),
  price: z.coerce.number().finite(),
  quantity: z.coerce.number().finite(),
});

const setVerificationSchema = z.object({
  pharmacyId: z.string().min(1).max(60),
  status: z.enum(["verified", "pending", "suspended"]),
});

function sameOriginGuard(request: Request) {
  return isSameOrigin(request) ? null : jsonError("Origine non autorisée.", 403);
}

function ownedPharmacy(auth: AuthContext, id: string) {
  if (!auth || auth.account.type !== "pharmacy") return false;
  return auth.account.establishmentId === id;
}

function ownedHospital(auth: AuthContext, id: string) {
  if (!auth || auth.account.type !== "hospital") return false;
  return auth.account.establishmentId === id;
}

export async function GET() {
  try {
    await ensureSeeded();
    const auth = await getAuth();
    return jsonOk({ state: await loadPublicState(auth) });
  } catch {
    return jsonError("Données indisponibles.", 500);
  }
}

export async function POST(request: Request) {
  const originError = sameOriginGuard(request);
  if (originError) return originError;

  const limit = rateLimit(clientKey(request, "actions"), 240, 60_000);
  if (!limit.allowed) {
    return jsonError(
      `Trop de requêtes. Réessayez dans ${limit.retryAfter} secondes.`,
      429,
    );
  }

  const body = await readJson(request);
  if (!body) return jsonError("Requête invalide.");

  const action = text(body.action, 40);

  if (action === "resetDemo") {
    if (process.env.KENE_ALLOW_DEMO_RESET !== "true") {
      return jsonError("La réinitialisation est désactivée en production.", 403);
    }
    const resetLimit = rateLimit(
      clientKey(request, "reset-demo"),
      3,
      10 * 60_000,
    );
    if (!resetLimit.allowed) {
      return jsonError(
        `Trop de réinitialisations. Réessayez dans ${resetLimit.retryAfter} secondes.`,
        429,
      );
    }
  }

  try {
    await ensureSeeded();
    const auth = await getAuth();

    switch (action) {
      case "updatePharmacy":
        return await updatePharmacy(auth, body);
      case "updateStock":
        return await updateStock(auth, body);
      case "addStockMedicine":
        return await addStockMedicine(auth, body);
      case "removeStockItem":
        return await removeStockItem(auth, body);
      case "publishStock":
        return await publishStock(auth, body);
      case "toggleDuty":
        return await toggleDuty(auth, body);
      case "bulkImportStock":
        return await bulkImportStock(auth, body);
      case "setPharmacyVerification":
        return await setPharmacyVerification(auth, body);
      case "updateHospital":
        return await updateHospital(auth, body);
      case "updateUnit":
        return await updateUnit(auth, body);
      case "addUnit":
        return await addUnit(auth, body);
      case "removeUnit":
        return await removeUnit(auth, body);
      case "publishBeds":
        return await publishBeds(auth, body);
      case "resetDemo": {
        await resetDatabase();
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
      default:
        return jsonError("Action inconnue.");
    }
  } catch {
    return jsonError("Une erreur serveur est survenue.", 500);
  }
}

async function updatePharmacy(auth: AuthContext, body: Record<string, unknown>) {
  const pharmacyId = text(body.pharmacyId, 60);
  if (!ownedPharmacy(auth, pharmacyId)) {
    return jsonError("Vous ne pouvez modifier que votre officine.", 403);
  }

  const parsed = parseZod(updatePharmacySchema, {
    pharmacyId,
    patch: body.patch,
  });
  if (!parsed.success) {
    return jsonError(parsed.error);
  }

  const pharmacy = await prisma.pharmacy.findUnique({
    where: { id: pharmacyId },
  });
  if (!pharmacy) return jsonError("Pharmacie introuvable.", 404);

  const values = parsed.data.patch;
  if (values.name !== undefined && !values.name.trim()) {
    return jsonError("Le nom de l'officine est obligatoire.");
  }

  const nextOpenFrom =
    values.openFrom !== undefined ? values.openFrom : pharmacy.openFrom;
  const nextOpenTo =
    values.openTo !== undefined ? values.openTo : pharmacy.openTo;
  if (nextOpenTo <= nextOpenFrom) {
    return jsonError(
      "L'heure de fermeture doit être postérieure à l'heure d'ouverture.",
    );
  }

  const nextQuartier =
    values.quartier !== undefined ? values.quartier.trim() : pharmacy.quartier;
  let nextLat =
    values.latitude !== undefined ? values.latitude : pharmacy.latitude;
  let nextLng =
    values.longitude !== undefined ? values.longitude : pharmacy.longitude;

  if (
    values.quartier !== undefined &&
    values.quartier.trim() !== pharmacy.quartier &&
    values.latitude === undefined &&
    values.longitude === undefined
  ) {
    const coords = coordsForQuartier(nextQuartier);
    nextLat = coords.lat;
    nextLng = coords.lng;
  }

  const nextDistance = haversineKm(ABIDJAN_CENTER, {
    lat: nextLat,
    lng: nextLng,
  });
  const now = new Date();

  const updated = await prisma.pharmacy.update({
    where: { id: pharmacyId },
    data: {
      name: values.name !== undefined ? values.name.trim() : pharmacy.name,
      quartier: nextQuartier,
      address:
        values.address !== undefined ? values.address.trim() : pharmacy.address,
      phone: values.phone !== undefined ? values.phone.trim() : pharmacy.phone,
      whatsapp:
        values.whatsapp !== undefined
          ? values.whatsapp.trim()
          : pharmacy.whatsapp,
      dutyNote:
        values.dutyNote !== undefined
          ? values.dutyNote.trim()
          : pharmacy.dutyNote,
      licenseNumber:
        values.licenseNumber !== undefined
          ? values.licenseNumber.trim()
          : pharmacy.licenseNumber,
      latitude: nextLat,
      longitude: nextLng,
      distanceKm: nextDistance,
      openFrom: nextOpenFrom,
      openTo: nextOpenTo,
      updatedAt: now,
    },
  });

  await logActivity("pharmacy", `${updated.name} : fiche officine mise à jour.`);
  return jsonOk({
    state: await loadPublicState(auth),
    pharmacy: {
      ...updated,
      verifiedAt: updated.verifiedAt ? updated.verifiedAt.toISOString() : undefined,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

async function updateStock(auth: AuthContext, body: Record<string, unknown>) {
  const parsed = parseZod(updateStockSchema, body);
  if (!parsed.success) return jsonError(parsed.error);

  const { pharmacyId, medicineId } = parsed.data;
  if (!ownedPharmacy(auth, pharmacyId)) {
    return jsonError(
      "Vous ne pouvez modifier que le stock de votre officine.",
      403,
    );
  }

  const existing = await prisma.stockItem.findUnique({
    where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
  });
  if (!existing) return jsonError("Référence introuvable.", 404);

  const now = new Date();
  await prisma.$transaction([
    prisma.stockItem.update({
      where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
      data: {
        price:
          parsed.data.price !== undefined
            ? integer(parsed.data.price, 0, 1_000_000, existing.price)
            : existing.price,
        quantity:
          parsed.data.quantity !== undefined
            ? integer(parsed.data.quantity, 0, 99_999, existing.quantity)
            : existing.quantity,
        updatedAt: now,
      },
    }),
    prisma.pharmacy.update({
      where: { id: pharmacyId },
      data: { updatedAt: now },
    }),
  ]);

  return jsonOk({ state: await loadPublicState(auth) });
}

async function addStockMedicine(
  auth: AuthContext,
  body: Record<string, unknown>,
) {
  const pharmacyId = text(body.pharmacyId, 60);
  if (!ownedPharmacy(auth, pharmacyId)) {
    return jsonError(
      "Vous ne pouvez modifier que le stock de votre officine.",
      403,
    );
  }

  const pharmacy = await prisma.pharmacy.findUnique({
    where: { id: pharmacyId },
  });
  if (!pharmacy) return jsonError("Pharmacie introuvable.", 404);

  const input =
    body.input && typeof body.input === "object" && !Array.isArray(body.input)
      ? (body.input as Record<string, unknown>)
      : body;

  const requestedMedicineId = text(input.medicineId, 60);
  const quantity = integer(input.quantity, 0, 99_999, 0);
  const now = new Date();

  if (requestedMedicineId) {
    const medicine = await prisma.medicine.findUnique({
      where: { id: requestedMedicineId },
    });
    if (!medicine) return jsonError("Médicament introuvable.", 404);

    const duplicate = await prisma.stockItem.findUnique({
      where: {
        pharmacyId_medicineId: { pharmacyId, medicineId: requestedMedicineId },
      },
    });
    if (duplicate) {
      return jsonError("Ce médicament est déjà présent dans votre stock.", 409);
    }

    const price = integer(input.price, 0, 1_000_000, medicine.basePrice);
    await prisma.$transaction([
      prisma.stockItem.create({
        data: {
          pharmacyId,
          medicineId: medicine.id,
          price,
          quantity,
          updatedAt: now,
        },
      }),
      prisma.pharmacy.update({
        where: { id: pharmacyId },
        data: { updatedAt: now },
      }),
    ]);

    await logActivity(
      "stock",
      `${pharmacy.name} : ${medicine.name} ajouté au stock (${quantity}).`,
    );
    return jsonOk({ state: await loadPublicState(auth) });
  }

  const name = text(input.name, 120);
  const dci = text(input.dci, 120);
  const form = text(input.form, 120);
  const category = text(input.category, 80);

  if (!name || !dci || !form) {
    return jsonError("Indiquez le nom, la DCI et la forme du médicament.");
  }
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    return jsonError("Catégorie invalide.");
  }

  const price = integer(input.price, 0, 1_000_000, 0);
  const targetKey = `${normalize(name)}::${normalize(form)}`;
  const allMedicines = await prisma.medicine.findMany();
  let medicine = allMedicines.find(
    (item) => `${normalize(item.name)}::${normalize(item.form)}` === targetKey,
  );

  if (medicine) {
    const duplicate = await prisma.stockItem.findUnique({
      where: {
        pharmacyId_medicineId: { pharmacyId, medicineId: medicine.id },
      },
    });
    if (duplicate) {
      return jsonError("Ce médicament est déjà présent dans votre stock.", 409);
    }
  } else {
    medicine = await prisma.medicine.create({
      data: {
        id: `med_${randomUUID().slice(0, 8)}`,
        name,
        dci,
        form,
        category,
        basePrice: price,
      },
    });
  }

  await prisma.$transaction([
    prisma.stockItem.create({
      data: {
        pharmacyId,
        medicineId: medicine.id,
        price,
        quantity,
        updatedAt: now,
      },
    }),
    prisma.pharmacy.update({
      where: { id: pharmacyId },
      data: { updatedAt: now },
    }),
  ]);

  await logActivity(
    "stock",
    `${pharmacy.name} : ${medicine.name} ajouté au stock (${quantity}).`,
  );
  return jsonOk({ state: await loadPublicState(auth) });
}

async function removeStockItem(
  auth: AuthContext,
  body: Record<string, unknown>,
) {
  const pharmacyId = text(body.pharmacyId, 60);
  const medicineId = text(body.medicineId, 60);
  if (!ownedPharmacy(auth, pharmacyId)) {
    return jsonError(
      "Vous ne pouvez modifier que le stock de votre officine.",
      403,
    );
  }

  const existing = await prisma.stockItem.findUnique({
    where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
    include: { pharmacy: true, medicine: true },
  });
  if (!existing) return jsonError("Référence introuvable.", 404);

  const now = new Date();
  await prisma.$transaction([
    prisma.stockItem.delete({
      where: { pharmacyId_medicineId: { pharmacyId, medicineId } },
    }),
    prisma.pharmacy.update({
      where: { id: pharmacyId },
      data: { updatedAt: now },
    }),
  ]);

  await logActivity(
    "stock",
    `${existing.pharmacy.name} : ${existing.medicine.name} retiré du stock.`,
  );
  return jsonOk({ state: await loadPublicState(auth) });
}

async function publishStock(auth: AuthContext, body: Record<string, unknown>) {
  const pharmacyId = text(body.pharmacyId, 60);
  if (!ownedPharmacy(auth, pharmacyId)) {
    return jsonError("Action réservée à cette officine.", 403);
  }

  const pharmacy = await prisma.pharmacy.findUnique({
    where: { id: pharmacyId },
  });
  if (!pharmacy) return jsonError("Pharmacie introuvable.", 404);

  const now = new Date();
  await prisma.$transaction([
    prisma.stockItem.updateMany({
      where: { pharmacyId },
      data: { updatedAt: now },
    }),
    prisma.pharmacy.update({
      where: { id: pharmacyId },
      data: { updatedAt: now },
    }),
  ]);

  await logActivity(
    "stock",
    `${pharmacy.name} : inventaire confirmé et publié.`,
  );
  return jsonOk({ state: await loadPublicState(auth) });
}

async function toggleDuty(auth: AuthContext, body: Record<string, unknown>) {
  const pharmacyId = text(body.pharmacyId, 60);
  if (!ownedPharmacy(auth, pharmacyId)) {
    return jsonError("Action réservée à cette officine.", 403);
  }

  const pharmacy = await prisma.pharmacy.findUnique({
    where: { id: pharmacyId },
  });
  if (!pharmacy) return jsonError("Pharmacie introuvable.", 404);

  const nextDuty = !pharmacy.onDuty;
  const nextNote =
    typeof body.dutyNote === "string"
      ? text(body.dutyNote, 160)
      : pharmacy.dutyNote;

  await prisma.pharmacy.update({
    where: { id: pharmacyId },
    data: {
      onDuty: nextDuty,
      dutyNote: nextNote,
      updatedAt: new Date(),
    },
  });

  await logActivity(
    "pharmacy",
    `${pharmacy.name} ${nextDuty ? "signalée de garde" : "n'est plus de garde"}.`,
  );
  return jsonOk({ state: await loadPublicState(auth) });
}

async function bulkImportStock(
  auth: AuthContext,
  body: Record<string, unknown>,
) {
  const pharmacyId = text(body.pharmacyId, 60);
  if (!ownedPharmacy(auth, pharmacyId)) {
    return jsonError(
      "Vous ne pouvez importer que le stock de votre officine.",
      403,
    );
  }

  const pharmacy = await prisma.pharmacy.findUnique({
    where: { id: pharmacyId },
  });
  if (!pharmacy) return jsonError("Pharmacie introuvable.", 404);

  let rows: CsvStockRow[] = [];
  const parseErrors: string[] = [];

  if (typeof body.csv === "string") {
    const result = parseStockCsv(body.csv);
    rows = result.rows;
    parseErrors.push(...result.errors);
  } else if (Array.isArray(body.rows)) {
    if (body.rows.length > 200) {
      return jsonError("Import plafonné à 200 lignes maximum.");
    }
    body.rows.forEach((rawRow, idx) => {
      const parsed = bulkRowSchema.safeParse(rawRow);
      if (!parsed.success) {
        parseErrors.push(
          `Ligne ${idx + 1} : ${parsed.error.issues[0]?.message ?? "ligne invalide"}`,
        );
        return;
      }
      rows.push({
        line: parsed.data.line ?? idx + 1,
        name: parsed.data.name.trim(),
        dci: parsed.data.dci.trim(),
        form: parsed.data.form.trim(),
        category: parsed.data.category.trim(),
        price: Math.round(parsed.data.price),
        quantity: Math.round(parsed.data.quantity),
      });
    });
  } else {
    return jsonError("Fournissez un contenu CSV ou une liste de lignes.");
  }

  if (rows.length === 0) {
    return jsonError(parseErrors[0] ?? "Aucune ligne valide à importer.");
  }

  const summary: BulkImportSummary = {
    imported: 0,
    createdMedicines: 0,
    updated: 0,
    skipped: 0,
    errors: [...parseErrors],
  };

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const [allMedicines, currentStock] = await Promise.all([
      tx.medicine.findMany(),
      tx.stockItem.findMany({ where: { pharmacyId } }),
    ]);

    const byKey = new Map<string, (typeof allMedicines)[number]>();
    const byName = new Map<string, (typeof allMedicines)[number]>();
    for (const medicine of allMedicines) {
      byKey.set(
        `${normalize(medicine.name)}::${normalize(medicine.form)}`,
        medicine,
      );
      if (!byName.has(normalize(medicine.name))) {
        byName.set(normalize(medicine.name), medicine);
      }
    }

    const stockSet = new Set(currentStock.map((item) => item.medicineId));

    for (const row of rows.slice(0, 200)) {
      if (
        !Number.isFinite(row.price) ||
        row.price < 0 ||
        row.price > 1_000_000 ||
        !Number.isFinite(row.quantity) ||
        row.quantity < 0 ||
        row.quantity > 99_999
      ) {
        summary.skipped += 1;
        summary.errors.push(
          `Ligne ${row.line} (${row.name}) : prix ou quantité hors bornes.`,
        );
        continue;
      }

      const price = Math.round(row.price);
      const quantity = Math.round(row.quantity);
      const key = `${normalize(row.name)}::${normalize(row.form)}`;
      let medicine = row.form
        ? byKey.get(key)
        : byName.get(normalize(row.name));

      if (!medicine) {
        if (!row.dci || !row.form || !(CATEGORIES as readonly string[]).includes(row.category)) {
          summary.skipped += 1;
          summary.errors.push(
            `Ligne ${row.line} (${row.name}) : DCI, forme et catégorie valide requises pour créer une nouvelle référence.`,
          );
          continue;
        }
        medicine = await tx.medicine.create({
          data: {
            id: `med_${randomUUID().slice(0, 8)}`,
            name: row.name,
            dci: row.dci,
            form: row.form,
            category: row.category,
            basePrice: price,
          },
        });
        byKey.set(`${normalize(medicine.name)}::${normalize(medicine.form)}`, medicine);
        if (!byName.has(normalize(medicine.name))) {
          byName.set(normalize(medicine.name), medicine);
        }
        summary.createdMedicines += 1;
      }

      if (stockSet.has(medicine.id)) {
        await tx.stockItem.update({
          where: {
            pharmacyId_medicineId: { pharmacyId, medicineId: medicine.id },
          },
          data: { price, quantity, updatedAt: now },
        });
        summary.updated += 1;
      } else {
        await tx.stockItem.create({
          data: {
            pharmacyId,
            medicineId: medicine.id,
            price,
            quantity,
            updatedAt: now,
          },
        });
        stockSet.add(medicine.id);
        summary.imported += 1;
      }
    }

    await tx.pharmacy.update({
      where: { id: pharmacyId },
      data: { updatedAt: now },
    });
  });

  await logActivity(
    "stock",
    `${pharmacy.name} : import CSV (${summary.imported} ajoutés, ${summary.updated} mis à jour, ${summary.skipped} ignorés).`,
  );

  return jsonOk({
    state: await loadPublicState(auth),
    summary,
  });
}

async function setPharmacyVerification(
  auth: AuthContext,
  body: Record<string, unknown>,
) {
  if (!auth || auth.account.type !== "admin") {
    return jsonError("Action réservée à l'administrateur.", 403);
  }

  const parsed = parseZod(setVerificationSchema, body);
  if (!parsed.success) return jsonError(parsed.error);

  const { pharmacyId, status } = parsed.data;
  const pharmacy = await prisma.pharmacy.findUnique({
    where: { id: pharmacyId },
  });
  if (!pharmacy) return jsonError("Pharmacie introuvable.", 404);

  const now = new Date();
  await prisma.pharmacy.update({
    where: { id: pharmacyId },
    data: {
      verificationStatus: status,
      verifiedAt: status === "verified" ? now : null,
      updatedAt: now,
    },
  });

  const statusLabel =
    status === "verified"
      ? "vérifiée"
      : status === "suspended"
        ? "suspendue"
        : "en attente";
  await logActivity(
    "admin",
    `${pharmacy.name} : statut de vérification passé à « ${statusLabel} ».`,
  );

  return jsonOk({ state: await loadPublicState(auth) });
}

async function updateHospital(
  auth: AuthContext,
  body: Record<string, unknown>,
) {
  if (!FEATURES.hospitals) {
    return jsonError("Module urgences hospitalières désactivé.", 403);
  }
  const hospitalId = text(body.hospitalId, 60);
  if (!ownedHospital(auth, hospitalId)) {
    return jsonError("Vous ne pouvez modifier que votre établissement.", 403);
  }
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    include: { units: true },
  });
  if (!hospital) return jsonError("Hôpital introuvable.", 404);

  const patch = body.patch;
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    return jsonError("Modifications invalides.");
  }
  const values = patch as Record<string, unknown>;
  const allowed = ["name", "quartier", "address", "phone", "whatsapp"] as const;
  const cleaned: Partial<Record<(typeof allowed)[number], string>> = {};

  for (const field of allowed) {
    if (values[field] === undefined) continue;
    const value = text(values[field], field === "address" ? 180 : 120);
    if (field === "name" && !value) return jsonError("Le nom est obligatoire.");
    cleaned[field] = value;
  }

  const updated = await prisma.hospital.update({
    where: { id: hospitalId },
    data: {
      ...cleaned,
      updatedAt: new Date(),
    },
    include: { units: true },
  });

  return jsonOk({
    state: await loadPublicState(auth),
    hospital: {
      ...updated,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

async function updateUnit(auth: AuthContext, body: Record<string, unknown>) {
  if (!FEATURES.hospitals) {
    return jsonError("Module urgences hospitalières désactivé.", 403);
  }
  const hospitalId = text(body.hospitalId, 60);
  const unitId = text(body.unitId, 60);
  if (!ownedHospital(auth, hospitalId)) {
    return jsonError("Action réservée à cet hôpital.", 403);
  }

  const unit = await prisma.emergencyUnit.findUnique({
    where: { hospitalId_id: { hospitalId, id: unitId } },
    include: { hospital: true },
  });
  if (!unit) return jsonError("Service introuvable.", 404);

  const patch = (body.patch ?? {}) as Record<string, unknown>;
  const totalBeds =
    patch.totalBeds !== undefined
      ? integer(patch.totalBeds, 0, 999, unit.totalBeds)
      : unit.totalBeds;
  const occupiedBeds =
    patch.occupiedBeds !== undefined
      ? integer(patch.occupiedBeds, 0, totalBeds, unit.occupiedBeds)
      : Math.min(unit.occupiedBeds, totalBeds);
  const waitingMinutes =
    patch.waitingMinutes !== undefined
      ? integer(patch.waitingMinutes, 0, 600, unit.waitingMinutes)
      : unit.waitingMinutes;
  const label =
    patch.label !== undefined
      ? text(patch.label, 80) || unit.label
      : unit.label;

  const freeBefore = unitAvailable(unit);
  const freeAfter = unitAvailable({
    id: unit.id,
    label,
    totalBeds,
    occupiedBeds,
    waitingMinutes,
  });

  await prisma.$transaction([
    prisma.emergencyUnit.update({
      where: { hospitalId_id: { hospitalId, id: unitId } },
      data: { label, totalBeds, occupiedBeds, waitingMinutes },
    }),
    prisma.hospital.update({
      where: { id: hospitalId },
      data: { updatedAt: new Date() },
    }),
  ]);

  if (freeBefore === 0 && freeAfter > 0) {
    await logActivity(
      "beds",
      `${unit.hospital.name} : ${label} repasse à ${freeAfter} lit${freeAfter > 1 ? "s" : ""} libre${freeAfter > 1 ? "s" : ""}.`,
    );
  } else if (freeBefore > 0 && freeAfter === 0) {
    await logActivity(
      "beds",
      `${unit.hospital.name} : ${label} affiché complet aux patients.`,
    );
  }

  return jsonOk({ state: await loadPublicState(auth) });
}

async function addUnit(auth: AuthContext, body: Record<string, unknown>) {
  if (!FEATURES.hospitals) {
    return jsonError("Module urgences hospitalières désactivé.", 403);
  }
  const hospitalId = text(body.hospitalId, 60);
  if (!ownedHospital(auth, hospitalId)) {
    return jsonError("Action réservée à cet hôpital.", 403);
  }
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    include: { units: true },
  });
  if (!hospital) return jsonError("Hôpital introuvable.", 404);

  const input = (body.input ?? {}) as Record<string, unknown>;
  const label = text(input.label, 80);
  if (!label) return jsonError("Indiquez le nom du service.");
  if (
    hospital.units.some(
      (unit) => unit.label.toLowerCase() === label.toLowerCase(),
    )
  ) {
    return jsonError("Ce service est déjà déclaré pour cet hôpital.", 409);
  }

  const totalBeds = integer(input.totalBeds, 1, 999, 8);
  const id = serviceId(
    label,
    hospital.units.map((item) => item.id),
  );

  await prisma.$transaction([
    prisma.emergencyUnit.create({
      data: {
        id,
        hospitalId,
        label,
        totalBeds,
        occupiedBeds: integer(input.occupiedBeds, 0, totalBeds, 0),
        waitingMinutes: integer(input.waitingMinutes, 0, 600, 15),
      },
    }),
    prisma.hospital.update({
      where: { id: hospitalId },
      data: { updatedAt: new Date() },
    }),
  ]);

  await logActivity(
    "beds",
    `${hospital.name} : nouveau service « ${label} » (${totalBeds} lits).`,
  );
  return jsonOk({ state: await loadPublicState(auth) });
}

async function removeUnit(auth: AuthContext, body: Record<string, unknown>) {
  if (!FEATURES.hospitals) {
    return jsonError("Module urgences hospitalières désactivé.", 403);
  }
  const hospitalId = text(body.hospitalId, 60);
  const unitId = text(body.unitId, 60);
  if (!ownedHospital(auth, hospitalId)) {
    return jsonError("Action réservée à cet hôpital.", 403);
  }
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    include: { units: true },
  });
  if (!hospital) return jsonError("Hôpital introuvable.", 404);
  if (hospital.units.length <= 1) {
    return jsonError("Un hôpital doit conserver au moins un service.", 409);
  }
  const unit = hospital.units.find((item) => item.id === unitId);
  if (!unit) return jsonError("Service introuvable.", 404);

  await prisma.$transaction([
    prisma.emergencyUnit.delete({
      where: { hospitalId_id: { hospitalId, id: unitId } },
    }),
    prisma.hospital.update({
      where: { id: hospitalId },
      data: { updatedAt: new Date() },
    }),
  ]);

  await logActivity(
    "beds",
    `${hospital.name} : service « ${unit.label} » retiré de l'affichage.`,
  );
  return jsonOk({ state: await loadPublicState(auth) });
}

async function publishBeds(auth: AuthContext, body: Record<string, unknown>) {
  if (!FEATURES.hospitals) {
    return jsonError("Module urgences hospitalières désactivé.", 403);
  }
  const hospitalId = text(body.hospitalId, 60);
  if (!ownedHospital(auth, hospitalId)) {
    return jsonError("Action réservée à cet hôpital.", 403);
  }
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
  });
  if (!hospital) return jsonError("Hôpital introuvable.", 404);

  await prisma.hospital.update({
    where: { id: hospitalId },
    data: { updatedAt: new Date() },
  });

  await logActivity(
    "beds",
    `${hospital.name} : disponibilités des urgences mises à jour.`,
  );
  return jsonOk({ state: await loadPublicState(auth) });
}
