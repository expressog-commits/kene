import { FEATURES } from "@/lib/features";
import {
  buildProductionExtraStock,
  DEMO_ACCOUNTS,
  MEDICINES,
  PRODUCTION_EXTRA_PHARMACIES,
  seedState,
} from "@/lib/seed";
import type {
  ActivityItem,
  AppState,
  DemoAccount,
  Hospital,
  Medicine,
  Pharmacy,
  ProfessionalAccount,
  ProfessionalType,
  VerificationStatus,
} from "@/lib/types";
import { createSalt, hashAccessCode } from "./crypto";
import { prisma } from "./prisma";

export interface AccountRecord extends ProfessionalAccount {
  codeHash: string;
  codeSalt: string;
  recoveryHash: string;
  recoverySalt: string;
}

export interface SessionRecord {
  tokenHash: string;
  accountId: string;
  createdAt: string;
  expiresAt: string;
}

export interface OutboxItem {
  id: string;
  to: string;
  accountId: string;
  managerName: string;
  establishmentName: string;
  recoveryCode: string;
  kind: "created" | "reset";
  attempts: number;
  nextAttemptAt: string;
  createdAt: string;
  lastError?: string;
}

const shared = globalThis as typeof globalThis & {
  __keneSeedPromise?: Promise<void>;
  __keneCatalogPromise?: Promise<void>;
  __keneCatalogSynced?: boolean;
};

function buildSeedAccounts() {
  return DEMO_ACCOUNTS.map((account) => {
    const codeSalt = createSalt();
    const recoverySalt = createSalt();
    return {
      id: account.id,
      type: account.type,
      establishmentId: account.establishmentId,
      email: account.email,
      managerName: account.managerName,
      role: account.role,
      createdAt: new Date(account.createdAt),
      lastLoginAt: null,
      codeSalt,
      codeHash: hashAccessCode(account.accessCode, codeSalt),
      recoverySalt,
      recoveryHash: hashAccessCode(account.recoveryCode, recoverySalt),
    };
  });
}

export async function resetDatabase(): Promise<void> {
  const seed = seedState();
  const accounts = buildSeedAccounts();

  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany();
    await tx.outboxEmail.deleteMany();
    await tx.stockItem.deleteMany();
    await tx.emergencyUnit.deleteMany();
    await tx.activityLog.deleteMany();
    await tx.account.deleteMany();
    await tx.appSetting.deleteMany();
    await tx.pharmacy.deleteMany();
    await tx.medicine.deleteMany();
    await tx.hospital.deleteMany();

    await tx.pharmacy.createMany({
      data: seed.pharmacies.map((pharmacy) => ({
        id: pharmacy.id,
        name: pharmacy.name,
        quartier: pharmacy.quartier,
        address: pharmacy.address,
        phone: pharmacy.phone,
        whatsapp: pharmacy.whatsapp,
        distanceKm: pharmacy.distanceKm,
        latitude: pharmacy.latitude,
        longitude: pharmacy.longitude,
        openFrom: pharmacy.openFrom,
        openTo: pharmacy.openTo,
        onDuty: pharmacy.onDuty,
        dutyNote: pharmacy.dutyNote,
        verificationStatus: pharmacy.verificationStatus,
        licenseNumber: pharmacy.licenseNumber,
        verifiedAt: pharmacy.verifiedAt ? new Date(pharmacy.verifiedAt) : null,
        updatedAt: pharmacy.updatedAt ? new Date(pharmacy.updatedAt) : new Date(),
      })),
    });

    await tx.medicine.createMany({
      data: seed.medicines.map((medicine) => ({
        id: medicine.id,
        name: medicine.name,
        dci: medicine.dci,
        form: medicine.form,
        category: medicine.category,
        basePrice: medicine.basePrice,
      })),
    });

    await tx.stockItem.createMany({
      data: seed.stock.map((item) => ({
        pharmacyId: item.pharmacyId,
        medicineId: item.medicineId,
        price: item.price,
        quantity: item.quantity,
        updatedAt: new Date(item.updatedAt),
      })),
    });

    await tx.hospital.createMany({
      data: seed.hospitals.map((hospital) => ({
        id: hospital.id,
        name: hospital.name,
        quartier: hospital.quartier,
        address: hospital.address,
        phone: hospital.phone,
        whatsapp: hospital.whatsapp,
        distanceKm: hospital.distanceKm,
        latitude: hospital.latitude,
        longitude: hospital.longitude,
        updatedAt: new Date(hospital.updatedAt),
      })),
    });

    await tx.emergencyUnit.createMany({
      data: seed.hospitals.flatMap((hospital) =>
        hospital.units.map((unit) => ({
          id: unit.id,
          hospitalId: hospital.id,
          label: unit.label,
          totalBeds: unit.totalBeds,
          occupiedBeds: unit.occupiedBeds,
          waitingMinutes: unit.waitingMinutes,
        })),
      ),
    });

    await tx.appSetting.create({
      data: {
        id: "default",
        activePharmacyId: seed.settings.activePharmacyId,
        activeHospitalId: seed.settings.activeHospitalId,
        plan: seed.settings.plan,
      },
    });

    await tx.activityLog.createMany({
      data: seed.activity.map((entry) => ({
        id: entry.id,
        at: new Date(entry.at),
        kind: entry.kind,
        label: entry.label,
      })),
    });

    await tx.account.createMany({
      data: accounts,
    });
  });

  shared.__keneCatalogSynced = false;
}

export async function ensureProductionCatalog(): Promise<void> {
  if (shared.__keneCatalogSynced) {
    return;
  }
  if (shared.__keneCatalogPromise) {
    return shared.__keneCatalogPromise;
  }

  const run = (async () => {
    const isPostgres = (process.env.DATABASE_URL ?? "").startsWith("postgres");
    const now = Date.now();

    for (const medicine of MEDICINES) {
      await prisma.medicine.upsert({
        where: { id: medicine.id },
        update: { dci: medicine.dci },
        create: {
          id: medicine.id,
          name: medicine.name,
          dci: medicine.dci,
          form: medicine.form,
          category: medicine.category,
          basePrice: medicine.basePrice,
        },
      });
    }

    const extraIds = PRODUCTION_EXTRA_PHARMACIES.map((pharmacy) => pharmacy.id);
    const existingPharmacies = await prisma.pharmacy.findMany({
      where: { id: { in: extraIds } },
      select: { id: true },
    });
    const existingPharmacySet = new Set(existingPharmacies.map((row) => row.id));

    const missingPharmacies = PRODUCTION_EXTRA_PHARMACIES.filter(
      (pharmacy) => !existingPharmacySet.has(pharmacy.id),
    ).map((pharmacy, index) => ({
      id: pharmacy.id,
      name: pharmacy.name,
      quartier: pharmacy.quartier,
      address: pharmacy.address,
      phone: pharmacy.phone,
      whatsapp: pharmacy.whatsapp,
      distanceKm: pharmacy.distanceKm,
      latitude: pharmacy.latitude,
      longitude: pharmacy.longitude,
      openFrom: pharmacy.openFrom,
      openTo: pharmacy.openTo,
      onDuty: pharmacy.onDuty,
      dutyNote: pharmacy.dutyNote,
      verificationStatus: pharmacy.verificationStatus,
      licenseNumber: pharmacy.licenseNumber,
      verifiedAt: pharmacy.verifiedAt ? new Date(pharmacy.verifiedAt) : null,
      updatedAt: pharmacy.updatedAt
        ? new Date(pharmacy.updatedAt)
        : new Date(now - (index + 1) * 30 * 60_000),
    }));

    if (missingPharmacies.length > 0) {
      const pharmacyCreateArgs = (
        isPostgres
          ? { data: missingPharmacies, skipDuplicates: true }
          : { data: missingPharmacies }
      ) as Parameters<typeof prisma.pharmacy.createMany>[0];
      await prisma.pharmacy.createMany(pharmacyCreateArgs);
    }

    const extraStock = buildProductionExtraStock(now);
    const existingStock = await prisma.stockItem.findMany({
      where: { pharmacyId: { in: extraIds } },
      select: { pharmacyId: true, medicineId: true },
    });
    const existingStockKeys = new Set(
      existingStock.map((item) => `${item.pharmacyId}:${item.medicineId}`),
    );
    const missingStock = extraStock
      .filter(
        (item) => !existingStockKeys.has(`${item.pharmacyId}:${item.medicineId}`),
      )
      .map((item) => ({
        pharmacyId: item.pharmacyId,
        medicineId: item.medicineId,
        price: item.price,
        quantity: item.quantity,
        updatedAt: new Date(item.updatedAt),
      }));

    if (missingStock.length > 0) {
      const stockCreateArgs = (
        isPostgres
          ? { data: missingStock, skipDuplicates: true }
          : { data: missingStock }
      ) as Parameters<typeof prisma.stockItem.createMany>[0];
      await prisma.stockItem.createMany(stockCreateArgs);
    }

    shared.__keneCatalogSynced = true;
  })();

  shared.__keneCatalogPromise = run;
  try {
    await run;
  } finally {
    shared.__keneCatalogPromise = undefined;
  }
}

export async function ensureSeeded(): Promise<void> {
  if (shared.__keneSeedPromise) {
    return shared.__keneSeedPromise;
  }

  const run = (async () => {
    const [setting, pharmacyCount] = await Promise.all([
      prisma.appSetting.findUnique({ where: { id: "default" } }),
      prisma.pharmacy.count(),
    ]);
    if (!setting || pharmacyCount === 0) {
      await resetDatabase();
    }
    await ensureProductionCatalog();
  })();

  shared.__keneSeedPromise = run;
  try {
    await run;
  } finally {
    shared.__keneSeedPromise = undefined;
  }
}

export function mapAccountRecord(account: {
  id: string;
  type: string;
  establishmentId: string;
  email: string;
  managerName: string;
  role: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  codeHash: string;
  codeSalt: string;
  recoveryHash: string;
  recoverySalt: string;
}): AccountRecord {
  return {
    id: account.id,
    type: account.type as ProfessionalType,
    establishmentId: account.establishmentId,
    email: account.email,
    managerName: account.managerName,
    role: account.role,
    createdAt: account.createdAt.toISOString(),
    lastLoginAt: account.lastLoginAt ? account.lastLoginAt.toISOString() : undefined,
    codeHash: account.codeHash,
    codeSalt: account.codeSalt,
    recoveryHash: account.recoveryHash,
    recoverySalt: account.recoverySalt,
  };
}

export async function loadPublicState(
  auth: { account: AccountRecord } | null,
): Promise<AppState> {
  await ensureSeeded();

  const pharmacyWhere =
    auth?.account.type === "admin"
      ? undefined
      : auth?.account.type === "pharmacy"
        ? {
            OR: [
              { verificationStatus: "verified" },
              { id: auth.account.establishmentId },
            ],
          }
        : { verificationStatus: "verified" };

  const [pharmaciesRaw, medicinesRaw, hospitalsRaw, settingsRow, activityRaw] =
    await Promise.all([
      prisma.pharmacy.findMany({
        where: pharmacyWhere,
        orderBy: [{ distanceKm: "asc" }, { name: "asc" }],
      }),
      prisma.medicine.findMany(),
      FEATURES.hospitals
        ? prisma.hospital.findMany({
            include: { units: true },
            orderBy: [{ distanceKm: "asc" }, { name: "asc" }],
          })
        : Promise.resolve([]),
      prisma.appSetting.findUnique({ where: { id: "default" } }),
      prisma.activityLog.findMany({
        where: FEATURES.hospitals ? undefined : { kind: { not: "beds" } },
        orderBy: { at: "desc" },
        take: 40,
      }),
    ]);

  const pharmacies: Pharmacy[] = pharmaciesRaw.map((pharmacy) => ({
    id: pharmacy.id,
    name: pharmacy.name,
    quartier: pharmacy.quartier,
    address: pharmacy.address,
    phone: pharmacy.phone,
    whatsapp: pharmacy.whatsapp,
    distanceKm: pharmacy.distanceKm,
    latitude: pharmacy.latitude,
    longitude: pharmacy.longitude,
    openFrom: pharmacy.openFrom,
    openTo: pharmacy.openTo,
    onDuty: pharmacy.onDuty,
    dutyNote: pharmacy.dutyNote,
    verificationStatus: pharmacy.verificationStatus as VerificationStatus,
    licenseNumber: pharmacy.licenseNumber,
    verifiedAt: pharmacy.verifiedAt
      ? pharmacy.verifiedAt.toISOString()
      : undefined,
    updatedAt: pharmacy.updatedAt.toISOString(),
  }));

  const pharmacyIds = pharmacies.map((p) => p.id);
  const stockRaw = pharmacyIds.length
    ? await prisma.stockItem.findMany({
        where: { pharmacyId: { in: pharmacyIds } },
      })
    : [];

  const medicines: Medicine[] = medicinesRaw.map((medicine) => ({
    id: medicine.id,
    name: medicine.name,
    dci: medicine.dci,
    form: medicine.form,
    category: medicine.category,
    basePrice: medicine.basePrice,
  }));

  const hospitals: Hospital[] = hospitalsRaw.map((hospital) => ({
    id: hospital.id,
    name: hospital.name,
    quartier: hospital.quartier,
    address: hospital.address,
    phone: hospital.phone,
    whatsapp: hospital.whatsapp,
    distanceKm: hospital.distanceKm,
    latitude: hospital.latitude,
    longitude: hospital.longitude,
    updatedAt: hospital.updatedAt.toISOString(),
    units: hospital.units.map((unit) => ({
      id: unit.id,
      label: unit.label,
      totalBeds: unit.totalBeds,
      occupiedBeds: unit.occupiedBeds,
      waitingMinutes: unit.waitingMinutes,
    })),
  }));

  return {
    pharmacies,
    medicines,
    hospitals,
    stock: stockRaw.map((item) => ({
      pharmacyId: item.pharmacyId,
      medicineId: item.medicineId,
      price: item.price,
      quantity: item.quantity,
      updatedAt: item.updatedAt.toISOString(),
    })),
    settings: settingsRow
      ? {
          activePharmacyId: settingsRow.activePharmacyId,
          activeHospitalId: settingsRow.activeHospitalId,
          plan: settingsRow.plan,
        }
      : {
          activePharmacyId: "ph_rondpoint",
          activeHospitalId: "hos_cocody",
          plan: "Pharmacie Pro",
        },
    activity: activityRaw.map((entry) => ({
      id: entry.id,
      at: entry.at.toISOString(),
      kind: entry.kind as ActivityItem["kind"],
      label: entry.label,
    })),
  };
}

export async function getClaimedEstablishmentIds(): Promise<string[]> {
  const rows = await prisma.account.findMany({
    where: { establishmentId: { not: "" } },
    select: { establishmentId: true },
  });
  return rows.map((row) => row.establishmentId);
}

export function getVisibleDemoAccounts(): DemoAccount[] {
  if (!FEATURES.showDemoAccounts) return [];
  return DEMO_ACCOUNTS.filter(
    (account) => FEATURES.hospitals || account.type !== "hospital",
  );
}
